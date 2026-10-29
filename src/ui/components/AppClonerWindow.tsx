import React, { useState } from 'react';
import type { ClonedAppInstance } from '../types';
import { GlassWindow } from '../primitives/GlassWindow';
import { SquircleIcon } from '../primitives/SquircleIcon';

export interface AppClonerWindowProps {
  instances?: ClonedAppInstance[];
  className?: string;
  onCloneNew?: () => void;
  embedded?: boolean;
}

const DEFAULT_CLONED_INSTANCES: ClonedAppInstance[] = [
  {
    id: 'clone-phantom-alpha',
    appId: 'phantom',
    instanceName: 'Phantom #1 • Alpha Burner',
    profileTag: 'ns-vault-01',
    namespacePid: 14820,
    boundWalletLabel: 'Alpha Sniper',
    boundAddressShort: '7xKX...9fPq',
    rpcRoute: 'Helius Staked (11ms)',
    status: 'running',
    cpuPercent: 1.8,
    memoryMb: 112,
    networkKbps: 42,
    isolatedFilesystemPath: '/solos/sandboxes/phantom-01',
    clipboardSandboxed: true,
  },
  {
    id: 'clone-phantom-airdrop',
    appId: 'phantom',
    instanceName: 'Phantom #2 • Perps & LP',
    profileTag: 'ns-vault-02',
    namespacePid: 14905,
    boundWalletLabel: 'Jupiter LP Vault',
    boundAddressShort: '4mTR...2kLw',
    rpcRoute: 'Triton One (14ms)',
    status: 'isolated-enclave',
    cpuPercent: 1.2,
    memoryMb: 98,
    networkKbps: 19,
    isolatedFilesystemPath: '/solos/sandboxes/phantom-02',
    clipboardSandboxed: true,
  },
  {
    id: 'clone-cursor-ide',
    appId: 'cursor-ide',
    instanceName: 'Cursor IDE • Anchor Audit',
    profileTag: 'ns-dev-03',
    namespacePid: 15210,
    boundWalletLabel: 'Devnet Deployer',
    boundAddressShort: '9vB1...8zQa',
    rpcRoute: 'Localnet (2ms)',
    status: 'frozen',
    cpuPercent: 0.0,
    memoryMb: 64,
    networkKbps: 0,
    isolatedFilesystemPath: '/solos/sandboxes/cursor-03',
    clipboardSandboxed: true,
  },
];

/**
 * AppClonerWindow renders the Solana OS Universal App Cloner GUI.
 * Allows running multiple isolated instances of wallets, Web3 browsers, and IDEs
 * with Linux namespace sandboxing, dedicated RPC routing, and 1-click Process Freeze ❄️.
 */
export const AppClonerWindow: React.FC<AppClonerWindowProps> = ({
  instances: initialInstances = DEFAULT_CLONED_INSTANCES,
  className = '',
  onCloneNew,
  embedded = false,
}) => {
  const [instances, setInstances] = useState<ClonedAppInstance[]>(initialInstances);

  const toggleFreezeInstance = (id: string) => {
    setInstances((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextFrozen = item.status !== 'frozen';
        return {
          ...item,
          status: nextFrozen ? 'frozen' : 'running',
          cpuPercent: nextFrozen ? 0.0 : 1.6,
          networkKbps: nextFrozen ? 0 : 28,
        };
      })
    );
  };

  return (
    <GlassWindow
      title="Universal App Cloner"
      subtitle="solos-sandboxd v2.4"
      badgeText="3 Namespaces Active"
      badgeTone="cyan"
      className={className}
      embedded={embedded}
      icon={
        <SquircleIcon preset="cloner" size="sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="8" y="8" width="12" height="12" rx="2.5" />
            <path d="M4 16V6a2 2 0 0 1 2-2h10" />
            <line x1="14" y1="11" x2="14" y2="17" />
            <line x1="11" y1="14" x2="17" y2="14" />
          </svg>
        </SquircleIcon>
      }
      headerRight={
        <button
          type="button"
          onClick={onCloneNew}
          className="h-[26px] rounded-[6px] border border-white/[0.06] bg-[#0A84FF] px-2.5 text-[13px] font-medium text-white"
        >
          + Clone App
        </button>
      }
    >
      <div className="p-4">
        {/* Top Sandbox Isolation Telemetry Strip */}
        <div className="mb-3 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Isolation Engine
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-xs font-bold text-white">cgroups v2 + Landlock</span>
              <span className="h-2 w-2 rounded-full bg-[#14F195]" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              RAM Saved via Freeze ❄️
            </div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="font-mono text-xs font-bold text-sky-300">1.84 GB Freed</span>
              <span className="text-[10px] text-white/50">SIGSTOP</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Cross-Profile Clipboard
            </div>
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-xs font-bold text-[#14F195]">Zero-Leak Ring</span>
              <span className="font-mono text-[10px] text-white/55">Isolated</span>
            </div>
          </div>
        </div>

        {/* Cloned Instances List */}
        <div className="space-y-2.5">
          {instances.map((inst) => {
            const isFrozen = inst.status === 'frozen';
            return (
              <div
                key={inst.id}
                className={`flex items-center justify-between rounded-2xl border p-3 transition ${
                  isFrozen
                    ? 'border-sky-400/35 bg-sky-950/25'
                    : 'border-white/15 bg-white/[0.05] hover:bg-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <SquircleIcon
                    preset={inst.appId === 'phantom' ? 'phantom' : 'cursor'}
                    size="md"
                    badgeDot={isFrozen ? 'frozen' : 'active'}
                  >
                    {inst.appId === 'phantom' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                        <path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
                        <rect x="13" y="7" width="8" height="10" rx="2" />
                        <circle cx="17" cy="12" r="1.2" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                    )}
                  </SquircleIcon>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-white">
                        {inst.instanceName}
                      </span>
                      <span className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/75">
                        PID {inst.namespacePid}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/60">
                      <span>
                        Signer: <strong className="font-mono text-white/85">{inst.boundAddressShort}</strong>
                      </span>
                      <span>•</span>
                      <span>{inst.rpcRoute}</span>
                    </div>
                  </div>
                </div>

                {/* Right Metrics + Freeze Action */}
                <div className="flex items-center gap-3">
                  <div className="text-right font-mono text-[11px]">
                    <div className={isFrozen ? 'text-sky-300' : 'text-white/85'}>
                      {isFrozen ? '0.0% CPU • FROZEN' : `${inst.cpuPercent}% CPU`}
                    </div>
                    <div className="text-[10px] text-white/50">{inst.memoryMb} MB RAM</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFreezeInstance(inst.id)}
                    className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      isFrozen
                        ? 'border-sky-400/50 bg-sky-400/20 text-sky-200'
                        : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    {isFrozen ? '❄️ Resume' : '❄️ Freeze'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassWindow>
  );
};

export default AppClonerWindow;
