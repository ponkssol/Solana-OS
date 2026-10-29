import React from 'react';
import type { WindowControlProps } from '../types';
import { SpecularBorder } from './SpecularBorder';

const BADGE_STYLES: Record<NonNullable<WindowControlProps['badgeTone']>, string> = {
  emerald:
    'bg-[#14F195]/15 text-[#14F195] border-[#14F195]/35 shadow-[0_0_12px_rgba(20,241,149,0.18)]',
  purple:
    'bg-[#9945FF]/20 text-[#c49bff] border-[#9945FF]/40 shadow-[0_0_12px_rgba(153,69,255,0.2)]',
  cyan:
    'bg-sky-400/18 text-sky-300 border-sky-400/35 shadow-[0_0_12px_rgba(56,189,248,0.2)]',
  amber:
    'bg-amber-400/18 text-amber-300 border-amber-400/35 shadow-[0_0_12px_rgba(245,158,11,0.18)]',
  rose:
    'bg-rose-500/20 text-rose-300 border-rose-400/35 shadow-[0_0_12px_rgba(244,63,94,0.2)]',
};

export const GlassWindow: React.FC<WindowControlProps> = ({
  id,
  title,
  subtitle,
  badgeText,
  badgeTone = 'emerald',
  icon,
  isFocused = true,
  isFrozen = false,
  className = '',
  onClose,
  onMinimize,
  onMaximize,
  onToggleFreeze,
  headerRight,
  embedded = false,
  children,
}) => {
  if (embedded) {
    return <div className={className}>{children}</div>;
  }

  return (
    <section
      id={id}
      className={`relative flex flex-col overflow-hidden rounded-[22px] border text-white select-none ${
        isFrozen
          ? 'border-[#0A84FF]/40'
          : 'border-white/[0.06]'
      } ${className}`}
      style={{
        background: '#1e1e1e',
        boxShadow: 'none',
      }}
    >
      <SpecularBorder
        topHighlightOpacity={isFocused ? 0.26 : 0.15}
        accentRimColor={isFrozen ? 'rgba(56, 189, 248, 0.45)' : undefined}
      />

      <header className="relative z-10 flex h-11 shrink-0 items-center justify-between border-b border-white/[0.11] bg-white/[0.03] px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close window"
              className="h-3 w-3 rounded-full bg-[#FF5F56] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.25)] transition hover:brightness-110"
            />
            <button
              type="button"
              onClick={onMinimize}
              aria-label="Minimize window"
              className="h-3 w-3 rounded-full bg-[#FFBD2E] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.25)] transition hover:brightness-110"
            />
            <button
              type="button"
              onClick={onMaximize}
              aria-label="Maximize window"
              className="h-3 w-3 rounded-full bg-[#27C93F] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.25)] transition hover:brightness-110"
            />
          </div>

          {onToggleFreeze && (
            <button
              type="button"
              onClick={onToggleFreeze}
              title="Toggle Process Freeze"
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition ${
                isFrozen
                  ? 'border-sky-400/50 bg-sky-400/20 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                  : 'border-white/15 bg-white/5 text-white/65 hover:border-white/25 hover:text-white'
              }`}
            >
              <span>❄️</span>
              <span>{isFrozen ? 'FROZEN' : 'Freeze'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {icon && <span className="flex shrink-0 items-center">{icon}</span>}
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold tracking-tight text-white/95">{title}</span>
            {subtitle && <span className="font-mono text-[11px] text-white/50">{subtitle}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {badgeText && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wide ${BADGE_STYLES[badgeTone]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {badgeText}
            </span>
          )}
          {headerRight}
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-auto">{children}</div>
    </section>
  );
};

export default GlassWindow;
