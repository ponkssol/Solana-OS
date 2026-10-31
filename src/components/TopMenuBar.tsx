import React, { useState } from 'react';
import { useOSStore, WindowId } from '../store/useOSStore';
import { BentoControlCenter } from './BentoControlCenter';
import { CONTROL_CENTER_ICON, WIFI_ICON } from './macosMaterials';
import { ipcMinimizeShell } from '../lib/tauriIpc';
import { ROOM_CONFIGS } from '../tokens/designTokens';

const MENUS: { label: string; windowId?: WindowId; heavy?: boolean }[] = [
  { label: 'Solana OS', heavy: true },
  { label: 'File' },
  { label: 'Sandbox', windowId: 'app-cloner' },
  { label: 'Vault', windowId: 'vault-monitor' },
  { label: 'Shield', windowId: 'degen-terminal' },
  { label: 'Builder', windowId: 'dev-console' },
  { label: 'Window' },
  { label: 'Help' },
];

export const TopMenuBar: React.FC = () => {
  const {
    lockVault,
    toggleShield,
    vault,
    processFreezeActive,
    toggleProcessFreeze,
    displayBrightness,
    setDisplayBrightness,
    setSpotlightOpen,
    setShellView,
    setSettingsOpen,
    openWindow: openApp,
    shellMode,
    toggleShellMode,
    hosted,
    activeRoom,
  } = useOSStore();
  const [controlOpen, setControlOpen] = useState(false);
  const [volume, setVolume] = useState(68);

  return (
    <header className="absolute left-0 right-0 top-0 z-40 flex items-center justify-between pb-[11px] pl-[10px] pr-[20px] pt-[10px] text-white">
      <div className="flex items-center">
        {MENUS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if (item.label === 'Solana OS') {
                setSettingsOpen(true);
                return;
              }
              openApp('app-cloner');
              if (item.label === 'Vault') setShellView('vault');
              else if (item.label === 'Shield') setShellView('shield');
              else if (item.label === 'Builder') setShellView('builder');
              else if (item.label === 'Sandbox' || item.label === 'File') setShellView('sandboxes');
            }}
            className={`rounded-[4px] px-[9px] py-[4px] text-[13px] leading-[16px] text-white ${
              item.heavy ? 'pl-[11px] pr-[9px] font-[860]' : 'font-[590]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center">
        <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-[590]">
          <span className="size-1.5 rounded-full bg-[#8e8e93]" />
          RPC not configured
        </span>
        <button type="button" aria-label="Spotlight" onClick={() => setSpotlightOpen(true)} className="px-[9px] py-[4px] text-[13px]">
          ⌕
        </button>
        <img src={WIFI_ICON} alt="Wi-Fi" className="h-[20px] w-[34.5px]" />
        <div className="relative">
          <button type="button" aria-label="Control Center" onClick={() => setControlOpen((open) => !open)}>
            <img src={CONTROL_CENTER_ICON} alt="" className="h-[21.41px] w-[31.15px]" />
          </button>
          {controlOpen && (
            <div className="absolute right-0 top-[28px]">
              <BentoControlCenter
                identity={vault.identity}
                roomLabel={ROOM_CONFIGS[activeRoom].label}
                runningApps={new Set(hosted.map((win) => win.instanceId)).size}
                shieldOn={vault.shieldActive}
                freezeOn={processFreezeActive}
                brightness={displayBrightness}
                volume={volume}
                onToggleShield={toggleShield}
                onToggleFreeze={() => void toggleProcessFreeze()}
                onBrightness={setDisplayBrightness}
                onVolume={setVolume}
                onLock={() => {
                  setControlOpen(false);
                  void lockVault();
                }}
              />
            </div>
          )}
        </div>
        <div className="flex gap-[8px] pl-[9px] text-[13px] font-[590] leading-[16px]">
          <span>Thu Oct 29</span>
          <span>9:41 AM</span>
        </div>
        <button
          type="button"
          onClick={() => void ipcMinimizeShell()}
          aria-label="Minimize"
          title="Minimize"
          className="ml-[8px] flex size-[22px] items-center justify-center rounded-[6px] text-white/90 hover:bg-white/10"
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          onClick={() => void toggleShellMode()}
          aria-label={shellMode === 'os' ? 'Windows mode' : 'Fullscreen'}
          title={shellMode === 'os' ? 'Windows mode' : 'Fullscreen'}
          className="ml-[8px] flex size-[22px] items-center justify-center rounded-[6px] text-white/90 hover:bg-white/10"
        >
          {shellMode === 'os' ? <WindowedIcon /> : <FullscreenIcon />}
        </button>
      </div>
    </header>
  );
};

function MinimizeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <path d="M2.6 6.5h7.8" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.2 5.1V2.4h2.7M8.1 2.4h2.7v2.7M10.8 7.9v2.7H8.1M4.9 10.6H2.2V7.9" />
    </svg>
  );
}

function WindowedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1.6" y="2.2" width="9.8" height="7.4" rx="1.2" />
      <path d="M1.6 7.6h9.8" />
    </svg>
  );
}
