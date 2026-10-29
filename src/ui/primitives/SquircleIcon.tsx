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

const FILL_PRESETS: Record<SquirclePreset, string> = {
  solos: '#14151c',
  cloner: '#0A84FF',
  phantom: '#7c5cbf',
  solflare: '#ea580c',
  backpack: '#b91c1c',
  browser: '#0A84FF',
  cursor: '#1e293b',
  builder: '#059669',
  vault: '#7c3aed',
};

const SIZE_CLASSES: Record<NonNullable<SquircleIconProps['size']>, string> = {
  sm: 'h-8 w-8 rounded-[9px]',
  md: 'h-11 w-11 rounded-[12px]',
  lg: 'h-[54px] w-[54px] rounded-[14px]',
};

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
        className={`relative flex items-center justify-center overflow-hidden border border-white/[0.06] text-white ${SIZE_CLASSES[size]} ${className}`}
        style={{ background: FILL_PRESETS[preset] }}
      >
        <span className="relative z-[1] flex items-center justify-center">{children}</span>
      </div>
      {badgeDot !== 'none' && (
        <span
          className={` -bottom-1.5 absolute h-1.5 w-1.5 rounded-full ${
            badgeDot === 'frozen'
              ? 'bg-[#0A84FF]'
              : 'bg-white/90'
          }`}
        />
      )}
    </div>
  );
};

export default SquircleIcon;
