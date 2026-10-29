# Tim bot Solana OS

Delapan bot ini yang menjaga repositori. **Grok Bot** memimpin: membagi pekerjaan, menjalankan agen kode, menggabungkan pull request, merilis, dan mengurus dokumen Figma. Tujuh bot lain memegang frontend, komponen UI, desain, sandbox backend, quantum vault, Solana/Web3, dan keamanan.

Kalau akun Grok Bot pindah, buat ulang tiap bot dari berkas di folder ini. Tempel nama, judul, dan deskripsi, masukkan ke kanal grup yang benar, lalu minta bot itu membaca dokumennya dan `docs/team/NEXT_TASKS.md`.

Push, pull request, issue, rilis, dan hasil CI masuk ke topik forum lewat GitHub Actions. Pemasangannya di `docs/TELEGRAM_NOTIFICATIONS.md`.

## English

This folder is how the bot team is rebuilt on a new account. `agents.json` is the roster without internal ids. Each `docs/team/<slug>.md` file is what that bot should read first.

The profile export left every `title` empty. The title in the roster is the one to paste when you create the bot. Descriptions are copied verbatim from the export. Desain's description was empty there; the responsibilities in `desain.md` are the job to paste.

### Roster

| Name | Role | Channels |
| --- | --- | --- |
| Grok Bot | Project lead | Solana OS Backend & Core, Solana OS Frontend |
| Frontend Lead | Lead Frontend Architect | Solana OS Frontend, Solana OS Backend & Core |
| UI Components | UI components and motion | Solana OS Frontend |
| Desain | Visual design | Solana OS Frontend |
| Backend & Sandbox | Systems and sandbox backend | Solana OS Backend & Core |
| Quantum Vault | Post-quantum vault | Solana OS Backend & Core |
| Solana & Web3 | Solana and wallet bridge | Solana OS Backend & Core |
| Security & QA | Security and QA | Solana OS Backend & Core |

### Recreate the team

1. Create the bot.
2. Open its file in this folder. Paste the name, the title, and the description block.
3. Add it to the channels in the roster. Grok Bot and Frontend Lead are in both channels. Everyone else is in one.
4. Tell the bot to read its file and `docs/team/NEXT_TASKS.md` before it takes work.
5. Grok Bot keeps the backlog, launches coding agents, merges pull requests, and publishes the Windows pre-release.

### How they talk

Grok Bot scopes a task and names the owner. Frontend work (shell, components, assets) is discussed in **Solana OS Frontend**. Host, vault, chain, and security work is discussed in **Solana OS Backend & Core**. Frontend Lead sits in both and is the handoff when a command's shape changes. A bot does not edit another bot's paths without saying so in the channel.

GitHub push, pull request, issue, release, and workflow results are posted to a forum topic by `.github/workflows/telegram-notify.yml` once the Telegram secrets are set. Setup is `docs/TELEGRAM_NOTIFICATIONS.md`.

### Working rules

- Code changes go through a pull request. Do not push straight to `main`.
- No secrets in the repo: no API keys, no `.env` with credentials, no signing certificates.
- Never handle a private key, a seed phrase, or an `id.json`. The vault keeps signing material inside the enclave for the length of the signing call, then zeroizes it. Do not ask the owner to paste a seed into chat.
- Say what the code actually does. ML-KEM-1024 here is a ciphertext slot and a shared-secret combiner, not a finished lattice implementation. Commitment checks are a SHA-256 witness, not a SNARK.
