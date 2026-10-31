import React, { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  getEnclaveStatus,
  terminateSandbox,
  toggleFreezeProcess,
  type EnclaveSnapshot,
  type SandboxInstance,
} from '../lib/tauriBridge';
import { ipcContainmentFocus, isTauriRuntime, type ContainmentEvent } from '../lib/tauriIpc';
import { OSWindow, useOSStore, WindowId } from '../store/useOSStore';
import { ROOM_CONFIGS, RoomId } from '../tokens/designTokens';
import { AppIcon } from './AppIcon';
import { SidebarVibrancy, Stoplights } from './macosMaterials';
import { BuilderPanel, EmptyState, ShieldPanel, VaultPanel, WalletPanel } from './ShellPanels';
import { HostedApps } from './HostedApps';
import { TerminalWindow } from './TerminalWindow';

const ROOM_ITEMS = (Object.keys(ROOM_CONFIGS) as RoomId[]).map((id) => ({ id, label: ROOM_CONFIGS[id].label }));

const SIDEBAR = [
  { section: '', items: ['Active Sandboxes'] },
  { section: 'Rooms', items: ROOM_ITEMS.map((room) => room.label) },
  { section: 'Security & Tools', items: ['Quantum Vault', 'Anti-Drainer Shield', 'Builder Suite', 'Solana OS Terminal'] },
];

const STATUS_COLOR: Record<SandboxInstance['status'], string> = {
  Running: '#14f195',
  Frozen: '#38bdf8',
  Stopped: '#8e8e93',
};

export const WindowManager: React.FC = () => {
  const {
    windows,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowFrame,
    toggleWindowFreeze,
    shellView,
    roomFilter,
    walletBrand,
    activeRoom,
    vault,
    setShellView,
    setRoomFilter,
    setWalletBrand,
    lockVault,
    launchApp,
    rememberInstances,
    instanceBadges,
  } = useOSStore();
  const hostedCount = useOSStore((state) => state.hosted.length);
  const [draggingId, setDraggingId] = useState<WindowId | null>(null);
  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState<EnclaveSnapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragged = useRef<Set<WindowId>>(new Set());
  const clonerOpen = windows.some((win) => win.id === 'app-cloner' && win.isOpen);

  const refresh = useCallback(async () => {
    try {
      const next = await getEnclaveStatus();
      setSnapshot(next);
      setLoadError('');
      rememberInstances(next.sandboxes);
    } catch (error) {
      setLoadError(String(error));
    }
  }, [rememberInstances]);

  useEffect(() => {
    if (clonerOpen) void refresh();
  }, [clonerOpen, hostedCount, refresh]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const pending = listen<ContainmentEvent>('containment-window', (event) => {
      if (event.payload.kind === 'exited' || event.payload.kind === 'appeared') void refresh();
    });
    return () => {
      void pending.then((stop) => stop());
    };
  }, [refresh]);

  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { windows: openWindows } = useOSStore.getState();
      for (const win of openWindows) {
        if (win.isMaximized) continue;
        const frame = dragged.current.has(win.id) || win.id !== 'app-cloner'
          ? clampFrame(win.position.x, win.position.y, win.size.width, win.size.height, vw, vh)
          : preferredClonerFrame(vw, vh);
        if (
          frame.x !== win.position.x ||
          frame.y !== win.position.y ||
          frame.width !== win.size.width ||
          frame.height !== win.size.height
        ) {
          updateWindowFrame(win.id, frame);
        }
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [updateWindowFrame]);

  const onMove = (event: React.MouseEvent) => {
    if (!draggingId) return;
    const win = useOSStore.getState().windows.find((item) => item.id === draggingId);
    const width = win?.size.width ?? 280;
    const nextX = event.clientX - dragOffset.current.x;
    const nextY = event.clientY - dragOffset.current.y;
    updateWindowPosition(
      draggingId,
      Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - Math.min(width, window.innerWidth - 16))),
      Math.min(Math.max(36, nextY), Math.max(36, window.innerHeight - 80)),
    );
  };

  const visible = windows.filter((win) => win.isOpen && !win.isMinimized);
  const rows = (snapshot?.sandboxes ?? [])
    .filter((item) => !roomFilter || item.roomId === roomFilter)
    .filter((item) => !query.trim() || item.appName.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.launchedAtMs - a.launchedAtMs);
  const selected = rows.find((item) => item.instanceId === selectedId) ?? null;

  const openNav = (item: string) => {
    const room = ROOM_ITEMS.find((entry) => entry.label === item);
    if (item === 'Active Sandboxes') {
      setShellView('sandboxes');
      setRoomFilter(null);
    } else if (room) setRoomFilter(room.id);
    else if (item === 'Quantum Vault') setShellView('vault');
    else if (item === 'Anti-Drainer Shield') setShellView('shield');
    else if (item === 'Builder Suite') setShellView('builder');
    else if (item === 'Solana OS Terminal') setShellView('terminal');
  };

  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      useOSStore.getState().notify('Action failed', String(error));
    }
    await refresh();
  };

  const cloneSelected = () => {
    if (!selected) return;
    const base = selected.appName.replace(/\s+\(.*\)$/, '');
    void launchApp({ id: selected.appId, name: base, path: selected.exePath, args: [] }, true).then(refresh);
  };

  const focusSelected = () => {
    if (!selected) return;
    const hwnd = useOSStore.getState().focusHostedInstance(selected.instanceId);
    if (hwnd) void ipcContainmentFocus(hwnd);
  };

  return (
    <div className="absolute inset-0" onMouseMove={onMove} onMouseUp={() => setDraggingId(null)}>
      <HostedApps />
      {visible.map((win) => (
        <WindowFrame
          key={win.id}
          win={win}
          sandboxCount={snapshot?.sandboxes.filter((item) => item.status !== 'Stopped').length ?? 0}
          onDragStart={(event) => {
            focusWindow(win.id);
            dragged.current.add(win.id);
            setDraggingId(win.id);
            dragOffset.current = { x: event.clientX - win.position.x, y: event.clientY - win.position.y };
          }}
          onClose={() => closeWindow(win.id)}
          onMinimize={() => minimizeWindow(win.id)}
          onZoom={() => toggleMaximizeWindow(win.id)}
          onFreeze={() => toggleWindowFreeze(win.id)}
          onNavigate={openNav}
          activeItem={activeSidebarItem(shellView, roomFilter)}
        >
          {win.id === 'app-cloner' ? (
            shellView === 'vault' ? (
              <VaultPanel snapshot={snapshot} error={loadError} onLock={() => void lockVault()} />
            ) : shellView === 'shield' ? (
              <ShieldPanel active={vault.shieldActive} />
            ) : shellView === 'builder' ? (
              <BuilderPanel onOpenTerminal={() => setShellView('terminal')} />
            ) : shellView === 'terminal' ? (
              <TerminalWindow roomId={roomFilter ?? activeRoom} />
            ) : (
              <SandboxList
                rows={rows}
                loading={!snapshot && !loadError}
                error={loadError}
                title={roomFilter ? ROOM_CONFIGS[roomFilter as RoomId]?.label ?? 'Active Sandboxes' : 'Active Sandboxes'}
                query={query}
                selected={selected}
                badges={instanceBadges}
                onQuery={setQuery}
                onSelect={setSelectedId}
                onOpenLaunchpad={() => useOSStore.getState().setLaunchpadOpen(true)}
                onFocus={focusSelected}
                onClone={cloneSelected}
                onFreeze={() => selected && void act(() => toggleFreezeProcess(selected.instanceId))}
                onTerminate={() => selected && void act(() => terminateSandbox(selected.instanceId))}
              />
            )
          ) : (
            <div className="p-6 text-[13px] text-white/80">{win.title}</div>
          )}
        </WindowFrame>
      ))}
      {walletBrand && (
        <section className="absolute right-4 top-[88px] z-30 h-[min(360px,calc(100%-150px))] w-[min(320px,calc(100%-2rem))] overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#1e1e1e] shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_18px_40px_rgba(0,0,0,0.5)]">
          <WalletPanel brand={walletBrand} onClose={() => setWalletBrand(null)} />
        </section>
      )}
    </div>
  );
};

function preferredClonerFrame(vw: number, vh: number) {
  const top = 40;
  const bottom = 84;
  const reserve = Math.min(372, Math.max(0, vw - 760));
  const width = Math.round(Math.max(520, Math.min(vw - 32 - reserve, vw * 0.66)));
  const height = Math.round(Math.max(380, Math.min(vh - top - bottom, vh * 0.74)));
  return clampFrame(20, top, width, height, vw, vh);
}

function clampFrame(x: number, y: number, width: number, height: number, vw: number, vh: number) {
  const nextWidth = Math.min(width, Math.max(320, vw - 16));
  const nextHeight = Math.min(height, Math.max(240, vh - 48));
  return {
    x: Math.min(Math.max(8, x), Math.max(8, vw - nextWidth - 8)),
    y: Math.min(Math.max(32, y), Math.max(32, vh - nextHeight - 8)),
    width: nextWidth,
    height: nextHeight,
  };
}

const INTERACTIVE = 'button, input, textarea, select, a, [role="button"], [data-no-drag]';
const TITLEBAR_HEIGHT = 52;

function WindowFrame({
  win,
  sandboxCount,
  children,
  onDragStart,
  onClose,
  onMinimize,
  onZoom,
  onFreeze,
  onNavigate,
  activeItem,
}: {
  win: OSWindow;
  sandboxCount: number;
  children: React.ReactNode;
  onDragStart: (event: React.MouseEvent) => void;
  onClose: () => void;
  onMinimize: () => void;
  onZoom: () => void;
  onFreeze: () => void;
  onNavigate: (item: string) => void;
  activeItem: string;
}) {
  const style: React.CSSProperties = win.isMaximized
    ? { top: 36, left: 16, right: 16, bottom: 76, zIndex: win.zIndex }
    : { top: win.position.y, left: win.position.x, width: win.size.width, height: win.size.height, zIndex: win.zIndex };

  // Like macOS, the whole title/toolbar strip moves the window, not just the sidebar header.
  const onTitlebarDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || win.isMaximized) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    const top = event.currentTarget.getBoundingClientRect().top;
    if (event.clientY - top > TITLEBAR_HEIGHT) return;
    event.preventDefault();
    onDragStart(event);
  };

  return (
    <section
      onMouseDown={onTitlebarDown}
      onDoubleClick={(event) => {
        const top = event.currentTarget.getBoundingClientRect().top;
        if (event.clientY - top <= TITLEBAR_HEIGHT && !(event.target as HTMLElement).closest(INTERACTIVE)) onZoom();
      }}
      className="absolute flex overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#1e1e1e] shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_18px_54px_rgba(0,0,0,0.57)]"
      style={style}
    >
      <aside className="relative flex h-full w-[220px] shrink-0 flex-col border-r border-white/[0.04]">
        <SidebarVibrancy />
        <div className="relative z-[1] flex h-[52px] items-center justify-between pl-[19px] pr-[8px]">
          <Stoplights onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} />
          <button
            type="button"
            onClick={onFreeze}
            aria-label="Freeze"
            className="flex size-[28px] items-center justify-center rounded-[6px] border border-white/[0.06] bg-white/[0.05] text-[13px] text-[#f5f5f5]"
          >
            {win.isFrozen ? '❄' : '☰'}
          </button>
        </div>
        <nav className="relative z-[1] w-full px-[10px]">
          {SIDEBAR.map((group) => (
            <div key={group.section || 'root'}>
              {group.section && (
                <div className="pb-[6px] pl-[10px] pt-[17px] text-[11px] font-[700] leading-[14px] text-[#8a8a8a]">
                  {group.section}
                </div>
              )}
              {group.items.map((item) => {
                const active = item === activeItem;
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => onNavigate(item)}
                    className={`relative flex h-[26px] w-full items-center gap-[6px] rounded-[6px] pl-[8px] pr-[8px] text-left ${
                      active ? 'bg-white/[0.1]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <SidebarIcon name={item} />
                    <span className="relative truncate text-[11px] font-[510] leading-[16px] text-[#f5f5f5]">
                      {item}
                      {item === 'Active Sandboxes' && <span className="ml-1 font-normal text-[#8a8a8a]">{sandboxCount}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">{children}</div>
    </section>
  );
}

const COLUMNS = 'grid-cols-[1.6fr_0.8fr_0.6fr_0.7fr]';

function SandboxList({
  rows,
  loading,
  error,
  title,
  query,
  selected,
  badges,
  onQuery,
  onSelect,
  onOpenLaunchpad,
  onFocus,
  onClone,
  onFreeze,
  onTerminate,
}: {
  rows: SandboxInstance[];
  loading: boolean;
  error: string;
  title: string;
  query: string;
  selected: SandboxInstance | null;
  badges: Record<string, { cloned: boolean; cloneNumber: number }>;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onOpenLaunchpad: () => void;
  onFocus: () => void;
  onClone: () => void;
  onFreeze: () => void;
  onTerminate: () => void;
}) {
  const live = selected && selected.status !== 'Stopped';
  return (
    <>
      <div className="relative flex h-[52px] shrink-0 items-center gap-[8px] pl-[18px] pr-[10px]">
        <div className="absolute inset-0 border-b border-white/[0.04] bg-[rgba(31,31,31,0.55)] backdrop-blur-[3px]" />
        <div className="relative min-w-0 flex-1">
          <div className="truncate text-[13px] font-[700] leading-[15px] text-white/85">{title}</div>
          <div className="truncate text-[11px] leading-[14px] text-[#8a8a8a]">
            {rows.length} {rows.length === 1 ? 'instance' : 'instances'}
          </div>
        </div>
        <label className="relative flex h-[26px] w-[168px] items-center gap-1.5 rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-2 focus-within:border-[#0A84FF]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search instances"
            className="w-full bg-transparent text-[13px] text-white/85 outline-none placeholder:text-[#8a8a8a]"
          />
        </label>
      </div>

      <div className={`grid ${COLUMNS} border-b border-white/[0.04] px-[22px] py-1 text-[11px] font-[700] leading-[14px] text-[#8a8a8a]`}>
        <span>Application</span>
        <span>Room</span>
        <span>PID</span>
        <span>Status</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-[10px] py-[6px]">
        {loading && <EmptyState text="Loading instances…" />}
        {error && <EmptyState text={`Couldn't read running apps: ${error}`} />}
        {!loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-[12px] text-[#8a8a8a]">
            No apps are running in this room yet.
            <button type="button" onClick={onOpenLaunchpad} className="os-btn os-btn-primary">
              Open Launchpad
            </button>
          </div>
        )}
        {rows.map((row, index) => {
          const isSelected = selected?.instanceId === row.instanceId;
          const badge = badges[row.instanceId] ?? row;
          return (
            <button
              key={row.instanceId}
              type="button"
              onClick={() => onSelect(row.instanceId)}
              onDoubleClick={onFocus}
              className={`grid h-[30px] w-full ${COLUMNS} items-center rounded-[8px] px-[12px] text-left text-[12px] font-[510] ${
                isSelected ? 'bg-[#0A84FF]/80' : index % 2 === 0 ? 'bg-white/[0.035]' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-[8px] text-white">
                <AppIcon path={row.exePath} name={row.appName} size={18} cloned={badge.cloned} cloneNumber={badge.cloneNumber} />
                <span className="truncate">{row.appName}</span>
              </span>
              <span className="truncate text-white/70">{ROOM_CONFIGS[row.roomId as RoomId]?.label ?? row.roomId}</span>
              <span className="truncate font-mono text-[11px] text-white/70">{row.pid}</span>
              <span className="truncate" style={{ color: isSelected ? '#fff' : STATUS_COLOR[row.status] }}>
                {row.status}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-[8px] border-t border-white/[0.04] px-[20px] py-[12px]">
        <button type="button" onClick={onOpenLaunchpad} className="os-btn">
          Launchpad
        </button>
        <div className="flex-1" />
        <button type="button" disabled={!live} onClick={onClone} className="os-btn disabled:opacity-40">
          Clone
        </button>
        <button type="button" disabled={!live} onClick={onFreeze} className="os-btn disabled:opacity-40">
          {selected?.status === 'Frozen' ? 'Resume' : 'Freeze'}
        </button>
        <button
          type="button"
          disabled={!live}
          onClick={onTerminate}
          className="h-[28px] rounded-[6px] border border-[#ff383c]/20 bg-[#ff383c]/15 px-3 text-[13px] font-[510] text-[#ff383c] disabled:opacity-40"
        >
          Quit
        </button>
        <button type="button" disabled={!live} onClick={onFocus} className="os-btn os-btn-primary disabled:opacity-40">
          Show Window
        </button>
      </div>
    </>
  );
}

function SidebarIcon({ name }: { name: string }) {
  const kind =
    name === 'Quantum Vault'
      ? 'lock'
      : name === 'Anti-Drainer Shield'
        ? 'shield'
        : name === 'Builder Suite' || name === 'Solana OS Terminal'
          ? 'terminal'
          : name === 'Active Sandboxes'
            ? 'layers'
            : 'folder';
  return (
    <span className="relative flex w-[18px] shrink-0 items-center justify-center">
      <SfIcon kind={kind} />
    </span>
  );
}

function activeSidebarItem(view: string, room: string | null): string {
  if (view === 'vault') return 'Quantum Vault';
  if (view === 'shield') return 'Anti-Drainer Shield';
  if (view === 'builder') return 'Builder Suite';
  if (view === 'terminal') return 'Solana OS Terminal';
  return ROOM_ITEMS.find((entry) => entry.id === room)?.label ?? 'Active Sandboxes';
}

function SfIcon({ kind }: { kind: 'folder' | 'layers' | 'lock' | 'shield' | 'terminal' | 'globe' }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 15 15',
    fill: 'none',
    'aria-hidden': true as const,
    className: 'block shrink-0',
  };
  if (kind === 'folder') {
    return (
      <svg {...common}>
        <path fill="#0A84FF" d="M1.4 3.2A1.2 1.2 0 0 1 2.6 2h3.1l1.15 1.3h5.55A1.2 1.2 0 0 1 13.6 4.5v7.3a1.2 1.2 0 0 1-1.2 1.2H2.6a1.2 1.2 0 0 1-1.2-1.2V3.2Z" />
      </svg>
    );
  }
  if (kind === 'layers') {
    return (
      <svg {...common}>
        <path fill="#0A84FF" d="M7.5 1.6 13 4.5 7.5 7.4 2 4.5 7.5 1.6Zm5.2 4.15L7.5 8.7 2.3 5.75 1.4 6.25 7.5 9.5l6.1-3.25-.9-.5Zm0 2.7L7.5 11.4 2.3 8.45l-.9.5L7.5 12.2l6.1-3.25-.9-.5Z" />
      </svg>
    );
  }
  if (kind === 'lock') {
    return (
      <svg {...common}>
        <path fill="#0A84FF" d="M4.2 6.2V4.7a3.3 3.3 0 0 1 6.6 0v1.5h.7A1.3 1.3 0 0 1 12.8 7.5v4.7a1.3 1.3 0 0 1-1.3 1.3H3.5a1.3 1.3 0 0 1-1.3-1.3V7.5a1.3 1.3 0 0 1 1.3-1.3h.7Zm1.3 0h4.0V4.7a2 2 0 0 0-4 0v1.5Z" />
      </svg>
    );
  }
  if (kind === 'shield') {
    return (
      <svg {...common}>
        <path fill="#0A84FF" d="M7.5 1.4 12.6 3.2v3.9c0 3-2 5.2-5.1 6.5C4.4 12.3 2.4 10.1 2.4 7.1V3.2L7.5 1.4Z" />
      </svg>
    );
  }
  if (kind === 'globe') {
    return (
      <svg {...common}>
        <circle cx="7.5" cy="7.5" r="5.4" stroke="#0A84FF" strokeWidth="1.3" />
        <path stroke="#0A84FF" strokeWidth="1.2" d="M2.2 7.5h10.6M7.5 2.1c1.5 1.6 2.2 3.4 2.2 5.4s-.7 3.8-2.2 5.4c-1.5-1.6-2.2-3.4-2.2-5.4s.7-3.8 2.2-5.4Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path stroke="#0A84FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" d="M2 11.2 6.2 7l2 2L12.8 3.2M9.2 3.2h3.6V6.8" />
    </svg>
  );
}
