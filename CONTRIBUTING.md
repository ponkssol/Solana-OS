# Contributing

Thanks for looking at Solana OS. Issues and pull requests are welcome.

## What to know first

- The shell is React 18, TypeScript, Vite, and Tailwind. `npm run build` must pass (`tsc` and Vite).
- The host is Tauri v2 and Rust. `cargo check --manifest-path src-tauri/Cargo.toml` is the host check.
- The program is Anchor 0.30.1. `cargo check --manifest-path programs/solana-os-registry/Cargo.toml` is the program check.
- Do not commit `node_modules/`, `dist/`, or `target/`.
- Do not commit secrets, seed phrases, or a real `id.json`. The lock screen's recovery sheet is empty inputs, not a published mnemonic.

## Local setup

```bash
npm install
npm run dev
```

Rust checks need a stable toolchain. Linux also needs the Tauri webview packages listed in the README. Vault tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib vault
```

Do not run the full host test binary on a machine where you care about spawned processes. One test launches a cloned app.

## Pull requests

- One concern per PR when you can.
- Match the file you are editing. The repo does not want new helper layers for a one-off.
- UI changes need a quick pass through boot, lock, and the desktop (room switch, a wallet window, the control center).
- Say what you ran (`npm run build`, `cargo check`, `cargo test`).
- Link the issue if one exists (`#1` through `#5` are the current roadmap).

## Commit messages

`type(scope): summary`

Types we already use: `feat`, `fix`, `docs`, `chore`. Scope examples: `ui`, `backend`, `contracts`.

## Reporting security issues

Use [SECURITY.md](SECURITY.md). Do not open a public issue for an unpatched vulnerability.
