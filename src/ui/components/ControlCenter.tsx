import React, { useState } from 'react';
import type { ControlCenterState, RpcEndpointId, RpcEndpointOption } from '../types';
import { GlassSurface } from '../primitives/GlassSurface';
import { PillSlider } from '../primitives/PillSlider';

export interface ControlCenterProps {
  initialState?: Partial<ControlCenterState>;
  emblemSrc?: string;
  userHandle?: string;
  roomLabel?: string;
  className?: string;
  onStateChange?: (state: ControlCenterState) => void;
}

const DEFAULT_RPC_ENDPOINTS: RpcEndpointOption[] = [
  {
    id: 'helius-staked',
    label: 'Helius Staked',
    provider: 'Mainnet-Beta • Stake-Weighted QoS',
    url: 'https://mainnet.helius-rpc.com',
    latencyMs: 11,
    slotHeight: 318_492_104,
    tps: 4_280,
    status: 'optimal',
  },
  {
    id: 'mainnet-beta',
    label: 'Mainnet-Beta',
    provider: 'Solana Foundation Public Cluster',
    url: 'https://api.mainnet-beta.solana.com',
    latencyMs: 38,
    slotHeight: 318_492_102,
    tps: 4_190,
    status: 'optimal',
  },
  {
    id: 'custom-rpc',
    label: 'Custom RPC',
    provider: 'Localnet / Private Geyser Node',
    url: 'http://127.0.0.1:8899',
    latencyMs: 2,
    slotHeight: 318_492_104,
    tps: 6_840,
    status: 'custom',
  },
];

/**
 * ControlCenter renders the Solana OS Bento Control Center inspired by macOS Sequoia/Big Sur
 * (/workspace/ref/01M61VA0QR6JZ5XR0S79AYKYTX.png).
 * Features circular RPC toggles with ms latency, Anti-Drainer Shield, Process Freeze ❄️,
 * Isolated Clipboard scrubber, and Display/Audio/Haptic pill sliders.
 */
export const ControlCenter: React.FC<ControlCenterProps> = ({
  initialState,
  emblemSrc = '/assets/emblem-only-white.png',
  userHandle = 'nanda.solos',
  roomLabel = 'Main',
  className = '',
  onStateChange,
}) => {
  const [state, setState] = useState<ControlCenterState>({
    activeRpc: 'helius-staked',
    antiDrainerShield: true,
    processFreezeActive: true,
    frozenProcessCount: 3,
    isolatedClipboard: true,
    clipboardScrubCountdownSec: 18,
    displayBrightness: 86,
    systemAudioVolume: 68,
    hapticFeedback: true,
    enclaveLocked: false,
    ...initialState,
  });

  const updateState = (patch: Partial<ControlCenterState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      onStateChange?.(next);
      return next;
    });
  };

  const selectedRpc =
    DEFAULT_RPC_ENDPOINTS.find((r) => r.id === state.activeRpc) || DEFAULT_RPC_ENDPOINTS[0];

  return (
    <GlassSurface
      intensity="control-center"
      tint="dark"
      rounded="3xl"
      className={`w-[376px] p-4 select-none ${className}`}
    >
      {/* Top User & Enclave Header Row */}
      <div className="mb-3.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.06]">
            <img src={emblemSrc} alt="Solana OS" className="h-4 w-auto" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0b1020] bg-[#14F195]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold tracking-tight text-white">
                {userHandle}
              </span>
              <span className="rounded-full bg-[#14F195]/15 px-1.5 py-0.2 font-mono text-[9.5px] font-semibold text-[#14F195]">
                ML-KEM-1024
              </span>
            </div>
            <p className="text-[11px] text-white/60">
              Room: {roomLabel} • Enclave {state.enclaveLocked ? 'Locked' : 'Unlocked'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => updateState({ enclaveLocked: !state.enclaveLocked })}
            title="Lock Quantum Enclave"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/85 transition hover:bg-white/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
          <button
            type="button"
            title="System Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/85 transition hover:bg-white/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Bento Grid: Left RPC Stack (3 Circular Toggles) + Right Security Toggles */}
      <div className="mb-3 grid grid-cols-12 gap-2.5">
        {/* Left Column (7 cols): RPC Cluster Circular Toggles with Latency ms */}
        <div className="solos-bento-tile col-span-7 flex flex-col justify-between rounded-[20px] p-3">
          {DEFAULT_RPC_ENDPOINTS.map((rpc) => {
            const active = state.activeRpc === rpc.id;
            return (
              <button
                key={rpc.id}
                type="button"
                onClick={() => updateState({ activeRpc: rpc.id as RpcEndpointId })}
                className="group flex items-center justify-between rounded-xl p-1.5 text-left transition hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                      active
                        ? 'border-[#0A84FF]/40 bg-[#0A84FF] text-white'
                        : 'border-white/15 bg-white/10 text-white/75'
                    }`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                      <circle cx="12" cy="20" r="1" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="leading-tight">
                    <div className="text-[12px] font-semibold text-white">{rpc.label}</div>
                    <div className="text-[10px] text-white/55">
                      {active ? 'Connected' : 'Standby'}
                    </div>
                  </div>
                </div>

                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    active
                      ? 'bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/35'
                      : 'bg-white/5 text-white/55'
                  }`}
                >
                  {rpc.latencyMs}ms
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Column (5 cols): Anti-Drainer Shield + Process Freeze ❄️ + Isolated Clipboard */}
        <div className="col-span-5 flex flex-col gap-2.5">
          {/* Anti-Drainer Shield Card */}
          <button
            type="button"
            onClick={() => updateState({ antiDrainerShield: !state.antiDrainerShield })}
            className={`solos-bento-tile flex items-center gap-2.5 rounded-[18px] p-2.5 text-left transition ${
              state.antiDrainerShield ? 'border-[#14F195]/40 bg-[#14F195]/12' : ''
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                state.antiDrainerShield
                  ? 'bg-[#14F195] text-slate-950 shadow-[0_0_12px_rgba(20,241,149,0.5)]'
                  : 'bg-white/10 text-white/70'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-[11.5px] font-semibold text-white">Anti-Drainer</div>
              <div className="text-[10px] text-[#14F195]">
                {state.antiDrainerShield ? 'CPI Guard ON' : 'Disabled'}
              </div>
            </div>
          </button>

          {/* 2 Small Square Tiles: Process Freeze ❄️ & Isolated Clipboard */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateState({ processFreezeActive: !state.processFreezeActive })}
              className={`solos-bento-tile flex flex-col items-center justify-center rounded-[16px] p-2 text-center transition ${
                state.processFreezeActive ? 'border-sky-400/45 bg-sky-400/15' : ''
              }`}
            >
              <span className="mb-1 text-base leading-none">❄️</span>
              <span className="text-[10.5px] font-semibold text-white">Freeze</span>
              <span className="font-mono text-[9.5px] text-sky-300">
                {state.processFreezeActive ? `${state.frozenProcessCount} Apps` : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateState({ isolatedClipboard: !state.isolatedClipboard })}
              className={`solos-bento-tile flex flex-col items-center justify-center rounded-[16px] p-2 text-center transition ${
                state.isolatedClipboard ? 'border-[#9945FF]/50 bg-[#9945FF]/18' : ''
              }`}
            >
              <svg
                className="mb-1 text-[#c49bff]"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="text-[10.5px] font-semibold text-white">Clipboard</span>
              <span className="font-mono text-[9.5px] text-purple-200">
                {state.isolatedClipboard ? `Scrub ${state.clipboardScrubCountdownSec}s` : 'Shared'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pill Sliders: Display Brightness & System Audio / Haptic Feedback */}
      <div className="mb-3 space-y-2.5">
        <PillSlider
          label="Display Brightness"
          value={state.displayBrightness}
          onChange={(v) => updateState({ displayBrightness: v })}
          rightBadgeText="TrueTone"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          }
        />

        <PillSlider
          label="System Audio & Signing Haptics"
          value={state.systemAudioVolume}
          onChange={(v) => updateState({ systemAudioVolume: v })}
          rightBadgeText={state.hapticFeedback ? 'Haptic ON' : 'Muted'}
          onRightBadgeClick={() => updateState({ hapticFeedback: !state.hapticFeedback })}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          }
        />
      </div>

      {/* Bottom Live Telemetry Tile (Slot / TPS / Priority Fee) */}
      <div className="solos-bento-tile flex items-center justify-between rounded-[18px] px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/[0.06] bg-[#141517] text-[12px] font-medium text-white">
            ◎
          </div>
          <div>
            <div className="text-[11.5px] font-semibold text-white">
              Slot #{selectedRpc.slotHeight.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] text-white/60">
              {selectedRpc.tps.toLocaleString()} TPS • Priority: 0.000012 SOL
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#14F195]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#14F195]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#14F195]" />
          {selectedRpc.latencyMs}ms
        </span>
      </div>
    </GlassSurface>
  );
};

export default ControlCenter;
