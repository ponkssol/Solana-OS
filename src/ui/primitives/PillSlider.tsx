import React from 'react';

export interface PillSliderProps {
  label: string;
  value: number; // 0 to 100
  onChange?: (nextValue: number) => void;
  icon?: React.ReactNode;
  rightBadgeText?: string;
  onRightBadgeClick?: () => void;
  accentGradient?: string;
}

/**
 * PillSlider implements the macOS Sequoia / Big Sur Control Center horizontal pill slider
 * with embedded left glyph, glowing white/gradient fill bar, and circular/pill right action.
 */
export const PillSlider: React.FC<PillSliderProps> = ({
  label,
  value,
  onChange,
  icon,
  rightBadgeText,
  onRightBadgeClick,
  accentGradient = 'linear-gradient(90deg, rgba(255,255,255,0.86) 0%, #ffffff 100%)',
}) => {
  const clamped = Math.max(0, Math.min(100, value));

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    onChange(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div className="solos-bento-tile rounded-[18px] p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11.5px] font-semibold tracking-tight text-white/90">
          {label}
        </span>
        <span className="font-mono text-[11px] font-medium text-white/65">{clamped}%</span>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="slider"
          aria-label={label}
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onClick={handleTrackClick}
          className="relative h-7 flex-1 cursor-pointer overflow-hidden rounded-full border border-white/15 bg-black/40 shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]"
        >
          {/* Filled portion */}
          <div
            className="h-full rounded-full transition-all duration-150"
            style={{
              width: `${clamped}%`,
              background: accentGradient,
              boxShadow: '0 0 14px rgba(255, 255, 255, 0.4)',
            }}
          />

          {/* Left Icon inside pill */}
          {icon && (
            <div
              className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors ${
                clamped > 16 ? 'text-slate-900' : 'text-white/75'
              }`}
            >
              {icon}
            </div>
          )}

          {/* Thumb Knob */}
          <div
            className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-black/10 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-all duration-150"
            style={{
              left: `calc(${clamped}% - ${clamped > 50 ? '22px' : '4px'})`,
            }}
          />
        </div>

        {rightBadgeText && (
          <button
            type="button"
            onClick={onRightBadgeClick}
            className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-white/85 transition hover:bg-white/20"
          >
            {rightBadgeText}
          </button>
        )}
      </div>
    </div>
  );
};

export default PillSlider;
