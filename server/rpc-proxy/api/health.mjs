// Vercel Function: liveness check that does not contact the upstream RPC.
import { send } from '../proxy.mjs';

export default function health(_req, res) {
  send(res, 200, { status: 'ok' });
}
