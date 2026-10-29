import React, { useState } from 'react';
import type { StandaloneWalletProfile, WalletBrand } from '../types';
import { GlassWindow } from '../primitives/GlassWindow';
import { SquircleIcon } from '../primitives/SquircleIcon';

export interface WalletWindowsProps {
  initialBrand?: WalletBrand;
  className?: string;
  embedded?: boolean;
  onApproveSimulatedTx?: (brand: WalletBrand, txId: string) => void;
  onRejectSimulatedTx?: (brand: WalletBrand, txId: string) => void;
}

export const WALLET_PROFILES: Record<WalletBrand, StandaloneWalletProfile> = {
  phantom: {
    brand: 'phantom',
    title: 'Phantom Native Enclave',
    version: 'v26.4.1-solos',
    accountName: 'Alpha Vault #1',
    addressShort: '7xKXtg...9fPq4W',
    solBalance: '148.65 SOL',
    usdTotal: '$34,812.40',
    change24hUsd: '+$1,940.15 (+5.89%)',
    hardwareSigner: {
      connected: true,
      model: 'Ledger Stax + solos-enclave',
      enclaveMode: 'ML-KEM-1024 Co-Sign',
    },
    tokens: [
      {
        symbol: 'SOL',
        name: 'Solana Native',
        mintShort: 'So111...1112',
        balance: '148.65',
        usdValue: '$28,540.80',
        change24h: '+6.2%',
        isPositive: true,
        accentColor: '#14F195',
      },
      {
        symbol: 'JUP',
        name: 'Jupiter Aggregator',
        mintShort: 'JUPyi...v8xN',
        balance: '4,250.00',
        usdValue: '$4,845.00',
        change24h: '+4.8%',
        isPositive: true,
        accentColor: '#38bdf8',
      },
      {
        symbol: 'USDC',
        name: 'USD Coin (Circle)',
        mintShort: 'EPjFW...TDt1v',
        balance: '1,426.60',
        usdValue: '$1,426.60',
        change24h: '0.0%',
        isPositive: true,
        accentColor: '#60a5fa',
      },
    ],
    pendingSimulation: {
      txId: '5xQp9...8kLm2',
      dappOrigin: 'jup.ag (Verified Enclave Socket)',
      programName: 'Jupiter v6 Swap Router',
      programIdShort: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      instructionSummary: 'ExactIn Swap: 12.50 SOL → 2,418.40 JUP',
      estimatedFeeSol: '0.000014 SOL',
      priorityFeeMicroLamports: '15,000 µL',
      balanceChanges: [
        { asset: 'SOL', delta: '-12.500014 SOL', direction: 'out', verifiedMint: true },
        { asset: 'JUP', delta: '+2,418.40 JUP', direction: 'in', verifiedMint: true },
      ],
      antiDrainerChecks: {
        ownerAuthorityUnchanged: true,
        noHiddenSetAuthority: true,
        knownProgramVerified: true,
        cpiDepthSafe: true,
      },
      riskScore: 'SAFE',
    },
  },
  solflare: {
    brand: 'solflare',
    title: 'Solflare Standalone Pro',
    version: 'v4.9.0-solos',
    accountName: 'Validator & Staking',
    addressShort: '9mTRx2...4kLw8P',
    solBalance: '512.00 SOL',
    usdTotal: '$98,940.00',
    change24hUsd: '+$4,120.50 (+4.35%)',
    hardwareSigner: {
      connected: true,
      model: 'Keystone 3 Pro + YubiKey 5C',
      enclaveMode: 'FIDO2 + Ed25519-PQ',
    },
    tokens: [
      {
        symbol: 'mSOL',
        name: 'Marinade Staked SOL',
        mintShort: 'mSoLz...v1p2',
        balance: '380.00',
        usdValue: '$78,280.00',
        change24h: '+6.4%',
        isPositive: true,
        accentColor: '#f97316',
      },
      {
        symbol: 'SOL',
        name: 'Native Liquid Stake',
        mintShort: 'So111...1112',
        balance: '132.00',
        usdValue: '$20,660.00',
        change24h: '+6.2%',
        isPositive: true,
        accentColor: '#14F195',
      },
    ],
    pendingSimulation: {
      txId: '8nWz4...3vRt9',
      dappOrigin: 'marinade.finance (Native IPC)',
      programName: 'Marinade Liquid Staking',
      programIdShort: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
      instructionSummary: 'DepositStakeAccount: 50.00 SOL → 43.12 mSOL',
      estimatedFeeSol: '0.000009 SOL',
      priorityFeeMicroLamports: '8,000 µL',
      balanceChanges: [
        { asset: 'SOL', delta: '-50.000009 SOL', direction: 'out', verifiedMint: true },
        { asset: 'mSOL', delta: '+43.1204 mSOL', direction: 'in', verifiedMint: true },
      ],
      antiDrainerChecks: {
        ownerAuthorityUnchanged: true,
        noHiddenSetAuthority: true,
        knownProgramVerified: true,
        cpiDepthSafe: true,
      },
      riskScore: 'SAFE',
    },
  },
  backpack: {
    brand: 'backpack',
    title: 'Backpack xNFT Native',
    version: 'v1.18.2-solos',
    accountName: 'xNFT & Tensor Trader',
    addressShort: '3kP9vQ...7nZa1M',
    solBalance: '64.20 SOL',
    usdTotal: '$15,498.40',
    change24hUsd: '+$812.00 (+5.53%)',
    hardwareSigner: {
      connected: true,
      model: 'Solana OS Quantum Vault',
      enclaveMode: 'vault.solos Direct IPC',
    },
    tokens: [
      {
        symbol: 'SOL',
        name: 'Solana Native',
        mintShort: 'So111...1112',
        balance: '64.20',
        usdValue: '$12,326.40',
        change24h: '+6.2%',
        isPositive: true,
        accentColor: '#ef4444',
      },
      {
        symbol: 'PYTH',
        name: 'Pyth Network Oracle',
        mintShort: 'HZ1Jov...2k9W',
        balance: '6,600.00',
        usdValue: '$3,172.00',
        change24h: '+3.9%',
        isPositive: true,
        accentColor: '#a855f7',
      },
    ],
    pendingSimulation: {
      txId: '2vLm8...9pQx1',
      dappOrigin: 'tensor.trade (Sandboxed xNFT)',
      programName: 'Tensor Swap Marketplace',
      programIdShort: 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN',
      instructionSummary: 'BuySingleListing: Mad Lads #4812 (Escrow Verified)',
      estimatedFeeSol: '0.000018 SOL',
      priorityFeeMicroLamports: '22,000 µL',
      balanceChanges: [
        { asset: 'SOL', delta: '-28.400018 SOL', direction: 'out', verifiedMint: true },
        { asset: 'xNFT Mad Lads #4812', delta: '+1 NFT', direction: 'in', verifiedMint: true },
      ],
      antiDrainerChecks: {
        ownerAuthorityUnchanged: true,
        noHiddenSetAuthority: true,
        knownProgramVerified: true,
        cpiDepthSafe: true,
      },
      riskScore: 'SAFE',
    },
  },
};

/**
 * WalletWindows renders standalone native OS windows for Phantom, Solflare, and Backpack
 * with instant switcher tabs, SOL/SPL portfolio balances, hardware signer verification,
 * and pre-flight Safe Transaction Simulation powered by Solana OS Anti-Drainer Shield.
 */
export const WalletWindows: React.FC<WalletWindowsProps> = ({
  initialBrand = 'phantom',
  className = '',
  embedded = false,
  onApproveSimulatedTx,
  onRejectSimulatedTx,
}) => {
  const [activeBrand, setActiveBrand] = useState<WalletBrand>(initialBrand);
  const profile = WALLET_PROFILES[activeBrand];

  return (
    <GlassWindow
      title={profile.title}
      subtitle={profile.version}
      badgeText="Hardware Co-Signer Active"
      badgeTone={
        activeBrand === 'phantom'
          ? 'purple'
          : activeBrand === 'solflare'
          ? 'amber'
          : 'emerald'
      }
      className={className}
      embedded={embedded}
      icon={
        <SquircleIcon preset={activeBrand} size="sm">
          <span className="text-xs font-bold">
            {activeBrand === 'phantom' ? '👻' : activeBrand === 'solflare' ? '⚡' : '🎒'}
          </span>
        </SquircleIcon>
      }
      headerRight={
        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/30 p-0.5">
          {(['phantom', 'solflare', 'backpack'] as WalletBrand[]).map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => setActiveBrand(brand)}
              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold capitalize transition ${
                activeBrand === brand
                  ? 'bg-white text-slate-950 shadow'
                  : 'text-white/65 hover:text-white'
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-12 gap-3.5 p-4">
        {/* Left 6 Cols: Native Portfolio + Hardware Signer Status */}
        <div className="col-span-6 flex flex-col justify-between space-y-3">
          {/* Balance Card */}
          <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.05] p-3.5">
            <div className="flex items-center justify-between text-[11px] text-white/65">
              <span className="font-semibold text-white/90">{profile.accountName}</span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                {profile.addressShort}
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-white">
              {profile.usdTotal}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-[#14F195]">
                {profile.solBalance}
              </span>
              <span className="text-[11px] text-emerald-300/90">{profile.change24hUsd}</span>
            </div>

            {/* Hardware Signer Strip */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#14F195]/30 bg-[#14F195]/10 px-2.5 py-1.5 text-[10.5px]">
              <span className="font-semibold text-[#14F195]">
                🔐 {profile.hardwareSigner.model}
              </span>
              <span className="font-mono text-white/80">
                {profile.hardwareSigner.enclaveMode}
              </span>
            </div>
          </div>

          {/* SPL Token Holdings */}
          <div className="space-y-1.5">
            <div className="px-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/50">
              Verified SPL Assets
            </div>
            {profile.tokens.map((token) => (
              <div
                key={token.symbol}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-slate-950"
                    style={{ backgroundColor: token.accentColor }}
                  >
                    {token.symbol.slice(0, 3)}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white">{token.symbol}</div>
                    <div className="font-mono text-[10px] text-white/50">{token.mintShort}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-semibold text-white">
                    {token.balance}
                  </div>
                  <div className="text-[10px] text-[#14F195]">
                    {token.usdValue} ({token.change24h})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 6 Cols: Pre-Flight Safe Transaction Simulation */}
        <div className="col-span-6 flex flex-col justify-between rounded-2xl border border-[#14F195]/35 bg-slate-950/55 p-3.5">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#14F195]">
                  🛡️ Pre-Flight Safe Simulation
                </div>
                <div className="text-xs font-bold text-white">
                  {profile.pendingSimulation.programName}
                </div>
              </div>
              <span className="rounded-full border border-[#14F195]/50 bg-[#14F195]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#14F195]">
                {profile.pendingSimulation.riskScore}
              </span>
            </div>

            <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <div className="text-[10.5px] text-white/60">
                Origin: <strong className="text-white/90">{profile.pendingSimulation.dappOrigin}</strong>
              </div>
              <div className="mt-1 font-mono text-[11px] font-semibold text-sky-300">
                {profile.pendingSimulation.instructionSummary}
              </div>

              {/* Balance Diff Rows */}
              <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2">
                {profile.pendingSimulation.balanceChanges.map((diff) => (
                  <div
                    key={diff.asset}
                    className="flex items-center justify-between font-mono text-[11px]"
                  >
                    <span className="text-white/75">{diff.asset}</span>
                    <span
                      className={
                        diff.direction === 'in'
                          ? 'font-bold text-[#14F195]'
                          : 'font-semibold text-rose-300'
                      }
                    >
                      {diff.delta}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Anti-Drainer Verification Checklist */}
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px] text-white/80">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1">
                <span className="text-[#14F195]">✔</span>
                <span>No Owner Authority Mutation</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1">
                <span className="text-[#14F195]">✔</span>
                <span>Verified IDL & Program Hash</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onRejectSimulatedTx?.(activeBrand, profile.pendingSimulation.txId)
              }
              className="flex-1 rounded-xl border border-white/15 bg-white/10 py-2 text-xs font-semibold text-white/80 transition hover:bg-rose-500/20 hover:text-rose-200"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() =>
                onApproveSimulatedTx?.(activeBrand, profile.pendingSimulation.txId)
              }
              className="h-[26px] flex-1 rounded-[6px] bg-[#0A84FF] text-[13px] font-medium text-white"
            >
              Sign in Enclave ↵
            </button>
          </div>
        </div>
      </div>
    </GlassWindow>
  );
};

export default WalletWindows;
