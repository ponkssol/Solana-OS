import React from 'react';
import type { GlassIntensity, GlassTint } from '../types';
import { SpecularBorder } from './SpecularBorder';

export interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: GlassIntensity;
  tint?: GlassTint;
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  specular?: boolean;
  accentRimColor?: string;
  interactive?: boolean;
  children: React.ReactNode;
}

const BLUR_MAP: Record<GlassIntensity, string> = {
  subtle: 'blur(18px) saturate(165%)',
  regular: 'blur(32px) saturate(185%)',
  heavy: 'blur(44px) saturate(195%)',
  ultra: 'blur(56px) saturate(210%)',
  'control-center': 'blur(48px) saturate(200%)',
};

const TINT_MAP: Record<GlassTint, string> = {
  dark: 'rgba(22, 24, 32, 0.94)',
  light: 'rgba(255, 255, 255, 0.08)',
  obsidian: 'rgba(14, 16, 22, 0.96)',
  'solana-purple': 'rgba(42, 28, 64, 0.94)',
  'solana-emerald': 'rgba(16, 36, 32, 0.94)',
  'cyan-ice': 'rgba(16, 32, 48, 0.94)',
  'rose-alert': 'rgba(48, 20, 28, 0.94)',
};

const RADIUS_MAP: Record<NonNullable<GlassSurfaceProps['rounded']>, string> = {
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-[20px]',
  '2xl': 'rounded-[24px]',
  '3xl': 'rounded-[28px]',
  full: 'rounded-full',
};

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  intensity = 'regular',
  tint = 'dark',
  rounded = 'xl',
  specular = true,
  accentRimColor,
  interactive = false,
  className = '',
  style,
  children,
  ...rest
}) => {
  const backdropFilterValue = BLUR_MAP[intensity];
  const backgroundValue = TINT_MAP[tint];
  const radiusClass = RADIUS_MAP[rounded];

  return (
    <div
      className={`relative overflow-hidden border border-white/[0.06] text-white ${radiusClass} ${
        interactive ? 'transition-transform duration-150 hover:-translate-y-px' : ''
      } ${className}`}
      style={{
        background: backgroundValue,
        backdropFilter: backdropFilterValue,
        WebkitBackdropFilter: backdropFilterValue,
        boxShadow: 'none',
        ...style,
      }}
      {...rest}
    >
      {specular && <SpecularBorder accentRimColor={accentRimColor} />}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlassSurface;
