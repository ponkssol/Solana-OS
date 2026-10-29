import React, { useEffect, useRef, useState } from 'react';
import {
  cloneAppInstance,
  getEnclaveStatus,
  signWithRamEnclave,
  simulateSolanaTx,
  terminateSandbox,
  toggleFreezeProcess,
  type SandboxInstance,
} from '../lib/tauriBridge';
import { OSWindow, useOSStore, WindowId } from '../store/useOSStore';
import { MacOSDialogModal } from './MacOSDialogModal';
import { SidebarVibrancy, Stoplights } from './macosMaterials';
import { BuilderPanel, CloneSheet, ShieldPanel, VaultPanel, WalletPanel } from './ShellPanels';
import { TerminalWindow } from './TerminalWindow';

const SIDEBAR = [
  { section: '', items: ['Active Sandboxes', 'Quantum Enclave'] },
  {
    section: 'Isolated Rooms',
    items: ['Main Treasury', 'DeFi & Perps Trading', 'Burner Minting', 'Devnet Builder'],
  },
  {
    section: 'Security & Kernel',
    items: ['Anti-Drainer CPI Guard', 'Quantum Vault ML-KEM', 'Network Namespace', 'Solana OS Terminal'],
  },
];

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
    setShellView,
    setRoomFilter,
    setWalletBrand,
    lockVault,
  } = useOSStore();
  const [draggingId, setDraggingId] = useState<WindowId | null>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<SandboxInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>('ph-1');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [simulationOpen, setSimulationOpen] = useState(true);
  const [logs, setLogs] = useState<string[]>([
    '09:41  blocked SetAuthority on Burner Sandbox #02',
    '09:40  ClickFix clipboard payload dropped',
    '09:38  jup.ag origin verified',
  ]);
  const [validatorOn, setValidatorOn] = useState(true);
  const [notice, setNotice] = useState('');
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragged = useRef<Set<WindowId>>(new Set());

  useEffect(() => {
    void getEnclaveStatus().then((status) => setRows(status.sandboxes));
  }, []);

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
  const shown = rows.filter((item) => {
    if (roomFilter && item.room !== roomFilter) return false;
    if (query.trim() && !item.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const openNav = (item: string) => {
    if (item === 'Active Sandboxes') {
      setShellView('sandboxes');
      setRoomFilter(null);
    } else if (item === 'Main Treasury') setRoomFilter('treasury');
    else if (item === 'DeFi & Perps Trading') setRoomFilter('defi');
    else if (item === 'Burner Minting') setRoomFilter('burner');
    else if (item === 'Devnet Builder') setShellView('builder');
    else if (item === 'Quantum Enclave' || item === 'Quantum Vault ML-KEM') setShellView('vault');
    else if (item === 'Anti-Drainer CPI Guard' || item === 'Network Namespace') setShellView('shield');
    else if (item === 'Solana OS Terminal') setShellView('terminal');
  };

  const selected = rows.find((item) => item.id === selectedId) ?? shown[0];

  return (
    <div className="absolute inset-0" onMouseMove={onMove} onMouseUp={() => setDraggingId(null)}>
      {visible.map((win) => (
        <WindowFrame
          key={win.id}
          win={win}
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
              <VaultPanel
                locked={false}
                onLock={() => void lockVault()}
                onExport={() => setNotice('Exported vault.solos to the room mount.')}
                onRotate={() => setNotice('Kyber keypair rotation staged inside the enclave.')}
              />
            ) : shellView === 'shield' ? (
              <ShieldPanel logs={logs} onSimulate={() => void runSimulation()} />
            ) : shellView === 'builder' ? (
              <BuilderPanel
                validatorOn={validatorOn}
                onToggleValidator={() => setValidatorOn((value) => !value)}
                onOpenTerminal={() => setShellView('terminal')}
              />
            ) : shellView === 'terminal' ? (
              <TerminalWindow roomId={roomFilter ?? 'treasury'} />
            ) : (
              <ClonerBody
                rows={shown}
                query={query}
                selectedId={selected?.id ?? null}
                notice={notice}
                onQuery={setQuery}
                onSelect={setSelectedId}
                onClone={() => setCloneOpen(true)}
                onFreeze={() => selected && void toggleFreezeProcess(selected.id).then((next) => setRows(next.sandboxes))}
                onTerminate={() => selected && void terminateSandbox(selected.id).then((next) => setRows(next.sandboxes))}
                onLaunch={() => selected?.walletBrand && setWalletBrand(selected.walletBrand)}
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
      {cloneOpen && (
        <CloneSheet
          onCancel={() => setCloneOpen(false)}
          onClone={(appId, room) => {
            void cloneAppInstance(appId, room).then((next) => {
              setRows(next.sandboxes);
              setCloneOpen(false);
              setShellView('sandboxes');
            });
          }}
        />
      )}
      {simulationOpen && shellView === 'sandboxes' && (
        <MacOSDialogModal
          onSign={() => {
            void signWithRamEnclave().then(() => setSimulationOpen(false));
          }}
          onInspect={() => setLogs((prev) => ['09:42  CPI trace: Jupiter v6 route, no SetAuthority', ...prev])}
          onReject={() => setSimulationOpen(false)}
        />
      )}
    </div>
  );

  async function runSimulation() {
    const result = await simulateSolanaTx();
    setLogs((prev) => [`now  ${result.summary}`, ...prev]);
    setSimulationOpen(true);
    setShellView('sandboxes');
  }
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

function WindowFrame({
  win,
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

  return (
    <section
      className="absolute flex overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#1e1e1e] shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_18px_54px_rgba(0,0,0,0.57)]"
      style={style}
    >
      <aside className="relative flex h-full w-[240px] shrink-0 flex-col border-r border-white/[0.04]">
        <SidebarVibrancy />
        <div
          className="relative z-[1] flex h-[52px] items-center justify-between pl-[19px] pr-[8px]"
          onMouseDown={onDragStart}
        >
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
        <nav className="relative z-[1] w-full px-[14px]">
          {SIDEBAR.map((group) => (
            <div key={group.section || 'root'}>
              {group.section && (
                <div className="pb-[8px] pl-[4px] pt-[17px] text-[11px] font-[700] leading-[14px] text-[#8a8a8a]">
                  {group.section}
                </div>
              )}
              {group.items.map((item) => {
                const active = item === activeItem;
                return (
                  <button type="button" key={item} onClick={() => onNavigate(item)} className="relative flex h-[24px] w-full items-center gap-[4px] rounded-[5px] pr-[2px] text-left">
                    {active && (
                      <span className="absolute inset-y-0 -left-1 -right-1 rounded-[8px] bg-[#0d0d0d] [mix-blend-mode:plus-lighter]" />
                    )}
                    <SidebarIcon name={item} />
                    <span className="relative truncate text-[11px] font-[510] leading-[16px] text-[#f5f5f5]">
                      {item}
                      {item === 'Active Sandboxes' && <span className="ml-1 font-normal text-[#8a8a8a]">6</span>}
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

function ClonerBody({
  rows,
  query,
  selectedId,
  notice,
  onQuery,
  onSelect,
  onClone,
  onFreeze,
  onTerminate,
  onLaunch,
}: {
  rows: SandboxInstance[];
  query: string;
  selectedId: string | null;
  notice: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onClone: () => void;
  onFreeze: () => void;
  onTerminate: () => void;
  onLaunch: () => void;
}) {
  return (
    <>
      <div className="relative flex items-center gap-[8px] py-[8px] pl-[18px] pr-[8px]">
        <div className="absolute inset-0 border-b border-white/[0.04] bg-[rgba(31,31,31,0.55)] backdrop-blur-[3px]" />
        <div className="relative flex h-[28px] items-center rounded-[6px] border border-white/[0.06] bg-white/[0.05] p-[2px]">
          {['I', 'II', 'III', 'IV'].map((mark, index) => (
            <span
              key={mark}
              className={`flex h-[22px] w-[28px] items-center justify-center rounded-[5px] text-[10px] font-[510] text-[#f5f5f5] ${
                index === 0 ? 'bg-white/[0.14]' : ''
              }`}
            >
              {mark}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 text-center">
          <div className="truncate text-[13px] font-[700] leading-[15px] text-white/85 [mix-blend-mode:plus-lighter]">
            Universal App Cloner — cgroups v2 Enclave
          </div>
          <div className="truncate text-[11px] leading-[14px] text-[#8a8a8a]">
            vault.solos · ML-KEM-1024 · CRYSTALS-Dilithium
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

      <div className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.8fr] border-b border-white/[0.04] px-3 py-1 text-[11px] font-[700] leading-[14px] text-[#8a8a8a]">
        <span>Instance / Cloned Application</span>
        <span>Bound Wallet</span>
        <span>Namespace PID</span>
        <span>Enclave State</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {rows.map((row, index) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className="relative flex h-[28px] w-full items-center text-left text-[12px] font-[510]"
          >
            {index % 2 === 0 && (
              <span className="absolute inset-x-[10px] inset-y-0 rounded-[8px] bg-[rgba(255,255,255,0.04)]" />
            )}
            {selectedId === row.id && <span className="absolute inset-x-[10px] inset-y-0 rounded-[8px] bg-white/[0.06]" />}
            <span className="relative grid w-full grid-cols-[1.4fr_0.8fr_0.9fr_0.8fr] items-center px-2">
              <span className="flex items-center gap-2 truncate text-white">
                <FolderIcon />
                {row.name}
              </span>
              <span className="truncate font-mono text-[11px] text-white/70">{row.wallet}</span>
              <span className="truncate text-white/70">{row.namespace}</span>
              <span className="truncate" style={{ color: row.color }}>
                {row.stateLabel}
              </span>
            </span>
          </button>
        ))}
      </div>
      {notice && <div className="px-5 text-[12px] text-[#8a8a8a]">{notice}</div>}
      <div className="flex items-center gap-[8px] px-[20px] pb-[20px] pt-[12px]">
        <button type="button" onClick={onClone} className="h-[28px] rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-3 text-[13px] font-[510]">
          + Clone New App Instance
        </button>
        <button type="button" onClick={onTerminate} className="h-[28px] rounded-[6px] border border-[#ff383c]/20 bg-[#ff383c]/15 px-3 text-[13px] font-[510] text-[#ff383c]">
          Terminate Sandbox
        </button>
        <button type="button" onClick={onFreeze} className="h-[28px] rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-3 text-[13px] font-[510]">
          Freeze Process
        </button>
        <button type="button" onClick={onLaunch} className="os-btn os-btn-primary">
          Launch in Enclave
        </button>
      </div>
    </>
  );
}

function SidebarIcon({ name }: { name: string }) {
  const kind =
    name === 'Quantum Enclave' || name === 'Quantum Vault ML-KEM'
      ? 'lock'
      : name === 'Anti-Drainer CPI Guard'
        ? 'shield'
        :     name === 'Devnet Builder' || name === 'Solana OS Terminal'
          ? 'terminal'
          : name === 'Network Namespace'
            ? 'globe'
            : name === 'Active Sandboxes'
              ? 'layers'
              : 'folder';
  return (
    <span className="relative flex w-[24px] shrink-0 items-center justify-center">
      <SfIcon kind={kind} />
    </span>
  );
}

function activeSidebarItem(view: string, room: string | null): string {
  if (view === 'vault') return 'Quantum Vault ML-KEM';
  if (view === 'shield') return 'Anti-Drainer CPI Guard';
  if (view === 'builder') return 'Devnet Builder';
  if (view === 'terminal') return 'Solana OS Terminal';
  if (room === 'treasury') return 'Main Treasury';
  if (room === 'defi') return 'DeFi & Perps Trading';
  if (room === 'burner') return 'Burner Minting';
  return 'Active Sandboxes';
}

function FolderIcon() {
  return <SfIcon kind="folder" />;
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
