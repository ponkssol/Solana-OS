import React, { useState } from 'react';
import { useOSStore, WindowId } from '../store/useOSStore';
import { BentoControlCenter } from './BentoControlCenter';
import { CONTROL_CENTER_ICON, WIFI_ICON } from './macosMaterials';

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
          <span className="size-1.5 rounded-full bg-[#14f195]" />
          Helius RPC · 11ms
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
                shieldOn={vault.shieldActive}
                freezeOn={processFreezeActive}
                brightness={displayBrightness}
                volume={volume}
                onToggleShield={toggleShield}
                onToggleFreeze={toggleProcessFreeze}
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
        <div className="flex gap-[8px] pl-[9px] text-[13.1px] font-[590] leading-[16px]">
          <span>Thu Oct 29</span>
          <span>9:41 AM</span>
        </div>
      </div>
    </header>
  );
};
