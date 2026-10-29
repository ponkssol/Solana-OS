# Notifikasi GitHub ke Telegram

`.github/workflows/telegram-notify.yml` mengirim peristiwa repositori ke satu topik forum Telegram. Tidak ada server lain. Job memanggil Bot API `sendMessage` (`parse_mode=HTML`, pratinjau tautan mati).

Token tidak dicetak di log. Jangan commit token.

## Peristiwa

- Push ke semua cabang. Maksimal 5 commit (sha pendek, baris pertama, tautan), lalu `dan N lagi`.
- Pull request: dibuka, dibuka lagi, ditutup, digabung, siap ditinjau. Commit baru di PR dikirim ringkas.
- Review pull request.
- Issue dibuka, ditutup, dibuka lagi, plus komentar baru.
- Rilis yang dipublikasikan, termasuk tautan aset.
- Workflow selesai, berhasil atau gagal: CI, Windows installer, Security audit, Bug detector. Tautan ke run ikut terkirim.
- Cabang atau tag dibuat / dihapus.
- Uji manual dari tab Actions.

Workflow ini tidak memberi tahu run-nya sendiri. `workflow_run` yang sama (id, percobaan, hasil) hanya sekali. Push yang menghapus cabang dilewati karena peristiwa delete sudah mengirim.

Kalau `TELEGRAM_BOT_TOKEN` atau `TELEGRAM_CHAT_ID` kosong, job tetap hijau dan tidak mengirim. PR dari fork tidak membawa secret, jadi pesan PR-nya dilewati. Hasil CI fork tetap masuk lewat `workflow_run` setelah berkas ini ada di branch default.

Pesan yang lebih panjang dari 4096 karakter dipecah.

## Pasang bot

1. Buka @BotFather, kirim `/newbot`, simpan tokennya.
2. Buat grup dan nyalakan Topics.
3. Undang bot ke grup, lalu jadikan admin supaya bisa menulis di topik.

## Chat id dan topic id

Id grup forum berbentuk `-100...`.

Dari tautan topik `https://t.me/c/<id>/<topic>`:

- `TELEGRAM_CHAT_ID` = `-100` + `<id>`
- `TELEGRAM_TOPIC_ID` = angka terakhir, yaitu `message_thread_id`

Contoh `https://t.me/c/1234567890/42`: chat `-1001234567890`, topik `42`.

Cara lain: kirim satu pesan di topik (sebut botnya kalau privacy mode masih aktif), lalu buka `https://api.telegram.org/bot<TOKEN>/getUpdates`. Ambil `chat.id` dan `message_thread_id`.

Kalau `TELEGRAM_TOPIC_ID` kosong, pesan masuk ke chat umum, bukan ke topik.

## Secret

Settings → Secrets and variables → Actions → Secrets:

| Nama | Isi |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | token dari BotFather |
| `TELEGRAM_CHAT_ID` | `-100...` |
| `TELEGRAM_TOPIC_ID` | `message_thread_id` |

`TELEGRAM_TOPIC_ID` boleh secret atau variable. Kalau secret terisi, secret yang dipakai.

## Uji

Actions → Telegram notify → Run workflow. Pilih cabang yang memuat workflow ini. Catatan uji opsional.

`workflow_run` baru aktif setelah workflow ini ada di branch default.
