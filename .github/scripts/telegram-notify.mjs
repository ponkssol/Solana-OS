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

export function jakartaTime(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())} +07:00`;
}

function clipLines(value, max) {
  const text = String(value ?? '').replace(/\r\n/g, '\n').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function shortSha(id) {
  return String(id || '').slice(0, 7) || '???????';
}

function serverOf(payload) {
  const html = payload.repository?.html_url || '';
  return html.replace(/\/[^/]+\/[^/]+$/, '') || process.env.GITHUB_SERVER_URL || 'https://github.com';
}

function repoUrl(payload) {
  const name = payload.repository?.full_name || process.env.GITHUB_REPOSITORY || 'repo';
  return payload.repository?.html_url || `${serverOf(payload)}/${name}`;
}

function branchUrl(payload, branch) {
  if (!branch) return '';
  const encoded = encodeURIComponent(branch).replace(/%2F/g, '/');
  return `${repoUrl(payload)}/tree/${encoded}`;
}

function tree(rows) {
  const clean = rows.filter((row) => row != null && String(row) !== '');
  return clean.map((row, index) => `${index === clean.length - 1 ? '└' : '├'} ${row}`);
}

function frame(tag, section, rows, blocks) {
  return [
    `<b>Solana OS Update</b> ${tag}`,
    `╭─ ${section} ─╮`,
    ...tree(rows),
    ...blocks,
    `╰${'─'.repeat(section.length + 4)}╯`,
  ].filter((line) => line !== '').join('\n');
}

function messageBlock(label, raw, max = 1500) {
  const text = clipLines(raw, max);
  if (!text) return [];
  return [`▸ ${label}`, `<pre>${escapeHtml(text)}</pre>`];
}

function commitEntry(commit) {
  const sha = shortSha(commit.id || commit.sha);
  const url = commit.url || commit.html_url || '';
  const first = String(commit.message || commit.commit?.message || '').split('\n')[0].trim();
  const msg = escapeHtml(first ? clip(first, 140) : '(no message)');
  const author = commit.author?.username || commit.author?.name || commit.commit?.author?.name || '';
  const shaHtml = url ? link(url, escapeHtml(sha)) : escapeHtml(sha);
  const who = author ? ` <i>${escapeHtml(author)}</i>` : '';
  return `${shaHtml} ${msg}${who}`;
}

function commitSection(commits, total) {
  const shown = (commits || []).slice(0, 5);
  const count = total ?? shown.length;
  if (!shown.length) return ['▸ Commits (0)', '└ (no new commits)'];
  const lines = [`▸ Commits (${count})`, ...tree(shown.map(commitEntry))];
  const extra = Math.max(count - shown.length, 0);
  if (extra > 0) lines.push(`and ${extra} more`);
  return lines;
}

function fileSection(files, total) {
  if (!Array.isArray(files) || !files.length) return [];
  const shown = files.slice(0, 15);
  const rows = shown.map((file) => {
    const name = escapeHtml(file.filename || file.name || 'file');
    return `${name} +${Number(file.additions || 0)} −${Number(file.deletions || 0)}`;
  });
  const count = total || files.length;
  const lines = [`▸ Files (${count})`, ...tree(rows)];
  const extra = Math.max(count - shown.length, 0);
  if (extra > 0) lines.push(`and ${extra} more`);
  return lines;
}

function checkSection(checks) {
  if (!checks) return [];
  const passed = checks.passed || 0;
  const failed = checks.failed || 0;
  const pending = checks.pending || 0;
  if (!passed && !failed && !pending) return [];
  const rows = [
    `${passed} passed, ${failed} failed, ${pending} pending`,
    ...(checks.failedNames || []).slice(0, 5).map((name) => `${escapeHtml(name)} failed`),
  ];
  return ['▸ Checks', ...tree(rows)];
}

function urlButton(text, url) {
  if (!text || !url || !/^https?:\/\//.test(String(url))) return null;
  return { text: String(text), url: String(url) };
}

function runButton(extra, repoHtmlUrl) {
  const runId = extra.runId || process.env.GITHUB_RUN_ID;
  const runNumber = extra.runNumber || process.env.GITHUB_RUN_NUMBER;
  if (!runId || !runNumber) return null;
  return urlButton(`Action #${runNumber}`, `${repoHtmlUrl}/actions/runs/${runId}`);
}

function authorLine(author) {
  if (!author) return 'Author unknown';
  const name = author.name || author.username || author.login || '';
  const email = author.email || '';
  if (name && email) return `Author ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;`;
  if (name) return `Author ${link(author.html_url, escapeHtml(name))}`;
  return 'Author unknown';
}

export function splitMessage(text, limit = 4096) {
  const src = String(text ?? '');
  if (src.length <= limit) return src ? [src] : [];
  const budget = limit - 40;
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
  const balanced = [];
  let reopen = false;
  for (const chunk of chunks) {
    let part = reopen ? `<pre>\n${chunk}` : chunk;
    reopen = false;
    const opens = (part.match(/<pre>/g) || []).length;
    const closes = (part.match(/<\/pre>/g) || []).length;
    if (opens > closes) {
      part += '</pre>';
      reopen = true;
    }
    balanced.push(part);
  }
  const count = balanced.length;
  return balanced.map((part, index) => {
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

function reviewState(state) {
  if (state === 'changes_requested') return 'changes requested';
  if (state === 'approved' || state === 'commented' || state === 'dismissed') return state;
  return state || 'commented';
}

function prSection(eventName, payload) {
  if (eventName === 'pull_request_review') {
    if (payload.action === 'dismissed') return 'Review Dismissed';
    if (payload.action === 'edited') return 'Review Edited';
    return 'Review Submitted';
  }
  const pr = payload.pull_request || {};
  const action = payload.action;
  if (action === 'reopened') return 'Pull Request Reopened';
  if (action === 'closed' && pr.merged) return 'Pull Request Merged';
  if (action === 'closed') return 'Pull Request Closed';
  if (action === 'ready_for_review') return 'Pull Request Ready for Review';
  if (action === 'synchronize') return 'Pull Request Updated';
  return 'Pull Request Opened';
}

function when(payload, eventName) {
  const pr = payload.pull_request || {};
  const issue = payload.issue || {};
  const rel = payload.release || {};
  const run = payload.workflow_run || {};
  const iso = payload.head_commit?.timestamp
    || pr.merged_at
    || pr.updated_at
    || pr.created_at
    || payload.review?.submitted_at
    || issue.updated_at
    || issue.created_at
    || payload.comment?.created_at
    || rel.published_at
    || run.updated_at
    || run.created_at
    || payload.repository?.pushed_at
    || '';
  if (!iso && eventName === 'workflow_dispatch') return jakartaTime(new Date().toISOString());
  return iso ? jakartaTime(iso) : jakartaTime(new Date().toISOString());
}

function renderPush(payload, extra) {
  const branch = String(payload.ref || '').replace(/^refs\/heads\//, '');
  const commits = [...(payload.commits || [])].reverse();
  const head = payload.head_commit || commits[0] || {};
  const commitUrl = head.url || commits[0]?.url || '';
  const rows = [
    `Repo ${repoHtml(payload)}`,
    `${link(branchUrl(payload, branch), 'Branch')} <code>${escapeHtml(branch)}</code>`,
    `Pushed by ${actorHtml(payload, 'push')}`,
    `Time ${when(payload, 'push')}`,
    `Commit ${commitUrl ? link(commitUrl, escapeHtml(shortSha(head.id || commits[0]?.id))) : escapeHtml(shortSha(head.id || commits[0]?.id))}`,
    authorLine(head.author || commits[0]?.author),
  ];
  const blocks = [
    ...messageBlock('Message', head.message || commits[0]?.message || ''),
    ...commitSection(commits, commits.length),
  ];
  const section = payload.forced ? 'Repository Updated (Force-push)' : 'Repository Updated (Push)';
  const buttons = [
    urlButton('Compare', payload.compare),
    runButton(extra, repoUrl(payload)),
    urlButton('Commit', commitUrl),
  ].filter(Boolean);
  return { text: frame('#push', section, rows, blocks), buttons };
}

function renderPull(payload, extra, eventName) {
  const pr = payload.pull_request || {};
  const head = pr.head?.ref || '';
  const base = pr.base?.ref || '';
  const commitCount = pr.commits ?? extra.commits?.length ?? 0;
  const fileCount = pr.changed_files ?? (Array.isArray(extra.files) ? extra.files.length : 0);
  const rows = [
    `PR ${link(pr.html_url, `#${pr.number || ''}`)} ${escapeHtml(flat(pr.title || ''))}`,
    `Repo ${repoHtml(payload)}`,
    `Branch ${link(branchUrl(payload, head), escapeHtml(head))} → ${link(branchUrl(payload, base), escapeHtml(base))}`,
    `Author ${link(pr.user?.html_url, escapeHtml(pr.user?.login || 'unknown'))}`,
    `By ${actorHtml(payload, eventName)}`,
    `Time ${when(payload, eventName)}`,
    `Draft ${pr.draft ? 'yes' : 'no'}`,
    `Labels ${people(pr.labels)}`,
    `Assignees ${people(pr.assignees)}`,
    `Reviewers ${people([...(pr.requested_reviewers || []), ...(pr.requested_teams || [])])}`,
    `Changes ${commitCount} commits · ${fileCount} files · +${pr.additions ?? 0} −${pr.deletions ?? 0}`,
  ];
  if (pr.merged && pr.merged_by?.login) {
    rows.push(`Merged by ${link(pr.merged_by.html_url, escapeHtml(pr.merged_by.login))}`);
  }
  if (pr.merged && pr.merge_commit_sha) {
    const sha = String(pr.merge_commit_sha);
    rows.push(`Merge commit ${link(`${repoUrl(payload)}/commit/${sha}`, escapeHtml(shortSha(sha)))}`);
  }
  const blocks = [
    ...messageBlock('Description', stripMarkdown(pr.body) || 'none', 600),
    ...fileSection(extra.files, fileCount),
    ...(Array.isArray(extra.commits) && extra.commits.length ? commitSection(extra.commits, commitCount || extra.commits.length) : []),
    ...checkSection(extra.checks),
  ];
  if (eventName === 'pull_request_review') {
    const review = payload.review || {};
    const reviewer = review.user?.login || payload.sender?.login || 'unknown';
    rows.push(`Reviewer ${link(review.user?.html_url || payload.sender?.html_url, escapeHtml(reviewer))}`);
    rows.push(`Review ${escapeHtml(reviewState(review.state || payload.action))}`);
    blocks.unshift(...messageBlock('Review', stripMarkdown(review.body), 600));
  }
  const buttons = [
    urlButton('View PR', pr.html_url),
    urlButton('Files', pr.html_url ? `${pr.html_url}/files` : ''),
    urlButton('Checks', pr.html_url ? `${pr.html_url}/checks` : ''),
  ].filter(Boolean);
  const tag = eventName === 'pull_request_review' ? '#review' : '#pr';
  return { text: frame(tag, prSection(eventName, payload), rows, blocks), buttons };
}

function renderIssue(payload) {
  const issue = payload.issue || {};
  const titles = { opened: 'Issue Opened', closed: 'Issue Closed', reopened: 'Issue Reopened' };
  const rows = [
    `Issue ${link(issue.html_url, `#${issue.number || ''}`)} ${escapeHtml(flat(issue.title || ''))}`,
    `Repo ${repoHtml(payload)}`,
    `By ${actorHtml(payload, 'issues')}`,
    `Time ${when(payload, 'issues')}`,
  ];
  const blocks = messageBlock('Description', stripMarkdown(issue.body), 600);
  return {
    text: frame('#issue', titles[payload.action] || 'Issue', rows, blocks),
    buttons: [urlButton('View issue', issue.html_url)].filter(Boolean),
  };
}

function renderComment(payload) {
  const issue = payload.issue || {};
  const href = payload.comment?.html_url || issue.html_url;
  const onPr = Boolean(issue.pull_request);
  const rows = [
    `${onPr ? 'PR' : 'Issue'} ${link(href, `#${issue.number || ''}`)} ${escapeHtml(flat(issue.title || ''))}`,
    `Repo ${repoHtml(payload)}`,
    `By ${actorHtml(payload, 'issue_comment')}`,
    `Time ${when(payload, 'issue_comment')}`,
  ];
  return {
    text: frame('#issue', onPr ? 'PR Comment' : 'Issue Comment', rows, messageBlock('Message', payload.comment?.body, 600)),
    buttons: [urlButton('View comment', href)].filter(Boolean),
  };
}

function renderRelease(payload) {
  const rel = payload.release || {};
  const assets = (rel.assets || []).filter((asset) => asset.browser_download_url);
  const exe = assets.find((asset) => /\.exe$/i.test(asset.name || ''));
  const msi = assets.find((asset) => /\.msi$/i.test(asset.name || ''));
  const rows = [
    `Release ${link(rel.html_url, escapeHtml(flat(rel.name || rel.tag_name || 'release')))}`,
    `Tag <code>${escapeHtml(rel.tag_name || '')}</code>`,
    `Repo ${repoHtml(payload)}`,
    `By ${actorHtml(payload, 'release')}`,
    `Time ${when(payload, 'release')}`,
  ];
  const assetRows = assets.map((asset) => link(asset.browser_download_url, escapeHtml(asset.name || 'asset')));
  const blocks = [
    ...messageBlock('Notes', stripMarkdown(rel.body), 600),
    ...(assetRows.length ? [`▸ Assets (${assets.length})`, ...tree(assetRows)] : []),
  ];
  const buttons = [
    urlButton('Release', rel.html_url),
    exe ? urlButton('Download .exe', exe.browser_download_url) : null,
    msi ? urlButton('Download .msi', msi.browser_download_url) : null,
  ].filter(Boolean);
  const section = rel.prerelease ? 'Prerelease Published' : 'Release Published';
  return { text: frame('#release', section, rows, blocks), buttons };
}

function renderWorkflow(payload) {
  const run = payload.workflow_run || {};
  const ok = run.conclusion === 'success';
  const repo = payload.repository?.full_name || '';
  const server = serverOf(payload);
  const rows = [
    `Workflow ${escapeHtml(run.name || 'Workflow')}`,
    `Result ${ok ? 'succeeded' : 'failed'}`,
    `Repo ${repoHtml(payload)}`,
    `${link(branchUrl(payload, run.head_branch || ''), 'Branch')} <code>${escapeHtml(run.head_branch || '')}</code>`,
    `By ${actorHtml(payload, 'workflow_run')}`,
    `Time ${when(payload, 'workflow_run')}`,
    run.html_url ? `Run ${link(run.html_url, 'open')}` : '',
    ...(run.pull_requests || []).slice(0, 3).map((pr) => (
      repo && pr.number ? `PR ${link(`${server}/${repo}/pull/${pr.number}`, `#${pr.number}`)}` : ''
    )),
  ];
  const logs = run.id ? `${repoUrl(payload)}/actions/runs/${run.id}/logs` : '';
  return {
    text: frame('#workflow', ok ? 'Workflow Succeeded' : 'Workflow Failed', rows, []),
    buttons: [urlButton('Run', run.html_url), urlButton('Logs', logs)].filter(Boolean),
  };
}

function renderRef(payload, eventName) {
  const tag = payload.ref_type === 'tag';
  const section = eventName === 'delete'
    ? (tag ? 'Tag Deleted' : 'Branch Deleted')
    : (tag ? 'Tag Created' : 'Branch Created');
  const refUrl = eventName === 'delete' ? '' : (tag
    ? `${repoUrl(payload)}/releases/tag/${encodeURIComponent(payload.ref || '')}`
    : branchUrl(payload, payload.ref || ''));
  const rows = [
    `Repo ${repoHtml(payload)}`,
    `${tag ? 'Tag' : 'Branch'} ${refUrl ? link(refUrl, 'open') : ''} <code>${escapeHtml(payload.ref || '')}</code>`.replace('  ', ' '),
    `By ${actorHtml(payload, eventName)}`,
    `Time ${when(payload, eventName)}`,
  ];
  return {
    text: frame(tag ? '#tag' : '#branch', section, rows, []),
    buttons: [urlButton(tag ? 'Tag' : 'Branch', refUrl)].filter(Boolean),
  };
}

function renderTest(payload, extra) {
  const rows = [
    `Repo ${repoHtml(payload)}`,
    `By ${actorHtml(payload, 'workflow_dispatch')}`,
    `Time ${when(payload, 'workflow_dispatch')}`,
  ];
  const blocks = [
    'The bot is connected to this chat.',
    ...messageBlock('Note', extra.note || '', 300),
  ];
  return {
    text: frame('#test', 'Notification Test', rows, blocks),
    buttons: [runButton(extra, repoUrl(payload))].filter(Boolean),
  };
}

export function buildNotification(eventName, payload, extra = {}) {
  if (eventName === 'push') return renderPush(payload, extra);
  if (eventName === 'pull_request' || eventName === 'pull_request_review') return renderPull(payload, extra, eventName);
  if (eventName === 'issues') return renderIssue(payload);
  if (eventName === 'issue_comment') return renderComment(payload);
  if (eventName === 'release') return renderRelease(payload);
  if (eventName === 'workflow_run') return renderWorkflow(payload);
  if (eventName === 'create' || eventName === 'delete') return renderRef(payload, eventName);
  if (eventName === 'workflow_dispatch') return renderTest(payload, extra);
  return {
    text: frame('#event', eventName || 'Event', [
      `Repo ${repoHtml(payload)}`,
      `By ${actorHtml(payload, eventName)}`,
    ], []),
    buttons: [],
  };
}

export function buildMessage(eventName, payload, extra = {}) {
  return buildNotification(eventName, payload, extra).text;
}

export function telegramBody(text, chatId, threadId, buttons) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (threadId != null) body.message_thread_id = threadId;
  if (buttons?.length) body.reply_markup = { inline_keyboard: [buttons] };
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

async function deliver(parts, token, chatId, threadId, buttons) {
  const base = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
  const url = `${base}/bot${token}/sendMessage`;
  for (let index = 0; index < parts.length; index += 1) {
    const text = parts[index];
    const markup = index === parts.length - 1 ? buttons : null;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramBody(text, chatId, threadId, markup)),
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

  const extra = {
    note: process.env.TELEGRAM_TEST_NOTE || '',
    runId: process.env.GITHUB_RUN_ID || '',
    runNumber: process.env.GITHUB_RUN_NUMBER || '',
  };
  if (eventName === 'pull_request' || eventName === 'pull_request_review') {
    Object.assign(extra, await pullRequestExtra(payload));
  }
  const note = buildNotification(eventName, payload, extra);
  const parts = splitMessage(note.text);
  if (!parts.length) {
    console.log('Skip: empty message.');
    return;
  }
  if (process.env.TELEGRAM_DRY_RUN === '1') {
    const bodies = parts.map((part, index) => telegramBody(
      part,
      chatId,
      threadId,
      index === parts.length - 1 ? note.buttons : null,
    ));
    console.log(JSON.stringify(bodies, null, 2));
    return;
  }
  await deliver(parts, token, chatId, threadId, note.buttons);
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
