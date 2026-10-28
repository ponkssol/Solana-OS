export function MacOSDialogModal({
  onSign,
  onInspect,
  onReject,
}: {
  onSign: () => void;
  onInspect: () => void;
  onReject: () => void;
}) {
  return (
    <section
      className="absolute bottom-[72px] right-4 z-40 flex h-[216px] w-[260px] flex-col rounded-[16px] border border-white/[0.07] px-4 pt-5 shadow-[0_0_0_1px_rgba(0,0,0,0.75),0_18px_54px_rgba(0,0,0,0.57)]"
      style={{ background: 'rgba(30,30,30,0.85)', backdropFilter: 'blur(40px)' }}
    >
      <div className="px-[6px] text-center">
        <h2 className="h-[16px] text-[13px] font-[700] leading-[16px] text-white">Approve Safe Simulation?</h2>
        <p className="mt-[10px] h-[42px] text-[11px] font-[400] leading-[14px] text-white/80">
          Swap 25.0 SOL → 4,812.50 USDC via Jupiter v6. Zero authority changes detected.
        </p>
      </div>
      <div className="mt-auto flex flex-col gap-[6px] pb-4">
        <button
          type="button"
          onClick={onSign}
          className="h-[28px] w-full rounded-[6px] bg-[#0088ff] text-[13px] font-[510] text-white"
        >
          Sign with Hardware Enclave
        </button>
        <button
          type="button"
          onClick={onInspect}
          className="h-[28px] w-full rounded-[6px] bg-white/12 text-[13px] font-[510] text-white"
        >
          Inspect CPI Trace
        </button>
        <button
          type="button"
          onClick={onReject}
          className="h-[28px] w-full rounded-[6px] bg-[#ff383c]/20 text-[13px] font-[510] text-[#ff383c]"
        >
          Reject Transaction
        </button>
      </div>
    </section>
  );
}
