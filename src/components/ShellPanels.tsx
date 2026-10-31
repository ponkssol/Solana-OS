import { useEffect, useState } from 'react';
import { usePrefs } from '../lib/settings';
import { getSolBalance, simulateTransaction, type SimulationResult } from '../lib/rpc';
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
  const rpcUrl = usePrefs((p) => p.rpcUrl);
  const [tx, setTx] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await simulateTransaction(rpcUrl, tx.trim()));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-6 text-[13px]">
      <h2 className="text-[15px] font-[700]">Anti-Drainer Shield</h2>
      <Spec label="Status" value={active ? 'On' : 'Off'} />
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-[700] text-[#8a8a8a]">Pre-sign simulation</div>
        <textarea
          value={tx}
          onChange={(e) => setTx(e.target.value)}
          placeholder="Paste a base64-encoded transaction to simulate it before signing"
          className="h-[90px] resize-none rounded-[8px] border border-white/[0.08] bg-white/[0.04] p-3 font-mono text-[11px] outline-none"
        />
        <button type="button" disabled={busy || !tx.trim()} className={`${BTN} w-fit`} onClick={() => void run()}>
          {busy ? 'Simulating…' : 'Simulate via RPC'}
        </button>
        <div className="text-[11px] text-[#8a8a8a]">Endpoint: {rpcUrl}</div>
      </div>
      {error && <div className="text-[12px] text-[#ff6961]">{error}</div>}
      {result && (
        <div className="flex flex-col gap-2">
          <Spec label="Result" value={result.err ? `Would fail: ${JSON.stringify(result.err)}` : 'Would succeed'} />
          {result.unitsConsumed !== undefined && <Spec label="Compute units" value={result.unitsConsumed.toLocaleString()} />}
          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[8px] bg-black/40 p-3 font-mono text-[11px] text-white/80">
            {(result.logs ?? ['No program logs.']).join('\n')}
          </pre>
        </div>
      )}
      {!result && !error && (
        <EmptyState text="Contained wallets don't route signing requests here yet, so simulation runs on transactions you paste." />
      )}
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
      <WalletBalance />
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

function WalletBalance() {
  const { rpcUrl, walletAddress } = usePrefs();
  const [state, setState] = useState<{ sol?: number; error?: string }>({});

  useEffect(() => {
    if (!walletAddress) return;
    let live = true;
    setState({});
    getSolBalance(rpcUrl, walletAddress)
      .then((sol) => live && setState({ sol }))
      .catch((err) => live && setState({ error: String(err) }));
    return () => {
      live = false;
    };
  }, [rpcUrl, walletAddress]);

  if (!walletAddress) {
    return <EmptyState text="Add a wallet address in Settings → RPC & Wallet to see its SOL balance." />;
  }
  return (
    <div className="flex flex-col gap-3">
      <Spec label="Address" value={walletAddress} />
      <Spec
        label="Balance"
        value={state.error ? `Couldn't load: ${state.error}` : state.sol === undefined ? 'Loading…' : `${state.sol.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`}
      />
      <div className="text-[11px] text-[#8a8a8a]">Endpoint: {rpcUrl}</div>
    </div>
  );
}
