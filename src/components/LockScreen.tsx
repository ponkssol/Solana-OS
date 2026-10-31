import React, { useEffect, useState } from 'react';
import { ipcDiagLog } from '../lib/tauriIpc';
import { useOSStore } from '../store/useOSStore';
import { BRAND_ASSETS } from '../tokens/designTokens';
import { WALLPAPER, WIFI_ICON } from './macosMaterials';

export const LockScreen: React.FC = () => {
  // Lands in solana-os.log next to the backend input probe, to tell a click that never
  // reaches the page apart from one the page ignores.
  useEffect(() => {
    void ipcDiagLog('lock screen mounted').catch(() => undefined);
    const onPointer = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.tagName.toLowerCase() : 'none';
      void ipcDiagLog(`lock screen pointerdown at ${event.clientX},${event.clientY} on ${target}`).catch(() => undefined);
    };
    window.addEventListener('pointerdown', onPointer, { capture: true, once: true });
    return () => window.removeEventListener('pointerdown', onPointer, { capture: true });
  }, []);

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

      <div className="absolute left-0 right-0 top-[14vh] text-center">
        <img
          src={BRAND_ASSETS.logoWhite}
          alt="SOLANA OS"
          width={2172}
          height={724}
          draggable={false}
          className="mx-auto mb-3 block h-auto w-[min(240px,46vw)]"
        />
        <div className="text-[15px] font-[510] text-white/90">Thursday, October 29</div>
        <div className="os-clock text-[length:var(--os-type-clock)] leading-none tracking-[-0.04em]">01:14</div>
      </div>

      <form
        className="absolute left-1/2 top-[46%] flex w-[240px] -translate-x-1/2 flex-col items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void unlock();
        }}
      >
        <div className="mb-3 flex size-[64px] items-center justify-center rounded-full border border-white/[0.06] bg-[#1a1030]">
          <img src={BRAND_ASSETS.emblemOnlyWhite} alt="" className="h-8 w-auto" />
        </div>
        <div className="mb-3 text-[13px] font-[590]">nanda.solos</div>
        <div
          className="flex h-[26px] w-full items-center rounded-full border border-white/[0.06] bg-white/10 px-3"
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
            className="w-[min(360px,calc(100%-32px))] rounded-[16px] border border-white/[0.06] p-4"
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
              className="os-btn os-btn-primary w-full"
            >
              {busy ? 'Unsealing…' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
