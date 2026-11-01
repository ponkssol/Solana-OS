// Vercel Function: Solana JSON-RPC proxy. The root path is rewritten here (vercel.json).
import { handle, handleRpc, send } from '../proxy.mjs';

export const config = { api: { bodyParser: false } };

export default function rpc(req, res) {
  if (req.method === 'POST') return handleRpc(req, res);
  if (req.method === 'OPTIONS') return handle(req, res);
  return send(res, 405, { error: 'Use POST for JSON-RPC' }, { Allow: 'POST, OPTIONS' });
}
