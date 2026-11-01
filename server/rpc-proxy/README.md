# Solana OS RPC proxy

A small, dependency-free Node.js service that forwards Solana JSON-RPC requests to a
premium RPC provider (QuickNode). The provider URL, which contains an access token,
stays on the server; the desktop app only knows the proxy's public URL.

## Behaviour

Production: `https://solana-os-rpc-proxy.vercel.app` (Vercel).

- `POST /` (or `/rpc`, `/api/rpc`): JSON-RPC, single call or batch of up to `MAX_BATCH` calls.
- `GET /health`: returns `{"status":"ok"}` without contacting the upstream.
- Method allowlist covering the app, the Solana CLI, Anchor and common SDKs.
  `getProgramAccounts` requires at least one filter; anything not listed gets HTTP 403.
- Per-IP token-bucket rate limit (each call in a batch costs one token); excess
  requests get HTTP 429 with `Retry-After`. On Vercel the bucket is held in memory
  per function instance, so it is a per-instance limit. A Vercel Firewall rule
  (600 POSTs per IP per 60 s, fixed window) is configured as the global limit.
- Request bodies over `MAX_BODY_BYTES` get HTTP 413.
- The upstream URL is never logged or included in responses.
- WebSocket subscriptions are not proxied.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `QUICKNODE_RPC_URL` | (required) | Upstream HTTPS endpoint. Keep it secret. |
| `PORT` | `8080` | Listen port (standalone server only). |
| `RATE_PER_SEC` / `RATE_BURST` | `10` / `40` | Per-IP refill rate and burst size. |
| `MAX_BATCH` | `20` | Maximum calls per batch. |
| `MAX_BODY_BYTES` | `262144` | Maximum request body size. |
| `UPSTREAM_TIMEOUT_MS` | `30000` | Upstream request timeout. |

## Layout

- `proxy.mjs`: request handling, allowlist, limits (shared).
- `api/rpc.mjs`, `api/health.mjs`: Vercel Functions; `vercel.json` rewrites `/`, `/rpc` and `/health` to them.
- `server.mjs`: standalone Node server for local runs or other hosts.

## Run, test and deploy

```sh
QUICKNODE_RPC_URL=... npm start   # local server on :8080
npm test
printf %s "$QUICKNODE_RPC_URL" | vercel env add QUICKNODE_RPC_URL production --sensitive
vercel deploy --prod
```
