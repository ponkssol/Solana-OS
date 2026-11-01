import { useEffect } from 'react';
import { useOSStore } from '../store/useOSStore';

export function AppIcon({
  path,
  name,
  size = 36,
  cloned = false,
  cloneNumber = 0,
  native = true,
}: {
  path: string;
  name: string;
  size?: number;
  cloned?: boolean;
  cloneNumber?: number;
  native?: boolean;
}) {
  const src = useOSStore((state) => state.icons[path]);
  const requestIcons = useOSStore((state) => state.requestIcons);

  useEffect(() => {
    if (path && !src) void requestIcons([path]);
  }, [path, src, requestIcons]);

  const badge = Math.max(14, Math.round(size * 0.42));
  const nativeBadge = Math.max(11, Math.round(size * 0.32));
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
      {cloned ? (
        <span
          title={cloneNumber ? `Clone ${cloneNumber}` : 'Clone'}
          className="absolute -bottom-[3px] -right-[4px] flex items-center justify-center gap-[2px] rounded-[5px] bg-gradient-to-b from-[#ffb340] to-[#ff8a00] px-[3px] text-black shadow-[0_0_0_1px_rgba(0,0,0,0.55),0_1px_3px_rgba(0,0,0,0.5)]"
          style={{ height: badge, minWidth: badge, fontSize: Math.round(badge * 0.64) }}
        >
          <svg width={badge * 0.58} height={badge * 0.58} viewBox="0 0 12 12" fill="none" aria-hidden>
            <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2H3.4A1.4 1.4 0 0 0 2 3.4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {cloneNumber > 0 && size >= 28 && <span className="font-[800] leading-none">{cloneNumber}</span>}
        </span>
      ) : (
        native && (
          <span
            title="Original Windows app"
            className="absolute -bottom-[2px] -right-[2px] flex items-center justify-center rounded-full bg-[#1c1c1e] shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_1px_3px_rgba(0,0,0,0.5)]"
            style={{ width: nativeBadge, height: nativeBadge }}
          >
            <svg width={nativeBadge * 0.52} height={nativeBadge * 0.52} viewBox="0 0 16 16" fill="#3aa0ff" aria-hidden>
              <rect x="0" y="0" width="7.4" height="7.4" />
              <rect x="8.6" y="0" width="7.4" height="7.4" />
              <rect x="0" y="8.6" width="7.4" height="7.4" />
              <rect x="8.6" y="8.6" width="7.4" height="7.4" />
            </svg>
          </span>
        )
      )}
    </span>
  );
}
