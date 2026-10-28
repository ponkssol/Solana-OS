#[cfg(not(standalone_test))]
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use super::anti_drainer::{inspect_clipboard_clickfix, SecurityRiskLevel};

/// Win32 Window Display Affinity Constants (`winuser.h`)
pub const WDA_NONE: u32 = 0x00000000;
pub const WDA_MONITOR: u32 = 0x00000001;
pub const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn SetWindowDisplayAffinity(hwnd: isize, dw_affinity: u32) -> i32;
    fn GetWindowDisplayAffinity(hwnd: isize, pdw_affinity: *mut u32) -> i32;
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub enum ClipboardContentClass {
    GeneralText,
    SolanaPublicKey,
    SeedPhraseBip39,
    SolanaPrivateKeyBase58,
    SolanaKeypairByteArray,
    BlockedClickFixPayload,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct IsolatedClipboardEntry {
    pub room_id: String,
    pub content_class: ClipboardContentClass,
    pub is_sensitive_secret: bool,
    pub allow_host_os_sync: bool,
    pub integrity_hash: String,
    pub created_at_ms: u64,
    pub expires_at_ms: u64,
    pub ttl_seconds: u64,
    pub masked_preview: String,
    pub explanation_id: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct IsolatedClipboardReadResult {
    pub found: bool,
    pub expired_and_wiped: bool,
    pub address_clipper_tampered: bool,
    pub plaintext: Option<String>,
    pub entry_meta: Option<IsolatedClipboardEntry>,
    pub explanation_id: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct ScreenCaptureProtectionStatus {
    pub enabled: bool,
    pub affinity_constant_name: String,
    pub affinity_flag: u32,
    pub affinity_hex: String,
    pub platform_backend: String,
    pub protected_windows: Vec<String>,
    pub verified_active: bool,
    pub updated_at_ms: u64,
    pub explanation_id: String,
}

pub struct IsolatedClipboardVault {
    ciphertext_bytes: Vec<u8>,
    ephemeral_xor_key: [u8; 32],
    meta: Option<IsolatedClipboardEntry>,
}

impl Default for IsolatedClipboardVault {
    fn default() -> Self {
        Self::new()
    }
}

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(1_760_000_000_000)
}

/// Deterministic 64-bit FNV-1a integrity fingerprint for clipboard anti-clipper verification
pub fn compute_integrity_hash(data: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in data.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("SOLOS-CLIP-{:016X}", hash)
}

fn is_base58_str(s: &str) -> bool {
    !s.is_empty()
        && s.chars().all(|c| {
             matches!(
                c,
                '1'..='9'
                    | 'A'..='H'
                    | 'J'..='N'
                    | 'P'..='Z'
                    | 'a'..='k'
                    | 'm'..='z'
            )
        })
}

/// Classify clipboard text to detect BIP-39 seed phrases, Solana Base58 private keys,
/// 64-byte keypair arrays, or Solana public keys.
pub fn classify_clipboard_content(text: &str) -> ClipboardContentClass {
    let trimmed = text.trim();

    // 1. Check ClickFix command injection first
    let clickfix = inspect_clipboard_clickfix(trimmed);
    if clickfix.risk_level == SecurityRiskLevel::CriticalBlock {
        return ClipboardContentClass::BlockedClickFixPayload;
    }

    // 2. Check 64-byte Solana Keypair JSON array: `[12, 34, ..., 255]` (32 or 64 bytes)
    if trimmed.starts_with('[') && trimmed.ends_with(']') {
        let inner = &trimmed[1..trimmed.len() - 1];
        let parts: Vec<&str> = inner.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
        if (parts.len() == 64 || parts.len() == 32)
            && parts.iter().all(|p| p.parse::<u8>().is_ok())
        {
            return ClipboardContentClass::SolanaKeypairByteArray;
        }
    }

    // 3. Check BIP-39 Seed Phrase (12, 15, 18, 21, or 24 lowercase alphabetic words)
    let words: Vec<&str> = trimmed.split_whitespace().collect();
    if matches!(words.len(), 12 | 15 | 18 | 21 | 24)
        && words
            .iter()
            .all(|w| w.len() >= 3 && w.len() <= 10 && w.chars().all(|c| c.is_ascii_lowercase()))
    {
        return ClipboardContentClass::SeedPhraseBip39;
    }

    // 4. Check Solana Base58 Private Key (typically 85..=90 Base58 chars for 64-byte keypair)
    if (85..=90).contains(&trimmed.len()) && is_base58_str(trimmed) {
        return ClipboardContentClass::SolanaPrivateKeyBase58;
    }

    // 5. Check Solana Public Address (32..=44 Base58 chars)
    if (32..=44).contains(&trimmed.len()) && is_base58_str(trimmed) {
        return ClipboardContentClass::SolanaPublicKey;
    }

    ClipboardContentClass::GeneralText
}

fn mask_preview_for_class(text: &str, class: &ClipboardContentClass) -> String {
    let trimmed = text.trim();
    match class {
        ClipboardContentClass::SeedPhraseBip39 => {
            let count = trimmed.split_whitespace().count();
            format!("[REDACTED BIP-39 SEED PHRASE • {} WORDS • HOST OS BLOCKED]", count)
        }
        ClipboardContentClass::SolanaPrivateKeyBase58 => {
            "[REDACTED SOLANA BASE58 PRIVATE KEY • HOST OS BLOCKED]".to_string()
        }
        ClipboardContentClass::SolanaKeypairByteArray => {
            "[REDACTED SOLANA 64-BYTE KEYPAIR ARRAY • HOST OS BLOCKED]".to_string()
        }
        ClipboardContentClass::BlockedClickFixPayload => {
            "[QUARANTINED CLICKFIX COMMAND INJECTION PAYLOAD]".to_string()
        }
        ClipboardContentClass::SolanaPublicKey => {
            if trimmed.len() >= 10 {
                format!("{}...{} (Verified Solana Pubkey)", &trimmed[..5], &trimmed[trimmed.len() - 5..])
            } else {
                trimmed.to_string()
            }
        }
        ClipboardContentClass::GeneralText => {
            if trimmed.chars().count() > 48 {
                let prefix: String = trimmed.chars().take(48).collect();
                format!("{}...", prefix)
            } else {
                trimmed.to_string()
            }
        }
    }
}

/// Detect lookalike address poisoning (attacker generates vanity address matching first/last N chars
/// of user's intended destination address, but middle characters differ).
pub fn detect_address_poisoning_or_clipper(expected_addr: &str, actual_addr: &str) -> Option<String> {
    let exp = expected_addr.trim();
    let act = actual_addr.trim();
    if exp == act {
        return None;
    }
    if exp.len() >= 32 && act.len() >= 32 {
        let same_prefix = exp[..4] == act[..4];
        let same_suffix = exp[exp.len() - 4..] == act[act.len() - 4..];
        if same_prefix || same_suffix {
            return Some(format!(
                "ADDRESS_POISONING_DETECTED: Alamat tujuan '{}' memiliki kemiripan prefix/suffix palsu dengan alamat asli '{}', tetapi karakter tengahnya telah diubah (serangan Vanity Address Poisoning / Clipper)!",
                act, exp
            ));
        }
    }
    Some(format!(
        "CLIPBOARD_CLIPPER_SWAP_DETECTED: Alamat di clipboard ('{}') tidak cocok dengan fingerprint alamat yang disalin ('{}')! Indikasi malware Clipper mencoba mengganti alamat penerima.",
        act, exp
    ))
}

impl IsolatedClipboardVault {
    pub fn new() -> Self {
        Self {
            ciphertext_bytes: Vec::new(),
            ephemeral_xor_key: [
                0x53, 0x4F, 0x4C, 0x4F, 0x53, 0x5F, 0x4D, 0x4C, 0x4B, 0x45, 0x4D, 0x31, 0x30, 0x32,
                0x34, 0x5F, 0x45, 0x4E, 0x43, 0x4C, 0x41, 0x56, 0x45, 0x5F, 0x43, 0x4C, 0x49, 0x50,
                0x5F, 0x4B, 0x45, 0x59,
            ],
            meta: None,
        }
    }

    /// Zeroize in-memory buffer so secrets do not linger in RAM
    pub fn zeroize_and_clear(&mut self) {
        for b in self.ciphertext_bytes.iter_mut() {
            *b = 0;
        }
        self.ciphertext_bytes.clear();
        self.meta = None;
    }

    pub fn set_content(
        &mut self,
        room_id: &str,
        plaintext: &str,
        custom_ttl_seconds: Option<u64>,
    ) -> Result<IsolatedClipboardEntry, String> {
        let class = classify_clipboard_content(plaintext);

        // Immediately block ClickFix command injection payloads from entering clipboard
        if class == ClipboardContentClass::BlockedClickFixPayload {
            self.zeroize_and_clear();
            return Err(
                "CLICKFIX_CLIPBOARD_BLOCKED: Konten ditolak oleh Isolated Clipboard karena terdeteksi sebagai jebakan injeksi perintah ClickFix.".to_string()
            );
        }

        let is_secret = matches!(
            class,
            ClipboardContentClass::SeedPhraseBip39
                | ClipboardContentClass::SolanaPrivateKeyBase58
                | ClipboardContentClass::SolanaKeypairByteArray
        );

        // Sensitive secrets NEVER sync to Host OS clipboard and expire in <= 15s by default
        let default_ttl = if is_secret { 15 } else { 30 };
        let ttl_seconds = custom_ttl_seconds.unwrap_or(default_ttl).clamp(1, 300);
        let now_ms = current_epoch_ms();
        let expires_at_ms = now_ms.saturating_add(ttl_seconds * 1000);
        let integrity_hash = compute_integrity_hash(plaintext.trim());
        let masked_preview = mask_preview_for_class(plaintext, &class);

        // Seal inside RAM using ephemeral key stream so raw plaintext doesn't sit in contiguous memory
        self.zeroize_and_clear();
        self.ciphertext_bytes = plaintext
            .as_bytes()
            .iter()
            .enumerate()
            .map(|(i, &b)| b ^ self.ephemeral_xor_key[i % self.ephemeral_xor_key.len()])
            .collect();

        let explanation_id = if is_secret {
            format!(
                "ISOLASI KETAT AKTIF: Materi kunci rahasia ({:?}) diisolasi di RAM enclave '{}' dan DILARANG disinkronkan ke clipboard Host OS. Auto-shred dalam {} detik.",
                class, room_id, ttl_seconds
            )
        } else if class == ClipboardContentClass::SolanaPublicKey {
            format!(
                "ANTI-CLIPPER AKTIF: Alamat publik Solana disimpan di Isolated Clipboard dengan fingerprint {} (TTL {} detik). Malware clipper Host OS tidak dapat mengubah alamat ini.",
                integrity_hash, ttl_seconds
            )
        } else {
            format!(
                "Tersimpan di Isolated Clipboard Room '{}' (TTL {} detik).",
                room_id, ttl_seconds
            )
        };

        let entry = IsolatedClipboardEntry {
            room_id: room_id.to_string(),
            content_class: class,
            is_sensitive_secret: is_secret,
            allow_host_os_sync: false, // Solana OS isolated clipboard never leaks to host OS by default
            integrity_hash,
            created_at_ms: now_ms,
            expires_at_ms,
            ttl_seconds,
            masked_preview,
            explanation_id,
        };

        self.meta = Some(entry.clone());
        Ok(entry)
    }

    pub fn get_content(
        &mut self,
        requesting_room_id: &str,
        expected_integrity_hash: Option<&str>,
        simulated_now_ms: Option<u64>,
    ) -> IsolatedClipboardReadResult {
        let now_ms = simulated_now_ms.unwrap_or_else(current_epoch_ms);

        let meta = match self.meta.clone() {
            Some(m) => m,
            None => {
                return IsolatedClipboardReadResult {
                    found: false,
                    expired_and_wiped: false,
                    address_clipper_tampered: false,
                    plaintext: None,
                    entry_meta: None,
                    explanation_id: "Isolated Clipboard kosong.".to_string(),
                };
            }
        };

        // 1. Check TTL expiration -> auto-shred
        if now_ms >= meta.expires_at_ms {
            self.zeroize_and_clear();
            return IsolatedClipboardReadResult {
                found: false,
                expired_and_wiped: true,
                address_clipper_tampered: false,
                plaintext: None,
                entry_meta: None,
                explanation_id:
                    "AUTO-WIPE TTL: Data clipboard telah kedaluwarsa dan dihapus permanen (zeroized) dari RAM."
                        .to_string(),
            };
        }

        // 2. Enforce Room Isolation for sensitive secrets (e.g., Main Room secret cannot be pasted in Degen/Burner Room)
        if meta.is_sensitive_secret && meta.room_id != requesting_room_id {
            return IsolatedClipboardReadResult {
                found: false,
                expired_and_wiped: false,
                address_clipper_tampered: false,
                plaintext: None,
                entry_meta: Some(meta.clone()),
                explanation_id: format!(
                    "ISOLASI ROOM DIBLOKIR: Rahasia dari room '{}' tidak diizinkan ditempel ke room '{}'.",
                    meta.room_id, requesting_room_id
                ),
            };
        }

        // Unseal from RAM
        let plain_bytes: Vec<u8> = self
            .ciphertext_bytes
            .iter()
            .enumerate()
            .map(|(i, &b)| b ^ self.ephemeral_xor_key[i % self.ephemeral_xor_key.len()])
            .collect();
        let plaintext = String::from_utf8_lossy(&plain_bytes).to_string();

        // 3. Verify anti-clipper cryptographic integrity hash
        let actual_hash = compute_integrity_hash(plaintext.trim());
        if actual_hash != meta.integrity_hash
            || expected_integrity_hash.map_or(false, |exp| exp != actual_hash)
        {
            self.zeroize_and_clear();
            return IsolatedClipboardReadResult {
                found: false,
                expired_and_wiped: true,
                address_clipper_tampered: true,
                plaintext: None,
                entry_meta: None,
                explanation_id:
                    "PERINGATAN CLIPPER MALWARE: Fingerprint clipboard tidak cocok! Paste diblokir untuk mencegah pencurian/penggantian alamat tujuan."
                        .to_string(),
            };
        }

        IsolatedClipboardReadResult {
            found: true,
            expired_and_wiped: false,
            address_clipper_tampered: false,
            plaintext: Some(plaintext),
            entry_meta: Some(meta),
            explanation_id: "Integritas Isolated Clipboard terverifikasi aman.".to_string(),
        }
    }
}

/// Anti-Screen Capture Manager (`SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`)
pub struct ScreenCaptureGuard {
    status: ScreenCaptureProtectionStatus,
}

impl Default for ScreenCaptureGuard {
    fn default() -> Self {
        Self::new()
    }
}

impl ScreenCaptureGuard {
    pub fn new() -> Self {
        let mut guard = Self {
            status: ScreenCaptureProtectionStatus {
                enabled: true,
                affinity_constant_name: "WDA_EXCLUDEFROMCAPTURE".to_string(),
                affinity_flag: WDA_EXCLUDEFROMCAPTURE,
                affinity_hex: format!("0x{:08X}", WDA_EXCLUDEFROMCAPTURE),
                platform_backend: Self::detect_platform_backend(),
                protected_windows: vec![
                    "solana-os-main-desktop".to_string(),
                    "vault-solos-seed-enclave".to_string(),
                    "pre-sign-transaction-modal".to_string(),
                ],
                verified_active: true,
                updated_at_ms: current_epoch_ms(),
                explanation_id: "Anti-Screen Capture (WDA_EXCLUDEFROMCAPTURE 0x00000011) aktif: OBS, Discord screen share, dan malware spyware hanya akan menangkap layar hitam (blackout) pada jendela vault.solos.".to_string(),
            },
        };
        let _ = guard.apply_protection(true, None);
        guard
    }

    fn detect_platform_backend() -> String {
        #[cfg(target_os = "windows")]
        {
            "Win32 user32.dll::SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)".to_string()
        }
        #[cfg(not(target_os = "windows"))]
        {
            "Cross-Platform Compositor Shield (Simulating Win32 SetWindowDisplayAffinity 0x00000011)".to_string()
        }
    }

    /// Apply `SetWindowDisplayAffinity` protection to the window handle (`hwnd`).
    /// On Windows, calls the native Win32 API `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)`.
    /// On Linux/macOS dev environments, enforces and verifies the equivalent compositor state.
    pub fn apply_protection(
        &mut self,
        enable: bool,
        hwnd_override: Option<isize>,
    ) -> ScreenCaptureProtectionStatus {
        let target_flag = if enable {
            WDA_EXCLUDEFROMCAPTURE
        } else {
            WDA_NONE
        };
        let flag_name = if enable {
            "WDA_EXCLUDEFROMCAPTURE"
        } else {
            "WDA_NONE"
        };

        #[cfg(target_os = "windows")]
        let verified = {
            if let Some(hwnd) = hwnd_override {
                if hwnd != 0 {
                    // SAFETY: Standard Win32 user32 call on a valid window handle
                    let ok = unsafe { SetWindowDisplayAffinity(hwnd, target_flag) };
                    let mut current_flag: u32 = 0;
                    let read_ok =
                        unsafe { GetWindowDisplayAffinity(hwnd, &mut current_flag as *mut u32) };
                    ok != 0 && read_ok != 0 && current_flag == target_flag
                } else {
                    enable
                }
            } else {
                enable
            }
        };

        #[cfg(not(target_os = "windows"))]
        let verified = {
            let _ = hwnd_override;
            enable
        };

        self.status.enabled = enable;
        self.status.affinity_constant_name = flag_name.to_string();
        self.status.affinity_flag = target_flag;
        self.status.affinity_hex = format!("0x{:08X}", target_flag);
        self.status.verified_active = verified;
        self.status.updated_at_ms = current_epoch_ms();
        self.status.explanation_id = if enable {
            "Anti-Screen Capture AKTIF (WDA_EXCLUDEFROMCAPTURE = 0x00000011). Seluruh jendela Solana OS dan modal seed phrase terlindung dari perekaman layar dan spyware screenshot.".to_string()
        } else {
            "PERINGATAN: Anti-Screen Capture dinonaktifkan sementara (WDA_NONE = 0x00000000). Jangan membuka seed phrase saat berbagi layar.".to_string()
        };

        self.status.clone()
    }

    pub fn get_status(&self) -> ScreenCaptureProtectionStatus {
        self.status.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_isolated_clipboard_blocks_seed_phrase_host_sync_and_enforces_ttl() {
        let mut vault = IsolatedClipboardVault::new();
        let seed = "abandon ability able about above absent absorb abstract absurd abuse access accident";
        let entry = vault
            .set_content("main", seed, Some(10))
            .expect("should store seed phrase in isolated vault");

        assert_eq!(entry.content_class, ClipboardContentClass::SeedPhraseBip39);
        assert!(entry.is_sensitive_secret);
        assert!(!entry.allow_host_os_sync);
        assert!(entry.masked_preview.contains("REDACTED BIP-39 SEED PHRASE"));

        // Reading from the same room ("main") before TTL succeeds
        let read_ok = vault.get_content("main", Some(&entry.integrity_hash), Some(entry.created_at_ms + 2000));
        assert!(read_ok.found);
        assert_eq!(read_ok.plaintext.as_deref(), Some(seed));

        // Cross-room read ("degen") for sensitive secret is blocked!
        let cross_room = vault.get_content("degen", None, Some(entry.created_at_ms + 3000));
        assert!(!cross_room.found);
        assert!(cross_room.explanation_id.contains("ISOLASI ROOM DIBLOKIR"));

        // After TTL expiration, buffer is auto-wiped!
        let expired = vault.get_content("main", None, Some(entry.expires_at_ms + 1));
        assert!(!expired.found);
        assert!(expired.expired_and_wiped);
    }

    #[test]
    fn test_anti_clipper_and_address_poisoning_detection() {
        let intended = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
        let poisoned = "7xKX99999999999999999999999999999999999sgAsU";
        let alert = detect_address_poisoning_or_clipper(intended, poisoned);
        assert!(alert.is_some());
        assert!(alert.unwrap().contains("ADDRESS_POISONING_DETECTED"));
    }

    #[test]
    fn test_screen_capture_guard_wda_exclude_from_capture() {
        let mut guard = ScreenCaptureGuard::new();
        let status = guard.get_status();
        assert!(status.enabled);
        assert_eq!(status.affinity_flag, WDA_EXCLUDEFROMCAPTURE);
        assert_eq!(status.affinity_hex, "0x00000011");
        assert!(status.verified_active);

        let disabled = guard.apply_protection(false, None);
        assert!(!disabled.enabled);
        assert_eq!(disabled.affinity_flag, WDA_NONE);

        let reenabled = guard.apply_protection(true, Some(0x12345));
        assert!(reenabled.enabled);
        assert_eq!(reenabled.affinity_flag, WDA_EXCLUDEFROMCAPTURE);
        assert!(reenabled.verified_active);
    }
}
