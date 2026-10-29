import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildMessage,
  isDuplicateRun,
  resolveThreadId,
  skipReason,
  splitMessage,
} from './telegram-notify.mjs';

const repo = {
  repository: {
    full_name: 'ponkssol/Solana-OS',
    html_url: 'https://github.com/ponkssol/Solana-OS',
  },
  sender: { login: 'nanda', html_url: 'https://github.com/nanda' },
};

const script = fileURLToPath(new URL('./telegram-notify.mjs', import.meta.url));

function run(payload, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tg-'));
  const file = join(dir, 'event.json');
  writeFileSync(file, JSON.stringify(payload));
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME || '/tmp',
      GITHUB_REPOSITORY: 'ponkssol/Solana-OS',
      ...env,
      GITHUB_EVENT_PATH: file,
    },
  });
}

test('push lists five newest commits and escapes HTML', () => {
  const commits = Array.from({ length: 7 }, (_, i) => ({
    id: `abcdef${i}${'0'.repeat(32)}`,
    message: i === 6 ? '<b>baru</b> & co\nbody' : `commit ${i}`,
    url: `https://github.com/ponkssol/Solana-OS/commit/abcdef${i}`,
  }));
  const text = buildMessage('push', {
    ...repo,
    ref: 'refs/heads/main',
    compare: 'https://github.com/ponkssol/Solana-OS/compare/a...b',
    commits,
  });
  assert.match(text, /🚀 <b>Push<\/b>/);
  assert.match(text, /ponkssol\/Solana-OS/);
  assert.match(text, /nanda/);
  assert.match(text, /<code>main<\/code>/);
  assert.doesNotMatch(text, /<b>baru<\/b>/);
  assert.match(text, /&lt;b&gt;baru&lt;\/b&gt; &amp; co/);
  assert.match(text, /dan 2 lagi/);
  assert.ok(text.indexOf('abcdef6') < text.indexOf('abcdef2'));
  assert.doesNotMatch(text, /abcdef0/);
  assert.match(text, /bandingkan/);
});

test('pull request, review, issue, release, workflow, and ref events', () => {
  const pr = buildMessage('pull_request', {
    ...repo,
    action: 'closed',
    pull_request: {
      number: 12,
      title: 'Fix <vault>',
      html_url: 'https://github.com/ponkssol/Solana-OS/pull/12',
      merged: true,
      head: { ref: 'cursor/fix' },
      base: { ref: 'main' },
    },
  });
  assert.match(pr, /PR digabung/);
  assert.match(pr, /#12/);
  assert.match(pr, /Fix &lt;vault&gt;/);

  const sync = buildMessage('pull_request', {
    ...repo,
    action: 'synchronize',
    pull_request: {
      number: 3,
      title: 'More commits',
      html_url: 'https://github.com/ponkssol/Solana-OS/pull/3',
      commits: 8,
      head: { ref: 'feat' },
      base: { ref: 'main' },
    },
  }, {
    commits: [{ id: 'aaa1111', message: 'newest', url: 'https://github.com/ponkssol/Solana-OS/commit/aaa1111' }],
    commitTotal: 8,
  });
  assert.match(sync, /PR diperbarui/);
  assert.match(sync, /aaa1111/);
  assert.match(sync, /dan 7 lagi/);

  const review = buildMessage('pull_request_review', {
    ...repo,
    action: 'submitted',
    review: { state: 'approved', body: 'LGTM <b>ok</b>', html_url: 'https://github.com/ponkssol/Solana-OS/pull/3#pullrequestreview-1' },
    pull_request: { number: 3, title: 'More commits', html_url: 'https://github.com/ponkssol/Solana-OS/pull/3' },
  });
  assert.match(review, /Review disetujui/);
  assert.match(review, /LGTM &lt;b&gt;ok&lt;\/b&gt;/);

  const issue = buildMessage('issues', {
    ...repo,
    action: 'opened',
    issue: { number: 9, title: 'Boot loop', html_url: 'https://github.com/ponkssol/Solana-OS/issues/9' },
  });
  assert.match(issue, /Issue dibuka/);
  assert.match(issue, /#9/);

  const comment = buildMessage('issue_comment', {
    ...repo,
    action: 'created',
    issue: { number: 9, title: 'Boot loop', html_url: 'https://github.com/ponkssol/Solana-OS/issues/9' },
    comment: { body: 'lihat <script>', html_url: 'https://github.com/ponkssol/Solana-OS/issues/9#issuecomment-1' },
  });
  assert.match(comment, /Komentar issue/);
  assert.match(comment, /lihat &lt;script&gt;/);

  const release = buildMessage('release', {
    ...repo,
    release: {
      name: 'Solana OS v1',
      tag_name: 'v1.0.0-alpha.2',
      html_url: 'https://github.com/ponkssol/Solana-OS/releases/tag/v1.0.0-alpha.2',
      prerelease: true,
      assets: [{ name: 'Solana-OS-setup.exe', browser_download_url: 'https://example.com/setup.exe' }],
    },
  });
  assert.match(release, /Prarilis/);
  assert.match(release, /v1\.0\.0-alpha\.2/);
  assert.match(release, /Solana-OS-setup\.exe/);

  const run = buildMessage('workflow_run', {
    ...repo,
    workflow_run: {
      name: 'Security audit',
      conclusion: 'failure',
      head_branch: 'main',
      html_url: 'https://github.com/ponkssol/Solana-OS/actions/runs/9',
      actor: { login: 'nanda', html_url: 'https://github.com/nanda' },
    },
  });
  assert.match(run, /Security audit gagal/);
  assert.match(run, /lihat run/);
  assert.match(run, /actions\/runs\/9/);

  assert.match(buildMessage('create', { ...repo, ref: 'feat', ref_type: 'branch' }), /Cabang dibuat/);
  assert.match(buildMessage('delete', { ...repo, ref: 'v1', ref_type: 'tag' }), /Tag dihapus/);
  assert.match(buildMessage('workflow_dispatch', repo, { note: 'halo <b>' }), /Uji notifikasi/);
  assert.match(buildMessage('workflow_dispatch', repo, { note: 'halo <b>' }), /halo &lt;b&gt;/);
});

test('long messages split under 4096 without cutting a tag', () => {
  const assets = Array.from({ length: 80 }, (_, i) => ({
    name: `installer-${i}-` + 'x'.repeat(40) + '.exe',
    browser_download_url: `https://github.com/ponkssol/Solana-OS/releases/download/v1/file-${i}`,
  }));
  const text = buildMessage('release', {
    ...repo,
    release: { name: 'Big', tag_name: 'v9', html_url: 'https://github.com/ponkssol/Solana-OS/releases/tag/v9', assets },
  });
  assert.ok(text.length > 4096);
  const parts = splitMessage(text);
  assert.ok(parts.length > 1);
  for (const part of parts) {
    assert.ok(part.length <= 4096);
    assert.ok(part.lastIndexOf('<') <= part.lastIndexOf('>'));
  }
});

test('topic id falls back to the general chat', () => {
  assert.equal(resolveThreadId(''), null);
  assert.equal(resolveThreadId('  '), null);
  assert.equal(resolveThreadId('abc'), null);
  assert.equal(resolveThreadId('0'), null);
  assert.equal(resolveThreadId('42'), 42);
});

test('skips its own runs, cancelled runs, and branch-delete pushes', () => {
  assert.equal(skipReason('push', { deleted: true }), 'push penghapusan');
  assert.equal(skipReason('workflow_run', {
    workflow_run: { name: 'Telegram notify', conclusion: 'success', path: '.github/workflows/telegram-notify.yml' },
  }), 'workflow sendiri');
  assert.equal(skipReason('workflow_run', {
    workflow_run: { name: 'CI', conclusion: 'cancelled', path: '.github/workflows/ci.yml' },
  }), 'hasil cancelled');
  assert.equal(skipReason('workflow_run', {
    workflow_run: { name: 'CI', conclusion: 'success', path: '.github/workflows/ci.yml' },
  }), '');
});

test('workflow_run dedupe matches one successful delivery', () => {
  const runs = [
    { id: 5, display_title: 'tg-dedupe:9:1:failure', conclusion: 'success', status: 'completed' },
    { id: 8, display_title: 'tg-dedupe:9:1:success', conclusion: null, status: 'in_progress' },
  ];
  assert.equal(isDuplicateRun(runs, 10, 'tg-dedupe:9:1:success'), true);
  assert.equal(isDuplicateRun(runs, 4, 'tg-dedupe:9:1:success'), false);
  assert.equal(isDuplicateRun(runs, 10, 'tg-dedupe:9:2:failure'), false);
});

test('missing secrets skip without failing', () => {
  const result = run({ ...repo, ref: 'refs/heads/main', commits: [] }, { GITHUB_EVENT_NAME: 'push' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID/);
});

test('dry run omits an empty topic and never prints the token', () => {
  const token = 'test-token-value';
  const result = run({ ...repo, ref: 'refs/heads/main', commits: [] }, {
    GITHUB_EVENT_NAME: 'push',
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_CHAT_ID: '-1001234567890',
    TELEGRAM_DRY_RUN: '1',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /test-token-value/);
  const body = JSON.parse(result.stdout);
  assert.equal(body[0].parse_mode, 'HTML');
  assert.equal(body[0].disable_web_page_preview, true);
  assert.equal(body[0].chat_id, '-1001234567890');
  assert.equal(body[0].message_thread_id, undefined);
  assert.match(body[0].text, /Push/);
});

test('topic id is included and a bad topic falls back without printing the token', () => {
  const token = 'test-token-value';
  const withTopic = run(repo, {
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_CHAT_ID: '-1001234567890',
    TELEGRAM_TOPIC_ID: '42',
    TELEGRAM_TEST_NOTE: 'ping <b>',
    TELEGRAM_DRY_RUN: '1',
  });
  assert.equal(withTopic.status, 0, withTopic.stderr);
  assert.doesNotMatch(withTopic.stdout + withTopic.stderr, /test-token-value/);
  const body = JSON.parse(withTopic.stdout);
  assert.equal(body[0].message_thread_id, 42);
  assert.equal(body[0].parse_mode, 'HTML');
  assert.equal(body[0].disable_web_page_preview, true);
  assert.match(body[0].text, /Uji notifikasi/);
  assert.match(body[0].text, /ping &lt;b&gt;/);

  const badTopic = run({ ...repo, ref: 'refs/heads/main', commits: [] }, {
    GITHUB_EVENT_NAME: 'push',
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_CHAT_ID: '-1001234567890',
    TELEGRAM_TOPIC_ID: 'bukan-angka',
    TELEGRAM_DRY_RUN: '1',
  });
  assert.equal(badTopic.status, 0, badTopic.stderr);
  assert.match(badTopic.stdout, /chat umum/);
  const fallback = JSON.parse(badTopic.stdout.slice(badTopic.stdout.indexOf('[')));
  assert.equal(fallback[0].message_thread_id, undefined);
  assert.doesNotMatch(badTopic.stdout + badTopic.stderr, /test-token-value/);
});
