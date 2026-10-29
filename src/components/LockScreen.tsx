import React, { useState } from 'react';
import { useOSStore } from '../store/useOSStore';
import { BRAND_ASSETS } from '../tokens/designTokens';
import { WALLPAPER, WIFI_ICON } from './macosMaterials';

export const LockScreen: React.FC = () => {
  const { unlockVault, setScreen } = useOSStore();
  const [passphrase, setPassphrase] = useState('solana');
  const [sheet, setSheet] = useState<'restore' | 'create' | 'recovery' | null>(null);
  const [busy, setBusy] = useState(false);

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    await unlockVault(passphrase.trim() || 'passkey-mlkem1024');
    setBusy(false);
  };

  return (
    <div className="relative h-full w-full overflow-hidden text-white select-none">
      <img src={WALLPAPER} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-[28px]" />
      <div className="absolute inset-0 bg-black/25" />

      <div className="absolute right-[18px] top-[10px] flex items-center gap-3 text-[12px] font-[590]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[11px]">
          <span className="size-1.5 rounded-full bg-[#14f195]" />
          On-Chain Verified · ML-KEM-1024
        </span>
        <span>100%</span>
        <img src={WIFI_ICON} alt="" className="h-[16px] w-[28px]" />
      </div>

      <div className="absolute left-0 right-0 top-[18vh] text-center">
        <div className="text-[20px] font-[510] text-white/90">Thursday, October 29</div>
        <div className="os-clock text-[96px] leading-none tracking-[-0.04em]">01:14</div>
      </div>

      <form
        className="absolute left-1/2 top-[46%] flex w-[240px] -translate-x-1/2 flex-col items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void unlock();
        }}
      >
        <div className="mb-3 flex size-[74px] items-center justify-center rounded-full bg-[#1a1030] shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-2 ring-white/30">
          <img src={BRAND_ASSETS.emblemOnlyWhite} alt="" className="h-8 w-auto" />
        </div>
        <div className="mb-3 text-[18px] font-[590]">nanda.solos</div>
        <div
          className="flex h-[32px] w-full items-center rounded-[1000px] px-4"
          style={{
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
          }}
        >
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            aria-label="Password"
            className="w-full bg-transparent text-center text-[13px] tracking-[0.28em] outline-none"
          />
          <button type="submit" aria-label="Unlock" className="text-[14px] text-white/80">
            →
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-white/70">
          <button type="button" onClick={() => setSheet('restore')}>
            Restore vault.solos
          </button>
          <span>·</span>
          <button type="button" onClick={() => setSheet('create')}>
            Create account
          </button>
        </div>
      </form>

      <div className="absolute bottom-[36px] left-0 right-0 flex justify-center gap-16 text-[12px] text-white/80">
        <button type="button" onClick={() => setSheet('recovery')} className="flex flex-col items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-xl">⌂</span>
          24-Word Recovery
        </button>
        <button type="button" onClick={() => setScreen('boot')} className="flex flex-col items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-xl">⏻</span>
          Switch to Windows
        </button>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" onClick={() => setSheet(null)}>
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-[360px] rounded-[16px] border border-white/20 p-5"
            style={{ background: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(40px)' }}
          >
            <h2 className="mb-2 text-[13px] font-[700]">
              {sheet === 'restore' && 'Restore vault.solos'}
              {sheet === 'create' && 'Create account'}
              {sheet === 'recovery' && '24-Word Recovery'}
            </h2>
            <p className="mb-4 text-[11px] leading-[14px] text-white/70">
              {sheet === 'recovery'
                ? 'Enter the recovery phrase on a new machine. The daily PIN still unwraps the container with Argon2id.'
                : 'Unseal the portable container. The ML-KEM shared secret stays in the signing enclave.'}
            </p>
            <button
              type="button"
              onClick={() => void unlock()}
              className="h-[28px] w-full rounded-[6px] bg-[#0088ff] text-[13px] font-[510]"
            >
              {busy ? 'Unsealing…' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
