import { LiquidGlassPill } from './macosMaterials';

export function BentoControlCenter({
  shieldOn,
  freezeOn,
  brightness,
  volume,
  onToggleShield,
  onToggleFreeze,
  onBrightness,
  onVolume,
  onLock,
}: {
  shieldOn: boolean;
  freezeOn: boolean;
  brightness: number;
  volume: number;
  onToggleShield: () => void;
  onToggleFreeze: () => void;
  onBrightness: (value: number) => void;
  onVolume: (value: number) => void;
  onLock: () => void;
}) {
  return (
    <div
      className="w-[320px] rounded-[16px] border border-white/20 p-3 text-white shadow-[0px_18px_54px_rgba(0,0,0,0.57)]"
      style={{ background: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(40px)' }}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <div className="text-[13px] font-[700] leading-[16px] text-[#f5f5f5] [mix-blend-mode:plus-lighter]">
            Control Center
          </div>
          <div className="text-[11px] font-[510] leading-[14px] text-[#8a8a8a]">nanda.solos · Main</div>
        </div>
        <button
          type="button"
          onClick={onLock}
          className="h-[24px] rounded-[6px] bg-white/12 px-[16px] text-[13px] font-[510]"
        >
          Lock
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ToggleCard label="Helius RPC" detail="11ms" on />
        <ToggleCard label="Anti-Drainer" detail={shieldOn ? 'CPI Guard ON' : 'Off'} on={shieldOn} onClick={onToggleShield} />
        <ToggleCard label="Freeze" detail={freezeOn ? 'SIGSTOP' : 'Off'} on={freezeOn} onClick={onToggleFreeze} />
        <ToggleCard label="Clipboard" detail="Isolated" on />
      </div>

      <div className="mt-2 space-y-2">
        <GlassSlider label="Display" value={brightness} onChange={onBrightness} />
        <GlassSlider label="Audio" value={volume} onChange={onVolume} />
      </div>
    </div>
  );
}

function ToggleCard({
  label,
  detail,
  on,
  onClick,
}: {
  label: string;
  detail: string;
  on: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-[12px] border border-white/10 bg-white/[0.06] px-2.5 py-2 text-left"
    >
      <span>
        <span className="block text-[11px] font-[700] leading-[14px] text-[#f5f5f5]">{label}</span>
        <span className="block text-[11px] font-[510] text-[#8a8a8a]">{detail}</span>
      </span>
      <span
        className="relative h-[24px] w-[54px] rounded-[100px]"
        style={{ background: on ? '#0088ff' : 'rgba(255,255,255,0.16)' }}
      >
        <span
          className="absolute top-[2px] size-[20px] rounded-full bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.35)]"
          style={{ left: on ? 32 : 2 }}
        />
      </span>
    </button>
  );
}

function GlassSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <LiquidGlassPill className="w-full px-3">
      <div className="flex w-full items-center gap-2">
        <span className="w-12 text-[11px] font-[510] text-[#8a8a8a] [mix-blend-mode:plus-lighter]">{label}</span>
        <input
          aria-label={label}
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-[6px] flex-1 cursor-pointer appearance-none rounded-[100px] bg-white/15 accent-[#0088ff]"
        />
      </div>
    </LiquidGlassPill>
  );
}
