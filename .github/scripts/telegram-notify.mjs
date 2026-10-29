import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function link(url, label) {
  if (!url) return label;
  return `<a href="${escapeAttr(url)}">${label}</a>`;
}

function flat(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function clip(value, max) {
  const text = flat(value);
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function repoHtml(payload) {
  const repo = payload.repository?.full_name || process.env.GITHUB_REPOSITORY || 'repo';
  const url = payload.repository?.html_url || `https://github.com/${repo}`;
  return link(url, escapeHtml(repo));
}

function actorHtml(payload, eventName) {
  let login = payload.sender?.login;
  let url = payload.sender?.html_url;
  if (eventName === 'workflow_run') {
    const run = payload.workflow_run || {};
    login = run.triggering_actor?.login || run.actor?.login || login;
    url = run.triggering_actor?.html_url || run.actor?.html_url || url;
  }
  login = login || process.env.GITHUB_ACTOR || 'seseorang';
  if (!url) url = `https://github.com/${login}`;
  return link(url, escapeHtml(login));
}

function header(emoji, label, payload) {
  return `${emoji} <b>${escapeHtml(label)}</b> · ${repoHtml(payload)}`;
}

export function formatCommit(commit) {
  const full = String(commit.id || commit.sha || '');
  const sha = full.slice(0, 7) || '???????';
  const url = commit.url || commit.html_url || '';
  const first = String(commit.message || commit.commit?.message || '').split('\n')[0].trim();
  const msg = first ? clip(first, 140) : '(tanpa pesan)';
  const shaHtml = url ? link(url, escapeHtml(sha)) : `<code>${escapeHtml(sha)}</code>`;
  return `${shaHtml} ${escapeHtml(msg)}`;
}

export function commitLines(commits, total) {
  const list = Array.isArray(commits) ? commits : [];
  const shown = list.slice(0, 5);
  const lines = shown.map(formatCommit);
  const extra = Math.max((total ?? list.length) - shown.length, 0);
  if (extra > 0) lines.push(`dan ${extra} lagi`);
  return lines;
}

export function splitMessage(text, limit = 4096) {
  const src = String(text ?? '');
  if (src.length <= limit) return src ? [src] : [];
  const budget = limit - 24;
  const chunks = [];
  let rest = src;
  while (rest.length > budget) {
    let cut = rest.lastIndexOf('\n', budget);
    if (cut < budget * 0.5) cut = budget;
    const slice = rest.slice(0, cut);
    const open = slice.lastIndexOf('<');
    const close = slice.lastIndexOf('>');
    if (open > close && open > 0) cut = open;
    if (cut <= 0) cut = Math.min(budget, rest.length);
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  const count = chunks.length;
  return chunks.map((part, index) => {
    const joined = `(${index + 1}/${count})\n${part}`;
    return joined.length <= limit ? joined : joined.slice(0, limit);
  });
}

export function resolveThreadId(raw) {
  const value = String(raw ?? '').trim();
  if (!/^[1-9]\d*$/.test(value)) return null;
  return Number(value);
}

export function skipReason(eventName, payload) {
  if (eventName === 'push' && payload.deleted) return 'push penghapusan';
  if (eventName !== 'workflow_run') return '';
  const run = payload.workflow_run || {};
  const file = run.path || '';
  if (file.endsWith('telegram-notify.yml') || run.name === 'Telegram notify') return 'workflow sendiri';
  if (run.conclusion !== 'success' && run.conclusion !== 'failure') {
    return `hasil ${run.conclusion || 'kosong'}`;
  }
  return '';
}

export function isDuplicateRun(runs, currentId, key) {
  if (!key) return false;
  for (const run of runs || []) {
    if (run.id === currentId) continue;
    if (String(run.display_title || '').trim() !== key) continue;
    if (run.conclusion === 'success') return true;
    if (run.status !== 'completed' && run.id < currentId) return true;
  }
  return false;
}

function numbered(item) {
  return `${link(item.html_url, `#${item.number}`)} ${escapeHtml(flat(item.title || ''))}`;
}

export function buildMessage(eventName, payload, extra = {}) {
  const lines = [];
  if (eventName === 'push') {
    const ref = payload.ref || '';
    const branch = ref.replace(/^refs\/heads\//, '');
    lines.push(header(payload.forced ? '⤴️' : '🚀', payload.forced ? 'Force-push' : 'Push', payload));
    lines.push(`oleh ${actorHtml(payload, eventName)} · cabang <code>${escapeHtml(branch)}</code>`);
    const commits = [...(payload.commits || [])].reverse();
    const block = commitLines(commits);
    lines.push(...(block.length ? block : ['tanpa commit baru']));
    if (payload.compare) lines.push(link(payload.compare, 'bandingkan'));
  } else if (eventName === 'pull_request') {
    const pr = payload.pull_request || {};
    const action = payload.action;
    let emoji = '🔀';
    let label = 'PR dibuka';
    if (action === 'opened' && pr.draft) {
      emoji = '📝';
      label = 'PR draft';
    } else if (action === 'reopened') {
      emoji = '🔁';
      label = 'PR dibuka lagi';
    } else if (action === 'closed' && pr.merged) {
      emoji = '✅';
      label = 'PR digabung';
    } else if (action === 'closed') {
      emoji = '🚫';
      label = 'PR ditutup';
    } else if (action === 'ready_for_review') {
      emoji = '👀';
      label = 'PR siap ditinjau';
    } else if (action === 'synchronize') {
      emoji = '📝';
      label = 'PR diperbarui';
    }
    lines.push(header(emoji, label, payload));
    lines.push(numbered(pr));
    lines.push(`oleh ${actorHtml(payload, eventName)} · <code>${escapeHtml(pr.head?.ref || '')}</code> → <code>${escapeHtml(pr.base?.ref || '')}</code>`);
    if (action === 'synchronize' && extra.commits) {
      lines.push(...commitLines(extra.commits, extra.commitTotal ?? pr.commits));
    }
  } else if (eventName === 'pull_request_review') {
    const pr = payload.pull_request || {};
    const review = payload.review || {};
    let emoji = '💬';
    let label = 'Komentar review';
    if (payload.action === 'dismissed') {
      emoji = '🚫';
      label = 'Review dibatalkan';
    } else if (payload.action === 'edited') {
      emoji = '✏️';
      label = 'Review diubah';
    } else if (review.state === 'approved') {
      emoji = '✅';
      label = 'Review disetujui';
    } else if (review.state === 'changes_requested') {
      emoji = '🟡';
      label = 'Perubahan diminta';
    }
    lines.push(header(emoji, label, payload));
    lines.push(numbered(pr));
    lines.push(`oleh ${actorHtml(payload, eventName)}`);
    const bit = clip(review.body, 180);
    if (bit) lines.push(escapeHtml(bit));
    if (review.html_url) lines.push(link(review.html_url, 'lihat review'));
  } else if (eventName === 'issues') {
    const issue = payload.issue || {};
    const map = {
      opened: ['📌', 'Issue dibuka'],
      closed: ['✅', 'Issue ditutup'],
      reopened: ['🔁', 'Issue dibuka lagi'],
    };
    const [emoji, label] = map[payload.action] || ['📌', 'Issue'];
    lines.push(header(emoji, label, payload));
    lines.push(numbered(issue));
    lines.push(`oleh ${actorHtml(payload, eventName)}`);
  } else if (eventName === 'issue_comment') {
    const issue = payload.issue || {};
    const href = payload.comment?.html_url || issue.html_url;
    lines.push(header('💬', issue.pull_request ? 'Komentar PR' : 'Komentar issue', payload));
    lines.push(`${link(href, `#${issue.number}`)} ${escapeHtml(flat(issue.title || ''))}`);
    lines.push(`oleh ${actorHtml(payload, eventName)}`);
    const bit = clip(payload.comment?.body, 180);
    if (bit) lines.push(escapeHtml(bit));
  } else if (eventName === 'release') {
    const rel = payload.release || {};
    lines.push(header('🏷️', rel.prerelease ? 'Prarilis' : 'Rilis', payload));
    lines.push(`${link(rel.html_url, escapeHtml(flat(rel.name || rel.tag_name || 'rilis')))} · <code>${escapeHtml(rel.tag_name || '')}</code>`);
    lines.push(`oleh ${actorHtml(payload, eventName)}`);
    for (const asset of rel.assets || []) {
      if (!asset.browser_download_url) continue;
      lines.push(`• ${link(asset.browser_download_url, escapeHtml(asset.name || 'aset'))}`);
    }
  } else if (eventName === 'workflow_run') {
    const run = payload.workflow_run || {};
    const ok = run.conclusion === 'success';
    lines.push(header(ok ? '✅' : '❌', `${run.name || 'Workflow'} ${ok ? 'berhasil' : 'gagal'}`, payload));
    lines.push(`cabang <code>${escapeHtml(run.head_branch || '')}</code> · oleh ${actorHtml(payload, eventName)}`);
    const repo = payload.repository?.full_name || '';
    const server = String(payload.repository?.html_url || '').replace(/\/[^/]+\/[^/]+$/, '') || 'https://github.com';
    for (const pr of (run.pull_requests || []).slice(0, 3)) {
      if (!repo || !pr.number) continue;
      lines.push(link(`${server}/${repo}/pull/${pr.number}`, `#${pr.number}`));
    }
    if (run.html_url) lines.push(link(run.html_url, 'lihat run'));
  } else if (eventName === 'create' || eventName === 'delete') {
    const tag = payload.ref_type === 'tag';
    const emoji = eventName === 'delete' ? '🗑️' : tag ? '🏷️' : '🌿';
    const label = eventName === 'delete'
      ? (tag ? 'Tag dihapus' : 'Cabang dihapus')
      : (tag ? 'Tag dibuat' : 'Cabang dibuat');
    lines.push(header(emoji, label, payload));
    lines.push(`${tag ? 'tag' : 'cabang'} <code>${escapeHtml(payload.ref || '')}</code>`);
    lines.push(`oleh ${actorHtml(payload, eventName)}`);
  } else if (eventName === 'workflow_dispatch') {
    lines.push(header('🧪', 'Uji notifikasi', payload));
    lines.push(`oleh ${actorHtml(payload, eventName)}`);
    lines.push('Bot terhubung ke chat ini.');
    const note = clip(extra.note || '', 300);
    if (note) lines.push(escapeHtml(note));
  } else {
    lines.push(header('📣', eventName || 'peristiwa', payload));
    lines.push(`oleh ${actorHtml(payload, eventName)}`);
  }
  return lines.filter(Boolean).join('\n');
}

export function telegramBody(text, chatId, threadId) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (threadId != null) body.message_thread_id = threadId;
  return body;
}

function redact(text, token) {
  const raw = String(text ?? '');
  if (!token) return raw;
  return raw.split(token).join('[redacted]');
}

function chatIdOk(value) {
  return /^-?\d+$/.test(value) || /^@[A-Za-z0-9_]+$/.test(value);
}

async function githubJson(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'solana-os-telegram-notify',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function alreadyReported(key) {
  const token = process.env.GITHUB_TOKEN || '';
  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!key || !token || !repo) return false;
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const current = Number(process.env.GITHUB_RUN_ID || 0);
  try {
    const data = await githubJson(
      `${api}/repos/${repo}/actions/workflows/telegram-notify.yml/runs?event=workflow_run&per_page=50`,
      token,
    );
    return isDuplicateRun(data?.workflow_runs, current, key);
  } catch {
    return false;
  }
}

async function recentCommits(payload) {
  const sha = payload.pull_request?.head?.sha;
  const repo = payload.repository?.full_name || process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN || '';
  if (!sha || !repo || !token) return null;
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  try {
    const data = await githubJson(
      `${api}/repos/${repo}/commits?sha=${encodeURIComponent(sha)}&per_page=5`,
      token,
    );
    if (!Array.isArray(data)) return null;
    return data.map((item) => ({
      id: item.sha,
      message: item.commit?.message || '',
      url: item.html_url,
    }));
  } catch {
    return null;
  }
}

async function deliver(parts, token, chatId, threadId) {
  const base = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
  const url = `${base}/bot${token}/sendMessage`;
  for (const text of parts) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramBody(text, chatId, threadId)),
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      console.error(redact(err?.message || err, token));
      process.exitCode = 1;
      return;
    }
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok || data.ok === false) {
      console.error(`Telegram API ${res.status}: ${redact(data.description || '', token)}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`Terkirim (${parts.length} pesan).`);
}

export async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.log('Lewati: GITHUB_EVENT_PATH kosong.');
    return;
  }
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const reason = skipReason(eventName, payload);
  if (reason) {
    console.log(`Lewati: ${reason}.`);
    return;
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) {
    console.log('Lewati: TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diisi.');
    return;
  }
  if (!chatIdOk(chatId)) {
    console.log('Lewati: TELEGRAM_CHAT_ID bukan id chat.');
    return;
  }

  const dedupeKey = (process.env.TELEGRAM_DEDUPE_KEY || '').trim();
  if (eventName === 'workflow_run' && await alreadyReported(dedupeKey)) {
    console.log('Lewati: run workflow ini sudah dilaporkan.');
    return;
  }

  const threadRaw = process.env.TELEGRAM_TOPIC_ID || '';
  const threadId = resolveThreadId(threadRaw);
  if (threadRaw.trim() && threadId == null) {
    console.log('TELEGRAM_TOPIC_ID bukan angka, kirim ke chat umum.');
  }

  let commits = null;
  if (eventName === 'pull_request' && payload.action === 'synchronize') {
    commits = await recentCommits(payload);
  }
  const text = buildMessage(eventName, payload, {
    commits,
    commitTotal: payload.pull_request?.commits,
    note: process.env.TELEGRAM_TEST_NOTE || '',
  });
  const parts = splitMessage(text);
  if (!parts.length) {
    console.log('Lewati: pesan kosong.');
    return;
  }
  if (process.env.TELEGRAM_DRY_RUN === '1') {
    console.log(JSON.stringify(parts.map((part) => telegramBody(part, chatId, threadId)), null, 2));
    return;
  }
  await deliver(parts, token, chatId, threadId);
  if (process.exitCode) process.exit(process.exitCode);
}

const isDirect = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirect) {
  main().catch((err) => {
    console.error(redact(err?.stack || err, process.env.TELEGRAM_BOT_TOKEN));
    process.exit(1);
  });
}
