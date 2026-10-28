import React, { useRef, useState } from 'react';
import { useOSStore, WindowId } from '../store/useOSStore';
import { BRAND_ASSETS, SQUIRCLE_GRADIENTS } from '../tokens/designTokens';

interface DockItemConfig {
  id: string;
  label: string;
  gradient: string;
  border?: string;
  windowId?: WindowId;
  action?: 'lock' | 'burner';
  dotState?: 'active' | 'frozen' | 'none';
  renderIcon: () => React.ReactNode;
}

export const FloatingDock: React.FC = () => {
  const { windows, openWindow, focusWindow, switchRoom, lockVault } = useOSStore();
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const isWindowOpen = (winId?: WindowId) => {
    if (!winId) return false;
    return windows.some((w) => w.id === winId && w.isOpen);
  };

  const dockItems: DockItemConfig[] = [
    {
      id: 'solos-launcher',
      label: 'Solana OS Enclave Hub',
      gradient: SQUIRCLE_GRADIENTS.solos,
      border: '0.5px solid rgba(255,255,255,0.22)',
      windowId: 'vault-monitor',
      dotState: 'active',
      renderIcon: () => (
        <img
          src={BRAND_ASSETS.emblemOnlyWhite}
          alt="Solana OS"
          className="w-[28px] h-auto pointer-events-none"
        />
      ),
    },
    {
      id: 'app-cloner',
      label: 'App Cloner (+)',
      gradient: SQUIRCLE_GRADIENTS.cloner,
      windowId: 'app-cloner',
      dotState: isWindowOpen('app-cloner') ? 'active' : 'none',
      renderIcon: () => (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="8" y="8" width="12" height="12" rx="2.5" />
          <path d="M4 16V6a2 2 0 0 1 2-2h10" />
          <line x1="14" y1="11" x2="14" y2="17" />
          <line x1="11" y1="14" x2="17" y2="14" />
        </svg>
      ),
    },
    {
      id: 'phantom-standalone',
      label: 'Phantom Standalone Wallet',
      gradient: SQUIRCLE_GRADIENTS.phantom,
      windowId: 'phantom-wallet',
      dotState: 'active',
      renderIcon: () => (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 7V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
          <rect x="13" y="7" width="8" height="10" rx="2" />
          <circle cx="17" cy="12" r="1.2" fill="#ffffff" />
        </svg>
      ),
    },
    {
      id: 'solflare-standalone',
      label: 'Solflare Standalone Wallet',
      gradient: SQUIRCLE_GRADIENTS.solflare,
      windowId: 'solflare-wallet',
      dotState: isWindowOpen('solflare-wallet') ? 'active' : 'none',
      renderIcon: () => (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    },
    {
      id: 'backpack-standalone',
      label: 'Backpack Standalone Wallet',
      gradient: SQUIRCLE_GRADIENTS.backpack,
      windowId: 'backpack-wallet',
      dotState: isWindowOpen('backpack-wallet') ? 'active' : 'none',
      renderIcon: () => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <path d="M4 13h16" />
        </svg>
      ),
    },
    {
      id: 'burner-session',
      label: 'Burner Room',
      gradient: SQUIRCLE_GRADIENTS.burner,
      windowId: 'burner-session',
      action: 'burner',
      dotState: isWindowOpen('burner-session') ? 'active' : 'none',
      renderIcon: () => (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
        >
          <path d="M12 3c2 3 2 5 0 7 3 0 6 2 6 6a6 6 0 1 1-12 0c0-2 1-4 2-5 0 2 1 3 2 3-1-3 0-6 2-11z" />
        </svg>
      ),
    },
    {
      id: 'isolated-browser',
      label: 'Isolated Web3 Browser & GMGN Radar',
      gradient: SQUIRCLE_GRADIENTS.browser,
      windowId: 'degen-terminal',
      dotState: 'active',
      renderIcon: () => (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="3.6" y1="9" x2="20.4" y2="9" />
          <line x1="3.6" y1="15" x2="20.4" y2="15" />
          <path d="M11.5 3a17 17 0 0 0 0 18" />
          <path d="M12.5 3a17 17 0 0 1 0 18" />
        </svg>
      ),
    },
    {
      id: 'cloned-cursor',
      label: 'Cloned Cursor IDE (Frozen State)',
      gradient: SQUIRCLE_GRADIENTS.cursor,
      windowId: 'dev-console',
      dotState: 'frozen',
      renderIcon: () => (
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      id: 'builder-terminal',
      label: 'Solana Builder Terminal',
      gradient: SQUIRCLE_GRADIENTS.anchor,
      windowId: 'dev-console',
      dotState: isWindowOpen('dev-console') ? 'active' : 'none',
      renderIcon: () => (
        <svg
          width="25"
          height="25"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      ),
    },
  ];

  const getScaleForItem = (id: string): number => {
    if (mouseX === null) return 1;
    const el = itemRefs.current[id];
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    const itemCenterX = rect.left + rect.width / 2;
    const distance = Math.abs(mouseX - itemCenterX);
    const maxDistance = 135;
    if (distance >= maxDistance) return 1;
    const normalized = 1 - distance / maxDistance;
    return 1 + 0.62 * Math.pow(normalized, 1.35);
  };

  const handleDockItemClick = (item: DockItemConfig) => {
    if (item.action === 'lock') {
      lockVault();
      return;
    }
    if (item.action === 'burner') {
      switchRoom('burner');
    }
    if (item.windowId) {
      openWindow(item.windowId);
      focusWindow(item.windowId);
    }
  };

  return (
    <div className="fixed bottom-[14px] left-0 right-0 flex justify-center z-40 select-none pointer-events-none">
      <div
        onMouseMove={(e) => setMouseX(e.clientX)}
        onMouseLeave={() => {
          setMouseX(null);
          setHoveredId(null);
        }}
        className="h-[78px] px-[14px] rounded-[24px] flex items-center gap-[12px] pointer-events-auto"
        style={{
          background: 'rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(34px) saturate(190%)',
          border: '0.5px solid rgba(255, 255, 255, 0.34)',
          boxShadow:
            '0 20px 45px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
        }}
      >
        {dockItems.map((item) => {
          const scale = getScaleForItem(item.id);
          const translateY = (scale - 1) * -18;

          return (
            <div key={item.id} className="flex flex-col items-center relative">
              {hoveredId === item.id && (
                <div
                  className="absolute -top-10 px-2.5 py-1 rounded-lg text-[11.5px] font-medium text-white whitespace-nowrap pointer-events-none shadow-lg border border-white/25"
                  style={{
                    background: 'rgba(18, 20, 32, 0.82)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  {item.label}
                </div>
              )}

              <button
                ref={(el) => {
                  itemRefs.current[item.id] = el;
                }}
                type="button"
                onMouseEnter={() => setHoveredId(item.id)}
                onClick={() => handleDockItemClick(item)}
                aria-label={item.label}
                style={{
                  background: item.gradient,
                  border: item.border,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  transformOrigin: 'bottom center',
                  boxShadow:
                    '0 10px 18px rgba(0, 0, 0, 0.32), inset 0 1.5px 1px rgba(255, 255, 255, 0.48), inset 0 -2px 3px rgba(0, 0, 0, 0.28)',
                }}
                className="relative flex h-[54px] w-[54px] cursor-pointer items-center justify-center overflow-hidden rounded-[16px] transition-transform duration-75 ease-out"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.02) 70%, transparent)',
                  }}
                />
                <span className="relative z-[1] flex items-center justify-center">{item.renderIcon()}</span>
              </button>

              {/* Active or Frozen Indicator Dot */}
              {item.dotState === 'active' && (
                <div
                  className="w-[4.5px] h-[4.5px] rounded-full absolute -bottom-[7px]"
                  style={{ background: 'rgba(255, 255, 255, 0.88)' }}
                />
              )}
              {item.dotState === 'frozen' && (
                <div
                  className="w-[4.5px] h-[4.5px] rounded-full absolute -bottom-[7px]"
                  style={{
                    background: '#38bdf8',
                    boxShadow: '0 0 6px #38bdf8',
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Dock Divider */}
        <div
          className="w-[1px] h-[42px] mx-[3px]"
          style={{ background: 'rgba(255, 255, 255, 0.24)' }}
        />

        {/* 8. Quantum Vault (vault.solos) + Lock Trigger */}
        {(() => {
          const vaultId = 'quantum-vault';
          const scale = getScaleForItem(vaultId);
          const translateY = (scale - 1) * -18;
          return (
            <div className="flex flex-col items-center relative">
              {hoveredId === vaultId && (
                <div
                  className="absolute -top-10 px-2.5 py-1 rounded-lg text-[11.5px] font-medium text-white whitespace-nowrap pointer-events-none shadow-lg border border-white/25"
                  style={{
                    background: 'rgba(18, 20, 32, 0.82)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  Quantum Vault (vault.solos • Lock / Inspect)
                </div>
              )}

              <button
                ref={(el) => {
                  itemRefs.current[vaultId] = el;
                }}
                type="button"
                onMouseEnter={() => setHoveredId(vaultId)}
                onClick={() => openWindow('vault-monitor')}
                onDoubleClick={() => lockVault()}
                aria-label="Quantum Vault (vault.solos)"
                style={{
                  background: SQUIRCLE_GRADIENTS.vault,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  transformOrigin: 'bottom center',
                  boxShadow:
                    '0 8px 18px rgba(0, 0, 0, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                }}
                className="w-[54px] h-[54px] rounded-[14px] flex items-center justify-center relative overflow-hidden transition-transform duration-75 ease-out cursor-pointer"
                title="Click to open Quantum Vault Monitor • Double-click to Lock Screen"
              >
                <svg
                  width="25"
                  height="25"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </button>

              <div
                className="w-[4.5px] h-[4.5px] rounded-full absolute -bottom-[7px]"
                style={{ background: 'rgba(255, 255, 255, 0.88)' }}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};
