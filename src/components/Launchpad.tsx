import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InstalledApp } from '../lib/tauriBridge';
import { useOSStore } from '../store/useOSStore';
import { AppIcon } from './AppIcon';

export function Launchpad() {
  const { installedApps, appsState, appsError, loadInstalledApps, launchApp, setLaunchpadOpen } = useOSStore();
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ app: InstalledApp; x: number; y: number } | null>(null);

  useEffect(() => {
    if (appsState === 'idle') void loadInstalledApps();
  }, [appsState, loadInstalledApps]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (menu) setMenu(null);
      else setLaunchpadOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, setLaunchpadOpen]);

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? installedApps.filter((app) => app.name.toLowerCase().includes(q)) : installedApps;
  }, [installedApps, query]);

  const open = (app: InstalledApp, clone: boolean) => {
    setMenu(null);
    setLaunchpadOpen(false);
    void launchApp(app, clone);
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex flex-col items-center bg-black/30 backdrop-blur-[36px] backdrop-saturate-150"
      onClick={() => (menu ? setMenu(null) : setLaunchpadOpen(false))}
      onContextMenu={(event) => event.preventDefault()}
    >
      <label
        onClick={(event) => event.stopPropagation()}
        className="mt-[64px] flex h-[30px] w-[min(240px,calc(100%-32px))] items-center gap-2 rounded-[8px] border border-white/[0.12] bg-white/[0.08] px-2.5 focus-within:border-[#0A84FF]"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.4" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search apps"
          className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-white/50"
        />
      </label>

      <div className="mt-8 w-full max-w-[1080px] flex-1 overflow-y-auto px-10 pb-[110px]">
        {appsState === 'loading' && installedApps.length === 0 && <Status text="Finding installed apps…" />}
        {appsState === 'error' && (
          <Status text={`Couldn't read installed apps: ${appsError}`}>
            <button
              type="button"
              className="os-btn mt-3"
              onClick={(event) => {
                event.stopPropagation();
                void loadInstalledApps();
              }}
            >
              Try Again
            </button>
          </Status>
        )}
        {appsState === 'ready' && apps.length === 0 && (
          <Status text={query ? `No apps match “${query}”.` : 'No installed apps were found in the Start Menu.'} />
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-x-4 gap-y-7">
          {apps.map((app) => (
            <button
              key={`${app.path}|${app.name}`}
              type="button"
              title={app.name}
              onClick={(event) => {
                event.stopPropagation();
                open(app, false);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setMenu({ app, x: event.clientX, y: event.clientY });
              }}
              className="group flex flex-col items-center gap-2 rounded-[14px] px-1 py-2 outline-none focus-visible:bg-white/[0.08]"
            >
              <span className="transition-transform duration-100 group-active:scale-95">
                <AppIcon path={app.path} name={app.name} size={72} />
              </span>
              <span className="line-clamp-2 max-w-full text-center text-[12px] font-[510] leading-[15px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                {app.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {menu && (
        <div
          role="menu"
          onClick={(event) => event.stopPropagation()}
          className="fixed z-[76] w-[168px] rounded-[10px] border border-white/[0.1] bg-[rgba(40,40,42,0.92)] p-[5px] shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-[30px]"
          style={{ left: Math.min(menu.x, window.innerWidth - 176), top: Math.min(menu.y, window.innerHeight - 80) }}
        >
          <MenuItem label="Open" onClick={() => open(menu.app, false)} />
          <MenuItem label="Clone" onClick={() => open(menu.app, true)} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-[24px] w-full items-center rounded-[5px] px-[9px] text-left text-[13px] text-white/90 hover:bg-[#0A84FF] hover:text-white"
    >
      {label}
    </button>
  );
}

function Status({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-16 text-center text-[13px] text-white/70">
      {text}
      {children}
    </div>
  );
}
