import React, { useState } from 'react';
import type { VaultItemRecord } from '../types';
import { GlassWindow } from '../primitives/GlassWindow';
import { SquircleIcon } from '../primitives/SquircleIcon';

export interface QuantumVaultWindowProps {
  items?: VaultItemRecord[];
  className?: string;
  embedded?: boolean;
}

const DEFAULT_VAULT_ITEMS: VaultItemRecord[] = [
  {
    id: 'vault-seed-primary',
    label: 'Primary Sovereign Seed (nanda.solos)',
    category: 'seed-24',
    cipherSuite: 'ML-KEM-1024 + AES-256-GCM',
    derivationPath: "m/44'/501'/0'/0'",
    publicKeyShort: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    createdAt: '2026-10-12',
    lastVerified: '2 mins ago',
    biometricRequired: true,
    yubikeySlot: 'YubiKey 5C Nano • Slot #1 (PIV)',
    maskedPreview: [
      '01.quantum',
      '02.••••••',
      '03.••••••',
      '04.lattice',
      '05.••••••',
      '06.••••••',
      '07.solos',
      '08.••••••',
    ],
  },
  {
    id: 'vault-keypair-anchor',
    label: 'Anchor Mainnet Upgrade Authority (.json)',
    category: 'keypair-json',
    cipherSuite: 'CRYSTALS-Dilithium5',
    derivationPath: '/solos/enclave/keys/deploy-auth.json',
    publicKeyShort: '9vB1xR8pL4mZw7kQvN2cXyT6hJ5dF3sA1wE9zQa8LpK',
    createdAt: '2026-10-20',
    lastVerified: '14 mins ago',
    biometricRequired: true,
    yubikeySlot: 'Hardware Enclave TPM 2.0',
    maskedPreview: ['[184, 92, •••, •••, 41, 19, •••, 251] (64-byte sealed blob)'],
  },
  {
    id: 'vault-shard-shamir',
    label: 'Cold Treasury Shamir Shard (2-of-3)',
    category: 'hardware-shard',
    cipherSuite: 'Shamir-2of3-PQ',
    publicKeyShort: '4mTRx2kLw8P9vN1qZ5cXyT6hJ5dF3sA1wE9zQa2kLw',
    createdAt: '2026-10-01',
    lastVerified: 'Verified On-Boot',
    biometricRequired: true,
    yubikeySlot: 'Ledger Stax + YubiKey Quorum',
    maskedPreview: ['Shard #1: Active', 'Shard #2: YubiKey Ready', 'Shard #3: Cold Airgap'],
  },
];

/**
 * QuantumVaultWindow renders the `vault.solos` Post-Quantum Key & Seed Enclave window.
 * Protects 24-word mnemonics, Anchor `.json` keypairs, and Shamir hardware shards
 * with NIST FIPS 203 ML-KEM-1024 lattice encryption and biometric/YubiKey gating.
 */
export const QuantumVaultWindow: React.FC<QuantumVaultWindowProps> = ({
  items = DEFAULT_VAULT_ITEMS,
  className = '',
  embedded = false,
}) => {
  const [revealSeedPreview, setRevealSeedPreview] = useState(false);

  return (
    <GlassWindow
      title="Quantum Vault • vault.solos"
      subtitle="FIPS-203 ML-KEM-1024 Enclave"
      badgeText="YubiKey + Biometric Armed"
      badgeTone="purple"
      className={className}
      embedded={embedded}
      icon={
        <SquircleIcon preset="vault" size="sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </SquircleIcon>
      }
      headerRight={
        <button
          type="button"
          onClick={() => setRevealSeedPreview((v) => !v)}
          className="rounded-lg border border-pink-400/35 bg-pink-500/20 px-2.5 py-1 text-[10.5px] font-semibold text-pink-200 transition hover:bg-pink-500/30"
        >
          {revealSeedPreview ? '🙈 Mask Enclave' : '👁️ TouchID Peek'}
        </button>
      }
    >
      <div className="space-y-3 p-4">
        {/* Top Post-Quantum Security Banner */}
        <div className="flex items-center justify-between rounded-2xl border border-[#9945FF]/40 bg-gradient-to-r from-[#9945FF]/20 via-pink-500/15 to-[#14F195]/15 px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-black/40 font-mono text-xs font-bold text-[#14F195]">
              PQ
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Zero-Plaintext Memory Enclave • Locked to Kernel Keyring
              </div>
              <div className="font-mono text-[10.5px] text-white/65">
                KEM: ML-KEM-1024 (Kyber) • Signer: Ed25519 + Dilithium5 Hybrid
              </div>
            </div>
          </div>

          <div className="text-right font-mono text-[10.5px]">
            <div className="font-semibold text-[#14F195]">● Hardware Attested</div>
            <div className="text-white/55">PCR[0..7] Verified</div>
          </div>
        </div>

        {/* Sealed Vault Records */}
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/15 bg-white/[0.045] p-3 transition hover:border-white/25"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#9945FF]/25 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-200">
                    {item.category.toUpperCase()}
                  </span>
                  <span className="text-[13px] font-bold text-white">{item.label}</span>
                </div>
                <span className="font-mono text-[10px] text-[#14F195]">
                  {item.cipherSuite}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] text-white/55">
                <span>Pubkey: {item.publicKeyShort.slice(0, 22)}...</span>
                <span>{item.yubikeySlot}</span>
              </div>

              {/* Masked / Segmented Seed & Shard Preview */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.maskedPreview.map((token, idx) => (
                  <span
                    key={idx}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10.5px] text-white/80"
                  >
                    {revealSeedPreview ? token.replace('••••••', 'cipher') : token}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassWindow>
  );
};

export default QuantumVaultWindow;
