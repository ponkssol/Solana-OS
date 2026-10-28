use anchor_lang::prelude::*;
use crate::state::{LicenseTier, PaymentMethod, RoomKind};

#[event]
pub struct ProtocolInitializedEvent {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub pro_price_lamports: u64,
    pub pro_price_usdc: u64,
    pub timestamp: i64,
}

#[event]
pub struct CommitmentRegisteredEvent {
    pub owner: Pubkey,
    pub commitment_pda: Pubkey,
    pub commitment_hash: [u8; 32],
    pub mlkem_poseidon_root: [u8; 32],
    pub anti_tamper_state_root: [u8; 32],
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct CommitmentVerifiedEvent {
    pub owner: Pubkey,
    pub commitment_pda: Pubkey,
    pub verification_count: u64,
    pub verified_digest: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct CommitmentRotatedEvent {
    pub owner: Pubkey,
    pub commitment_pda: Pubkey,
    pub old_commitment_hash: [u8; 32],
    pub new_commitment_hash: [u8; 32],
    pub new_nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct RecoveryGuardInitializedEvent {
    pub owner: Pubkey,
    pub recovery_guard_pda: Pubkey,
    pub guardian_threshold: u8,
    pub cooldown_seconds: i64,
    pub timestamp: i64,
}

#[event]
pub struct RecoveryProofSubmittedEvent {
    pub owner: Pubkey,
    pub pending_new_owner: Pubkey,
    pub pending_approvals: u8,
    pub guardian_threshold: u8,
    pub unlock_timestamp: i64,
}

#[event]
pub struct AntiTamperRecoveryExecutedEvent {
    pub previous_owner: Pubkey,
    pub new_owner: Pubkey,
    pub new_commitment_hash: [u8; 32],
    pub recovery_sequence: u64,
    pub timestamp: i64,
}

#[event]
pub struct LicenseUpgradedEvent {
    pub owner: Pubkey,
    pub license_pda: Pubkey,
    pub tier: LicenseTier,
    pub payment_method: PaymentMethod,
    pub unlocked_rooms_mask: u8,
    pub amount_paid: u64,
    pub expires_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct RoomAccessVerifiedEvent {
    pub owner: Pubkey,
    pub room: RoomKind,
    pub tier: LicenseTier,
    pub granted: bool,
    pub timestamp: i64,
}
