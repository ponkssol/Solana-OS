import { useEffect } from 'react';
import { useOSStore } from '../store/useOSStore';

export function AppIcon({
  path,
  name,
  size = 36,
  cloned = false,
  cloneNumber = 0,
}: {
  path: string;
  name: string;
  size?: number;
  cloned?: boolean;
  cloneNumber?: number;
}) {
  const src = useOSStore((state) => state.icons[path]);
  const requestIcons = useOSStore((state) => state.requestIcons);

  useEffect(() => {
    if (path && !src) void requestIcons([path]);
  }, [path, src, requestIcons]);

  const badge = Math.max(14, Math.round(size * 0.42));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" draggable={false} className="size-full object-contain" />
      ) : (
        <span
          className="flex size-full items-center justify-center rounded-[22%] bg-gradient-to-b from-[#3a3a3c] to-[#242426] font-[700] text-white/85"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {(name.trim()[0] || 'A').toUpperCase()}
        </span>
      )}
      {cloned && (
        <span
          title={cloneNumber ? `Clone ${cloneNumber}` : 'Clone'}
          className="absolute -bottom-[3px] -right-[3px] flex items-center justify-center gap-[1px] rounded-full border border-black/60 bg-[#0A84FF] px-[3px] text-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
          style={{ height: badge, minWidth: badge, fontSize: Math.round(badge * 0.62) }}
        >
          <svg width={badge * 0.6} height={badge * 0.6} viewBox="0 0 12 12" fill="none" aria-hidden>
            <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 2H3.4A1.4 1.4 0 0 0 2 3.4V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {cloneNumber > 0 && size >= 28 && <span className="font-[700] leading-none">{cloneNumber}</span>}
        </span>
      )}
    </span>
  );
}
