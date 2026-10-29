# Next tasks

Ordered backlog. Phase 1 is the desktop that is already in the tree. Phase 2 is issue [#5](https://github.com/ponkssol/Solana-OS/issues/5) and is not started.

Shipped baseline: issues [#1](https://github.com/ponkssol/Solana-OS/issues/1), [#2](https://github.com/ponkssol/Solana-OS/issues/2), [#3](https://github.com/ponkssol/Solana-OS/issues/3), and [#4](https://github.com/ponkssol/Solana-OS/issues/4) are closed. Pull requests [#23](https://github.com/ponkssol/Solana-OS/pull/23) (Figma shell), [#24](https://github.com/ponkssol/Solana-OS/pull/24) (interactive shell, Windows ConPTY, installer workflow), and [#25](https://github.com/ponkssol/Solana-OS/pull/25) (Win32 desktop and registry calls) are merged. Pre-release [v1.0.0-alpha.1](https://github.com/ponkssol/Solana-OS/releases/tag/v1.0.0-alpha.1) is the build that was installed. The installer workflow now tags `v1.0.0-alpha.2`. Alpha.2 still let cloned apps open as normal Windows windows; row 2 is the containment pass for that.

## Phase 1

| # | Work | Owner | State |
| --- | --- | --- | --- |
| 1 | Fullscreen on launch. Borderless, covers the Windows taskbar, menu bar and dock follow the viewport, F11 toggles Windows mode, Esc does not leave fullscreen. | Backend & Sandbox, Frontend Lead | In the tree. Needs a Windows install check at the machine's DPI. |
| 2 | Keep apps launched from the shell inside Solana OS. Each one is a shell window (traffic lights, title, dock entry). The clock toggle (Windows mode) leaves them inside the shell window instead of dropping them on the desktop. | Backend & Sandbox, Frontend Lead | In the tree. Classic windows are reparented. DirectComposition windows (Chrome, Electron) are owned and clamped, because `SetParent` blanks them. Needs a Windows check with Chrome, Telegram, Discord, and VS Code, including popups and the Windows-mode toggle. Elevated processes are not contained. |
| 3 | Install feedback: type was too large, control-center sliders were glossy, the boot wordmark looked jagged. | UI Components, Desain, Frontend Lead | In the tree (13px body, flat `#0A84FF` slider, official 2172×724 PNG). Confirm on the alpha.2 install. |
| 4 | Replace the mock cloner rows, wallet balances, and vault panel with real Tauri command results. `src/lib/tauriBridge.ts` still keeps its own list after the host call. A clone now also opens a hosted shell window. | Frontend Lead, Backend & Sandbox | Not started. |
| 5 | Frontend audit, one surface at a time: Settings (the modal is static), first-run (boot and lock only), notification center (two hardcoded notes), empty / loading / error on the cloner, wallets, and terminal. | Frontend Lead, UI Components, Desain | Not started. |
| 6 | Code signing for the NSIS and MSI artifacts. The workflow builds them and does not sign them. | Security & QA, Grok Bot | Not started. |

## Phase 2

Do not start these until the Phase 1 install is signed and the shell is reading the host. Detail is in `docs/ROADMAP.md` and issue #5.

| # | Work | Owner | State |
| --- | --- | --- | --- |
| 7 | Built-in AI agent. Local to the room. It does not receive an unwrapped signing key. | Frontend Lead, Solana & Web3 | Not started. |
| 8 | Secure airlock file transfer. One-way, scanned, not a shared folder with the host profile. | Backend & Sandbox, Security & QA | Not started. |
| 9 | Hardware wallet bridge (Ledger) and Solana Mobile. The device returns a signature. `vault.solos` stores the pubkey, not a seed. | Solana & Web3, Quantum Vault | Not started. |
| 10 | Dead man's switch. Extend `RecoveryGuard` with a beneficiary and a heartbeat. A missed heartbeat opens the existing timelock; it does not move funds by itself. | Solana & Web3, Quantum Vault | Not started. |
| 11 | On-chain binary hash at boot. Mismatch stops before the vault opens. Release CI publishes the hash. | Security & QA, Backend & Sandbox | Not started. |

## Not this list

Dependabot has open update pull requests. They are dependency bumps. Grok Bot triages them; they do not jump ahead of the table above.

## Telegram

GitHub events go to the forum topic from `.github/workflows/telegram-notify.yml`. Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TOPIC_ID`. Setup is `docs/TELEGRAM_NOTIFICATIONS.md`. A missing secret skips the send and does not fail the job.
