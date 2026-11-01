import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { isTauriRuntime } from './tauriIpc';

export interface UnlockResult {
  address: string | null;
  suite: string;
  migrated: boolean;
}

export interface WalletAccount {
  index: number;
  name: string;
  address: string;
}

// Names and room assignments are labels only; addresses are re-derived in Rust on unlock.
interface AccountMeta {
  count: number;
  names: Record<number, string>;
  rooms: Record<string, number>;
}

const META_KEY = 'solos.walletAccounts';

function readMeta(): AccountMeta {
  try {
    const raw = JSON.parse(localStorage.getItem(META_KEY) ?? '');
    return { count: Math.max(1, Number(raw.count) || 1), names: raw.names ?? {}, rooms: raw.rooms ?? {} };
  } catch {
    return { count: 1, names: {}, rooms: {} };
  }
}

function writeMeta(meta: AccountMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export interface ExternalTx {
  id: number;
  room: string;
  transaction: string;
  encoding: string;
}

export type SignKind = 'transaction' | 'message';

export interface SignRequest {
  id: number;
  kind: SignKind;
  origin: string;
  summary: string;
  bytes: Uint8Array;
  account: number;
  // Present for transactions: the unsigned wire transaction used for simulation.
  unsignedTx?: Uint8Array;
  transfer?: { destination: string; lamports: number };
}

export interface ShieldDecision {
  id: number;
  at: number;
  kind: SignKind;
  summary: string;
  approved: boolean;
}

interface Pending {
  request: SignRequest;
  resolve: (signature: Uint8Array) => void;
  reject: (err: Error) => void;
}

interface WalletState {
  address: string | null;
  suite: string | null;
  pending: Pending | null;
  history: ShieldDecision[];
  accounts: WalletAccount[];
  selected: number;
  rooms: Record<string, number>;
  external: ExternalTx[];
}

export const useWallet = create<WalletState>(() => ({
  address: null,
  suite: null,
  pending: null,
  history: [],
  accounts: [],
  selected: 0,
  rooms: readMeta().rooms,
  external: [],
}));

async function loadAccounts(meta = readMeta()) {
  const addresses = await invoke<string[]>('wallet_accounts', { count: meta.count });
  useWallet.setState({
    accounts: addresses.map((address, index) => ({ index, address, name: meta.names[index] ?? `Account ${index + 1}` })),
    rooms: meta.rooms,
  });
}

export async function addAccount() {
  const meta = readMeta();
  meta.count += 1;
  await loadAccounts(meta);
  writeMeta(meta);
  useWallet.setState({ selected: meta.count - 1 });
}

export function renameAccount(index: number, name: string) {
  const meta = readMeta();
  meta.names[index] = name.trim() || `Account ${index + 1}`;
  writeMeta(meta);
  useWallet.setState((s) => ({
    accounts: s.accounts.map((a) => (a.index === index ? { ...a, name: meta.names[index] } : a)),
  }));
}

export function assignRoom(room: string, index: number) {
  const meta = readMeta();
  meta.rooms[room] = index;
  writeMeta(meta);
  useWallet.setState({ rooms: { ...meta.rooms } });
}

export function selectAccount(index: number) {
  useWallet.setState({ selected: index });
}

export function accountAddress(index: number): string | null {
  return useWallet.getState().accounts.find((a) => a.index === index)?.address ?? null;
}

export function queueExternal(tx: ExternalTx) {
  useWallet.setState((s) => ({ external: [...s.external, tx] }));
}

export function expireExternal(id: number) {
  useWallet.setState((s) => {
    const tx = s.external.find((e) => e.id === id);
    if (!tx) return {};
    return {
      external: s.external.filter((e) => e.id !== id),
      history: [
        { id: -tx.id, at: Date.now(), kind: 'transaction' as const, summary: `Transaction from room ${tx.room} (timed out)`, approved: false },
        ...s.history.slice(0, 19),
      ],
    };
  });
}

export async function decideExternal(tx: ExternalTx, approve: boolean) {
  await invoke('shield_proxy_decide', { id: tx.id, approve }).catch(() => undefined);
  useWallet.setState((s) => ({
    external: s.external.filter((e) => e.id !== tx.id),
    history: [
      { id: -tx.id, at: Date.now(), kind: 'transaction' as const, summary: `Transaction from room ${tx.room}`, approved: approve },
      ...s.history.slice(0, 19),
    ],
  }));
}

export function setUnlocked(result: UnlockResult) {
  useWallet.setState({ address: result.address, suite: result.suite, selected: 0 });
  if (result.address) void loadAccounts().catch(() => undefined);
}

export async function lockWallet() {
  const pending = useWallet.getState().pending;
  pending?.reject(new Error('The vault was locked.'));
  useWallet.setState({ address: null, pending: null, accounts: [] });
  if (isTauriRuntime()) await invoke('wallet_lock');
}

function record(request: SignRequest, approved: boolean) {
  useWallet.setState((s) => ({
    pending: null,
    history: [
      { id: request.id, at: Date.now(), kind: request.kind, summary: request.summary, approved },
      ...s.history.slice(0, 19),
    ],
  }));
}

/** Every signature goes through here, so the Shield review always runs first. */
export async function requestSignature(request: Omit<SignRequest, 'id'>): Promise<Uint8Array> {
  if (useWallet.getState().pending) throw new Error('Another signing request is waiting for review.');
  const id = await invoke<number>('shield_queue_sign', { message: Array.from(request.bytes), account: request.account });
  const full: SignRequest = { ...request, id };
  return await new Promise<Uint8Array>((resolve, reject) => {
    useWallet.setState({ pending: { request: full, resolve, reject } });
  });
}

export async function approvePending() {
  const pending = useWallet.getState().pending;
  if (!pending) return;
  try {
    const signature = await invoke<number[]>('shield_approve_sign', { id: pending.request.id });
    record(pending.request, true);
    pending.resolve(Uint8Array.from(signature));
  } catch (err) {
    record(pending.request, false);
    pending.reject(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function rejectPending() {
  const pending = useWallet.getState().pending;
  if (!pending) return;
  await invoke('shield_reject_sign', { id: pending.request.id }).catch(() => undefined);
  record(pending.request, false);
  pending.reject(new Error('Rejected in Shield review.'));
}
