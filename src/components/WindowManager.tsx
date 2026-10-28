import React, { useRef, useState } from 'react';
import { OSWindow, useOSStore, WindowId } from '../store/useOSStore';
import { ROOM_CONFIGS, RoomId, TRAFFIC_LIGHTS } from '../tokens/designTokens';
import { AppClonerWindow } from '../ui/components/AppClonerWindow';
import { BuilderSuiteWindow } from '../ui/components/BuilderSuiteWindow';
import { QuantumVaultWindow } from '../ui/components/QuantumVaultWindow';
import { WalletWindows } from '../ui/components/WalletWindows';
import type { WalletBrand } from '../ui/types';

const SIDEBAR_APPS: { label: string; id: WindowId }[] = [
  { label: 'Vault', id: 'vault-monitor' },
  { label: 'Cloner', id: 'app-cloner' },
  { label: 'Shield', id: 'degen-terminal' },
  { label: 'Builder', id: 'dev-console' },
  { label: 'Phantom', id: 'phantom-wallet' },
  { label: 'Solflare', id: 'solflare-wallet' },
  { label: 'Backpack', id: 'backpack-wallet' },
];

const SAMPLE_MEME_RADAR = [
  {
    ticker: '$SOLOS',
    name: 'Solana OS Quantum',
    mc: '$18.4M',
    liq: '$1.9M',
    mintAuth: 'Renounced',
    lpBurned: '100% Burned',
    risk: 'LOW',
    change: '+42.8%',
  },
  {
    ticker: '$MLKEM',
    name: 'Lattice Enclave',
    mc: '$6.2M',
    liq: '$640K',
    mintAuth: 'Renounced',
    lpBurned: '99.4% Locked',
    risk: 'LOW',
    change: '+19.3%',
  },
  {
    ticker: '$SONOMA',
    name: 'Silk Wave AI',
    mc: '$3.1M',
    liq: '$380K',
    mintAuth: 'Renounced',
    lpBurned: '96.0% Burned',
    risk: 'MEDIUM',
    change: '+11.5%',
  },
];

export const WindowManager: React.FC = () => {
  const {
    windows,
    activeRoom,
    vault,
    auditLogs,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    focusWindow,
    updateWindowPosition,
    openWindow,
    switchRoom,
    toggleVaultLock,
    toggleShield,
    spawnClonedInstance,
    toggleWindowFreeze,
  } = useOSStore();

  const [draggingId, setDraggingId] = useState<WindowId | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cliInput, setCliInput] = useState('solana-os enclave verify --cipher ML-KEM-1024');
  const [cliHistory, setCliHistory] = useState<string[]>([
    '$ anchor --version -> anchor-cli 0.31.0 (SVM Quantum Build)',
    '$ solana-os room status -> Isolated Key: MLKEM1024-ENCLAVE-DEV-7B1D',
    '$ cursor-cloner --state frozen -> Container PID 4418 [FROZEN • ZERO EGRESS]',
  ]);
  const [ephemeralNonce, setEphemeralNonce] = useState('0x99F4...E82A');

  const handleMouseDownTitle = (
    e: React.MouseEvent<HTMLDivElement>,
    win: OSWindow
  ) => {
    if (win.isMaximized) return;
    focusWindow(win.id);
    setDraggingId(win.id);
    dragOffset.current = {
      x: e.clientX - win.position.x,
      y: e.clientY - win.position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    const nextX = Math.max(12, Math.min(window.innerWidth - 280, e.clientX - dragOffset.current.x));
    const nextY = Math.max(34, Math.min(window.innerHeight - 140, e.clientY - dragOffset.current.y));
    updateWindowPosition(draggingId, nextX, nextY);
  };

  const handleMouseUp = () => {
    if (draggingId) {
      setDraggingId(null);
    }
  };

  const handleRunCli = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;
    setCliHistory((prev) => [
      ...prev,
      `$ ${cliInput}`,
      `✔ [ML-KEM-1024] Verified in ${vault.lastHandshakeMs}ms • Room=${ROOM_CONFIGS[activeRoom].label} • Key=${vault.keyIsolationId}`,
    ]);
    setCliInput('');
  };

  const currentRoomCfg = ROOM_CONFIGS[activeRoom];

  const renderWindowBody = (win: OSWindow) => {
    switch (win.id) {
      case 'vault-monitor':
        return (
          <div className="p-5 space-y-4 text-[12.5px]">
            {/* Top summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/[0.07] border border-white/15">
                <div className="text-[10.5px] uppercase tracking-wider text-white/55 font-semibold">
                  Enclave Container
                </div>
                <div className="text-[16px] font-bold text-white mt-0.5 flex items-center gap-2">
                  <span>{vault.enclaveName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#14f195]/20 text-[#14f195] border border-[#14f195]/30">
                    {vault.locked ? 'LOCKED' : 'UNSEALED'}
                  </span>
                </div>
                <div className="text-[11px] text-white/65 mt-1">
                  Owner: <span className="text-white font-medium">{vault.identity}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.07] border border-white/15">
                <div className="text-[10.5px] uppercase tracking-wider text-white/55 font-semibold">
                  Post-Quantum Cipher
                </div>
                <div className="text-[16px] font-bold text-[#14f195] mt-0.5">
                  {vault.cipherSuite}
                </div>
                <div className="text-[11px] text-white/65 mt-1">
                  FIPS-203 Lattice Encapsulation
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.07] border border-white/15">
                <div className="text-[10.5px] uppercase tracking-wider text-white/55 font-semibold">
                  Active Room Isolation
                </div>
                <div className="text-[15px] font-bold text-white mt-0.5 flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: currentRoomCfg.accentColor,
                      boxShadow: currentRoomCfg.accentGlow,
                    }}
                  />
                  <span>{currentRoomCfg.label}</span>
                </div>
                <div className="text-[11px] font-mono text-white/65 mt-1 truncate">
                  {vault.keyIsolationId}
                </div>
              </div>
            </div>

            {/* Room Key Isolation Matrix */}
            <div className="rounded-2xl bg-black/30 border border-white/15 p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  Hardware Key Isolation Per Room (Zero Cross-Room Key Leakage)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleShield}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/10 hover:bg-white/20 border border-white/15 transition"
                  >
                    {vault.shieldActive ? 'Shield: ON' : 'Shield: PAUSED'}
                  </button>
                  <button
                    type="button"
                    onClick={toggleVaultLock}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#14f195]/20 hover:bg-[#14f195]/30 text-[#14f195] border border-[#14f195]/30 transition"
                  >
                    {vault.locked ? 'Unseal vault.solos' : 'Lock Enclave'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['main', 'degen', 'dev', 'burner'] as RoomId[]).map((rId) => {
                  const cfg = ROOM_CONFIGS[rId];
                  const isCurrent = rId === activeRoom;
                  return (
                    <div
                      key={rId}
                      onClick={() => switchRoom(rId)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition ${
                        isCurrent
                          ? 'bg-white/15 border-white/35 shadow-sm'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: cfg.accentColor }}
                          />
                          <span>{cfg.label}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-white/75">
                          {isCurrent ? 'ACTIVE' : 'ISOLATED'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-white/70 mt-1">
                        {cfg.publicKeyShort}
                      </div>
                      <div className="text-[10.5px] text-white/55 mt-0.5">
                        {cfg.isolationPolicy}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Enclave Audit Feed */}
            <div className="rounded-xl bg-black/35 border border-white/10 p-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/55 mb-1.5">
                Tauri v2 Enclave IPC Telemetry Log
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[11px]">
                {auditLogs.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-white/80">
                    <span className="truncate">
                      <span className="text-[#14f195]">[{item.timestamp}]</span> {item.event}
                    </span>
                    <span className="text-[10px] text-white/45 ml-2 shrink-0">{item.cipher}</span>
                  </div>
                ))}
              </div>
            </div>
            <QuantumVaultWindow embedded />
          </div>
        );

      case 'degen-terminal':
        return (
          <div className="p-5 space-y-4 text-[12.5px]">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/15 border border-rose-400/30">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                  <span>Degen Room Alpha Radar • GMGN / On-Chain Rug Shield</span>
                </div>
                <div className="text-[11px] text-white/70">
                  Research-Only Mode enforced by <code className="text-white">vault.solos</code> • Signer isolated to{' '}
                  <span className="font-mono text-rose-200">{ROOM_CONFIGS.degen.publicKeyShort}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => switchRoom('degen')}
                className="px-3 py-1.5 rounded-xl text-[11.5px] font-semibold bg-rose-500/30 hover:bg-rose-500/45 border border-rose-300/40 transition"
              >
                {activeRoom === 'degen' ? 'In Degen Room' : 'Switch to Degen Room'}
              </button>
            </div>

            <div className="rounded-2xl bg-black/35 border border-white/15 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10.5px] uppercase tracking-wider text-white/55 bg-white/[0.04]">
                    <th className="py-2.5 px-3">Token</th>
                    <th className="py-2.5 px-3">Market Cap</th>
                    <th className="py-2.5 px-3">Liquidity</th>
                    <th className="py-2.5 px-3">Mint / Freeze</th>
                    <th className="py-2.5 px-3">LP Status</th>
                    <th className="py-2.5 px-3">Shield Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-[12px]">
                  {SAMPLE_MEME_RADAR.map((row) => (
                    <tr key={row.ticker} className="hover:bg-white/[0.06] transition">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white">{row.ticker}</div>
                        <div className="text-[10.5px] text-white/60">{row.name}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <div>{row.mc}</div>
                        <div className="text-[10.5px] text-[#14f195]">{row.change}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-white/85">{row.liq}</td>
                      <td className="py-2.5 px-3 text-[#14f195] font-medium">{row.mintAuth}</td>
                      <td className="py-2.5 px-3 text-sky-300 font-medium">{row.lpBurned}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                            row.risk === 'LOW'
                              ? 'bg-[#14f195]/20 text-[#14f195] border border-[#14f195]/30'
                              : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          }`}
                        >
                          {row.risk} RISK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11.5px]">
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/15">
                <div className="font-semibold text-white">Quantum Drain Protection</div>
                <div className="text-white/65 mt-0.5">
                  Blocks malicious <code className="text-rose-300">SetAuthority</code> & hidden token drainer instructions before signing.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.06] border border-white/15">
                <div className="font-semibold text-white">Approval Gate Policy</div>
                <div className="text-white/65 mt-0.5">
                  Zero auto-execution. Every swap requires explicit human passkey approval inside <code className="text-white">vault.solos</code>.
                </div>
              </div>
            </div>
          </div>
        );

      case 'dev-console':
        return (
          <div className="p-5 space-y-3.5 text-[12px] font-mono">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-sky-500/15 border border-sky-400/30 font-sans">
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Dev Room • SVM Builder & Frozen Cursor IDE Container</span>
                </div>
                <div className="text-[11px] text-white/70">
                  Cloned Cursor IDE state: <span className="text-sky-300 font-semibold">FROZEN (Blue Dot)</span> — Zero background telemetry while compiling Anchor programs.
                </div>
              </div>
              <button
                type="button"
                onClick={() => switchRoom('dev')}
                className="px-3 py-1.5 rounded-xl text-[11.5px] font-semibold bg-sky-500/30 hover:bg-sky-500/45 border border-sky-300/40 transition"
              >
                {activeRoom === 'dev' ? 'Active: Dev Room' : 'Activate Dev Room'}
              </button>
            </div>

            <div className="rounded-xl bg-black/55 border border-white/15 p-3.5 h-44 overflow-y-auto space-y-1.5 text-[11.5px]">
              {cliHistory.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.startsWith('✔')
                      ? 'text-[#14f195]'
                      : line.startsWith('$')
                      ? 'text-sky-300'
                      : 'text-white/80'
                  }
                >
                  {line}
                </div>
              ))}
            </div>

            <form onSubmit={handleRunCli} className="flex gap-2">
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="Run solana-os / anchor command..."
                className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-white outline-none focus:border-sky-400 text-[12px]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 text-[#14f195] border border-emerald-400/35 font-sans font-semibold text-[12px] transition"
              >
                Execute
              </button>
            </form>
            <BuilderSuiteWindow embedded />
          </div>
        );

      case 'burner-session':
        return (
          <div className="p-5 space-y-4 text-[12.5px]">
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">
                  Burner Room • Ephemeral RAM-Only Enclave
                </div>
                <div className="text-[11px] text-white/70">
                  Disposable subkey shreds automatically when locking Solana OS or rotating nonce.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const randomHex = Math.floor(1000 + Math.random() * 9000)
                    .toString(16)
                    .toUpperCase();
                  setEphemeralNonce(`0x${randomHex}...B91C`);
                  switchRoom('burner');
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/30 hover:bg-amber-500/45 border border-amber-300/40 text-amber-200 font-semibold text-[11.5px] transition"
              >
                Rotate & Shred Subkey
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-black/35 border border-white/15">
                <div className="text-[10.5px] uppercase text-white/55 font-semibold">
                  Active Ephemeral Session Nonce
                </div>
                <div className="text-[16px] font-mono font-bold text-amber-300 mt-1">
                  {ephemeralNonce}
                </div>
                <div className="text-[11px] text-white/60 mt-1">
                  Key ID: {ROOM_CONFIGS.burner.keyIsolationId}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/35 border border-white/15">
                <div className="text-[10.5px] uppercase text-white/55 font-semibold">
                  Zero-Trace Isolation Guarantees
                </div>
                <div className="text-[12px] text-white/85 mt-1">
                  • No persistent disk keychain write
                  <br />• Disconnected from <code className="text-white">nanda.solos</code> main vault
                </div>
              </div>
            </div>
          </div>
        );

      case 'app-cloner':
        return (
          <AppClonerWindow
            embedded
            onCloneNew={() => spawnClonedInstance('Isolated App', activeRoom)}
          />
        );

      case 'phantom-wallet':
      case 'solflare-wallet':
      case 'backpack-wallet': {
        const brand: WalletBrand =
          win.id === 'solflare-wallet' ? 'solflare' : win.id === 'backpack-wallet' ? 'backpack' : 'phantom';
        return <WalletWindows embedded initialBrand={brand} />;
      }

    }
  };

  return (
    <div
      className="relative w-full h-full flex-1 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top-Right Desktop Widget (exact macOS Sonoma widget from home.html) */}
      <div
        onClick={() => openWindow('vault-monitor')}
        className="fixed top-[48px] right-[24px] w-[260px] px-[18px] py-[16px] rounded-[20px] z-10 cursor-pointer transition hover:scale-[1.02]"
        style={{
          background: 'rgba(20, 22, 34, 0.44)',
          backdropFilter: 'blur(32px) saturate(180%)',
          border: '0.5px solid rgba(255, 255, 255, 0.22)',
          boxShadow:
            '0 16px 36px rgba(0, 0, 0, 0.24), inset 0 0.5px 0 rgba(255, 255, 255, 0.25)',
        }}
        title="Click to inspect Quantum Enclave Monitor"
      >
        <div
          className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.05em] mb-[10px]"
          style={{ color: 'rgba(255, 255, 255, 0.65)' }}
        >
          <span>Quantum Enclave</span>
          <span style={{ color: vault.locked ? '#f59e0b' : '#14f195' }}>
            &bull; {vault.locked ? 'Locked' : 'Active'}
          </span>
        </div>
        <div className="text-[16px] font-semibold text-white mb-[4px]">
          {vault.identity}
        </div>
        <div
          className="text-[12px] flex items-center gap-[6px]"
          style={{ color: 'rgba(255, 255, 255, 0.72)' }}
        >
          <span>{vault.enclaveName}</span>
          <span>&bull;</span>
          <span>{vault.cipherSuite}</span>
        </div>
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-white/60">Active Room:</span>
          <span
            className="font-semibold flex items-center gap-1.5"
            style={{ color: currentRoomCfg.accentColor }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: currentRoomCfg.accentColor }}
            />
            {currentRoomCfg.label}
          </span>
        </div>
      </div>

      {/* Render Open & Non-Minimized Windows */}
      {windows
        .filter((w) => w.isOpen && !w.isMinimized)
        .map((win) => {
          const rectStyle: React.CSSProperties = win.isMaximized
            ? {
                top: 34,
                left: 16,
                width: 'calc(100vw - 32px)',
                height: 'calc(100vh - 134px)',
                zIndex: win.zIndex,
              }
            : {
                top: win.position.y,
                left: win.position.x,
                width: win.size.width,
                height: win.size.height,
                zIndex: win.zIndex,
              };

          return (
            <section
              key={win.id}
              onMouseDown={() => focusWindow(win.id)}
              style={{
                ...rectStyle,
                background: 'rgba(16, 18, 30, 0.72)',
                backdropFilter: 'blur(36px) saturate(190%)',
                border: '0.5px solid rgba(255, 255, 255, 0.26)',
                boxShadow:
                  '0 24px 60px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
              }}
              className="fixed rounded-[20px] overflow-hidden flex flex-col transition-shadow duration-200"
            >
              {/* macOS Glassmorphic Window Title Bar with 3 Traffic Lights */}
              <div
                onMouseDown={(e) => handleMouseDownTitle(e, win)}
                onDoubleClick={() => toggleMaximizeWindow(win.id)}
                className="h-[42px] px-4 flex items-center justify-between border-b border-white/15 cursor-grab active:cursor-grabbing select-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                }}
              >
                {/* 3 macOS Traffic Lights: Red Close, Yellow Minimize, Green Maximize */}
                <div
                  className="flex items-center gap-[8px]"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => closeWindow(win.id)}
                    aria-label={`Close ${win.title}`}
                    className="w-[12px] h-[12px] rounded-full flex items-center justify-center group transition hover:brightness-110"
                    style={{
                      background: TRAFFIC_LIGHTS.close,
                      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.25)',
                    }}
                    title="Close Window"
                  >
                    <span className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-black/80 leading-none">
                      ×
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => minimizeWindow(win.id)}
                    aria-label={`Minimize ${win.title}`}
                    className="w-[12px] h-[12px] rounded-full flex items-center justify-center group transition hover:brightness-110"
                    style={{
                      background: TRAFFIC_LIGHTS.minimize,
                      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.25)',
                    }}
                    title="Minimize to Dock"
                  >
                    <span className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-black/80 leading-none">
                      −
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleMaximizeWindow(win.id)}
                    aria-label={`Maximize ${win.title}`}
                    className="w-[12px] h-[12px] rounded-full flex items-center justify-center group transition hover:brightness-110"
                    style={{
                      background: TRAFFIC_LIGHTS.maximize,
                      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.25)',
                    }}
                    title="Zoom / Maximize"
                  >
                    <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/80 leading-none">
                      +
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWindowFreeze(win.id)}
                    aria-label={`Freeze ${win.title}`}
                    title="Process Freeze"
                    className={`ml-1 flex h-[18px] items-center rounded-full border px-1.5 text-[10px] ${
                      win.isFrozen
                        ? 'border-sky-300/50 bg-sky-400/25 text-sky-100'
                        : 'border-white/15 bg-white/10 text-white/70'
                    }`}
                  >
                    ❄️
                  </button>
                </div>

                {/* Window Title & Subtitle */}
                <div className="flex flex-col items-center text-center min-w-0 px-3">
                  <div className="text-[12.5px] font-semibold text-white truncate">
                    {win.title}
                  </div>
                  <div className="text-[10px] text-white/55 truncate">
                    {win.subtitle}
                  </div>
                </div>

                {/* Right Enclave Badge */}
                <div className="flex items-center gap-1.5">
                  {win.isFrozen && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/35"
                      title="Frozen Container State"
                    >
                      ❄ FROZEN
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white/80 border border-white/15">
                    {win.badgeText}
                  </span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1">
                <aside
                  className="w-[156px] shrink-0 overflow-y-auto border-r border-white/10 px-2 py-3"
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    backdropFilter: 'blur(28px) saturate(180%)',
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
                    Rooms
                  </div>
                  {(['main', 'degen', 'dev', 'burner'] as RoomId[]).map((roomId) => {
                    const cfg = ROOM_CONFIGS[roomId];
                    const selected = roomId === activeRoom;
                    return (
                      <button
                        key={roomId}
                        type="button"
                        onClick={() => switchRoom(roomId)}
                        className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${
                          selected ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: cfg.accentColor }}
                        />
                        {cfg.label.replace(' Room', '')}
                      </button>
                    );
                  })}
                  <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
                    Apps
                  </div>
                  {SIDEBAR_APPS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openWindow(item.id)}
                      className={`mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-[12px] ${
                        win.id === item.id ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </aside>
                <div className="min-w-0 flex-1 overflow-y-auto">{renderWindowBody(win)}</div>
              </div>
            </section>
          );
        })}
    </div>
  );
};
