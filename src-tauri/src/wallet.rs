//! The Solana signing key derived from the vault's recovery phrase. It lives only in
//! this process, is never returned to the webview, and signs only requests that were
//! queued for Shield review and then approved.

use std::collections::HashMap;
use std::sync::Mutex;

use ed25519_dalek::{Signer, SigningKey};
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha512;
use zeroize::Zeroizing;

type HmacSha512 = Hmac<Sha512>;

pub const DERIVATION_PATH: &str = "m/44'/501'/0'/0'";
const PATH: [u32; 4] = [44, 501, 0, 0];
const HARDENED: u32 = 0x8000_0000;

static SESSION: Mutex<Option<SigningKey>> = Mutex::new(None);
static PENDING: Mutex<Option<PendingQueue>> = Mutex::new(None);

#[derive(Default)]
struct PendingQueue {
    next_id: u64,
    requests: HashMap<u64, Vec<u8>>,
}

fn normalize(phrase: &str) -> String {
    phrase.split_whitespace().map(str::to_lowercase).collect::<Vec<_>>().join(" ")
}

fn bip39_seed(phrase: &str) -> Zeroizing<[u8; 64]> {
    let mut seed = Zeroizing::new([0u8; 64]);
    let normalized = Zeroizing::new(normalize(phrase));
    pbkdf2::pbkdf2_hmac::<Sha512>(normalized.as_bytes(), b"mnemonic", 2048, seed.as_mut());
    seed
}

fn hmac512(key: &[u8], parts: &[&[u8]]) -> Zeroizing<[u8; 64]> {
    let mut mac = HmacSha512::new_from_slice(key).expect("HMAC accepts any key length");
    for part in parts {
        mac.update(part);
    }
    let mut out = Zeroizing::new([0u8; 64]);
    out.copy_from_slice(&mac.finalize().into_bytes());
    out
}

// SLIP-0010 for ed25519 only defines hardened children, which is what Phantom uses.
pub fn derive_signing_key(phrase: &str) -> SigningKey {
    let seed = bip39_seed(phrase);
    let mut node = hmac512(b"ed25519 seed", &[seed.as_ref()]);
    for index in PATH {
        let (key, chain) = node.split_at(32);
        let child = (index | HARDENED).to_be_bytes();
        node = hmac512(chain, &[&[0u8], key, &child]);
    }
    let mut secret = Zeroizing::new([0u8; 32]);
    secret.copy_from_slice(&node[..32]);
    SigningKey::from_bytes(&secret)
}

pub fn address_of(key: &SigningKey) -> String {
    bs58::encode(key.verifying_key().as_bytes()).into_string()
}

pub fn looks_like_phrase(text: &str) -> bool {
    matches!(text.split_whitespace().count(), 12 | 15 | 18 | 21 | 24)
}

/// Loads the key for this session and returns its address.
pub fn start_session(phrase: &str) -> Result<String, String> {
    if !looks_like_phrase(phrase) {
        return Err("The vault does not contain a recovery phrase.".into());
    }
    let key = derive_signing_key(phrase);
    let address = address_of(&key);
    *SESSION.lock().map_err(|_| "wallet session poisoned")? = Some(key);
    Ok(address)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletInfo {
    pub address: String,
    pub derivation_path: &'static str,
}

#[tauri::command]
pub fn wallet_info() -> Option<WalletInfo> {
    let guard = SESSION.lock().ok()?;
    guard.as_ref().map(|key| WalletInfo {
        address: address_of(key),
        derivation_path: DERIVATION_PATH,
    })
}

#[tauri::command]
pub fn wallet_lock() {
    if let Ok(mut guard) = SESSION.lock() {
        *guard = None;
    }
    if let Ok(mut guard) = PENDING.lock() {
        *guard = None;
    }
}

#[tauri::command]
pub fn shield_queue_sign(message: Vec<u8>) -> Result<u64, String> {
    if SESSION.lock().map_err(|_| "wallet session poisoned")?.is_none() {
        return Err("Unlock the vault before signing.".into());
    }
    let mut guard = PENDING.lock().map_err(|_| "sign queue poisoned")?;
    let queue = guard.get_or_insert_with(PendingQueue::default);
    queue.next_id += 1;
    let id = queue.next_id;
    queue.requests.insert(id, message);
    Ok(id)
}

#[tauri::command]
pub fn shield_reject_sign(id: u64) {
    if let Ok(mut guard) = PENDING.lock() {
        if let Some(queue) = guard.as_mut() {
            queue.requests.remove(&id);
        }
    }
}

#[tauri::command]
pub fn shield_approve_sign(id: u64) -> Result<Vec<u8>, String> {
    let message = PENDING
        .lock()
        .map_err(|_| "sign queue poisoned")?
        .as_mut()
        .and_then(|queue| queue.requests.remove(&id))
        .ok_or("This signing request is no longer pending.")?;
    let guard = SESSION.lock().map_err(|_| "wallet session poisoned")?;
    let key = guard.as_ref().ok_or("Unlock the vault before signing.")?;
    Ok(key.sign(&message).to_bytes().to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Verifier;

    const PHRASE: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    #[test]
    fn matches_phantom_first_account() {
        assert_eq!(
            address_of(&derive_signing_key(PHRASE)),
            "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk"
        );
    }

    #[test]
    fn restore_is_deterministic_and_whitespace_insensitive() {
        let messy = format!("  {}  ", PHRASE.replace(' ', "   ").to_uppercase());
        assert_eq!(address_of(&derive_signing_key(&messy)), address_of(&derive_signing_key(PHRASE)));
    }

    #[test]
    fn signing_requires_a_queued_request() {
        start_session(PHRASE).unwrap();
        assert!(shield_approve_sign(999).is_err());
        let id = shield_queue_sign(b"hello".to_vec()).unwrap();
        let sig = shield_approve_sign(id).unwrap();
        let key = derive_signing_key(PHRASE);
        let sig = ed25519_dalek::Signature::from_slice(&sig).unwrap();
        assert!(key.verifying_key().verify(b"hello", &sig).is_ok());
        assert!(shield_approve_sign(id).is_err());
        wallet_lock();
    }
}
