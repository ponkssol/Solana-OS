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
  dark: 'linear-gradient(150deg, rgba(22, 25, 42, 0.62) 0%, rgba(12, 15, 26, 0.74) 100%)',
  light: 'linear-gradient(150deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.07) 100%)',
  obsidian: 'linear-gradient(155deg, rgba(13, 16, 28, 0.78) 0%, rgba(7, 9, 17, 0.88) 100%)',
  'solana-purple':
    'linear-gradient(145deg, rgba(153, 69, 255, 0.24) 0%, rgba(22, 24, 42, 0.72) 100%)',
  'solana-emerald':
    'linear-gradient(145deg, rgba(20, 241, 149, 0.20) 0%, rgba(15, 23, 38, 0.74) 100%)',
  'cyan-ice':
    'linear-gradient(145deg, rgba(56, 189, 248, 0.22) 0%, rgba(15, 23, 42, 0.74) 100%)',
  'rose-alert':
    'linear-gradient(145deg, rgba(244, 63, 94, 0.22) 0%, rgba(24, 15, 30, 0.76) 100%)',
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
      className={`relative overflow-hidden border border-white/[0.15] text-white ${radiusClass} ${
        interactive ? 'transition-transform duration-150 hover:-translate-y-px' : ''
      } ${className}`}
      style={{
        background: backgroundValue,
        backdropFilter: backdropFilterValue,
        WebkitBackdropFilter: backdropFilterValue,
        boxShadow:
          intensity === 'control-center' || intensity === 'ultra'
            ? '0 30px 75px rgba(0, 0, 0, 0.58), 0 8px 24px rgba(0, 0, 0, 0.34)'
            : '0 18px 44px rgba(0, 0, 0, 0.42), 0 4px 14px rgba(0, 0, 0, 0.26)',
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
