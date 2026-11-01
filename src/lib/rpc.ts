import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './tauriIpc';

// Public Solana RPCs reject requests with a browser Origin (HTTP 403), so in the
// desktop app the request goes out from the Rust side instead of the webview.
async function post(url: string, payload: string): Promise<{ status: number; body: string }> {
  if (isTauriRuntime()) return invoke<{ status: number; body: string }>('rpc_post', { url, body: payload });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
  return { status: res.status, body: await res.text() };
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await post(url, JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }));
  if (res.status < 200 || res.status >= 300) throw new Error(`RPC returned HTTP ${res.status}`);
  const body = JSON.parse(res.body);
  if (body.error) throw new Error(body.error.message ?? 'RPC error');
  return body.result as T;
}

export async function getSolBalance(url: string, address: string): Promise<number> {
  const result = await rpc<{ value: number }>(url, 'getBalance', [address, { commitment: 'confirmed' }]);
  return result.value / 1_000_000_000;
}

export interface SimulationResult {
  err: unknown;
  logs: string[] | null;
  unitsConsumed?: number;
}

export async function simulateTransaction(url: string, base64Tx: string): Promise<SimulationResult> {
  const result = await rpc<{ value: SimulationResult }>(url, 'simulateTransaction', [
    base64Tx,
    { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' },
  ]);
  return result.value;
}

export async function getLatestBlockhash(url: string): Promise<string> {
  const result = await rpc<{ value: { blockhash: string } }>(url, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
  return result.value.blockhash;
}

export async function getLamports(url: string, address: string): Promise<number> {
  const result = await rpc<{ value: number }>(url, 'getBalance', [address, { commitment: 'confirmed' }]);
  return result.value;
}

export interface AccountSimulation extends SimulationResult {
  postLamports: (number | null)[];
}

export async function simulateWithAccounts(url: string, base64Tx: string, addresses: string[]): Promise<AccountSimulation> {
  const result = await rpc<{ value: SimulationResult & { accounts?: ({ lamports: number } | null)[] } }>(
    url,
    'simulateTransaction',
    [
      base64Tx,
      {
        encoding: 'base64',
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: 'confirmed',
        accounts: { encoding: 'base64', addresses },
      },
    ],
  );
  return { ...result.value, postLamports: (result.value.accounts ?? []).map((a) => a?.lamports ?? null) };
}

export async function sendRawTransaction(url: string, base64Tx: string): Promise<string> {
  return await rpc<string>(url, 'sendTransaction', [base64Tx, { encoding: 'base64', preflightCommitment: 'confirmed' }]);
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  program: 'token' | 'token-2022';
}

const TOKEN_PROGRAMS = {
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'token-2022': 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
} as const;

interface ParsedTokenAccount {
  account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmountString: string; decimals: number } } } } };
}

export async function getTokenBalances(url: string, owner: string): Promise<TokenBalance[]> {
  const lists = await Promise.all(
    (Object.keys(TOKEN_PROGRAMS) as (keyof typeof TOKEN_PROGRAMS)[]).map(async (program) => {
      const result = await rpc<{ value: ParsedTokenAccount[] }>(url, 'getTokenAccountsByOwner', [
        owner,
        { programId: TOKEN_PROGRAMS[program] },
        { encoding: 'jsonParsed', commitment: 'confirmed' },
      ]);
      return result.value.map(({ account }) => {
        const info = account.data.parsed.info;
        return { mint: info.mint, amount: info.tokenAmount.uiAmountString, decimals: info.tokenAmount.decimals, program };
      });
    }),
  );
  return lists.flat().filter((t) => Number(t.amount) > 0);
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  memo: string | null;
}

export async function getRecentSignatures(url: string, address: string, limit = 15): Promise<SignatureInfo[]> {
  return await rpc<SignatureInfo[]>(url, 'getSignaturesForAddress', [address, { limit, commitment: 'confirmed' }]);
}
