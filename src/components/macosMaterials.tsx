import React from 'react';

export const FIGMA = '/assets/figma-macos';

export const WALLPAPER = `${FIGMA}/5fffa-1920.png`;
export const WIFI_ICON = `${FIGMA}/4f10c.svg`;
export const CONTROL_CENTER_ICON = `${FIGMA}/b027c.svg`;
export const FOLDER_ICON = `${FIGMA}/be026.png`;

export const DOCK_ICONS = [
  { src: '/icons/solana.svg', label: 'Solana OS' },
  { src: `${FIGMA}/64817.png`, label: 'Finder' },
  { src: `${FIGMA}/2e283.png`, label: 'Launchpad' },
  { src: `${FIGMA}/b6df5.png`, label: 'Safari' },
  { src: `${FIGMA}/7b82d.png`, label: 'Messages' },
  { src: `${FIGMA}/08176.png`, label: 'Mail' },
  { src: `${FIGMA}/715ff.png`, label: 'Maps' },
  { src: `${FIGMA}/85a65.png`, label: 'Photos' },
  { src: `${FIGMA}/18f48.png`, label: 'FaceTime' },
  { src: `${FIGMA}/3485a.png`, label: 'Phone' },
  { src: `${FIGMA}/eed72.png`, label: 'Calendar' },
  { src: `${FIGMA}/d289e.png`, label: 'Contacts' },
  { src: `${FIGMA}/89ad5.png`, label: 'Notes' },
  { src: `${FIGMA}/d3d88.png`, label: 'Settings' },
] as const;

const STOPLIGHTS = {
  close: {
    fill: '#f06e6a',
    shadow:
      'inset 0px 1.25px 0.5px -0.75px #999, inset 0px -1.25px 0.5px -0.75px #808080, inset 0px 5px 4px -3px #262626, inset 0px 0px 3px 0px rgba(153,31,0,0.6), inset 0px 17px 4px -10px rgba(153,31,0,0.4)',
  },
  minimize: {
    fill: '#ffcd30',
    shadow:
      'inset 0px 1.25px 0.5px -0.75px #999, inset 0px -1.25px 0.5px -0.75px #808080, inset 0px 5px 4px -3px #161616, inset 0px 0px 3px 0px #4d2e0f, inset 0px 17px 4px -10px #4d2e0f',
  },
  zoom: {
    fill: '#58c73b',
    shadow:
      'inset 0px 1.25px 0.5px -0.75px #999, inset 0px -1.25px 0.5px -0.75px #808080, inset 0px 5px 4px -3px #262626, inset 0px 0px 3px 0px rgba(17,51,0,0.8), inset 0px 17px 4px -10px rgba(17,51,0,0.6)',
  },
} as const;

export function Stoplights({
  onClose,
  onMinimize,
  onZoom,
}: {
  onClose?: () => void;
  onMinimize?: () => void;
  onZoom?: () => void;
}) {
  const buttons = [
    { key: 'close' as const, label: 'Close', onClick: onClose },
    { key: 'minimize' as const, label: 'Minimize', onClick: onMinimize },
    { key: 'zoom' as const, label: 'Zoom', onClick: onZoom },
  ];
  return (
    <div className="flex items-center gap-[9px] pr-[8px]">
      {buttons.map((button) => (
        <button
          key={button.key}
          type="button"
          aria-label={button.label}
          onClick={button.onClick}
          className="relative size-[14px] rounded-[100px]"
        >
          <span
            className="absolute inset-0 rounded-[100px]"
            style={{ background: STOPLIGHTS[button.key].fill }}
          />
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ boxShadow: STOPLIGHTS[button.key].shadow }}
          />
        </button>
      ))}
    </div>
  );
}

export function LiquidGlassPill({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative h-[36px] rounded-[1000px] ${className}`}>
      <div
        className="absolute inset-0 rounded-[1000px] [mix-blend-mode:luminosity]"
        style={{
          background: 'rgba(153,153,153,0.17)',
          boxShadow:
            '1.25px 0px 0px -0.75px #a6a6a6, -1.25px 0px 0px -0.75px #a6a6a6, 0px 0px 0px 0.5px #a6a6a6, 0px 8px 15px 0px rgba(0,0,0,0.04)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[1000px]">
        <div className="absolute inset-0 rounded-[1000px] bg-white [mix-blend-mode:multiply]" />
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{
            boxShadow:
              'inset 0px 40px 10px -40px #1a1a1a, inset 0px -40px 10px -40px #1a1a1a, inset 0px 40px 30px -40px #e6e6e6',
          }}
        />
      </div>
      <div className="relative z-[1] flex h-full items-center">{children}</div>
    </div>
  );
}

export function SidebarVibrancy({ width = 240 }: { width?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden backdrop-blur-[40px]"
      style={{ width }}
    >
      <div className="absolute inset-0 bg-[#141517] opacity-[0.92] backdrop-blur-[60px] [mix-blend-mode:luminosity]" />
      <div className="absolute inset-0 bg-[#808080] opacity-[0.85] [mix-blend-mode:saturation]" />
    </div>
  );
}

export function DockGlass() {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[15px] border border-white/[0.07] bg-[rgba(28,28,30,0.72)]"
      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.75), 0 10px 28px rgba(0,0,0,0.4)' }}
    />
  );
}
