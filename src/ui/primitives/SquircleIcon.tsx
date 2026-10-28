import React from 'react';

export type SquirclePreset =
  | 'solos'
  | 'cloner'
  | 'phantom'
  | 'solflare'
  | 'backpack'
  | 'browser'
  | 'cursor'
  | 'builder'
  | 'vault';

export interface SquircleIconProps {
  preset?: SquirclePreset;
  size?: 'sm' | 'md' | 'lg';
  badgeDot?: 'active' | 'frozen' | 'none';
  className?: string;
  children?: React.ReactNode;
}

const GRADIENT_PRESETS: Record<SquirclePreset, string> = {
  solos: 'linear-gradient(145deg, #1e1b4b 0%, #090d16 100%)',
  cloner: 'linear-gradient(145deg, #0ea5e9 0%, #2563eb 100%)',
  phantom: 'linear-gradient(145deg, #a855f7 0%, #6366f1 100%)',
  solflare: 'linear-gradient(145deg, #f97316 0%, #ea580c 100%)',
  backpack: 'linear-gradient(145deg, #ef4444 0%, #b91c1c 100%)',
  browser: 'linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)',
  cursor: 'linear-gradient(145deg, #334155 0%, #0f172a 100%)',
  builder: 'linear-gradient(145deg, #10b981 0%, #059669 100%)',
  vault: 'linear-gradient(145deg, #ec4899 0%, #8b5cf6 100%)',
};

const SIZE_CLASSES: Record<NonNullable<SquircleIconProps['size']>, string> = {
  sm: 'h-8 w-8 rounded-[9px]',
  md: 'h-11 w-11 rounded-[12px]',
  lg: 'h-[54px] w-[54px] rounded-[14px]',
};

/**
 * SquircleIcon renders a 3D macOS-style squircle app icon with inner specular
 * rim and optional active/frozen dock indicator dot.
 */
export const SquircleIcon: React.FC<SquircleIconProps> = ({
  preset = 'solos',
  size = 'md',
  badgeDot = 'none',
  className = '',
  children,
}) => {
  return (
    <div className="relative inline-flex flex-col items-center">
      <div
        className={`relative flex items-center justify-center overflow-hidden border border-white/25 text-white ${SIZE_CLASSES[size]} ${className}`}
        style={{
          background: GRADIENT_PRESETS[preset],
          boxShadow:
            '0 10px 18px rgba(0, 0, 0, 0.34), inset 0 1.5px 1px rgba(255, 255, 255, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.35)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.05) 55%, transparent 100%)',
          }}
        />
        <span className="relative z-[1] flex items-center justify-center">{children}</span>
      </div>
      {badgeDot !== 'none' && (
        <span
          className={` -bottom-1.5 absolute h-1.5 w-1.5 rounded-full ${
            badgeDot === 'frozen'
              ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]'
              : 'bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.8)]'
          }`}
        />
      )}
    </div>
  );
};

export default SquircleIcon;
