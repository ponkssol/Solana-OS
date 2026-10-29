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
      <button type="button" className="h-[28px] w-fit rounded-[6px] bg-[#0088ff] px-3 text-[13px] font-[510]" onClick={onSimulate}>
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
      <div className="text-[22px] font-[700]">142.85 SOL</div>
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
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35" onClick={onCancel}>
      <form
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onClone(String(data.get('app')), data.get('room') as 'treasury');
        }}
        className="w-[min(420px,calc(100%-32px))] rounded-[16px] border border-white/[0.07] bg-[#1e1e1e] p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.75)]"
      >
        <h2 className="text-[14px] font-[700]">Clone New App Instance</h2>
        <p className="mt-1 text-[12px] text-[#8a8a8a]">Pick an installed Windows .exe and the room namespace.</p>
        <label className="mt-4 block text-[12px] text-[#8a8a8a]">
          Application
          <select name="app" className="mt-1 h-[28px] w-full rounded-[6px] border border-white/[0.06] bg-[#2a2a2c] px-2 text-white">
            {apps.map((app) => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-[12px] text-[#8a8a8a]">
          Room
          <select name="room" className="mt-1 h-[28px] w-full rounded-[6px] border border-white/[0.06] bg-[#2a2a2c] px-2 text-white">
            <option value="treasury">Main Treasury</option>
            <option value="defi">DeFi & Perps Trading</option>
            <option value="burner">Burner Minting</option>
            <option value="devnet">Devnet Builder</option>
          </select>
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-[28px] rounded-[6px] border border-white/[0.06] px-3">Cancel</button>
          <button type="submit" className="h-[28px] rounded-[6px] bg-[#0088ff] px-3">Clone</button>
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
