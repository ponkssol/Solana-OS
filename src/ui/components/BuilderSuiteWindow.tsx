import React, { useState } from 'react';
import type { AnchorProgramTarget } from '../types';
import { GlassWindow } from '../primitives/GlassWindow';
import { SquircleIcon } from '../primitives/SquircleIcon';

export interface BuilderSuiteWindowProps {
  program?: AnchorProgramTarget;
  className?: string;
  embedded?: boolean;
}

const DEFAULT_ANCHOR_PROGRAM: AnchorProgramTarget = {
  name: 'solos_quantum_escrow',
  programId: 'SoLoS9xK2vR8pL4mZw7kQvN2cXyT6hJ5dF3sA1wE9zQ',
  binarySizeKb: 284.6,
  computeUnitsAvg: 18_420,
  rentExemptSol: '1.9842 SOL',
  buildStatus: 'verified-sbf',
  idlMethods: [
    {
      name: 'initialize_enclave_vault',
      accountsCount: 6,
      argsSignature: '(kem_pubkey: [u8; 1568], bump: u8)',
      mutability: 'writable',
    },
    {
      name: 'execute_guarded_swap',
      accountsCount: 9,
      argsSignature: '(amount_in: u64, min_out: u64, max_slippage_bps: u16)',
      mutability: 'writable',
    },
    {
      name: 'verify_hardware_attestation',
      accountsCount: 4,
      argsSignature: '(pcr_digest: [u8; 32], sig: [u8; 64])',
      mutability: 'readonly',
    },
  ],
};

/**
 * BuilderSuiteWindow renders the Solana Builder Suite GUI for Anchor/Rust SBF compilation,
 * localnet validator telemetry (`solana-test-validator`), verifiable builds, and IDL inspection.
 */
export const BuilderSuiteWindow: React.FC<BuilderSuiteWindowProps> = ({
  program = DEFAULT_ANCHOR_PROGRAM,
  className = '',
  embedded = false,
}) => {
  const [clusterTarget, setClusterTarget] = useState<'localnet' | 'devnet' | 'mainnet-beta'>(
    'localnet'
  );

  return (
    <GlassWindow
      title="Solana Builder Suite • Anchor v0.31 SBF"
      subtitle="rustc 1.84-sbf-solana"
      badgeText="solana-test-validator • 400ms Slot"
      badgeTone="emerald"
      className={className}
      embedded={embedded}
      icon={
        <SquircleIcon preset="builder" size="sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        </SquircleIcon>
      }
      headerRight={
        <div className="flex items-center gap-1.5">
          {(['localnet', 'devnet', 'mainnet-beta'] as const).map((net) => (
            <button
              key={net}
              type="button"
              onClick={() => setClusterTarget(net)}
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
                clusterTarget === net
                  ? 'bg-[#14F195] text-slate-950'
                  : 'bg-white/10 text-white/65 hover:text-white'
              }`}
            >
              {net}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-12 gap-3.5 p-4">
        {/* Left 7 Cols: Program Target & IDL Inspector */}
        <div className="col-span-7 space-y-2.5">
          <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#14F195]">
                programs/{program.name}/src/lib.rs
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                Verifiable Build ✔
              </span>
            </div>
            <div className="mt-1 font-mono text-[10.5px] text-white/60">
              declare_id!(&quot;{program.programId}&quot;);
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-white/10 pt-2 font-mono text-[10.5px]">
              <div>
                <span className="text-white/45">SBF Binary:</span>{' '}
                <strong className="text-white">{program.binarySizeKb} KB</strong>
              </div>
              <div>
                <span className="text-white/45">Avg CU:</span>{' '}
                <strong className="text-sky-300">
                  {program.computeUnitsAvg.toLocaleString()} CU
                </strong>
              </div>
              <div>
                <span className="text-white/45">Rent:</span>{' '}
                <strong className="text-[#14F195]">{program.rentExemptSol}</strong>
              </div>
            </div>
          </div>

          {/* IDL Instructions Table */}
          <div className="space-y-1.5">
            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
              Generated Anchor IDL Instructions ({program.idlMethods.length})
            </div>
            {program.idlMethods.map((fn) => (
              <div
                key={fn.name}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2 font-mono text-[11px]"
              >
                <div>
                  <span className="font-bold text-white">{fn.name}</span>
                  <div className="text-[10px] text-white/55">{fn.argsSignature}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9.5px] text-white/75">
                    {fn.accountsCount} accts
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${
                      fn.mutability === 'writable'
                        ? 'bg-amber-400/20 text-amber-300'
                        : 'bg-sky-400/20 text-sky-300'
                    }`}
                  >
                    {fn.mutability}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: Live Build & Localnet Validator Terminal Output */}
        <div className="col-span-5 flex flex-col justify-between rounded-xl border border-white/15 bg-[#070A12]/90 p-3 font-mono text-[10.5px]">
          <div className="space-y-1.5 leading-relaxed">
            <div className="text-white/50">$ anchor build --verifiable</div>
            <div className="text-emerald-400">
              ✔ Compiling {program.name} v0.1.0 (SBFv2 target)
            </div>
            <div className="text-sky-300">
              ✔ IDL written to target/idl/{program.name}.json
            </div>
            <div className="text-white/75">
              ↳ SHA256: <span className="text-purple-300">9f4c...82e1</span> (Matches On-Chain)
            </div>
            <div className="mt-2 border-t border-white/10 pt-2 text-white/50">
              $ solana-test-validator --ledger /solos/ramdisk
            </div>
            <div className="text-[#14F195]">
              ● Slot: 14,982 • 6,840 TPS • Finalized 0.4s
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-white/20 bg-white/10 py-1.5 font-sans text-[11px] font-semibold text-white hover:bg-white/20"
            >
              Run SBF Tests
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-gradient-to-r from-emerald-400 to-[#14F195] py-1.5 font-sans text-[11px] font-bold text-slate-950 shadow"
            >
              Deploy ({clusterTarget})
            </button>
          </div>
        </div>
      </div>
    </GlassWindow>
  );
};

export default BuilderSuiteWindow;
