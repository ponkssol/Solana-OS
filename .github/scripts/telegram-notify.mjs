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
  login = login || process.env.GITHUB_ACTOR || 'someone';
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
  const msg = first ? clip(first, 140) : '(no message)';
  const shaHtml = url ? link(url, escapeHtml(sha)) : `<code>${escapeHtml(sha)}</code>`;
  return `${shaHtml} ${escapeHtml(msg)}`;
}

export function commitLines(commits, total) {
  const list = Array.isArray(commits) ? commits : [];
  const shown = list.slice(0, 5);
  const lines = shown.map(formatCommit);
  const extra = Math.max((total ?? list.length) - shown.length, 0);
  if (extra > 0) lines.push(`and ${extra} more`);
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
  if (eventName === 'push' && payload.deleted) return 'branch delete push';
  if (eventName !== 'workflow_run') return '';
  const run = payload.workflow_run || {};
  const file = run.path || '';
  if (file.endsWith('telegram-notify.yml') || run.name === 'Telegram notify') return 'own workflow';
  if (run.conclusion !== 'success' && run.conclusion !== 'failure') {
    return `conclusion ${run.conclusion || 'empty'}`;
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

export function stripMarkdown(value) {
  return String(value ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function people(list) {
  const names = (list || []).map((item) => item?.login || item?.name || item?.slug).filter(Boolean);
  return names.length ? names.map((name) => escapeHtml(name)).join(', ') : 'none';
}

export function prAction(eventName, payload) {
  if (eventName === 'pull_request_review') {
    if (payload.action === 'dismissed') return { emoji: '🚫', label: 'PR review dismissed' };
    if (payload.action === 'edited') return { emoji: '✏️', label: 'PR review edited' };
    return { emoji: '👀', label: 'PR review submitted' };
  }
  const pr = payload.pull_request || {};
  const action = payload.action;
  if (action === 'reopened') return { emoji: '🔁', label: 'PR reopened' };
  if (action === 'closed' && pr.merged) return { emoji: '✅', label: 'PR merged' };
  if (action === 'closed') return { emoji: '🚫', label: 'PR closed' };
  if (action === 'ready_for_review') return { emoji: '👀', label: 'PR ready for review' };
  if (action === 'synchronize') return { emoji: '📝', label: 'PR updated' };
  if (action === 'opened' && pr.draft) return { emoji: '📝', label: 'PR opened' };
  return { emoji: '🔀', label: 'PR opened' };
}

function reviewState(state) {
  if (state === 'changes_requested') return 'changes requested';
  if (state === 'approved' || state === 'commented' || state === 'dismissed') return state === 'dismissed' ? 'dismissed' : state;
  return state || 'commented';
}

function fileLines(files, total) {
  const list = Array.isArray(files) ? files : [];
  const shown = list.slice(0, 15);
  const lines = shown.map((file) => {
    const name = escapeHtml(file.filename || file.name || 'file');
    return `• ${name} +${Number(file.additions || 0)} −${Number(file.deletions || 0)}`;
  });
  const extra = Math.max((total ?? list.length) - shown.length, 0);
  if (extra > 0) lines.push(`and ${extra} more`);
  return lines;
}

function checkLines(checks) {
  if (!checks) return [];
  const passed = checks.passed || 0;
  const failed = checks.failed || 0;
  const pending = checks.pending || 0;
  if (!passed && !failed && !pending) return [];
  const lines = [`Checks: ${passed} passed, ${failed} failed, ${pending} pending`];
  for (const name of (checks.failedNames || []).slice(0, 5)) {
    lines.push(`• ${escapeHtml(name)} failed`);
  }
  return lines;
}

function pullRequestLines(payload, extra, eventName) {
  const pr = payload.pull_request || {};
  const { emoji, label } = prAction(eventName, payload);
  const lines = [
    header(emoji, label, payload),
    numbered(pr),
    `Author: ${link(pr.user?.html_url, escapeHtml(pr.user?.login || 'unknown'))}`,
    `Branch: <code>${escapeHtml(pr.head?.ref || '')}</code> → <code>${escapeHtml(pr.base?.ref || '')}</code>`,
    `Draft: ${pr.draft ? 'yes' : 'no'}`,
    `Labels: ${people(pr.labels)}`,
    `Assignees: ${people(pr.assignees)}`,
    `Reviewers: ${people([...(pr.requested_reviewers || []), ...(pr.requested_teams || [])])}`,
  ];
  const description = clip(stripMarkdown(pr.body), 600);
  lines.push(description ? `Description: ${escapeHtml(description)}` : 'Description: none');
  const commitCount = pr.commits ?? extra.commitTotal ?? 0;
  const fileCount = pr.changed_files ?? (Array.isArray(extra.files) ? extra.files.length : 0);
  lines.push(`Changes: ${commitCount} commits · ${fileCount} files · +${pr.additions ?? 0} −${pr.deletions ?? 0}`);
  const files = fileLines(extra.files, fileCount || extra.files?.length);
  if (files.length) {
    lines.push('Files:');
    lines.push(...files);
  }
  if (Array.isArray(extra.commits) && extra.commits.length) {
    lines.push('Commits:');
    lines.push(...commitLines(extra.commits, commitCount || extra.commits.length));
  }
  if (pr.merged) {
    if (pr.merged_by?.login) {
      lines.push(`Merged by: ${link(pr.merged_by.html_url, escapeHtml(pr.merged_by.login))}`);
    }
    if (pr.merge_commit_sha) {
      lines.push(`Merge commit: <code>${escapeHtml(String(pr.merge_commit_sha).slice(0, 7))}</code>`);
    }
  }
  if (eventName === 'pull_request_review') {
    const review = payload.review || {};
    const reviewer = review.user?.login || payload.sender?.login || 'unknown';
    lines.push(`Reviewer: ${link(review.user?.html_url || payload.sender?.html_url, escapeHtml(reviewer))}`);
    lines.push(`Review: ${escapeHtml(reviewState(review.state || payload.action))}`);
    const bit = clip(stripMarkdown(review.body), 600);
    if (bit) lines.push(escapeHtml(bit));
    if (review.html_url) lines.push(link(review.html_url, 'view review'));
  }
  lines.push(...checkLines(extra.checks));
  return lines;
}

export function buildMessage(eventName, payload, extra = {}) {
  const lines = [];
  if (eventName === 'push') {
    const ref = payload.ref || '';
    const branch = ref.replace(/^refs\/heads\//, '');
    lines.push(header(payload.forced ? '⤴️' : '🚀', payload.forced ? 'Force-push' : 'Push', payload));
    lines.push(`by ${actorHtml(payload, eventName)} · branch <code>${escapeHtml(branch)}</code>`);
    const commits = [...(payload.commits || [])].reverse();
    const block = commitLines(commits);
    lines.push(...(block.length ? block : ['no new commits']));
    if (payload.compare) lines.push(link(payload.compare, 'compare'));
  } else if (eventName === 'pull_request' || eventName === 'pull_request_review') {
    lines.push(...pullRequestLines(payload, extra, eventName));
  } else if (eventName === 'issues') {
    const issue = payload.issue || {};
    const map = {
      opened: ['📌', 'Issue opened'],
      closed: ['✅', 'Issue closed'],
      reopened: ['🔁', 'Issue reopened'],
    };
    const [emoji, label] = map[payload.action] || ['📌', 'Issue'];
    lines.push(header(emoji, label, payload));
    lines.push(numbered(issue));
    lines.push(`by ${actorHtml(payload, eventName)}`);
  } else if (eventName === 'issue_comment') {
    const issue = payload.issue || {};
    const href = payload.comment?.html_url || issue.html_url;
    lines.push(header('💬', issue.pull_request ? 'PR comment' : 'Issue comment', payload));
    lines.push(`${link(href, `#${issue.number}`)} ${escapeHtml(flat(issue.title || ''))}`);
    lines.push(`by ${actorHtml(payload, eventName)}`);
    const bit = clip(payload.comment?.body, 180);
    if (bit) lines.push(escapeHtml(bit));
  } else if (eventName === 'release') {
    const rel = payload.release || {};
    lines.push(header('🏷️', rel.prerelease ? 'Prerelease' : 'Release', payload));
    lines.push(`${link(rel.html_url, escapeHtml(flat(rel.name || rel.tag_name || 'release')))} · <code>${escapeHtml(rel.tag_name || '')}</code>`);
    lines.push(`by ${actorHtml(payload, eventName)}`);
    for (const asset of rel.assets || []) {
      if (!asset.browser_download_url) continue;
      lines.push(`• ${link(asset.browser_download_url, escapeHtml(asset.name || 'asset'))}`);
    }
  } else if (eventName === 'workflow_run') {
    const run = payload.workflow_run || {};
    const ok = run.conclusion === 'success';
    lines.push(header(ok ? '✅' : '❌', `${run.name || 'Workflow'} ${ok ? 'succeeded' : 'failed'}`, payload));
    lines.push(`branch <code>${escapeHtml(run.head_branch || '')}</code> · by ${actorHtml(payload, eventName)}`);
    const repo = payload.repository?.full_name || '';
    const server = String(payload.repository?.html_url || '').replace(/\/[^/]+\/[^/]+$/, '') || 'https://github.com';
    for (const pr of (run.pull_requests || []).slice(0, 3)) {
      if (!repo || !pr.number) continue;
      lines.push(link(`${server}/${repo}/pull/${pr.number}`, `#${pr.number}`));
    }
    if (run.html_url) lines.push(link(run.html_url, 'view run'));
  } else if (eventName === 'create' || eventName === 'delete') {
    const tag = payload.ref_type === 'tag';
    const emoji = eventName === 'delete' ? '🗑️' : tag ? '🏷️' : '🌿';
    const label = eventName === 'delete'
      ? (tag ? 'Tag deleted' : 'Branch deleted')
      : (tag ? 'Tag created' : 'Branch created');
    lines.push(header(emoji, label, payload));
    lines.push(`${tag ? 'tag' : 'branch'} <code>${escapeHtml(payload.ref || '')}</code>`);
    lines.push(`by ${actorHtml(payload, eventName)}`);
  } else if (eventName === 'workflow_dispatch') {
    lines.push(header('🧪', 'Notification test', payload));
    lines.push(`by ${actorHtml(payload, eventName)}`);
    lines.push('The bot is connected to this chat.');
    const note = clip(extra.note || '', 300);
    if (note) lines.push(escapeHtml(note));
  } else {
    lines.push(header('📣', eventName || 'event', payload));
    lines.push(`by ${actorHtml(payload, eventName)}`);
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

async function checkSummary(base, sha, token) {
  if (!sha) return null;
  const runs = await githubJson(`${base}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`, token);
  if (runs?.check_runs?.length) {
    let passed = 0;
    let failed = 0;
    let pending = 0;
    const failedNames = [];
    for (const run of runs.check_runs) {
      const conclusion = run.conclusion;
      if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') passed += 1;
      else if (!conclusion) pending += 1;
      else {
        failed += 1;
        if (run.name) failedNames.push(run.name);
      }
    }
    return { passed, failed, pending, failedNames };
  }
  const status = await githubJson(`${base}/commits/${encodeURIComponent(sha)}/status`, token);
  const statuses = status?.statuses || [];
  if (!statuses.length) return null;
  let passed = 0;
  let failed = 0;
  let pending = 0;
  const failedNames = [];
  for (const item of statuses) {
    if (item.state === 'success') passed += 1;
    else if (item.state === 'failure' || item.state === 'error') {
      failed += 1;
      if (item.context) failedNames.push(item.context);
    } else pending += 1;
  }
  return { passed, failed, pending, failedNames };
}

async function pullRequestExtra(payload) {
  const pr = payload.pull_request;
  const repo = payload.repository?.full_name || process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN || '';
  if (!pr?.number || !repo || !token) return {};
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const base = `${api}/repos/${repo}`;
  const lastPage = Math.max(1, Math.ceil((pr.commits || 1) / 100));
  try {
    const [files, commits, checks] = await Promise.all([
      githubJson(`${base}/pulls/${pr.number}/files?per_page=100`, token),
      githubJson(`${base}/pulls/${pr.number}/commits?per_page=100&page=${lastPage}`, token),
      checkSummary(base, pr.head?.sha, token),
    ]);
    return {
      files: Array.isArray(files)
        ? files.map((file) => ({
          filename: file.filename,
          additions: file.additions,
          deletions: file.deletions,
        }))
        : null,
      commits: Array.isArray(commits)
        ? commits.slice(-5).reverse().map((item) => ({
          id: item.sha,
          message: item.commit?.message || '',
          url: item.html_url,
        }))
        : null,
      checks,
    };
  } catch {
    return {};
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
  console.log(`Sent (${parts.length}).`);
}

export async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.log('Skip: GITHUB_EVENT_PATH is empty.');
    return;
  }
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const reason = skipReason(eventName, payload);
  if (reason) {
    console.log(`Skip: ${reason}.`);
    return;
  }

  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) {
    console.log('Skip: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.');
    return;
  }
  if (!chatIdOk(chatId)) {
    console.log('Skip: TELEGRAM_CHAT_ID is not a chat id.');
    return;
  }

  const dedupeKey = (process.env.TELEGRAM_DEDUPE_KEY || '').trim();
  if (eventName === 'workflow_run' && await alreadyReported(dedupeKey)) {
    console.log('Skip: this workflow run was already reported.');
    return;
  }

  const threadRaw = process.env.TELEGRAM_TOPIC_ID || '';
  const threadId = resolveThreadId(threadRaw);
  if (threadRaw.trim() && threadId == null) {
    console.log('TELEGRAM_TOPIC_ID is not a number, posting to the general chat.');
  }

  const extra = { note: process.env.TELEGRAM_TEST_NOTE || '' };
  if (eventName === 'pull_request' || eventName === 'pull_request_review') {
    Object.assign(extra, await pullRequestExtra(payload));
  }
  const text = buildMessage(eventName, payload, extra);
  const parts = splitMessage(text);
  if (!parts.length) {
    console.log('Skip: empty message.');
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
