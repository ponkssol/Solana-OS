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
      className="w-[min(320px,calc(100vw-24px))] rounded-[16px] border border-white/[0.06] p-3 text-white shadow-[0px_18px_54px_rgba(0,0,0,0.57)]"
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
      className="flex items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.05] px-2.5 py-2 text-left"
    >
      <span>
        <span className="block text-[11px] font-[700] leading-[14px] text-[#f5f5f5]">{label}</span>
        <span className="block text-[11px] font-[510] text-[#8a8a8a]">{detail}</span>
      </span>
      <span
        className="relative h-[24px] w-[54px] rounded-[100px]"
        style={{ background: on ? '#0A84FF' : 'rgba(255,255,255,0.16)' }}
      >
        <span
          className="absolute top-[2px] size-[20px] rounded-full bg-white"
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
    <div className="flex w-full items-center gap-2 rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-3 py-2">
      <span className="w-12 text-[11px] font-[510] text-[#8a8a8a]">{label}</span>
      <div className="relative h-[14px] flex-1">
        <div className="absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full border border-white/[0.06] bg-white/[0.08]" />
        <div
          className="absolute left-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#0A84FF]"
          style={{ width: `${value}%` }}
        />
        <div
          className="absolute top-1/2 size-[12px] -translate-y-1/2 rounded-full bg-[#f5f5f5]"
          style={{ left: `calc(${value}% - 6px)` }}
        />
        <input
          aria-label={label}
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
