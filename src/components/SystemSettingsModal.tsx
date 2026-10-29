export function SystemSettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={onClose}>
      <section
        onClick={(event) => event.stopPropagation()}
        className="flex h-[min(520px,calc(100%-48px))] w-[min(760px,calc(100%-48px))] overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#1e1e1e] shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_18px_54px_rgba(0,0,0,0.57)]"
      >
        <aside className="w-[210px] border-r border-white/[0.04] bg-[#141517] p-4 text-[13px]">
          <div className="mb-3 text-[11px] font-[700] uppercase tracking-wide text-[#8a8a8a]">System Settings</div>
          {['Rooms', 'Proxy / RPC', 'Post-Quantum Security', 'Theme / Wallpaper'].map((item, index) => (
            <div key={item} className={`rounded-[6px] px-2 py-1.5 ${index === 0 ? 'bg-white/[0.06] text-white' : 'text-[#8a8a8a]'}`}>
              {item}
            </div>
          ))}
        </aside>
        <div className="flex flex-1 flex-col p-5 text-[13px]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-[700]">Solana OS Settings</h2>
            <button type="button" onClick={onClose} className="h-[28px] rounded-[6px] border border-white/[0.06] px-3">
              Done
            </button>
          </div>
          <SettingsRow label="Active room" value="Main Treasury" />
          <SettingsRow label="RPC" value="Helius staked · 11ms" />
          <SettingsRow label="Cipher" value="ML-KEM-1024 + XChaCha20-Poly1305" />
          <SettingsRow label="Wallpaper" value="Figma dark wave · 5fffa-1920" />
          <p className="mt-4 text-[12px] leading-5 text-[#8a8a8a]">
            Room namespaces keep AppData, the Solana CLI config, and the vault mount separate.
            Theme stays on the dark macOS hairline system.
          </p>
        </div>
      </section>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-3">
      <span className="text-[#8a8a8a]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
