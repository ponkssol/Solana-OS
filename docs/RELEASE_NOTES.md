Solana OS 1.0.0-alpha.5 prerelease for Windows x64. Install with the NSIS setup .exe, or use the .msi for managed deployment.

- The vault now holds a real Solana wallet. The key is derived from the 24-word recovery phrase at m/44'/501'/0'/0', the same first account Phantom shows, and restoring the phrase brings back the same address. The secret key stays in the Tauri host and is never sent to the interface.
- Every signature goes through Shield first. Transactions are simulated against your RPC endpoint and checked by the local drainer rules, then you approve or reject. The Wallet window can send SOL and sign messages through this flow.
- The vault file moves to format v2: Argon2id plus a hybrid X25519 and ML-KEM-768 key wrap, sealed with XChaCha20-Poly1305. Existing vaults are upgraded on the next unlock. The hybrid keys are stored in the vault file under the passphrase, so the passphrase remains the root of trust.
- Solana OS checks for updates at launch and from Settings > Updates, and shows the release notes before installing.
- Launchpad and Dock icons are cached on disk, so they appear immediately after a restart.
