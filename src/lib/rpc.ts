async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC returned HTTP ${res.status}`);
  const body = await res.json();
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
