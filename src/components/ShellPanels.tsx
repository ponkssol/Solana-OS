import { useEffect, useState } from 'react';
import { usePrefs } from '../lib/settings';
import {
  getLatestBlockhash,
  getRecentSignatures,
  getSolBalance,
  getTokenBalances,
  sendRawTransaction,
  type SignatureInfo,
  type TokenBalance,
} from '../lib/rpc';
import { LAMPORTS_PER_SOL, buildTransferMessage, decodePublicKey, toBase64, wrapTransaction } from '../lib/solanaTx';
import { addAccount, assignRoom, renameAccount, requestSignature, selectAccount, useWallet } from '../lib/wallet';
import { ROOM_CONFIGS } from '../tokens/designTokens';
import { useOSStore } from '../store/useOSStore';
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
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto px-8 py-6 text-[13px]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-[700]">vault.solos</h2>
        {snapshot && !error && <button type="button" className={BTN} onClick={onLock}>Lock Vault</button>}
      </div>
      {error ? (
        <EmptyState text={`Vault status is unavailable: ${error}`} />
      ) : !snapshot ? (
        <EmptyState text="Reading vault status…" />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
          <Spec label="Container" value={snapshot.locked ? 'Locked' : 'Unlocked'} />
          <Spec label="Encryption" value={snapshot.cipherSuite} />
          <Spec label="KDF" value={snapshot.kdf} />
          <Spec label="AEAD" value={snapshot.aead} />
          <Spec label="KEM" value={snapshot.kem} />
          <Spec label="Key memory" value={snapshot.ramEnclave} />
          <Spec label="Room namespace" value={snapshot.keyId} />
          <VaultFileSpecs />
          </div>
        </>
      )}
    </div>
  );
}

function VaultFileSpecs() {
  const { address, suite } = useWallet();
  return (
    <>
      <Spec label="Vault file format" value={suite ?? 'Unknown until unlocked'} />
      <Spec label="Wallet address" value={address ?? 'No recovery phrase loaded'} />
    </>
  );
}

export function ShieldPanel({ active }: { active: boolean }) {
  const history = useWallet((s) => s.history);
  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto px-8 py-6 text-[13px]">
      <h2 className="text-[15px] font-[700]">Anti-Drainer Shield</h2>
      <Spec label="Status" value={active ? 'On' : 'Off'} />
      <p className="text-[12px] leading-5 text-[#8a8a8a]">
        Every signature the vault wallet produces is reviewed here first: transactions are simulated against your RPC endpoint and checked by the local drainer rules, then you approve or reject. Apps launched in a room get a loopback RPC in SOLANA_RPC_URL (also ANCHOR_PROVIDER_URL), so the Solana CLI, Anchor, scripts and any wallet pointed at that URL have their sendTransaction calls held here for review. Browser extension wallets such as Phantom use their own RPC and signer, so their transactions are not intercepted.
      </p>
      {history.length === 0 ? (
        <EmptyState text="No signing requests yet." />
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((d) => (
            <div key={`${d.id}-${d.at}`} className="flex items-center justify-between rounded-[8px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <span className="truncate">{d.summary}</span>
              <span className={d.approved ? 'text-[#30d158]' : 'text-[#ff6961]'}>
                {d.approved ? 'Signed' : 'Rejected'} · {new Date(d.at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BuilderPanel({ onOpenTerminal }: { onOpenTerminal: () => void }) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto px-8 py-6 text-[13px]">
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
  const activeRoom = useOSStore((s) => s.activeRoom);
  useEffect(() => {
    selectAccount(useWallet.getState().rooms[activeRoom] ?? 0);
  }, [activeRoom]);
  const title = brand === 'solflare' ? 'Solflare' : brand === 'backpack' ? 'Backpack' : 'Phantom';
  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto px-8 py-6 text-[13px]">
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
    <div className="min-w-0 rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] font-[700] text-[#8a8a8a]">{label}</div>
      <div className="mt-0.5 [overflow-wrap:anywhere] [word-break:normal]">{value}</div>
    </div>
  );
}

function WalletBalance() {
  const rpcUrl = usePrefs((p) => p.rpcUrl);
  const accounts = useWallet((s) => s.accounts);
  const selected = useWallet((s) => s.selected);
  const rooms = useWallet((s) => s.rooms);
  const account = accounts.find((a) => a.index === selected) ?? accounts[0];
  const address = account?.address;
  const [state, setState] = useState<{ sol?: number; tokens?: TokenBalance[]; history?: SignatureInfo[]; error?: string }>({});
  const [refresh, setRefresh] = useState(0);
  const [name, setName] = useState('');

  useEffect(() => setName(account?.name ?? ''), [account?.name]);

  useEffect(() => {
    if (!address) return;
    let live = true;
    setState({});
    Promise.all([getSolBalance(rpcUrl, address), getTokenBalances(rpcUrl, address), getRecentSignatures(rpcUrl, address)])
      .then(([sol, tokens, history]) => live && setState({ sol, tokens, history }))
      .catch((err) => live && setState({ error: String(err instanceof Error ? err.message : err) }));
    return () => {
      live = false;
    };
  }, [rpcUrl, address, refresh]);

  if (!account || !address) {
    return <EmptyState text="Unlock a vault created from a recovery phrase to load its wallet." />;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={account.index} onChange={(e) => selectAccount(Number(e.target.value))} className={FIELD}>
          {accounts.map((a) => (
            <option key={a.index} value={a.index}>{a.name}</option>
          ))}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => renameAccount(account.index, name)} className={`${FIELD} w-[160px]`} aria-label="Account name" />
        <button type="button" className={BTN} onClick={() => void addAccount()}>Add account</button>
        <button type="button" className={BTN} onClick={() => setRefresh((n) => n + 1)}>Refresh</button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
        <Spec label={`Address (m/44'/501'/${account.index}'/0')`} value={address} />
        <Spec
          label="Balance"
          value={state.error ? `Couldn't load: ${state.error}` : state.sol === undefined ? 'Loading…' : `${state.sol.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`}
        />
      </div>
      <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="mb-2 text-[11px] font-[700] text-[#8a8a8a]">Rooms using this account</div>
        <div className="flex flex-wrap gap-3">
          {Object.values(ROOM_CONFIGS).map((room) => (
            <label key={room.id} className="flex items-center gap-1.5 text-[12px]">
              <input type="radio" checked={(rooms[room.id] ?? 0) === account.index} onChange={() => assignRoom(room.id, account.index)} />
              {room.label}
            </label>
          ))}
        </div>
      </div>
      <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="mb-2 text-[11px] font-[700] text-[#8a8a8a]">Tokens</div>
        {!state.tokens ? (
          <div className="text-[12px] text-[#8a8a8a]">{state.error ? 'Unavailable.' : 'Loading…'}</div>
        ) : state.tokens.length === 0 ? (
          <div className="text-[12px] text-[#8a8a8a]">No SPL token balances.</div>
        ) : (
          state.tokens.map((t) => (
            <div key={`${t.program}-${t.mint}`} className="flex justify-between gap-3 py-1 text-[12px]">
              <span className="min-w-0 truncate font-mono" title={t.mint}>{t.mint}</span>
              <span className="shrink-0">{t.amount}{t.program === 'token-2022' ? ' · 2022' : ''}</span>
            </div>
          ))
        )}
      </div>
      <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="mb-2 text-[11px] font-[700] text-[#8a8a8a]">Recent transactions</div>
        {!state.history ? (
          <div className="text-[12px] text-[#8a8a8a]">{state.error ? 'Unavailable.' : 'Loading…'}</div>
        ) : state.history.length === 0 ? (
          <div className="text-[12px] text-[#8a8a8a]">No transactions yet.</div>
        ) : (
          state.history.map((h) => (
            <div key={h.signature} className="flex justify-between gap-3 py-1 text-[12px]">
              <span className="min-w-0 truncate font-mono" title={h.signature}>{h.signature}</span>
              <span className={`shrink-0 ${h.err ? 'text-[#ff6961]' : 'text-[#8a8a8a]'}`}>
                {h.err ? 'Failed · ' : ''}
                {h.blockTime ? new Date(h.blockTime * 1000).toLocaleString() : `slot ${h.slot}`}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="text-[11px] text-[#8a8a8a]">Endpoint: {rpcUrl}</div>
      <SendSol from={address} account={account.index} onSent={() => setRefresh((n) => n + 1)} />
      <SignMessage account={account.index} />
    </div>
  );
}

const FIELD = 'h-[30px] rounded-[6px] border border-white/[0.08] bg-white/[0.04] px-2 text-[12px] outline-none';

function SendSol({ from, account, onSent }: { from: string; account: number; onSent: () => void }) {
  const rpcUrl = usePrefs((p) => p.rpcUrl);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const send = async () => {
    setStatus('');
    try {
      decodePublicKey(to);
      if (to.trim() === from) throw new Error('The destination is this wallet.');
      const lamports = Math.round(Number(amount) * LAMPORTS_PER_SOL);
      if (!Number.isFinite(lamports) || lamports <= 0) throw new Error('Enter an amount above zero.');
      const blockhash = await getLatestBlockhash(rpcUrl);
      const message = buildTransferMessage(from, to.trim(), BigInt(lamports), blockhash);
      const signature = await requestSignature({
        kind: 'transaction',
        origin: 'Solana OS Wallet',
        summary: `Send ${amount} SOL to ${to.trim()}`,
        bytes: message,
        account,
        unsignedTx: wrapTransaction(message),
        transfer: { destination: to.trim(), lamports },
      });
      setStatus('Submitting…');
      const txid = await sendRawTransaction(rpcUrl, toBase64(wrapTransaction(message, signature)));
      setStatus(`Submitted: ${txid}`);
      onSent();
    } catch (err) {
      setStatus(String(err instanceof Error ? err.message : err));
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="text-[11px] font-[700] text-[#8a8a8a]">Send SOL</div>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient address" className={`${FIELD} font-mono`} />
      <div className="flex gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (SOL)" inputMode="decimal" className={`${FIELD} flex-1`} />
        <button type="button" className={BTN} disabled={!to || !amount} onClick={() => void send()}>Review in Shield</button>
      </div>
      {status && <div className="break-all text-[11px] text-white/80">{status}</div>}
    </div>
  );
}

function SignMessage({ account }: { account: number }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  const sign = async () => {
    setStatus('');
    try {
      const signature = await requestSignature({
        kind: 'message',
        origin: 'Solana OS Wallet',
        summary: 'Sign a text message',
        bytes: new TextEncoder().encode(text),
        account,
      });
      setStatus(`Signature: ${toBase64(signature)}`);
    } catch (err) {
      setStatus(String(err instanceof Error ? err.message : err));
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="text-[11px] font-[700] text-[#8a8a8a]">Sign message</div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message text" className={`${FIELD} flex-1`} />
        <button type="button" className={BTN} disabled={!text} onClick={() => void sign()}>Review in Shield</button>
      </div>
      {status && <div className="break-all font-mono text-[11px] text-white/80">{status}</div>}
    </div>
  );
}
