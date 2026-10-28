const NOTES = [
  {
    title: 'Anti-Drainer Shield · Blocked',
    body: 'Intercepted unauthorized SetAuthority CPI call in Burner Sandbox #02.',
    when: 'now',
  },
  {
    title: 'Quantum Vault (vault.solos)',
    body: 'ML-KEM-1024 + outbound hardware shard verified via YubiKey.',
    when: '2m ago',
  },
];

export function NotificationStack() {
  return (
    <div className="pointer-events-none absolute right-4 top-[49px] z-30 flex w-[344px] flex-col gap-4">
      {NOTES.map((note) => (
        <article
          key={note.title}
          className="pointer-events-auto relative h-[72px] overflow-hidden rounded-[16px] border border-white/[0.07] px-3.5 py-2.5"
          style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.75), 0px 12px 32px rgba(0,0,0,0.45)' }}
        >
          <div
            className="absolute inset-0 rounded-[16px] bg-[rgba(38,38,38,0.75)] backdrop-blur-[40px] [mix-blend-mode:luminosity]"
          />
          <div className="relative flex items-start justify-between gap-3">
            <h3 className="text-[13px] font-[700] leading-[16px] text-[#f5f5f5]">
              {note.title}
            </h3>
            <span className="shrink-0 text-[11px] font-[400] leading-[14px] text-[#8a8a8a]">{note.when}</span>
          </div>
          <p className="relative mt-1 text-[11px] font-[400] leading-[14px] text-white/80">{note.body}</p>
        </article>
      ))}
    </div>
  );
}
