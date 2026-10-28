<p align="center">
  <img src="public/assets/logo-white.png" alt="SOLANA OS" width="720">
</p>

<p align="center">
  <em>The Post-Quantum Sandboxed Desktop OS &amp; Builder Suite for Solana</em>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT%20%2F%20Apache--2.0-blue"></a>
  <img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24C8DB">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-2021-orange">
  <img alt="React 18" src="https://img.shields.io/badge/React-18-61DAFB">
  <img alt="ML-KEM-1024" src="https://img.shields.io/badge/Post--Quantum-ML--KEM--1024-14F195">
  <img alt="Anchor" src="https://img.shields.io/badge/Solana-Anchor%200.30-9945FF">
</p>

Solana OS is a desktop environment for people who build and trade on Solana. The shell follows the macOS Sequoia / Sonoma layout: a black boot screen, a lock screen, a 28px glass menu bar, a Bento control center, traffic-light windows, and a magnifying squircle dock. Under that shell, rooms keep cloned apps, wallet keys, and `id.json` signers in separate namespaces, and a portable container (`vault.solos`) seals them at rest.

The browser build is a full interactive shell. The Tauri host adds process isolation, the vault container, and the anti-drainer shield.

## Four core pillars

### 1. Universal App Cloner & Sandbox Workspace

Inspired by Android *Island*, adapted to a desktop host. Any installed Windows `.exe` (Chrome, Brave, Cursor, VS Code, Telegram, Discord, and the wallet apps) can be launched into a per-Room `AppData`, registry, and filesystem namespace stored beside `vault.solos`. Phantom, Solflare, and Backpack run as standalone windows instead of host browser extensions. Process Freeze (`❄️`) suspends idle clones with `NtSuspendProcess` / `NtResumeProcess` so their CPU drops to 0%.

Tracked in [#3](https://github.com/ponkssol/Solana-OS/issues/3).

### 2. Post-Quantum Portable Container (`vault.solos`) & RAM Enclave

Daily unlock derives an AEAD key with **Argon2id** and opens the container with **XChaCha20-Poly1305**. A 32-byte **ML-KEM-1024** shared secret, once decapsulated by the caller, is mixed into that key. The on-disk header reserves the ML-KEM-1024 ciphertext size (1568 bytes) and names **ML-DSA-87** as the signature suite. Signing material is `mlock`ed for the duration of the signing closure and `zeroize`d before return. The 24-word recovery ceremony is the lock-screen path for moving a vault to a new machine.

Tracked in [#2](https://github.com/ponkssol/Solana-OS/issues/2). The byte layout and what is executable today are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### 3. On-Chain Identity, Recovery & Freemium/Pro Licensing

`programs/solana-os-registry` is an Anchor program. It stores a zero-knowledge identity commitment (the preimage never lands on-chain), a timelocked recovery guard, and a license account. Freemium is Main Room. Pro, paid in SOL, unlocks Degen, Dev, and Burner plus the builder suite. Verification of a commitment checks a domain-separated SHA-256 witness so the chain can tell a holder rotated or recovered without learning the seed.

Tracked in [#4](https://github.com/ponkssol/Solana-OS/issues/4).

### 4. Real-Time Anti-Drainer Shield & Solana Builder Suite

Before a wallet signs, the shield simulates the transaction. It blocks `SetAuthority` and unlimited token approvals, scores homograph domains against known Solana sites, and rejects ClickFix clipboard payloads. `SetWindowDisplayAffinity` (`WDA_EXCLUDEFROMCAPTURE`) is the Windows path that keeps the Solana OS window out of host screen capture. Dev Room is the builder surface: Anchor builds and a zero-exposure signer so cloned Cursor / VS Code never receive a plaintext `id.json`.

Tracked in [#4](https://github.com/ponkssol/Solana-OS/issues/4).

## Repository layout

```
.
├── src/                         React 18 + TypeScript desktop shell
│   ├── components/              Boot, lock, menu bar, windows, dock, Spotlight
│   ├── ui/                      Glass primitives, Bento control center, wallet windows
│   ├── store/                   Zustand session, rooms, window stack
│   └── lib/tauriIpc.ts          Tauri invoke with a browser fallback
├── src-tauri/                   Tauri v2 host
│   └── src/
│       ├── cloner.rs            Per-room AppData / registry namespaces
│       ├── freezer.rs           NtSuspendProcess / NtResumeProcess
│       ├── desktop.rs           Host desktop ↔ Solana OS desktop
│       ├── quantum_vault/       vault.solos seal and open
│       └── security/            Anti-drainer, clipboard, capture affinity
├── programs/solana-os-registry/ Anchor identity, recovery, and license program
├── docs/                        Architecture and roadmap
└── .github/                     Issue templates, PR template, CI
```

## Quick start

Requirements: Node.js 22, npm. The Tauri host also needs a stable Rust toolchain. On Linux, install the Tauri webview packages (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`).

```bash
npm install
npm run dev
```

Open the printed local address (default `http://127.0.0.1:1420`).

- The boot screen is pure black. Click, or press Enter, to reach the lock screen. It also advances on its own.
- The lock screen clock reads **09:41**. The account is `nanda.solos`.
- Submit the password pill, or use **Restore vault.solos**, **Create account**, or **24-Word Recovery**.
- On the desktop, the menu-bar toggles switch rooms. The control-center icon opens the Bento panel (RPC, Anti-Drainer, Process Freeze, pill sliders). The dock magnifies. `Ctrl/Cmd+Space` opens Spotlight. `Ctrl/Cmd+L` locks the vault.

Production frontend check:

```bash
npm run build
```

Desktop host:

```bash
npm run tauri dev
```

Anchor program (no local validator required for a typecheck):

```bash
cargo check --manifest-path programs/solana-os-registry/Cargo.toml
```

Program id: `G8bkBpvs8E76jygEgHy3Lj6ZaHXZFWsBwG51uciNfUt4`.

## Engineering & architecture

Solana OS is split the way the threat model is split.

| Surface | Owns |
| --- | --- |
| React shell (`src/`) | Boot, lock, rooms, windows, dock, control center. Talks to the host only through `tauriIpc`. |
| Tauri host (`src-tauri/`) | Process namespaces, freeze, virtual desktop, `vault.solos`, shield. |
| Anchor program | Commitments, recovery timelock, room license. No private keys. |

Rooms are the isolation boundary: **Main**, **Degen**, **Dev**, and **Burner**. Each room has its own key id. Switching rooms freezes the previous room's clones and resumes the next. A deeper specification, with diagrams, is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

Phase 1 (this tree) is the shell, the cloner, the vault container, the registry, and the shield. Issues [#1](https://github.com/ponkssol/Solana-OS/issues/1), [#2](https://github.com/ponkssol/Solana-OS/issues/2), [#3](https://github.com/ponkssol/Solana-OS/issues/3), and [#4](https://github.com/ponkssol/Solana-OS/issues/4).

Phase 2 is tracked in [#5](https://github.com/ponkssol/Solana-OS/issues/5): a local AI agent, an airlock for file transfer, a hardware-wallet and Solana Mobile bridge, a dead-man's-switch inheritance flow, and on-chain binary hash checks at boot. Detail is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Automated security and bug detection

Every push and pull request is scanned. Dependabot also opens weekly update PRs.

| Bot | What it checks |
| --- | --- |
| [Dependabot](.github/dependabot.yml) | npm, both Cargo lockfiles (`src-tauri`, `programs/solana-os-registry`), and GitHub Actions. Weekly. Labels: `security`, `dependencies`. |
| [Security audit](.github/workflows/security-audit.yml) | CodeQL for JavaScript/TypeScript, RustSec `cargo audit` on both lockfiles, gitleaks plus a `id.json` / private-key regex guard, `npm audit --audit-level=high`. |
| [Bug detector](.github/workflows/bug-detector.yml) | `tsc --noEmit`, Vite production build, `cargo check`, `cargo clippy -- -D warnings` on the host and the Anchor program. |

[![Security audit](https://github.com/ponkssol/Solana-OS/actions/workflows/security-audit.yml/badge.svg)](https://github.com/ponkssol/Solana-OS/actions/workflows/security-audit.yml)
[![Bug detector](https://github.com/ponkssol/Solana-OS/actions/workflows/bug-detector.yml/badge.svg)](https://github.com/ponkssol/Solana-OS/actions/workflows/bug-detector.yml)
[![CI](https://github.com/ponkssol/Solana-OS/actions/workflows/ci.yml/badge.svg)](https://github.com/ponkssol/Solana-OS/actions/workflows/ci.yml)

What is ignored, and why, is written in [SECURITY.md](SECURITY.md).

## License

MIT or Apache-2.0, at your option. See [LICENSE](LICENSE).

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md). Vulnerability reports follow [SECURITY.md](SECURITY.md).
