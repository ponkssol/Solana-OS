import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getEnclaveStatus, type InstalledApp, type SandboxInstance } from '../lib/tauriBridge';
import { ipcContainmentFocus } from '../lib/tauriIpc';
import { useOSStore } from '../store/useOSStore';
import { ROOM_CONFIGS, type RoomId } from '../tokens/designTokens';
import { AppIcon } from './AppIcon';

type Tab = 'apps' | 'clones' | RoomId;

const TABS: { id: Tab; label: string }[] = [
  { id: 'apps', label: 'Apps' },
  { id: 'clones', label: 'Clones' },
  ...(Object.keys(ROOM_CONFIGS) as RoomId[]).map((id) => ({ id, label: ROOM_CONFIGS[id].label })),
];

export function Launchpad() {
  const { installedApps, appsState, appsError, loadInstalledApps, launchApp, setLaunchpadOpen } = useOSStore();
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ app: InstalledApp; x: number; y: number } | null>(null);
  const [tab, setTab] = useState<Tab>('apps');
  const [sandboxes, setSandboxes] = useState<SandboxInstance[] | null>(null);
  const [sandboxError, setSandboxError] = useState('');
  const lastLaunch = useRef({ key: '', at: 0 });

  useEffect(() => {
    if (tab === 'apps') return;
    let alive = true;
    const load = () =>
      getEnclaveStatus()
        .then((snapshot) => {
          if (!alive) return;
          setSandboxes(snapshot.sandboxes.filter((item) => item.status !== 'Stopped'));
          setSandboxError('');
          useOSStore.getState().rememberInstances(snapshot.sandboxes);
        })
        .catch((error) => alive && setSandboxError(String(error)));
    void load();
    const timer = window.setInterval(load, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [tab]);

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

  const instances = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sandboxes ?? [])
      .filter((item) => (tab === 'clones' ? item.cloned : item.roomId === tab))
      .filter((item) => !q || item.appName.toLowerCase().includes(q))
      .sort((a, b) => a.appName.localeCompare(b.appName) || a.cloneNumber - b.cloneNumber);
  }, [sandboxes, tab, query]);

  const showInstance = (item: SandboxInstance) => {
    setLaunchpadOpen(false);
    const hwnd = useOSStore.getState().focusHostedInstance(item.instanceId);
    if (hwnd) void ipcContainmentFocus(hwnd);
  };

  const open = (app: InstalledApp, clone: boolean) => {
    // A double-click delivers two clicks; only the first may launch.
    const key = `${app.path}|${clone}`;
    const now = Date.now();
    if (lastLaunch.current.key === key && now - lastLaunch.current.at < 1000) return;
    lastLaunch.current = { key, at: now };
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

      <div
        role="tablist"
        onClick={(event) => event.stopPropagation()}
        className="mt-5 flex max-w-[calc(100%-32px)] gap-[2px] overflow-x-auto rounded-[9px] bg-white/[0.08] p-[2px] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.08)]"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`h-[24px] shrink-0 whitespace-nowrap rounded-[7px] px-[14px] text-[12px] font-[590] transition-colors ${
              tab === item.id
                ? 'bg-white/[0.22] text-white shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_0_0_0.5px_rgba(255,255,255,0.12)]'
                : 'text-white/70 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== 'apps' ? (
        <div className="mt-8 w-full max-w-[95vw] flex-1 overflow-y-auto px-6 pb-[110px]">
          {sandboxError && <Status text={`Couldn't read running apps: ${sandboxError}`} />}
          {!sandboxError && sandboxes === null && <Status text="Loading…" />}
          {!sandboxError && sandboxes !== null && instances.length === 0 && (
            <Status
              text={
                tab === 'clones'
                  ? 'No clones are running. Right-click an app in Apps and choose Clone.'
                  : `Nothing is running in ${ROOM_CONFIGS[tab].label}. Switch to this room and open an app from Apps.`
              }
            />
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-7">
            {instances.map((item) => (
              <button
                key={item.instanceId}
                type="button"
                title={`${item.appName} · ${ROOM_CONFIGS[item.roomId as RoomId]?.label ?? item.roomId} · PID ${item.pid}`}
                onClick={(event) => {
                  event.stopPropagation();
                  showInstance(item);
                }}
                className="group flex flex-col items-center gap-2 rounded-[14px] px-1 py-2 outline-none focus-visible:bg-white/[0.08]"
              >
                <span className="transition-transform duration-100 group-active:scale-95">
                  <AppIcon path={item.exePath} name={item.appName} size={72} cloned={item.cloned} cloneNumber={item.cloneNumber} />
                </span>
                <span className="line-clamp-2 max-w-full text-center text-[12px] font-[510] leading-[15px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                  {item.appName}
                </span>
                <span className="-mt-1 text-[11px] text-white/55">{item.status === 'Frozen' ? 'Frozen' : `PID ${item.pid}`}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
      <div className="mt-8 w-full max-w-[95vw] flex-1 overflow-y-auto px-6 pb-[110px]">
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-7">
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
      )}

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
