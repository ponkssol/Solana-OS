import React from 'react';

export interface SpecularBorderProps {
  /** Top highlight opacity (default 0.22 for crisp macOS Sequoia 1px edge) */
  topHighlightOpacity?: number;
  /** Left highlight opacity (default 0.16) */
  leftHighlightOpacity?: number;
  /** Optional accent glow tint along the top rim */
  accentRimColor?: string;
  /** Border radius class or inline radius inheritance */
  className?: string;
}

/**
 * SpecularBorder renders a precision 1px directional inner highlight
 * (top/left specular catch-light + subtle bottom inner rim) on frosted glass cards.
 */
export const SpecularBorder: React.FC<SpecularBorderProps> = ({
  topHighlightOpacity = 0.22,
  leftHighlightOpacity = 0.16,
  accentRimColor,
  className = '',
}) => {
  const topColor = accentRimColor || `rgba(255, 255, 255, ${topHighlightOpacity})`;
  const leftColor = `rgba(255, 255, 255, ${leftHighlightOpacity})`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-[inherit] ${className}`}
      style={{
        boxShadow: [
          `inset 0 1px 0 0 ${topColor}`,
          `inset 1px 0 0 0 ${leftColor}`,
          `inset 0 -0.5px 0 0 rgba(255, 255, 255, 0.06)`,
        ].join(', '),
      }}
    />
  );
};

export default SpecularBorder;
