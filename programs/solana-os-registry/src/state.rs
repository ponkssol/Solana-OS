use anchor_lang::prelude::*;

pub const SEED_PROTOCOL_CONFIG: &[u8] = b"solos_protocol_config";
pub const SEED_IDENTITY_COMMITMENT: &[u8] = b"solos_identity_commitment";
pub const SEED_RECOVERY_GUARD: &[u8] = b"solos_recovery_guard";
pub const SEED_LICENSE_ACCOUNT: &[u8] = b"solos_license_account";

/// Maximum number of guardian hashes stored directly or referenced in RecoveryGuard
pub const MAX_GUARDIANS: usize = 5;

/// Room classification inside Solana OS Desktop Environment
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum RoomKind {
    /// Main Room — Primary Sovereign Enclave (Available in Freemium & Pro)
    Main = 0,
    /// Degen Room — High-Frequency Memecoin Desk & Rug Shield Sandbox (Requires Pro / LifetimePass)
    Degen = 1,
    /// Dev Room — Anchor / Rust SVM Builder, Localnet Validator & Mainnet Fork Cloner (Requires Pro / LifetimePass)
    Dev = 2,
    /// Burner Room — Ephemeral Zero-Trace RAM Sandbox with Auto-Shredding Keys (Requires Pro / LifetimePass)
    Burner = 3,
}

/// On-chain licensing tier for Solana OS
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum LicenseTier {
    /// Free tier: Single Main Room only, basic vault.solos commitment
    Freemium = 0,
    /// Pro Subscription / Upgrade: Unlocks Multi-Room (Main, Degen, Dev, Burner), Builder Suite & Standalone Wallet Bridge
    Pro = 1,
    /// Lifetime Pass NFT / Genesis Token Holder: Permanent unlock of all Rooms and Enterprise Enclave features
    LifetimePass = 2,
}

impl LicenseTier {
    pub fn can_access_room(&self, room: RoomKind) -> bool {
        match self {
            LicenseTier::Freemium => matches!(room, RoomKind::Main),
            LicenseTier::Pro | LicenseTier::LifetimePass => true,
        }
    }

    pub fn unlocked_rooms_bitmask(&self) -> u8 {
        match self {
            // Bit 0: Main
            LicenseTier::Freemium => 0b0001,
            // Bits 0..=3: Main | Degen | Dev | Burner
            LicenseTier::Pro | LicenseTier::LifetimePass => 0b1111,
        }
    }
}

/// Payment or verification method used to unlock Pro / LifetimePass
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PaymentMethod {
    None = 0,
    NativeSol = 1,
    UsdcSpl = 2,
    PassNftToken = 3,
}

/// Global protocol configuration PDA (`["solos_protocol_config"]`)
#[account]
pub struct ProtocolConfig {
    /// Governance / treasury authority
    pub authority: Pubkey,
    /// Treasury account receiving SOL/USDC licensing fees
    pub treasury: Pubkey,
    /// Accepted USDC SPL Mint (e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
    pub usdc_mint: Pubkey,
    /// Official Solana OS Genesis Pass Mint (NFT or semi-fungible token)
    pub pass_collection_mint: Pubkey,
    /// Price in lamports for Pro upgrade (default: 0.5 SOL = 500_000_000 lamports)
    pub pro_price_lamports: u64,
    /// Price in USDC base units (6 decimals) for Pro upgrade (default: 79 USDC = 79_000_000)
    pub pro_price_usdc: u64,
    /// Total registered ZK identity commitments
    pub total_commitments: u64,
    /// Total active Pro / LifetimePass licenses
    pub total_pro_licenses: u64,
    /// Protocol paused flag for emergency circuit breaker
    pub paused: bool,
    /// PDA bump
    pub bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize = 8 + 32 * 4 + 8 * 4 + 1 + 1;
}

/// Zero-Knowledge Account Commitment PDA (`["solos_identity_commitment", owner.key().as_ref()]`)
/// Stores the post-quantum ML-KEM-1024 + Poseidon zero-knowledge identity commitment without
/// ever exposing private keys or plaintext identity metadata on-chain.
#[account]
pub struct IdentityCommitment {
    /// Owner authority wallet
    pub owner: Pubkey,
    /// PQC/ZK identity commitment hash (`H(solos_id || mlkem1024_pk_root || salt)`)
    pub commitment_hash: [u8; 32],
    /// ML-KEM-1024 / Poseidon Merkle root covering isolated Room subkeys (Main, Degen, Dev, Burner)
    pub mlkem_poseidon_root: [u8; 32],
    /// Current `vault.solos` hardware enclave anti-tamper state root
    pub anti_tamper_state_root: [u8; 32],
    /// Monotonically increasing commitment rotation nonce (prevents replay attacks)
    pub nonce: u64,
    /// Unix timestamp of initial registration
    pub registered_at: i64,
    /// Unix timestamp of most recent commitment verification or rotation
    pub last_verified_at: i64,
    /// Count of successful on-chain ZK proof verifications
    pub verification_count: u64,
    /// Whether this commitment is currently active and untampered
    pub is_active: bool,
    /// PDA bump
    pub bump: u8,
}

impl IdentityCommitment {
    pub const LEN: usize = 8 + 32 + 32 * 3 + 8 * 4 + 1 + 1;
}

/// Anti-Tamper Recovery Verification Guard PDA (`["solos_recovery_guard", owner.key().as_ref()]`)
/// Protects `vault.solos` against local disk tampering and coordinates timelocked M-of-N
/// guardian + hardware enclave recovery.
#[account]
pub struct RecoveryGuard {
    /// Current owner of the enclave identity
    pub owner: Pubkey,
    /// Associated IdentityCommitment PDA
    pub commitment_pda: Pubkey,
    /// Merkle root of M-of-N recovery guardians / 24-word lattice shards
    pub recovery_merkle_root: [u8; 32],
    /// Expected `vault.solos` hardware enclave attestation digest (SHA-256 of signed enclave quote)
    pub enclave_attestation_hash: [u8; 32],
    /// Required guardian threshold (e.g. 2 of 3 or 3 of 5)
    pub guardian_threshold: u8,
    /// Mandatory cooldown timelock in seconds before recovery execution can finalize
    pub cooldown_seconds: i64,
    /// Pending recovery destination authority (Pubkey::default() if no recovery active)
    pub pending_new_owner: Pubkey,
    /// Pending replacement commitment hash submitted during recovery initiation
    pub pending_commitment_hash: [u8; 32],
    /// Pending verified guardian proof count
    pub pending_approvals: u8,
    /// Timestamp when recovery proof was submitted (0 if none pending)
    pub recovery_initiated_at: i64,
    /// Total anti-tamper recovery executions completed
    #[allow(non_snake_case)]
    pub recovery_Sequence: u64,
    /// Tamper alert flag triggered if an invalid enclave digest was detected
    pub tamper_alert_triggered: bool,
    /// PDA bump
    pub bump: u8,
}

impl RecoveryGuard {
    pub const LEN: usize = 8 + 32 * 2 + 32 * 2 + 1 + 8 + 32 + 32 + 1 + 8 + 8 + 1 + 1;
}

/// On-Chain Freemium vs Pro Licensing Account PDA (`["solos_license_account", owner.key().as_ref()]`)
#[account]
pub struct LicenseAccount {
    /// License owner wallet
    pub owner: Pubkey,
    /// Current license tier (Freemium, Pro, LifetimePass)
    pub tier: LicenseTier,
    /// Payment method used for activation
    pub payment_method: PaymentMethod,
    /// Bitmask of unlocked rooms: bit 0 = Main, bit 1 = Degen, bit 2 = Dev, bit 3 = Burner
    pub unlocked_rooms_mask: u8,
    /// Maximum concurrent standalone wallet bridge instances allowed
    pub max_wallet_bridges: u8,
    /// Whether Mainnet Fork Cloner & Local Validator GUI are unlocked
    pub builder_suite_unlocked: bool,
    /// Unix timestamp of license activation / upgrade
    pub activated_at: i64,
    /// Expiration timestamp (`i64::MAX` for LifetimePass or perpetual Pro epoch)
    pub expires_at: i64,
    /// Total lamports or USDC units paid historically
    pub total_paid_amount: u64,
    /// Verified Pass NFT mint (Pubkey::default() if upgraded via SOL/USDC)
    pub verified_pass_mint: Pubkey,
    /// PDA bump
    pub bump: u8,
}

impl LicenseAccount {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 1 + 1 + 1 + 8 + 8 + 8 + 32 + 1;
}
