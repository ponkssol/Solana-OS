Solana OS 1.0.0-alpha.6 prerelease for Windows x64. Install with the NSIS setup .exe, or use the .msi for managed deployment.

- Shield now covers transactions sent by apps inside a room. Each room's apps get a loopback RPC in SOLANA_RPC_URL and ANCHOR_PROVIDER_URL; sendTransaction calls through it are simulated and held until you allow or reject them. The Solana CLI, Anchor, scripts and wallets configured with that custom RPC are covered. Browser extension wallets such as Phantom use their own RPC and signer and are not intercepted.
- One recovery phrase can now hold several accounts (m/44'/501'/N'/0', matching Phantom's account order). Add and rename accounts in the Wallet window and choose which account each room uses.
- The Wallet window lists SPL token balances (Token and Token-2022) and recent transactions for the selected account.
- Launchpad pages horizontally like macOS, with page dots, mouse wheel, swipe and arrow keys.
- Removed unused legacy screens that described ML-KEM-1024 features Solana OS does not have.
