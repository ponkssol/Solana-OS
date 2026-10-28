import React from 'react';
import { RoomId } from '../tokens/designTokens';

interface WallpaperSvgProps {
  blurred?: boolean;
  activeRoom?: RoomId;
}

export const WallpaperSvg: React.FC<WallpaperSvgProps> = ({
  blurred = false,
  activeRoom = 'main',
}) => {
  // Subtle room-reactive ambient glow while preserving the exact Sonoma/Big Sur silk wave SVG
  const ambientPrimary =
    activeRoom === 'degen'
      ? '#f43f5e'
      : activeRoom === 'dev'
      ? '#38bdf8'
      : activeRoom === 'burner'
      ? '#f59e0b'
      : '#38bdf8';

  const ambientSecondary =
    activeRoom === 'degen'
      ? '#f59e0b'
      : activeRoom === 'dev'
      ? '#14f195'
      : activeRoom === 'burner'
      ? '#ec4899'
      : '#f43f5e';

  return (
    <div
      className={
        blurred
          ? 'absolute -inset-10 z-0 scale-[1.06] blur-[28px] saturate-[1.45] brightness-[0.88] transition-all duration-700 pointer-events-none'
          : 'absolute inset-0 z-0 transition-all duration-700 pointer-events-none'
      }
    >
      <svg
        className="w-full h-full block"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bgBase" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b1536" />
            <stop offset="40%" stopColor="#1e1b4b" />
            <stop offset="75%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>
          <linearGradient id="wave2" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="45%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="wave3" x1="0%" y1="20%" x2="100%" y2="90%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="wave4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14f195" stopOpacity="0.75" />
            <stop offset="45%" stopColor="#0ea5e9" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="wave5" x1="0%" y1="30%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9945ff" />
            <stop offset="55%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <rect width="1920" height="1080" fill="url(#bgBase)" />

        {/* Layered Big Sur / Sonoma style silk waves */}
        <path
          d="M-100,240 C380,40 820,460 1380,180 C1660,40 1840,140 2020,90 L2020,1180 L-100,1180 Z"
          fill="url(#wave2)"
          opacity="0.88"
        />
        <path
          d="M-100,430 C320,210 760,640 1290,340 C1620,160 1820,280 2020,240 L2020,1180 L-100,1180 Z"
          fill="url(#wave1)"
          opacity="0.9"
        />
        <path
          d="M-100,590 C260,740 740,320 1240,560 C1580,720 1790,490 2020,520 L2020,1180 L-100,1180 Z"
          fill="url(#wave5)"
          opacity="0.86"
        />
        <path
          d="M-100,740 C420,530 920,860 1440,620 C1710,500 1860,640 2020,610 L2020,1180 L-100,1180 Z"
          fill="url(#wave3)"
          opacity="0.82"
        />
        <path
          d="M-100,880 C480,720 1020,980 1580,790 C1780,720 1900,780 2020,760 L2020,1180 L-100,1180 Z"
          fill="url(#wave4)"
          opacity="0.85"
        />

        {/* Subtle ambient highlight */}
        <circle
          cx="420"
          cy="220"
          r="340"
          fill={ambientPrimary}
          opacity="0.18"
          filter="url(#softGlow)"
        />
        <circle
          cx="1480"
          cy="360"
          r="420"
          fill={ambientSecondary}
          opacity="0.15"
          filter="url(#softGlow)"
        />
      </svg>
    </div>
  );
};
