import React, { useEffect } from 'react';
import { useOSStore } from '../store/useOSStore';
import { BRAND_ASSETS } from '../tokens/designTokens';

const BOOT_STEPS: { at: number; label: string }[] = [
  { at: 8, label: 'Initializing Solana OS Microkernel • SVM Enclave Core' },
  { at: 36, label: 'Verifying Post-Quantum Lattice Keys • ML-KEM-1024' },
  { at: 62, label: 'Mounting vault.solos • ML-KEM-1024 Enclave' },
  { at: 84, label: 'Isolating Room Namespaces (Main • Degen • Dev • Burner)' },
  { at: 100, label: 'Handing off to the Lock Screen' },
];

export const BootScreen: React.FC = () => {
  const { bootProgress, bootStatusText, advanceToLockScreen } = useOSStore();

  useEffect(() => {
    const interval = setInterval(() => {
      useOSStore.setState((prev) => {
        if (prev.screen !== 'boot') return prev;
        const next = Math.min(100, prev.bootProgress + 1.6);
        const step = [...BOOT_STEPS].reverse().find((s) => next >= s.at) || BOOT_STEPS[0];
        return {
          bootProgress: next,
          bootStatusText: step.label,
        };
      });
    }, 42);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bootProgress < 100) return;
    const timer = setTimeout(advanceToLockScreen, 380);
    return () => clearTimeout(timer);
  }, [bootProgress, advanceToLockScreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advanceToLockScreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advanceToLockScreen]);

  return (
    <div
      className="relative flex h-screen w-screen cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-black"
      style={{ background: '#000000' }}
      onClick={advanceToLockScreen}
    >
      <div className="flex -translate-y-3 flex-col items-center">
        <img
          src={BRAND_ASSETS.logoWhite}
          alt="SOLANA OS"
          className="mb-[72px] block h-auto w-[min(460px,72vw)]"
          draggable={false}
        />

        <div
          className="relative h-[4px] w-[220px] overflow-hidden rounded-full"
          style={{ background: 'rgba(255, 255, 255, 0.18)' }}
        >
          <div
            className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
            style={{ width: `${Math.min(100, bootProgress)}%` }}
          />
        </div>

        <div className="mt-4 text-[12px] font-normal tracking-[0.01em] text-white/40">
          {bootStatusText}
        </div>
      </div>
    </div>
  );
};
