import type { EnclaveSnapshot } from '../lib/tauriBridge';

const BTN = 'h-[28px] rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-3 text-[13px] font-[510]';

export function VaultPanel({
  snapshot,
  error,
  onLock,
}: {
  snapshot: EnclaveSnapshot | null;
  error: string;
  onLock: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-6 text-[13px]">
      <h2 className="text-[15px] font-[700]">vault.solos</h2>
      {error ? (
        <EmptyState text={`Vault status is unavailable: ${error}`} />
      ) : !snapshot ? (
        <EmptyState text="Reading vault status…" />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          <Spec label="Container" value={snapshot.locked ? 'Locked' : 'Unlocked'} />
          <Spec label="Encryption" value={snapshot.cipherSuite} />
          <Spec label="KDF" value={snapshot.kdf} />
          <Spec label="AEAD" value={snapshot.aead} />
          <Spec label="KEM" value={snapshot.kem} />
          <Spec label="Key memory" value={snapshot.ramEnclave} />
          <Spec label="Key isolation ID" value={snapshot.keyId} />
          </div>
          <div>
            <button type="button" className={BTN} onClick={onLock}>Lock Vault</button>
          </div>
        </>
      )}
    </div>
  );
}

export function ShieldPanel({ active }: { active: boolean }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-6 text-[13px]">
      <h2 className="text-[15px] font-[700]">Anti-Drainer Shield</h2>
      <Spec label="Status" value={active ? 'On' : 'Off'} />
      <EmptyState text="No transactions have been inspected yet. Events appear here when a contained wallet asks to sign." />
    </div>
  );
}

export function BuilderPanel({ onOpenTerminal }: { onOpenTerminal: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-6 text-[13px]">
      <h2 className="text-[15px] font-[700]">Builder Suite</h2>
      <EmptyState text="Toolchain versions aren't detected yet. Run solana --version or anchor --version in the room terminal." />
      <button type="button" className={`${BTN} w-fit border-[#0A84FF]/30 text-[#0A84FF]`} onClick={onOpenTerminal}>
        Open Solana OS Terminal
      </button>
    </div>
  );
}

export function WalletPanel({
  brand,
  onClose,
}: {
  brand: 'phantom' | 'solflare' | 'backpack';
  onClose: () => void;
}) {
  const title = brand === 'solflare' ? 'Solflare' : brand === 'backpack' ? 'Backpack' : 'Phantom';
  return (
    <div className="flex h-full flex-col gap-4 p-6 text-[13px]">
      <div className="flex items-center justify-between">
        <h2 className="font-[700]">{title}</h2>
        <button type="button" onClick={onClose} className={BTN}>Close</button>
      </div>
      <EmptyState text="No wallet is connected. Balances need a connected wallet and an RPC endpoint, and neither is configured." />
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-white/[0.08] px-4 py-6 text-center text-[12px] leading-5 text-[#8a8a8a]">
      {text}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] font-[700] text-[#8a8a8a]">{label}</div>
      <div className="mt-0.5 break-all">{value}</div>
    </div>
  );
}
