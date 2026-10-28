use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::system_instruction;

pub mod errors;
pub mod events;
pub mod state;

use errors::SolanaOsError;
use events::*;
use state::*;

declare_id!("G8bkBpvs8E76jygEgHy3Lj6ZaHXZFWsBwG51uciNfUt4");

#[program]
pub mod solana_os_registry {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        pro_price_lamports: u64,
        pro_price_usdc: u64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.usdc_mint = ctx.accounts.usdc_mint.key();
        config.pass_collection_mint = ctx.accounts.pass_collection_mint.key();
        config.pro_price_lamports = pro_price_lamports;
        config.pro_price_usdc = pro_price_usdc;
        config.total_commitments = 0;
        config.total_pro_licenses = 0;
        config.paused = false;
        config.bump = ctx.bumps.config;

        let clock = Clock::get()?;
        emit!(ProtocolInitializedEvent {
            authority: config.authority,
            treasury: config.treasury,
            pro_price_lamports,
            pro_price_usdc,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn register_commitment(
        ctx: Context<RegisterCommitment>,
        commitment_hash: [u8; 32],
        mlkem_poseidon_root: [u8; 32],
        anti_tamper_state_root: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, SolanaOsError::ProtocolPaused);
        require!(
            commitment_hash != [0u8; 32],
            SolanaOsError::EmptyCommitmentHash
        );
        require!(
            mlkem_poseidon_root != [0u8; 32],
            SolanaOsError::EmptyMlkemPoseidonRoot
        );
        require!(
            anti_tamper_state_root != [0u8; 32],
            SolanaOsError::EmptyAntiTamperRoot
        );

        let clock = Clock::get()?;
        let commitment = &mut ctx.accounts.commitment;
        commitment.owner = ctx.accounts.owner.key();
        commitment.commitment_hash = commitment_hash;
        commitment.mlkem_poseidon_root = mlkem_poseidon_root;
        commitment.anti_tamper_state_root = anti_tamper_state_root;
        commitment.nonce = 0;
        commitment.registered_at = clock.unix_timestamp;
        commitment.last_verified_at = clock.unix_timestamp;
        commitment.verification_count = 0;
        commitment.is_active = true;
        commitment.bump = ctx.bumps.commitment;

        let config = &mut ctx.accounts.config;
        config.total_commitments = config.total_commitments.saturating_add(1);

        emit!(CommitmentRegisteredEvent {
            owner: commitment.owner,
            commitment_pda: commitment.key(),
            commitment_hash,
            mlkem_poseidon_root,
            anti_tamper_state_root,
            nonce: 0,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    /// Domain-separated SHA-256 witness. The preimage (seed, ML-KEM secret) is never stored.
    pub fn verify_commitment(ctx: Context<VerifyCommitment>, witness: [u8; 32]) -> Result<()> {
        require!(!ctx.accounts.config.paused, SolanaOsError::ProtocolPaused);
        let commitment = &mut ctx.accounts.commitment;
        require!(commitment.is_active, SolanaOsError::CommitmentDeactivated);

        let expected = domain_witness(&commitment.commitment_hash, commitment.nonce, b"solos-verify");
        require!(witness == expected, SolanaOsError::InvalidZkCommitmentProof);

        let clock = Clock::get()?;
        commitment.verification_count = commitment.verification_count.saturating_add(1);
        commitment.last_verified_at = clock.unix_timestamp;

        emit!(CommitmentVerifiedEvent {
            owner: commitment.owner,
            commitment_pda: commitment.key(),
            verification_count: commitment.verification_count,
            verified_digest: witness,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn rotate_commitment(
        ctx: Context<RotateCommitment>,
        new_commitment_hash: [u8; 32],
        new_nonce: u64,
        witness: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, SolanaOsError::ProtocolPaused);
        require!(
            new_commitment_hash != [0u8; 32],
            SolanaOsError::EmptyCommitmentHash
        );
        let commitment = &mut ctx.accounts.commitment;
        require!(commitment.is_active, SolanaOsError::CommitmentDeactivated);
        require!(
            new_nonce == commitment.nonce.saturating_add(1),
            SolanaOsError::InvalidRotationNonce
        );
        let expected = domain_witness(&commitment.commitment_hash, commitment.nonce, b"solos-rotate");
        require!(witness == expected, SolanaOsError::InvalidZkCommitmentProof);

        let old = commitment.commitment_hash;
        commitment.commitment_hash = new_commitment_hash;
        commitment.nonce = new_nonce;
        let clock = Clock::get()?;
        commitment.last_verified_at = clock.unix_timestamp;

        emit!(CommitmentRotatedEvent {
            owner: commitment.owner,
            commitment_pda: commitment.key(),
            old_commitment_hash: old,
            new_commitment_hash,
            new_nonce,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn initialize_recovery_guard(
        ctx: Context<InitializeRecoveryGuard>,
        recovery_merkle_root: [u8; 32],
        enclave_attestation_hash: [u8; 32],
        guardian_threshold: u8,
        cooldown_seconds: i64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, SolanaOsError::ProtocolPaused);
        require!(
            (1..=MAX_GUARDIANS as u8).contains(&guardian_threshold),
            SolanaOsError::InvalidGuardianThreshold
        );
        require!(
            cooldown_seconds >= 60,
            SolanaOsError::InvalidCooldownPeriod
        );

        let guard = &mut ctx.accounts.recovery_guard;
        guard.owner = ctx.accounts.owner.key();
        guard.commitment_pda = ctx.accounts.commitment.key();
        guard.recovery_merkle_root = recovery_merkle_root;
        guard.enclave_attestation_hash = enclave_attestation_hash;
        guard.guardian_threshold = guardian_threshold;
        guard.cooldown_seconds = cooldown_seconds;
        guard.pending_new_owner = Pubkey::default();
        guard.pending_commitment_hash = [0u8; 32];
        guard.pending_approvals = 0;
        guard.recovery_initiated_at = 0;
        guard.recovery_Sequence = 0;
        guard.tamper_alert_triggered = false;
        guard.bump = ctx.bumps.recovery_guard;

        let clock = Clock::get()?;
        emit!(RecoveryGuardInitializedEvent {
            owner: guard.owner,
            recovery_guard_pda: guard.key(),
            guardian_threshold,
            cooldown_seconds,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn submit_recovery_proof(
        ctx: Context<SubmitRecoveryProof>,
        pending_new_owner: Pubkey,
        pending_commitment_hash: [u8; 32],
        guardian_index: u8,
        witness: [u8; 32],
        enclave_attestation: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, SolanaOsError::ProtocolPaused);
        let guard = &mut ctx.accounts.recovery_guard;
        require!(
            guardian_index < MAX_GUARDIANS as u8,
            SolanaOsError::InvalidGuardianThreshold
        );
        if enclave_attestation != guard.enclave_attestation_hash {
            guard.tamper_alert_triggered = true;
            return err!(SolanaOsError::EnclaveAttestationMismatch);
        }
        let expected = domain_witness(
            &guard.recovery_merkle_root,
            guardian_index as u64,
            b"solos-guardian",
        );
        require!(witness == expected, SolanaOsError::InvalidRecoveryMerkleProof);

        let clock = Clock::get()?;
        if guard.recovery_initiated_at == 0 {
            guard.pending_new_owner = pending_new_owner;
            guard.pending_commitment_hash = pending_commitment_hash;
            guard.pending_approvals = 1;
            guard.recovery_initiated_at = clock.unix_timestamp;
        } else {
            require!(
                guard.pending_new_owner == pending_new_owner,
                SolanaOsError::NoPendingRecovery
            );
            guard.pending_approvals = guard.pending_approvals.saturating_add(1);
        }

        emit!(RecoveryProofSubmittedEvent {
            owner: guard.owner,
            pending_new_owner,
            pending_approvals: guard.pending_approvals,
            guardian_threshold: guard.guardian_threshold,
            unlock_timestamp: guard
                .recovery_initiated_at
                .saturating_add(guard.cooldown_seconds),
        });
        Ok(())
    }

    pub fn execute_recovery(ctx: Context<ExecuteRecovery>) -> Result<()> {
        require!(!ctx.accounts.config.paused, SolanaOsError::ProtocolPaused);
        let guard = &mut ctx.accounts.recovery_guard;
        require!(
            guard.recovery_initiated_at != 0,
            SolanaOsError::NoPendingRecovery
        );
        require!(
            guard.pending_approvals >= guard.guardian_threshold,
            SolanaOsError::InsufficientGuardianApprovals
        );
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= guard.recovery_initiated_at.saturating_add(guard.cooldown_seconds),
            SolanaOsError::RecoveryTimelockActive
        );

        let previous_owner = guard.owner;
        let new_owner = guard.pending_new_owner;
        let new_hash = guard.pending_commitment_hash;
        require!(new_owner != Pubkey::default(), SolanaOsError::NoPendingRecovery);

        let commitment = &mut ctx.accounts.commitment;
        commitment.owner = new_owner;
        commitment.commitment_hash = new_hash;
        commitment.nonce = commitment.nonce.saturating_add(1);
        commitment.last_verified_at = clock.unix_timestamp;
        commitment.is_active = true;

        guard.owner = new_owner;
        guard.recovery_Sequence = guard.recovery_Sequence.saturating_add(1);
        guard.pending_new_owner = Pubkey::default();
        guard.pending_commitment_hash = [0u8; 32];
        guard.pending_approvals = 0;
        guard.recovery_initiated_at = 0;
        guard.tamper_alert_triggered = false;

        emit!(AntiTamperRecoveryExecutedEvent {
            previous_owner,
            new_owner,
            new_commitment_hash: new_hash,
            recovery_sequence: guard.recovery_Sequence,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn upgrade_license_sol(ctx: Context<UpgradeLicenseSol>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, SolanaOsError::ProtocolPaused);
        require!(
            amount >= config.pro_price_lamports,
            SolanaOsError::InsufficientLicensePayment
        );

        let ix = system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.treasury.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                    ],
        )?;

        let clock = Clock::get()?;
        let license = &mut ctx.accounts.license;
        let first_pro = license.tier == LicenseTier::Freemium;
        license.owner = ctx.accounts.owner.key();
        license.tier = LicenseTier::Pro;
        license.payment_method = PaymentMethod::NativeSol;
        license.unlocked_rooms_mask = LicenseTier::Pro.unlocked_rooms_bitmask();
        license.max_wallet_bridges = 8;
        license.builder_suite_unlocked = true;
        if license.activated_at == 0 {
            license.activated_at = clock.unix_timestamp;
        }
        license.expires_at = clock.unix_timestamp.saturating_add(365 * 24 * 60 * 60);
        license.total_paid_amount = license.total_paid_amount.saturating_add(amount);
        license.verified_pass_mint = Pubkey::default();
        license.bump = ctx.bumps.license;

        if first_pro {
            let config = &mut ctx.accounts.config;
            config.total_pro_licenses = config.total_pro_licenses.saturating_add(1);
        }

        emit!(LicenseUpgradedEvent {
            owner: license.owner,
            license_pda: license.key(),
            tier: license.tier,
            payment_method: license.payment_method,
            unlocked_rooms_mask: license.unlocked_rooms_mask,
            amount_paid: amount,
            expires_at: license.expires_at,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn verify_room_access(ctx: Context<VerifyRoomAccess>, room: RoomKind) -> Result<()> {
        let license = &ctx.accounts.license;
        let clock = Clock::get()?;
        if license.tier != LicenseTier::LifetimePass && clock.unix_timestamp > license.expires_at {
            return err!(SolanaOsError::LicenseExpired);
        }
        let granted = license.tier.can_access_room(room);
        if !granted {
            return err!(SolanaOsError::RoomAccessDeniedProRequired);
        }
        emit!(RoomAccessVerifiedEvent {
            owner: license.owner,
            room,
            tier: license.tier,
            granted,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }
}

fn domain_witness(root: &[u8; 32], nonce: u64, domain: &[u8]) -> [u8; 32] {
    hashv(&[root, &nonce.to_le_bytes(), domain]).to_bytes()
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: treasury receives SOL license payments. Stored as a pubkey.
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: USDC mint is recorded, not deserialized.
    pub usdc_mint: UncheckedAccount<'info>,
    /// CHECK: pass collection mint is recorded, not deserialized.
    pub pass_collection_mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = ProtocolConfig::LEN,
        seeds = [SEED_PROTOCOL_CONFIG],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterCommitment<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [SEED_PROTOCOL_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        init,
        payer = owner,
        space = IdentityCommitment::LEN,
        seeds = [SEED_IDENTITY_COMMITMENT, owner.key().as_ref()],
        bump
    )]
    pub commitment: Account<'info, IdentityCommitment>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyCommitment<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [SEED_IDENTITY_COMMITMENT, owner.key().as_ref()],
        bump = commitment.bump,
        has_one = owner
    )]
    pub commitment: Account<'info, IdentityCommitment>,
}

#[derive(Accounts)]
pub struct RotateCommitment<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [SEED_IDENTITY_COMMITMENT, owner.key().as_ref()],
        bump = commitment.bump,
        has_one = owner
    )]
    pub commitment: Account<'info, IdentityCommitment>,
}

#[derive(Accounts)]
pub struct InitializeRecoveryGuard<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [SEED_IDENTITY_COMMITMENT, owner.key().as_ref()],
        bump = commitment.bump,
        has_one = owner
    )]
    pub commitment: Account<'info, IdentityCommitment>,
    #[account(
        init,
        payer = owner,
        space = RecoveryGuard::LEN,
        seeds = [SEED_RECOVERY_GUARD, owner.key().as_ref()],
        bump
    )]
    pub recovery_guard: Account<'info, RecoveryGuard>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitRecoveryProof<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [SEED_RECOVERY_GUARD, owner.key().as_ref()],
        bump = recovery_guard.bump,
        has_one = owner
    )]
    pub recovery_guard: Account<'info, RecoveryGuard>,
}

#[derive(Accounts)]
pub struct ExecuteRecovery<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [SEED_IDENTITY_COMMITMENT, owner.key().as_ref()],
        bump = commitment.bump
    )]
    pub commitment: Account<'info, IdentityCommitment>,
    #[account(
        mut,
        seeds = [SEED_RECOVERY_GUARD, owner.key().as_ref()],
        bump = recovery_guard.bump,
        has_one = owner,
        constraint = recovery_guard.commitment_pda == commitment.key() @ SolanaOsError::UnauthorizedAuthority
    )]
    pub recovery_guard: Account<'info, RecoveryGuard>,
}

#[derive(Accounts)]
pub struct UpgradeLicenseSol<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [SEED_PROTOCOL_CONFIG], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    /// CHECK: must match the treasury stored on the protocol config.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = owner,
        space = LicenseAccount::LEN,
        seeds = [SEED_LICENSE_ACCOUNT, owner.key().as_ref()],
        bump
    )]
    pub license: Account<'info, LicenseAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyRoomAccess<'info> {
    pub owner: Signer<'info>,
    #[account(
        seeds = [SEED_LICENSE_ACCOUNT, owner.key().as_ref()],
        bump = license.bump,
        has_one = owner
    )]
    pub license: Account<'info, LicenseAccount>,
}
