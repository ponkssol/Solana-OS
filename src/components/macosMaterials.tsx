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
  close: '#f06e6a',
  minimize: '#ffcd30',
  zoom: '#58c73b',
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
          className="relative size-[12px] rounded-[100px]"
          style={{ background: STOPLIGHTS[button.key] }}
        />
      ))}
    </div>
  );
}

export function SidebarVibrancy({ width = 240 }: { width?: number }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 bg-[#141517]" style={{ width }} />
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
