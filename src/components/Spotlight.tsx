import React, { useEffect, useMemo, useState } from 'react';
import { useOSStore } from '../store/useOSStore';

const ENTRIES: { label: string; hint: string; view?: 'sandboxes' | 'vault' | 'shield' | 'builder' | 'terminal'; wallet?: 'phantom' | 'solflare' | 'backpack'; room?: 'main' | 'degen' | 'dev' | 'burner' }[] = [
  { label: 'App Cloner', hint: 'Isolated .exe namespaces', view: 'sandboxes' },
  { label: 'Quantum Vault', hint: 'ML-KEM-1024 container', view: 'vault' },
  { label: 'Anti-Drainer Shield', hint: 'Pre-sign simulation', view: 'shield' },
  { label: 'Builder Suite', hint: 'Anchor and id.json signer', view: 'builder' },
  { label: 'Solana OS Terminal', hint: 'Windows ConPTY bridge', view: 'terminal' },
  { label: 'Phantom', hint: 'Standalone wallet', wallet: 'phantom' },
  { label: 'Solflare', hint: 'Standalone wallet', wallet: 'solflare' },
  { label: 'Backpack', hint: 'Standalone wallet', wallet: 'backpack' },
  { label: 'Main Room', hint: 'Switch room', room: 'main', view: 'sandboxes' },
  { label: 'Degen Room', hint: 'Switch room', room: 'degen', view: 'sandboxes' },
  { label: 'Dev Room', hint: 'Switch room', room: 'dev', view: 'builder' },
];

export const Spotlight: React.FC = () => {
  const { setSpotlightOpen, openWindow, switchRoom, setShellView, setWalletBrand } = useOSStore();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.filter((e) => `${e.label} ${e.hint}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpotlightOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSpotlightOpen]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[18vh]"
      onClick={() => setSpotlightOpen(false)}
    >
      <div
        className="w-[640px] overflow-hidden rounded-[18px] border border-white/25"
        style={{
          background: 'rgba(30, 30, 34, 0.72)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Spotlight Search"
            className="w-full bg-transparent text-[18px] outline-none placeholder:text-white/45"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {results.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                openWindow('app-cloner');
                if (item.room) void switchRoom(item.room);
                if (item.view) setShellView(item.view);
                if (item.wallet) setWalletBrand(item.wallet);
                setSpotlightOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-white/15"
            >
              <span className="text-[14px] font-medium">{item.label}</span>
              <span className="text-[12px] text-white/50">{item.hint}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-white/50">No results</div>
          )}
        </div>
      </div>
    </div>
  );
};
