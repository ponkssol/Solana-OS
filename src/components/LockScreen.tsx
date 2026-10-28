import React, { useEffect, useRef, useState } from 'react';
import { useOSStore } from '../store/useOSStore';
import { BRAND_ASSETS } from '../tokens/designTokens';
import { WallpaperSvg } from './WallpaperSvg';

const RECOVERY_SLOTS = Array.from({ length: 24 }, (_, i) => i);

export const LockScreen: React.FC = () => {
  const { unlockVault, activeRoom } = useOSStore();
  const [passphrase, setPassphrase] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [sheet, setSheet] = useState<'restore' | 'create' | 'recovery' | null>(null);
  const [accountName, setAccountName] = useState('');
  const [words, setWords] = useState<string[]>(() => Array(24).fill(''));
  const passwordRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const dateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isUnlocking) return;
    setIsUnlocking(true);
    const secret = passphrase.trim() || accountName.trim() || 'passkey-mlkem1024';
    await unlockVault(secret);
    setIsUnlocking(false);
  };

  const bottomActions: { id: 'restore' | 'create' | 'recovery'; label: string; glyph: React.ReactNode }[] = [
    {
      id: 'restore',
      label: 'Restore vault.solos',
      glyph: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
          <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'create',
      label: 'Create account',
      glyph: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19" strokeLinecap="round" />
          <path d="M19 8v6M16 11h6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'recovery',
      label: '24-Word Recovery',
      glyph: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden text-white select-none">
      <WallpaperSvg blurred activeRoom={activeRoom} />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.05) 38%, rgba(0,0,0,0.28) 100%)',
        }}
      />

      <div className="absolute left-0 right-0 top-[11vh] z-10 text-center">
        <div
          className="text-[22px] font-medium tracking-[0.01em] text-white/90"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.35)' }}
        >
          {dateFormatted}
        </div>
        <div
          className="os-clock mt-1 text-[128px] leading-none tracking-[-0.045em] text-white"
          style={{ textShadow: '0 8px 30px rgba(0,0,0,0.28)' }}
        >
          09:41
        </div>
      </div>

      <div className="absolute bottom-[148px] left-0 right-0 z-10 flex flex-col items-center">
        <div
          className="mb-4 h-[86px] w-[86px] rounded-full p-[2px]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.18))',
            boxShadow: '0 16px 36px rgba(0,0,0,0.35)',
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
            style={{ background: 'radial-gradient(circle at 32% 28%, #3b1d78 0%, #0b1020 72%)' }}
          >
            <img src={BRAND_ASSETS.emblemOnlyWhite} alt="" className="relative z-[1] h-9 w-auto" />
          </div>
        </div>

        <div
          className="mb-3 text-[22px] font-semibold tracking-[-0.02em]"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.4)' }}
        >
          nanda.solos
        </div>

        <form
          onSubmit={handleUnlockSubmit}
          className="flex h-[36px] w-[248px] items-center rounded-full pl-4 pr-1"
          style={{
            background: 'rgba(255, 255, 255, 0.22)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '0.5px solid rgba(255, 255, 255, 0.42)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          <input
            ref={passwordRef}
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoFocus
            className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/70"
          />
          <button
            type="submit"
            disabled={isUnlocking}
            aria-label="Unlock"
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white/30"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4">
              <path d="M5 12h14" strokeLinecap="round" />
              <path d="m12 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>

      <div className="absolute bottom-[42px] left-0 right-0 z-10 flex items-start justify-center gap-[72px]">
        {bottomActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              if (action.id === 'restore') {
                setSheet('restore');
                passwordRef.current?.focus();
              } else {
                setSheet(action.id);
              }
            }}
            className="group flex w-[120px] flex-col items-center gap-2 text-[12px] font-medium text-white/85"
          >
            <span
              className="flex h-[40px] w-[40px] items-center justify-center rounded-full transition group-hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.16)',
                backdropFilter: 'blur(24px) saturate(180%)',
                border: '0.5px solid rgba(255,255,255,0.32)',
                boxShadow: '0 8px 18px rgba(0,0,0,0.25)',
              }}
            >
              {action.glyph}
            </span>
            <span className="leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}>
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {sheet === 'restore' && (
        <Sheet title="Restore vault.solos" onClose={() => setSheet(null)}>
          <p className="text-[13px] leading-relaxed text-white/75">
            Point Solana OS at an existing <span className="text-white">vault.solos</span> container.
            The daily PIN unwraps it with Argon2id and XChaCha20-Poly1305. The ML-KEM-1024 key stays
            inside the RAM enclave.
          </p>
          <button
            type="button"
            onClick={() => handleUnlockSubmit()}
            className="mt-4 h-9 w-full rounded-full bg-white text-[13px] font-semibold text-black"
          >
            {isUnlocking ? 'Unsealing…' : 'Unseal container'}
          </button>
        </Sheet>
      )}

      {sheet === 'create' && (
        <Sheet title="Create account" onClose={() => setSheet(null)}>
          <p className="mb-3 text-[13px] text-white/70">
            A new Room profile is sealed into vault.solos. Freemium starts on Main Room.
          </p>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="name.solos"
            className="h-9 w-full rounded-full border border-white/20 bg-white/10 px-4 text-[13px] outline-none placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={() => handleUnlockSubmit()}
            className="mt-4 h-9 w-full rounded-full bg-white text-[13px] font-semibold text-black"
          >
            {isUnlocking ? 'Creating…' : 'Create account'}
          </button>
        </Sheet>
      )}

      {sheet === 'recovery' && (
        <Sheet title="24-Word Recovery" onClose={() => setSheet(null)} wide>
          <p className="mb-3 text-[12.5px] text-white/70">
            Enter the recovery phrase generated at setup. It is used only to rebuild the enclave on a
            new machine.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {RECOVERY_SLOTS.map((i) => (
              <label key={i} className="flex items-center gap-1 rounded-lg bg-black/30 px-2 py-1">
                <span className="w-5 text-[10px] text-white/40">{i + 1}</span>
                <input
                  value={words[i]}
                  onChange={(e) => {
                    const next = words.slice();
                    next[i] = e.target.value;
                    setWords(next);
                  }}
                  className="w-full bg-transparent text-[12px] outline-none"
                  aria-label={`Recovery word ${i + 1}`}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => handleUnlockSubmit()}
            className="mt-4 h-9 w-full rounded-full bg-white text-[13px] font-semibold text-black"
          >
            {isUnlocking ? 'Verifying…' : 'Recover vault.solos'}
          </button>
        </Sheet>
      )}
    </div>
  );
};

function Sheet({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`rounded-[22px] border border-white/25 p-5 text-left ${wide ? 'w-[560px]' : 'w-[360px]'}`}
        style={{
          background: 'rgba(18, 20, 32, 0.78)',
          backdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
