# GitHub notifications in Telegram

`.github/workflows/telegram-notify.yml` posts repository events to one Telegram forum topic. There is no extra server. The job calls the Bot API `sendMessage` method with `parse_mode=HTML` and link previews disabled.

The token is never printed. Do not commit it.

## Events

- Push on every branch. Up to 5 commits (short sha, first line, link), then `and N more`.
- Pull requests, in detail: opened, updated, merged, closed, reopened, ready for review, and review submitted. Each message has the number, title, link, author, source and target branch, draft state, labels, assignees, requested reviewers, a description excerpt (about 600 characters, markdown removed), commit and diff stats, up to 15 changed files with `+`/`-`, up to 5 recent commits, and a check summary when the API returns one. Merges include who merged and the merge commit sha. Reviews include the reviewer, the state (approved, changes requested, or commented), and a body excerpt.
- Issues opened, closed, or reopened, plus new comments.
- Published releases, including asset links.
- Finished workflows, success or failure: CI, Windows installer, Security audit, Bug detector, with a link to the run.
- Branch or tag created or deleted.
- A manual test from the Actions tab.

This workflow does not notify for its own runs. The same `workflow_run` (id, attempt, and conclusion) is reported once. A push that deletes a branch is skipped because the delete event already sends a message.

If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is empty, the job stays green and sends nothing. Pull requests from forks do not receive secrets, so that PR message is skipped. Fork CI results still arrive through `workflow_run` after this file is on the default branch.

Each message is a short card: a bold `Solana OS Update` title with a tag such as `#push`, `#pr`, or `#release`, a boxed header, and `├` / `└` fields. Commit messages and pull request descriptions sit in a `<pre>` block. Times are `Asia/Jakarta` (`YYYY-MM-DD HH:MM:SS +07:00`).

Buttons sit under the message (on the last part if it is split): Compare, Action, and Commit for a push; View PR, Files, and Checks for a pull request; Release plus Download .exe / Download .msi when those assets exist; Run and Logs for a workflow result.

Messages longer than 4096 characters are split. Pull request files, commits, and checks are read with `GITHUB_TOKEN` (`contents: read`, `pull-requests: read`, `checks: read`).

## Create the bot

1. Open @BotFather, send `/newbot`, and keep the token.
2. Create a group and turn on Topics.
3. Add the bot to the group and make it an admin so it can post in a topic.

## Chat id and topic id

A forum group's chat id looks like `-100...`.

From a topic link `https://t.me/c/<id>/<topic>`:

- `TELEGRAM_CHAT_ID` is `-100` plus `<id>`
- `TELEGRAM_TOPIC_ID` is the last number, `message_thread_id`

Example: `https://t.me/c/1234567890/42` means chat `-1001234567890` and topic `42`.

Or send a message in the topic (mention the bot if privacy mode is on), then open `https://api.telegram.org/bot<TOKEN>/getUpdates`. Read `chat.id` and `message_thread_id`.

If `TELEGRAM_TOPIC_ID` is empty, messages go to the general chat.

## Secrets

Settings → Secrets and variables → Actions → Secrets:

| Name | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | token from BotFather |
| `TELEGRAM_CHAT_ID` | `-100...` |
| `TELEGRAM_TOPIC_ID` | `message_thread_id` |

`TELEGRAM_TOPIC_ID` may be a secret or a variable. A non-empty secret wins.

## Test

Actions → Telegram notify → Run workflow. Pick the branch that contains this workflow. The note is optional.

`workflow_run` starts only after this workflow is on the default branch.
