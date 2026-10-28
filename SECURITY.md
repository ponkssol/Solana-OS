# Security policy

Solana OS handles room isolation, a sealed container, and a pre-sign shield. Reports are welcome.

## Supported surface

The current tree (v1.0) on the default branch.

In scope:

- Vault open/seal accepting a wrong password or skipping `zeroize`
- Room or clipboard isolation that leaks a secret to the host
- Anti-drainer false negatives on `SetAuthority`, unlimited approvals, or ClickFix payloads
- Anchor account checks that let a non-owner rotate a commitment or skip the recovery timelock

Out of scope for a vulnerability report:

- The browser build's simulated enclave. It is a UI preview and does not claim to hold keys.
- Missing ML-KEM or ML-DSA code. Those are reserved sizes, documented in `docs/ARCHITECTURE.md`, not a silent claim of a lattice implementation.
- Phishing list gaps for brands that are not in `PROTECTED_SOLANA_DOMAINS`.

## Reporting

Open a private GitHub security advisory on [ponkssol/Solana-OS](https://github.com/ponkssol/Solana-OS/security/advisories/new). If advisories are unavailable, email the maintainers listed on the repository. Include a short description, the file you looked at, and a way to reproduce.

Please do not file a public issue, and do not include a live seed phrase, private key, or `id.json` in the report. A redacted transcript is enough.

## Response

We will acknowledge a report and say whether it reproduces. Fixes land in a normal PR once a patch exists. We do not run a paid bounty program yet.

## Automated security and bug detection

These run on every push to `main` and on every pull request. Dependabot runs on a weekly schedule.

### Dependabot

[`.github/dependabot.yml`](../.github/dependabot.yml) opens update PRs for:

- npm at the repository root (the React shell)
- Cargo at `src-tauri` (Tauri host, vault, shield)
- Cargo at `programs/solana-os-registry` (Anchor program)
- GitHub Actions in `.github/workflows`

PRs are labeled `security` and `dependencies`.

### Security audit workflow

[`.github/workflows/security-audit.yml`](../.github/workflows/security-audit.yml):

- **CodeQL** (`github/codeql-action`) analyzes the JavaScript and TypeScript shell.
- **RustSec** via `cargo audit` reads `src-tauri/Cargo.lock` and `programs/solana-os-registry/Cargo.lock`. A vulnerability fails the job. Unmaintained-crate warnings are reported and do not fail the job.
- **Secret guard.** `gitleaks` scans the git history. A second step rejects a committed `id.json`, a PEM private key block, or a JSON array of 64 bytes (the Solana keypair file shape).
- **npm audit** fails on high or critical advisories (`npm audit --audit-level=high`).

Two RustSec IDs are ignored in [`.cargo/audit.toml`](../.cargo/audit.toml). `cargo audit` reads that file from the repository root, so both lockfile scans honor it:

| Advisory | Crate | Why it is ignored |
| --- | --- | --- |
| RUSTSEC-2024-0344 | `curve25519-dalek` 3.2.1 | Pulled in by `solana-program` 1.18.26, which Anchor 0.30.1 pins. The fixed 4.x line is a different major and does not fit that graph. |
| RUSTSEC-2022-0093 | `ed25519-dalek` 1.0.1 | Same pin. The fix is `ed25519-dalek` 2.x. |

They are removed from the ignore list when the program moves to an Anchor release that no longer depends on those versions. New advisories are not ignored.

### Bug detector workflow

[`.github/workflows/bug-detector.yml`](../.github/workflows/bug-detector.yml) typechecks and builds the shell (`tsc --noEmit`, `vite build`) and runs `cargo check` plus `cargo clippy -- -D warnings` on the Tauri host and the Anchor program. Clippy warnings fail the job.

The host clippy job installs the Linux webview packages the Tauri crate needs to compile (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, and the rest listed in the README).

## Safe use

`vault.solos` in this release is a real Argon2id + XChaCha20-Poly1305 container. It is not a hardware security module, and the lattice suites are not linked. Do not point it at a production treasury until you have reviewed `src-tauri/src/quantum_vault` and the program in `programs/solana-os-registry`.
