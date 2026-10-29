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

export const PillSlider: React.FC<PillSliderProps> = ({
  label,
  value,
  onChange,
  icon,
  rightBadgeText,
  onRightBadgeClick,
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
          className="relative h-[14px] flex-1 cursor-pointer"
        >
          <div className="absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full border border-white/[0.06] bg-white/[0.08]" />
          <div
            className="absolute left-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#0A84FF]"
            style={{ width: `${clamped}%` }}
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
            className="pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-[#f5f5f5]"
            style={{ left: `calc(${clamped}% - 6px)` }}
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
