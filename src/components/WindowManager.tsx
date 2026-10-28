import React, { useRef, useState } from 'react';
import { OSWindow, useOSStore, WindowId } from '../store/useOSStore';
import { SidebarVibrancy, Stoplights } from './macosMaterials';

const ROWS = [
  ['Phantom Standalone #01 (Treasury)', '7xKX…9fSol', 'PID 4102 · Landlock', 'Verified Active', '#14f195'],
  ['Phantom Standalone #02 (Burner Mint)', '3mPq…4kBurn', 'PID 4103 · Landlock', 'Isolated Net', '#0a99ff'],
  ['Cursor Sandbox IDE (Anchor Workspace)', '9vBn…2wStk', 'PID 4180 · SIGSTOP', 'Frozen (0% CPU)', '#38bdf8'],
  ['Solflare Native #01 (Validator Staking)', '9vBn…2wStk', 'PID 4408 · Landlock', 'Hardware Shard', '#c084fc'],
  ['Isolated Web3 Browser (Jupiter Perps)', '5xLm…8p Trade', 'PID 4512 · Landlock', 'CPI Shield ON', '#14f195'],
  ['vault.solos Post-Quantum Keyring Daemon', 'Shamir 2-of-3', 'PID 0812 · Ring-0', 'ML-KEM-1024', '#14f195'],
] as const;

const SIDEBAR = [
  { section: '', items: ['Active Sandboxes', 'Quantum Enclave'] },
  {
    section: 'Isolated Rooms',
    items: ['Main Treasury', 'DeFi & Perps Trading', 'Burner Minting', 'Devnet Builder'],
  },
  {
    section: 'Security & Kernel',
    items: ['Anti-Drainer CPI Guard', 'Quantum Vault ML-KEM', 'Network Namespace'],
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
    openWindow,
    toggleWindowFreeze,
  } = useOSStore();
  const [draggingId, setDraggingId] = useState<WindowId | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onMove = (event: React.MouseEvent) => {
    if (!draggingId) return;
    updateWindowPosition(
      draggingId,
      Math.max(8, event.clientX - dragOffset.current.x),
      Math.max(40, event.clientY - dragOffset.current.y),
    );
  };

  const visible = windows.filter((win) => win.isOpen && !win.isMinimized);
  const rows = ROWS.filter((row) => row[0].toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="absolute inset-0" onMouseMove={onMove} onMouseUp={() => setDraggingId(null)}>
      {visible.map((win) => (
        <WindowFrame
          key={win.id}
          win={win}
          onDragStart={(event) => {
            focusWindow(win.id);
            setDraggingId(win.id);
            dragOffset.current = { x: event.clientX - win.position.x, y: event.clientY - win.position.y };
          }}
          onClose={() => closeWindow(win.id)}
          onMinimize={() => minimizeWindow(win.id)}
          onZoom={() => toggleMaximizeWindow(win.id)}
          onFreeze={() => toggleWindowFreeze(win.id)}
        >
          {win.id === 'app-cloner' ? (
            <ClonerBody
              rows={rows}
              query={query}
              selected={selected}
              onQuery={setQuery}
              onSelect={setSelected}
              onOpen={openWindow}
            />
          ) : (
            <div className="p-6 text-[13px] font-[510] text-white/80">
              <div className="text-[13px] font-[700] text-white">{win.title}</div>
              <p className="mt-1 text-[11px] leading-[14px] text-[#8a8a8a]">{win.subtitle}</p>
            </div>
          )}
        </WindowFrame>
      ))}
    </div>
  );
};

function WindowFrame({
  win,
  children,
  onDragStart,
  onClose,
  onMinimize,
  onZoom,
  onFreeze,
}: {
  win: OSWindow;
  children: React.ReactNode;
  onDragStart: (event: React.MouseEvent) => void;
  onClose: () => void;
  onMinimize: () => void;
  onZoom: () => void;
  onFreeze: () => void;
}) {
  const style: React.CSSProperties = win.isMaximized
    ? { top: 40, left: 16, width: 'calc(100vw - 32px)', height: 'calc(100vh - 120px)', zIndex: win.zIndex }
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
              {group.items.map((item, index) => {
                const active = group.section === '' && index === 0;
                return (
                  <div key={item} className="relative flex h-[24px] w-full items-center gap-[4px] rounded-[5px] pr-[2px]">
                    {active && (
                      <span className="absolute inset-y-0 -left-1 -right-1 rounded-[8px] bg-[#0d0d0d] [mix-blend-mode:plus-lighter]" />
                    )}
                    <SidebarIcon name={item} />
                    <span className="relative truncate text-[11px] font-[510] leading-[16px] text-[#f5f5f5]">
                      {item}
                      {item === 'Active Sandboxes' && <span className="ml-1 font-normal text-[#8a8a8a]">6</span>}
                    </span>
                  </div>
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
  selected,
  onQuery,
  onSelect,
  onOpen,
}: {
  rows: readonly (readonly [string, string, string, string, string])[];
  query: string;
  selected: number;
  onQuery: (value: string) => void;
  onSelect: (index: number) => void;
  onOpen: (id: WindowId) => void;
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
        <label className="relative flex h-[28px] w-[168px] items-center gap-1.5 rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-2 focus-within:border-[#0088ff] focus-within:shadow-[0_0_0_3px_rgba(0,136,255,0.35)]">
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
            key={row[0]}
            type="button"
            onClick={() => onSelect(index)}
            className="relative flex h-[28px] w-full items-center text-left text-[12px] font-[510]"
          >
            {index % 2 === 0 && (
              <span className="absolute inset-x-[10px] inset-y-0 rounded-[8px] bg-[rgba(255,255,255,0.04)]" />
            )}
            {selected === index && <span className="absolute inset-x-[10px] inset-y-0 rounded-[8px] bg-white/[0.06]" />}
            <span className="relative grid w-full grid-cols-[1.4fr_0.8fr_0.9fr_0.8fr] items-center px-2">
              <span className="flex items-center gap-2 truncate text-white">
                <FolderIcon />
                {row[0]}
              </span>
              <span className="truncate font-mono text-[11px] text-white/70">{row[1]}</span>
              <span className="truncate text-white/70">{row[2]}</span>
              <span className="truncate" style={{ color: row[4] }}>
                {row[3]}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-[8px] px-[20px] pb-[20px] pt-[12px]">
        <button type="button" onClick={() => onOpen('phantom-wallet')} className="h-[28px] rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-3 text-[13px] font-[510]">
          Clone New App Instance
        </button>
        <button type="button" className="h-[28px] rounded-[6px] border border-[#ff383c]/20 bg-[#ff383c]/15 px-3 text-[13px] font-[510] text-[#ff383c]">
          Terminate Sandbox
        </button>
        <button type="button" className="h-[28px] rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-3 text-[13px] font-[510]">
          Freeze Process
        </button>
        <button type="button" onClick={() => onOpen('phantom-wallet')} className="h-[28px] rounded-[6px] bg-[#0088ff] px-3 text-[13px] font-[510] text-white">
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
        : name === 'Devnet Builder'
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
