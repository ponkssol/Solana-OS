import React from 'react';
import { useOSStore, WindowId } from '../store/useOSStore';
import { DOCK_ICONS, DockGlass, FIGMA } from './macosMaterials';

const APP_SLOTS: { label: string; windowId: WindowId }[] = [
  { label: 'Solana OS', windowId: 'vault-monitor' },
  { label: 'Launchpad', windowId: 'app-cloner' },
  { label: 'Safari', windowId: 'degen-terminal' },
  { label: 'Messages', windowId: 'phantom-wallet' },
  { label: 'Mail', windowId: 'solflare-wallet' },
  { label: 'Maps', windowId: 'backpack-wallet' },
  { label: 'Photos', windowId: 'dev-console' },
  { label: 'FaceTime', windowId: 'burner-session' },
];

export const FloatingDock: React.FC = () => {
  const { openWindow, focusWindow, setShellView, setWalletBrand } = useOSStore();
  const openView = (index: number) => {
    openWindow('app-cloner');
    focusWindow('app-cloner');
    if (index === 2) setShellView('shield');
    else if (index === 3) setWalletBrand('phantom');
    else if (index === 4) setWalletBrand('solflare');
    else if (index === 5) setWalletBrand('backpack');
    else if (index === 6) setShellView('builder');
    else if (index === 7) setShellView('vault');
    else setShellView('sandboxes');
  };

  return (
    <div className="absolute bottom-[4px] left-1/2 z-40 flex -translate-x-1/2 items-center justify-center gap-[9px] px-[8px] pt-[8px]">
      <DockGlass />
      {DOCK_ICONS.slice(0, 8).map((icon, index) => {
        const slot = APP_SLOTS[index];
        return (
          <button
            key={icon.src}
            type="button"
            aria-label={slot?.label ?? icon.label}
            onClick={() => openView(index)}
            className="relative flex h-[47px] w-[36px] flex-col items-center pb-[4px]"
          >
            <img src={icon.src} alt="" className="size-[36px] object-contain" />
          </button>
        );
      })}
      <div className="flex items-center px-[5px] pb-[9.5px]">
        <div className="h-[36px] w-px bg-white/[0.07]" />
      </div>
      <button
        type="button"
        aria-label="Solana OS Terminal"
        onClick={() => {
          openWindow('app-cloner');
          setShellView('terminal');
        }}
        className="mb-[4px] flex size-[36px] items-center justify-center rounded-[8px] bg-[#101114] text-[11px] font-[700] text-[#d6d6d6]"
      >
        &gt;_
      </button>
      <img src="/icons/folder.svg" alt="" className="mb-[4px] size-[36px]" />
      <img src={`${FIGMA}/cc48b.png`} alt="" className="mb-[4px] size-[36px] object-contain" />
    </div>
  );
};
