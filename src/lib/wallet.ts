import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { isTauriRuntime } from './tauriIpc';

export interface UnlockResult {
  address: string | null;
  suite: string;
  migrated: boolean;
}

export type SignKind = 'transaction' | 'message';

export interface SignRequest {
  id: number;
  kind: SignKind;
  origin: string;
  summary: string;
  bytes: Uint8Array;
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
}

export const useWallet = create<WalletState>(() => ({
  address: null,
  suite: null,
  pending: null,
  history: [],
}));

export function setUnlocked(result: UnlockResult) {
  useWallet.setState({ address: result.address, suite: result.suite });
}

export async function lockWallet() {
  const pending = useWallet.getState().pending;
  pending?.reject(new Error('The vault was locked.'));
  useWallet.setState({ address: null, pending: null });
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
  const id = await invoke<number>('shield_queue_sign', { message: Array.from(request.bytes) });
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
