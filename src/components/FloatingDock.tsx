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
  const { openWindow, focusWindow } = useOSStore();

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
            onClick={() => {
              if (!slot) return;
              openWindow(slot.windowId);
              focusWindow(slot.windowId);
            }}
            className="relative flex h-[47px] w-[36px] flex-col items-center pb-[4px]"
          >
            <img src={icon.src} alt="" className="size-[36px] object-contain" />
          </button>
        );
      })}
      <div className="flex items-center px-[5px] pb-[9.5px]">
        <div className="h-[36px] w-px bg-[#404040] [mix-blend-mode:plus-lighter]" />
      </div>
      <img src={`${FIGMA}/dea72.png`} alt="" className="mb-[4px] size-[36px] object-contain" />
      <img src={`${FIGMA}/cc48b.png`} alt="" className="mb-[4px] size-[36px] object-contain" />
    </div>
  );
};
