import React, { useEffect, useMemo, useState } from 'react';
import type { InstalledApp } from '../lib/tauriBridge';
import { ShellView, useOSStore } from '../store/useOSStore';
import { AppIcon } from './AppIcon';

const SHELL_ENTRIES: { label: string; hint: string; view: ShellView }[] = [
  { label: 'Active Sandboxes', hint: 'Running apps', view: 'sandboxes' },
  { label: 'Quantum Vault', hint: 'vault.solos', view: 'vault' },
  { label: 'Anti-Drainer Shield', hint: 'Transaction guard', view: 'shield' },
  { label: 'Builder Suite', hint: 'Solana toolchain', view: 'builder' },
  { label: 'Solana OS Terminal', hint: 'Room shell', view: 'terminal' },
];

type Result = { kind: 'app'; app: InstalledApp } | { kind: 'shell'; label: string; hint: string; view: ShellView };

export const Spotlight: React.FC = () => {
  const { setSpotlightOpen, openWindow, setShellView, installedApps, appsState, loadInstalledApps, launchApp } = useOSStore();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (appsState === 'idle') void loadInstalledApps();
  }, [appsState, loadInstalledApps]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const apps = installedApps
      .filter((app) => !q || app.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
      .slice(0, q ? 8 : 6)
      .map((app): Result => ({ kind: 'app', app }));
    const shell = SHELL_ENTRIES.filter((e) => !q || `${e.label} ${e.hint}`.toLowerCase().includes(q)).map(
      (e): Result => ({ kind: 'shell', ...e }),
    );
    return [...apps, ...shell];
  }, [query, installedApps]);

  const run = (item: Result | undefined) => {
    if (!item) return;
    setSpotlightOpen(false);
    if (item.kind === 'app') {
      void launchApp(item.app, false);
      return;
    }
    openWindow('app-cloner');
    setShellView(item.view);
  };

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpotlightOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSpotlightOpen]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[18vh]" onClick={() => setSpotlightOpen(false)}>
      <div
        className="w-[min(560px,calc(100%-32px))] overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#1e1e1e] shadow-[0_18px_54px_rgba(0,0,0,0.45)]"
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
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                run(results[active]);
              }
            }}
            placeholder="Spotlight Search"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-white/45"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {results.map((item, index) => (
            <button
              key={item.kind === 'app' ? `app:${item.app.path}|${item.app.name}` : `shell:${item.label}`}
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => run(item)}
              className={`flex w-full items-center gap-3 rounded-[8px] px-[10px] py-[6px] text-left ${
                index === active ? 'bg-[#0A84FF]' : ''
              }`}
            >
              {item.kind === 'app' ? (
                <AppIcon path={item.app.path} name={item.app.name} size={24} />
              ) : (
                <span className="flex size-[24px] items-center justify-center rounded-[6px] bg-white/[0.08] text-[11px] font-[700]">
                  ◎
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {item.kind === 'app' ? item.app.name : item.label}
              </span>
              <span className={`text-[11px] ${index === active ? 'text-white/80' : 'text-white/50'}`}>
                {item.kind === 'app' ? 'Application' : item.hint}
              </span>
            </button>
          ))}
          {appsState === 'loading' && installedApps.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-white/50">Finding installed apps…</div>
          )}
          {appsState === 'error' && (
            <div className="px-3 py-2 text-[12px] text-white/50">Installed apps are unavailable outside the desktop app.</div>
          )}
          {results.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-white/50">No results</div>}
        </div>
      </div>
    </div>
  );
};
