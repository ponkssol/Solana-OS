// Solana OS RPC proxy.
//
// Forwards Solana JSON-RPC POST requests to the upstream RPC in QUICKNODE_RPC_URL,
// so the provider credential never ships inside the desktop app. Adds per-IP rate
// limiting, a method allowlist, a body size limit and a health endpoint. The
// upstream URL is never logged or returned to clients.

import http from 'node:http';

const UPSTREAM = process.env.QUICKNODE_RPC_URL;
const PORT = Number(process.env.PORT || 8080);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 256 * 1024);
const MAX_BATCH = Number(process.env.MAX_BATCH || 20);
// Token bucket per client IP: RATE_PER_SEC refill, RATE_BURST capacity. A batch
// costs one token per call.
const RATE_PER_SEC = Number(process.env.RATE_PER_SEC || 10);
const RATE_BURST = Number(process.env.RATE_BURST || 40);
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 30_000);

if (!UPSTREAM || !/^https?:\/\//.test(UPSTREAM)) {
  console.error('QUICKNODE_RPC_URL is missing or not an http(s) URL.');
  process.exit(1);
}

// Everything the Solana OS app, the Solana CLI, Anchor and common wallet SDKs use.
export const ALLOWED_METHODS = new Set([
  'getAccountInfo', 'getBalance', 'getBlockHeight', 'getBlockTime', 'getBlockCommitment',
  'getBlockProduction', 'getClusterNodes', 'getEpochInfo', 'getEpochSchedule', 'getFeeForMessage',
  'getFirstAvailableBlock', 'getGenesisHash', 'getHealth', 'getHighestSnapshotSlot', 'getIdentity',
  'getInflationGovernor', 'getInflationRate', 'getInflationReward', 'getLatestBlockhash',
  'getLeaderSchedule', 'getMaxRetransmitSlot', 'getMaxShredInsertSlot',
  'getMinimumBalanceForRentExemption', 'getMultipleAccounts', 'getProgramAccounts',
  'getRecentPerformanceSamples', 'getRecentPrioritizationFees', 'getSignatureStatuses',
  'getSignaturesForAddress', 'getSlot', 'getSlotLeader', 'getStakeMinimumDelegation', 'getSupply',
  'getTokenAccountBalance', 'getTokenAccountsByDelegate', 'getTokenAccountsByOwner',
  'getTokenLargestAccounts', 'getTokenSupply', 'getTransaction', 'getTransactionCount', 'getVersion',
  'getVoteAccounts', 'isBlockhashValid', 'minimumLedgerSlot', 'sendTransaction', 'simulateTransaction',
  'getBlock',
]);

/** Returns an error message when a single call must be refused, otherwise null. */
export function checkCall(call) {
  if (!call || typeof call !== 'object' || typeof call.method !== 'string') return 'Invalid request';
  if (!ALLOWED_METHODS.has(call.method)) return `Method not allowed: ${call.method}`;
  if (call.method === 'getProgramAccounts') {
    // An unfiltered scan of a large program (e.g. SPL Token) is very expensive.
    const config = Array.isArray(call.params) ? call.params[1] : undefined;
    const filters = config && Array.isArray(config.filters) ? config.filters : [];
    if (filters.length === 0) return 'getProgramAccounts requires at least one filter';
  }
  return null;
}

const buckets = new Map();
export function takeTokens(ip, cost, now = Date.now()) {
  let b = buckets.get(ip);
  if (!b) {
    b = { tokens: RATE_BURST, at: now };
    buckets.set(ip, b);
  }
  b.tokens = Math.min(RATE_BURST, b.tokens + ((now - b.at) / 1000) * RATE_PER_SEC);
  b.at = now;
  if (b.tokens < cost) return false;
  b.tokens -= cost;
  return true;
}
setInterval(() => {
  const stale = Date.now() - 10 * 60_000;
  for (const [ip, b] of buckets) if (b.at < stale) buckets.delete(ip);
}, 60_000).unref();

function clientIp(req) {
  // Railway's edge appends the real client address to X-Forwarded-For.
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function send(res, status, body, extra = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, solana-client',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    ...extra,
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleRpc(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (err) {
    return send(res, err.status || 400, rpcError(null, -32600, 'Request body too large'));
  }
  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return send(res, 400, rpcError(null, -32700, 'Parse error'));
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  if (calls.length === 0 || calls.length > MAX_BATCH) {
    return send(res, 400, rpcError(null, -32600, `Batch must contain 1-${MAX_BATCH} calls`));
  }
  if (!takeTokens(clientIp(req), calls.length)) {
    return send(res, 429, rpcError(null, -32005, 'Rate limit exceeded'), {
      'Retry-After': String(Math.ceil(calls.length / RATE_PER_SEC)),
    });
  }
  for (const call of calls) {
    const problem = checkCall(call);
    if (problem) return send(res, 403, rpcError(call && call.id, -32601, problem));
  }
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await upstream.text();
    send(res, upstream.status, text);
  } catch (err) {
    // Log the failure class only: the upstream URL carries a credential.
    console.error(`upstream request failed: ${err && err.name}`);
    send(res, 502, rpcError(null, -32603, 'Upstream RPC unavailable'));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz')) {
    return send(res, 200, { status: 'ok' });
  }
  if (req.method === 'POST' && (req.url === '/' || req.url === '/rpc')) return void handleRpc(req, res);
  send(res, 404, { error: 'Not found' });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`rpc proxy listening on port ${PORT}`));
}
export { server };
