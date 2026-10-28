use anchor_lang::prelude::*;

#[error_code]
pub enum SolanaOsError {
    #[msg("Protocol is currently paused by governance authority.")]
    ProtocolPaused,

    #[msg("Zero-Knowledge commitment hash cannot be all zeros.")]
    EmptyCommitmentHash,

    #[msg("ML-KEM-1024 Poseidon root cannot be all zeros.")]
    EmptyMlkemPoseidonRoot,

    #[msg("Anti-tamper state root cannot be all zeros.")]
    EmptyAntiTamperRoot,

    #[msg("Invalid ZK commitment proof: domain-separated witness verification failed.")]
    InvalidZkCommitmentProof,

    #[msg("Commitment rotation nonce must strictly increment the current nonce.")]
    InvalidRotationNonce,

    #[msg("Identity commitment is currently deactivated due to tamper lockdown.")]
    CommitmentDeactivated,

    #[msg("Invalid guardian threshold: must be between 1 and MAX_GUARDIANS (5).")]
    InvalidGuardianThreshold,

    #[msg("Recovery cooldown timelock must be at least 60 seconds.")]
    InvalidCooldownPeriod,

    #[msg("Anti-tamper Merkle proof verification failed against recovery_merkle_root.")]
    InvalidRecoveryMerkleProof,

    #[msg("Hardware enclave vault.solos attestation digest mismatch — tamper alert!")]
    EnclaveAttestationMismatch,

    #[msg("Insufficient guardian approvals to meet recovery threshold.")]
    InsufficientGuardianApprovals,

    #[msg("Recovery timelock cooldown has not elapsed yet.")]
    RecoveryTimelockActive,

    #[msg("No pending anti-tamper recovery request is active.")]
    NoPendingRecovery,

    #[msg("Unauthorized caller for this enclave identity or recovery operation.")]
    UnauthorizedAuthority,

    #[msg("Insufficient SOL or USDC payment amount for Pro license upgrade.")]
    InsufficientLicensePayment,

    #[msg("Invalid SPL token mint or token account owner for Pass NFT / USDC check.")]
    InvalidTokenAccountOrMint,

    #[msg("Pass NFT token account balance must be at least 1.")]
    EmptyPassNftBalance,

    #[msg("Room access denied: Freemium tier only permits Main Room. Upgrade to Pro or verify Solana OS Pass NFT to unlock Multi-Room (Degen, Dev, Burner).")]
    RoomAccessDeniedProRequired,

    #[msg("License has expired; renew Pro tier or verify Solana OS Pass NFT.")]
    LicenseExpired,
}
