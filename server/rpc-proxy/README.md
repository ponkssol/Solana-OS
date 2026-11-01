# Solana OS RPC proxy

A small, dependency-free Node.js server that forwards Solana JSON-RPC requests to a
premium RPC provider (QuickNode). The provider URL, which contains an access token,
stays on the server; the desktop app only knows the proxy's public URL.

## Behaviour

- `POST /` (or `/rpc`): JSON-RPC, single call or batch of up to `MAX_BATCH` calls.
- `GET /health`: returns `{"status":"ok"}` without contacting the upstream.
- Method allowlist covering the app, the Solana CLI, Anchor and common SDKs.
  `getProgramAccounts` requires at least one filter; anything not listed gets HTTP 403.
- Per-IP token-bucket rate limit (each call in a batch costs one token); excess
  requests get HTTP 429 with `Retry-After`.
- Request bodies over `MAX_BODY_BYTES` get HTTP 413.
- The upstream URL is never logged or included in responses.
- WebSocket subscriptions are not proxied.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `QUICKNODE_RPC_URL` | (required) | Upstream HTTPS endpoint. Keep it secret. |
| `PORT` | `8080` | Listen port (set by Railway). |
| `RATE_PER_SEC` / `RATE_BURST` | `10` / `40` | Per-IP refill rate and burst size. |
| `MAX_BATCH` | `20` | Maximum calls per batch. |
| `MAX_BODY_BYTES` | `262144` | Maximum request body size. |
| `UPSTREAM_TIMEOUT_MS` | `30000` | Upstream request timeout. |

## Run and test

```sh
QUICKNODE_RPC_URL=... npm start
npm test
```

Deployed on Railway with this directory as the service root; `npm start` is the start
command and `/health` the health check.
