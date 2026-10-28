import React, { useEffect, useState } from 'react';
import { useOSStore } from '../store/useOSStore';
import { BRAND_ASSETS, ROOM_CONFIGS, RoomId } from '../tokens/designTokens';
import { ControlCenter } from '../ui/components/ControlCenter';

const ROOM_ORDER: RoomId[] = ['main', 'degen', 'dev', 'burner'];

export const TopMenuBar: React.FC = () => {
  const {
    activeRoom,
    vault,
    switchRoom,
    openWindow,
    lockVault,
    toggleVaultLock,
    toggleShield,
    setScreen,
    setSpotlightOpen,
    processFreezeActive,
    frozenProcessCount,
    toggleProcessFreeze,
    displayBrightness,
    setDisplayBrightness,
  } = useOSStore();

  const [roomMenuOpen, setRoomMenuOpen] = useState(false);
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const currentRoom = ROOM_CONFIGS[activeRoom];

  const formattedClock = `${now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}  ${now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 flex h-[28px] select-none items-center justify-between px-[14px] text-[13px]"
        style={{
          background: 'rgba(22, 22, 26, 0.38)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '0.5px solid rgba(255, 255, 255, 0.16)',
          color: 'rgba(255, 255, 255, 0.94)',
        }}
      >
        {/* Left Menu Items */}
        <div className="flex items-center gap-[16px]">
          {/* Brand Emblem + System Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSystemMenuOpen((v) => !v);
                setRoomMenuOpen(false);
                setControlCenterOpen(false);
              }}
              className="flex items-center gap-[8px] font-bold tracking-[-0.01em] hover:opacity-85 transition"
            >
              <img
                src={BRAND_ASSETS.emblemOnlyWhite}
                alt="Solana OS"
                className="h-[13px] w-auto block"
              />
              <span>Solana OS</span>
            </button>

            {systemMenuOpen && (
              <div
                className="absolute left-0 top-[26px] w-56 rounded-xl p-1.5 text-[12px] shadow-2xl border border-white/20 z-50"
                style={{
                  background: 'rgba(16, 18, 30, 0.86)',
                  backdropFilter: 'blur(32px) saturate(180%)',
                }}
              >
                <div className="px-2.5 py-1.5 border-b border-white/10">
                  <div className="font-semibold text-white">Solana OS Sequoia Enclave</div>
                  <div className="text-[11px] text-white/60">
                    Identity: {vault.identity} &bull; {vault.cipherSuite}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openWindow('vault-monitor');
                    setSystemMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/15 transition flex items-center justify-between"
                >
                  <span>About vault.solos</span>
                  <span className="text-[10px] text-[#14f195]">ML-KEM-1024</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSystemMenuOpen(false);
                    lockVault();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/15 transition flex items-center justify-between"
                >
                  <span>Lock Screen (Seal Enclave)</span>
                  <span className="text-[10px] text-white/50">⌘L</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSystemMenuOpen(false);
                    setScreen('boot');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/15 transition text-rose-300"
                >
                  Reboot Enclave Kernel...
                </button>
              </div>
            )}
          </div>

          {/* Interactive Room Switcher Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setRoomMenuOpen((v) => !v);
                setSystemMenuOpen(false);
                setControlCenterOpen(false);
              }}
              className="inline-flex items-center gap-[6px] px-[9px] py-[2px] rounded-full text-[12px] font-semibold transition hover:brightness-110"
              style={{
                background: currentRoom.badgeBg,
                border: `0.5px solid ${currentRoom.badgeBorder}`,
              }}
              title="Switch Isolated Room Enclave"
            >
              <span
                className="w-[6.5px] h-[6.5px] rounded-full transition-colors"
                style={{
                  background: currentRoom.accentColor,
                  boxShadow: currentRoom.accentGlow,
                }}
              />
              <span>{currentRoom.shortLabel}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="opacity-75"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {roomMenuOpen && (
              <div
                className="absolute left-0 top-[26px] w-72 rounded-2xl p-2 text-[12px] shadow-2xl border border-white/25 z-50"
                style={{
                  background: 'rgba(16, 18, 30, 0.88)',
                  backdropFilter: 'blur(34px) saturate(190%)',
                }}
              >
                <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/55 flex items-center justify-between">
                  <span>Hardware Key Isolation Rooms</span>
                  <span className="text-[#14f195]">ML-KEM-1024</span>
                </div>
                <div className="mt-1 space-y-1">
                  {ROOM_ORDER.map((rId) => {
                    const cfg = ROOM_CONFIGS[rId];
                    const isSelected = rId === activeRoom;
                    return (
                      <button
                        key={rId}
                        type="button"
                        onClick={() => {
                          switchRoom(rId);
                          setRoomMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl transition flex items-start gap-2.5 ${
                          isSelected ? 'bg-white/15 border border-white/20' : 'hover:bg-white/10'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                          style={{
                            background: cfg.accentColor,
                            boxShadow: cfg.accentGlow,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">{cfg.label}</span>
                            <span className="text-[10px] font-mono text-white/60">
                              {cfg.publicKeyShort.split(' ')[0]}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/65 truncate">
                            {cfg.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* App Menu Links (matching home.html: Vault, Clone App, Shield, Builder + Degen & Burner) */}
          <button
            type="button"
            onClick={() => openWindow('vault-monitor')}
            className="font-medium text-white/85 hover:text-white transition"
          >
            Vault
          </button>
          <button
            type="button"
            onClick={() => openWindow('app-cloner')}
            className="font-medium text-white/85 hover:text-white transition"
          >
            Clone App
          </button>
          <button
            type="button"
            onClick={() => openWindow('degen-terminal')}
            className="font-medium text-white/85 hover:text-white transition"
          >
            Shield
          </button>
          <button
            type="button"
            onClick={() => openWindow('dev-console')}
            className="font-medium text-white/85 hover:text-white transition"
          >
            Builder
          </button>
        </div>

        {/* Right Status Items */}
        <div className="flex items-center gap-[16px]">
          {/* Quick Room Segmented Dots for 1-click switching */}
          <div className="hidden xl:flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 border border-white/15">
            {ROOM_ORDER.map((rId) => {
              const cfg = ROOM_CONFIGS[rId];
              const active = rId === activeRoom;
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => switchRoom(rId)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition flex items-center gap-1 ${
                    active ? 'bg-white/20 text-white shadow-sm' : 'text-white/65 hover:text-white'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: cfg.accentColor }}
                  />
                  <span>{cfg.label.replace(' Room', '')}</span>
                </button>
              );
            })}
          </div>

          {/* vault.solos · ML-KEM-1024 interactive status badge */}
          <button
            type="button"
            onClick={toggleVaultLock}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-white/10 hover:bg-white/20 border border-white/20 transition"
            title="Click to Lock / Unlock vault.solos"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: vault.locked ? '#f59e0b' : '#14f195',
                boxShadow: vault.locked ? '0 0 6px #f59e0b' : '0 0 6px #14f195',
              }}
            />
            <span>vault.solos &bull; ML-KEM-1024</span>
            <span className="text-[10px] px-1 rounded bg-white/15 text-white/90">
              {vault.locked ? 'Locked' : 'Unlocked'}
            </span>
          </button>

          {/* Shield ON status badge */}
          <button
            type="button"
            onClick={toggleShield}
            className="inline-flex items-center gap-[5px] text-[12px] font-medium text-white/90 hover:text-white transition"
            title="Toggle Quantum Transaction Shield"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={vault.shieldActive ? '#14f195' : '#f59e0b'}
              strokeWidth="2.3"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>{vault.shieldActive ? 'Shield ON' : 'Shield PAUSED'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSpotlightOpen(true);
              setControlCenterOpen(false);
              setRoomMenuOpen(false);
              setSystemMenuOpen(false);
            }}
            className="inline-flex items-center text-white/90 hover:text-white transition"
            aria-label="Spotlight Search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>

          {/* Control Center Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setControlCenterOpen((v) => !v);
                setRoomMenuOpen(false);
                setSystemMenuOpen(false);
              }}
              className="inline-flex items-center text-white/90 hover:text-white transition"
              aria-label="Control Center"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="4" y1="8" x2="20" y2="8" />
                <circle cx="9" cy="8" r="2" fill="currentColor" />
                <line x1="4" y1="16" x2="20" y2="16" />
                <circle cx="15" cy="16" r="2" fill="currentColor" />
              </svg>
            </button>

            {controlCenterOpen && (
              <div className="absolute right-0 top-[22px] z-50">
                <ControlCenter
                  userHandle={vault.identity}
                  roomLabel={currentRoom.label.replace(' Room', '')}
                  emblemSrc={BRAND_ASSETS.emblemOnlyWhite}
                  initialState={{
                    antiDrainerShield: vault.shieldActive,
                    processFreezeActive,
                    frozenProcessCount,
                    enclaveLocked: vault.locked,
                    displayBrightness,
                  }}
                  onStateChange={(next) => {
                    if (next.antiDrainerShield !== vault.shieldActive) toggleShield();
                    if (next.processFreezeActive !== processFreezeActive) toggleProcessFreeze();
                    if (next.displayBrightness !== displayBrightness) {
                      setDisplayBrightness(next.displayBrightness);
                    }
                    if (next.enclaveLocked && !vault.locked) void lockVault();
                  }}
                />
              </div>
            )}
          </div>

          {/* Live Clock */}
          <span className="font-medium whitespace-nowrap">{formattedClock}</span>
        </div>
      </header>
    </>
  );
};
