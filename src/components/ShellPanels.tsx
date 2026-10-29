import { useState } from 'react';
import { PopupSelect } from './PopupSelect';

const BTN = 'h-[28px] rounded-[6px] border border-white/[0.06] bg-white/[0.05] px-3 text-[13px] font-[510]';

export function VaultPanel({
  locked,
  onLock,
  onExport,
  onRotate,
}: {
  locked: boolean;
  onLock: () => void;
  onExport: () => void;
  onRotate: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5 text-[13px]">
      <h2 className="text-[15px] font-[700]">vault.solos · ML-KEM-1024</h2>
      <Spec label="KDF" value="Argon2id · 8192 KiB · t=2 · p=1" />
      <Spec label="AEAD" value="XChaCha20-Poly1305" />
      <Spec label="KEM slot" value="ML-KEM-1024 ciphertext · 1568 bytes" />
      <Spec label="RAM enclave" value="VirtualLock + Zeroize · key lives only for the signing closure" />
      <Spec label="Hardware shard" value="YubiKey 5C · Shamir 2-of-3 verified" />
      <Spec label="Container" value={locked ? 'Locked' : 'Unsealed'} />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={onLock}>Lock Vault</button>
        <button type="button" className={BTN} onClick={onExport}>Export Portable .solos</button>
        <button type="button" className={`${BTN} border-[#0A84FF]/30 text-[#0A84FF]`} onClick={onRotate}>Rotate Kyber Keypair</button>
      </div>
    </div>
  );
}

export function ShieldPanel({
  logs,
  onSimulate,
}: {
  logs: string[];
  onSimulate: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5 text-[13px]">
      <h2 className="text-[15px] font-[700]">Anti-Drainer CPI Guard</h2>
      <Spec label="Blocked domains" value="jup-ag.io · phantom-app.co · raydium.finance" />
      <Spec label="ClickFix clipboard" value="Armed · PowerShell / mshta lures dropped" />
      <div className="rounded-[6px] border border-white/[0.04] bg-black/30 p-3 font-mono text-[12px] leading-5 text-[#d6d6d6]">
        {logs.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <button type="button" className="os-btn os-btn-primary w-fit" onClick={onSimulate}>
        Run live transaction simulation
      </button>
    </div>
  );
}

export function BuilderPanel({
  validatorOn,
  onToggleValidator,
  onOpenTerminal,
}: {
  validatorOn: boolean;
  onToggleValidator: () => void;
  onOpenTerminal: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5 text-[13px]">
      <h2 className="text-[15px] font-[700]">Solana Builder Suite · Dev Room</h2>
      <Spec label="Rust" value="stable · solana-os host" />
      <Spec label="Solana CLI" value="2.1 · config redirected into the room mount" />
      <Spec label="Anchor" value="0.30.1 · solana-os-registry" />
      <Spec label="Local validator" value={validatorOn ? 'Running · 127.0.0.1:8899' : 'Stopped'} />
      <Spec label="id.json signer" value="Zero-exposure enclave hook · plaintext key is not on disk" />
      <div className="flex gap-2">
        <button type="button" className={BTN} onClick={onToggleValidator}>
          {validatorOn ? 'Stop validator' : 'Start validator'}
        </button>
        <button type="button" className={`${BTN} border-[#0A84FF]/30 text-[#0A84FF]`} onClick={onOpenTerminal}>
          Open Solana OS Terminal
        </button>
      </div>
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
    <div className="flex h-full flex-col p-4 text-[13px]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[700]">{title} · standalone</h2>
        <button type="button" onClick={onClose} className={BTN}>Close</button>
      </div>
      <div className="text-[15px] font-[600]">142.85 SOL</div>
      <div className="text-[12px] text-[#8a8a8a]">$34,812.40 · window.solana bridge isolated</div>
      <div className="mt-3 space-y-2">
        {['SOL  142.85', 'JUP  4,250.00', 'USDC  1,426.60'].map((token) => (
          <div key={token} className="rounded-[6px] border border-white/[0.04] px-3 py-2 font-mono text-[12px]">
            {token}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CloneSheet({
  onCancel,
  onClone,
}: {
  onCancel: () => void;
  onClone: (appId: string, room: 'treasury' | 'defi' | 'burner' | 'devnet') => void;
}) {
  const apps = ['chrome', 'brave', 'cursor', 'vscode', 'telegram', 'discord'] as const;
  const rooms = [
    { value: 'treasury', label: 'Main Treasury' },
    { value: 'defi', label: 'DeFi & Perps Trading' },
    { value: 'burner', label: 'Burner Minting' },
    { value: 'devnet', label: 'Devnet Builder' },
  ] as const;
  const [app, setApp] = useState<(typeof apps)[number]>('chrome');
  const [room, setRoom] = useState<(typeof rooms)[number]['value']>('treasury');
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35" onClick={onCancel}>
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClone(app, room);
        }}
        className="w-[min(360px,calc(100%-32px))] rounded-[16px] border border-white/[0.06] bg-[#1e1e1e] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.75)]"
      >
        <h2 className="os-sheet-title">Clone New App Instance</h2>
        <p className="os-secondary mt-1">Pick an installed Windows .exe and the room namespace.</p>
        <label className="os-label mt-3 block">
          Application
          <PopupSelect
            label="Application"
            value={app}
            options={apps.map((item) => ({ value: item, label: item }))}
            onChange={(next) => setApp(next as (typeof apps)[number])}
          />
        </label>
        <label className="os-label mt-3 block">
          Room
          <PopupSelect
            label="Room"
            value={room}
            options={rooms.map((item) => ({ value: item.value, label: item.label }))}
            onChange={(next) => setRoom(next as (typeof rooms)[number]['value'])}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="os-btn">Cancel</button>
          <button type="submit" className="os-btn os-btn-primary">Clone</button>
        </div>
      </form>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-white/[0.04] px-3 py-2">
      <div className="text-[11px] font-[700] text-[#8a8a8a]">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
