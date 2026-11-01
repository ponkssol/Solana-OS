// Standalone server for the Solana OS RPC proxy (local runs or any Node host).
import http from 'node:http';
import { handle, upstreamConfigured } from './proxy.mjs';

if (!upstreamConfigured()) {
  console.error('QUICKNODE_RPC_URL is missing or not an http(s) URL.');
  process.exit(1);
}
const PORT = Number(process.env.PORT || 8080);
http.createServer(handle).listen(PORT, () => console.log(`rpc proxy listening on port ${PORT}`));
