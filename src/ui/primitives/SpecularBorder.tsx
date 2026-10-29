import React from 'react';

export interface SpecularBorderProps {
  topHighlightOpacity?: number;
  leftHighlightOpacity?: number;
  accentRimColor?: string;
  className?: string;
}

export const SpecularBorder: React.FC<SpecularBorderProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-[inherit] border border-white/[0.06] ${className}`}
    />
  );
};

export default SpecularBorder;
