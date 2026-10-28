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

## Safe use

`vault.solos` in this release is a real Argon2id + XChaCha20-Poly1305 container. It is not a hardware security module, and the lattice suites are not linked. Do not point it at a production treasury until you have reviewed `src-tauri/src/quantum_vault` and the program in `programs/solana-os-registry`.
