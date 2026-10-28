# Roadmap

Phase 1 is the tree in this repository. Phase 2 is tracked and not built yet.

## Phase 1 — MVP v1.0

| Issue | Area | What landed |
| --- | --- | --- |
| [#1](https://github.com/ponkssol/Solana-OS/issues/1) | UI shell | Black boot screen, Sequoia lock screen (`09:41`, `nanda.solos`, restore / create account / 24-word recovery), 28px blurred menu bar, room switcher, Bento control center, traffic lights `#FF5F56` `#FFBD2E` `#27C93F`, frosted sidebar, magnifying squircle dock |
| [#2](https://github.com/ponkssol/Solana-OS/issues/2) | Quantum vault | `vault.solos` sealed with Argon2id and XChaCha20-Poly1305. Optional 32-byte ML-KEM-1024 shared secret mixed into the key. `mlock` + `zeroize` signing closure. 24-word recovery sheet on the lock screen |
| [#3](https://github.com/ponkssol/Solana-OS/issues/3) | Cloner | Per-room `AppData` and registry namespace, virtual desktop switch, `NtSuspendProcess` freeze, standalone Phantom / Solflare / Backpack windows |
| [#4](https://github.com/ponkssol/Solana-OS/issues/4) | Chain + shield | Anchor registry (commitment, recovery guard, Pro license). Pre-sign simulation, `SetAuthority` block, ClickFix clipboard guard, `SetWindowDisplayAffinity` |

Still explicit follow-ups inside Phase 1, called out so they are not mistaken for done:

- ML-KEM-1024 encapsulation and ML-DSA-87 signing are interface sizes and a shared-secret combiner, not an in-tree lattice implementation.
- Commitment verification is a domain-separated SHA-256 witness, not a SNARK.
- `NtSuspendProcess` and `SetWindowDisplayAffinity` are compiled for Windows. They are not exercised by Linux CI.

## Phase 2 — v2.0

Tracked in [#5](https://github.com/ponkssol/Solana-OS/issues/5). None of these ship in v1.0.

### Built-in AI agent

A local-first copilot inside a room. It explains a simulated transaction in plain language and can draft Anchor tests. It does not receive an unwrapped signing key. Prompts and transcripts stay in the room's namespace. A remote model, if the user turns one on, sees redacted instructions only.

### Secure airlock file transfer

A one-way bridge from the host filesystem into a room and back. Files are scanned, metadata stripped, and written into the room's sandbox directory. The airlock is not a shared folder. The host process that owns the user's `Documents` directory never receives the room's `AppData`.

### Hardware wallet and Solana Mobile bridge

USB for Ledger, and a QR or local-network bridge for Solana Mobile Seeker / Saga. The desktop still builds the transaction and shows the shield result. The external device holds the key and returns a signature. `vault.solos` stores the device's pubkey and attestation, not a seed extracted from the device.

### Dead man's switch — on-chain inheritance

An extension of `RecoveryGuard`. The owner sets a beneficiary and a heartbeat window. If `last_verified_at` plus the window passes, the beneficiary can start the existing timelocked recovery. Missing a heartbeat does not move funds by itself. It only opens the recovery path that is already specified in the program.

### On-chain binary hash verification

At boot, the host hashes the Solana OS binary and compares it to a hash stored on `ProtocolConfig` (or a sibling PDA added for this purpose). A mismatch stops before the vault is unsealed and shows the expected versus actual hash. Release CI publishes the hash. The boot screen does not unseal a binary that fails the check.

## How a phase moves

1. An issue describes the user-visible behavior and the threat-model note.
2. A PR links the issue and updates this file when the behavior is actually in the tree.
3. Phase 2 items stay unchecked on [#5](https://github.com/ponkssol/Solana-OS/issues/5) until that PR lands.
