import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildMessage,
  buildNotification,
  jakartaTime,
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
  assert.match(text, /<b>Solana OS Update<\/b> #push/);
  assert.match(text, /╭─ Repository Updated \(Push\) ─╮/);
  assert.match(text, /├ Repo <a href="https:\/\/github.com\/ponkssol\/Solana-OS">ponkssol\/Solana-OS<\/a>/);
  assert.match(text, /<code>main<\/code>/);
  assert.match(text, /Pushed by/);
  assert.match(text, /nanda/);
  assert.match(text, /▸ Message/);
  assert.match(text, /<pre>[\s\S]*&lt;b&gt;baru&lt;\/b&gt; &amp; co/);
  assert.doesNotMatch(text, /<b>baru<\/b>/);
  assert.match(text, /▸ Commits \(7\)/);
  assert.match(text, /and 2 more/);
  assert.match(text, /╰─/);
  assert.ok(text.indexOf('abcdef6') < text.indexOf('abcdef2'));
  assert.doesNotMatch(text, /abcdef0/);
  const note = buildNotification('push', {
    ...repo,
    ref: 'refs/heads/main',
    compare: 'https://github.com/ponkssol/Solana-OS/compare/a...b',
    head_commit: {
      id: 'abcdef6' + '0'.repeat(32),
      message: 'head',
      url: 'https://github.com/ponkssol/Solana-OS/commit/abcdef6',
      timestamp: '2026-10-03T09:51:51Z',
      author: { name: 'Nanda', email: 'nanda@example.com' },
    },
    commits,
  }, { runId: '31', runNumber: '31' });
  assert.match(note.text, /2026-10-03 16:51:51 \+07:00/);
  assert.match(note.text, /Author Nanda &lt;nanda@example.com&gt;/);
  assert.deepEqual(note.buttons.map((button) => button.text), ['Compare', 'Action #31', 'Commit']);
  assert.equal(note.buttons[1].url, 'https://github.com/ponkssol/Solana-OS/actions/runs/31');
});

test('pull request messages include stats, files, commits, and review state', () => {
  const files = Array.from({ length: 16 }, (_, i) => ({
    filename: `src/f${i}.ts`,
    additions: i + 1,
    deletions: 1,
  }));
  const pr = buildMessage('pull_request', {
    ...repo,
    action: 'closed',
    pull_request: {
      number: 12,
      title: 'Fix <vault>',
      html_url: 'https://github.com/ponkssol/Solana-OS/pull/12',
      body: '## Hello\n\n`code` and [docs](https://example.com) <b>nope</b>',
      merged: true,
      draft: false,
      user: { login: 'author', html_url: 'https://github.com/author' },
      merged_by: { login: 'merger', html_url: 'https://github.com/merger' },
      merge_commit_sha: 'deadbeefcafebabe',
      head: { ref: 'cursor/fix', sha: 'abc' },
      base: { ref: 'main' },
      labels: [{ name: 'bug' }, { name: 'ui' }],
      assignees: [{ login: 'nanda' }],
      requested_reviewers: [{ login: 'qa' }],
      commits: 6,
      changed_files: 16,
      additions: 40,
      deletions: 3,
    },
  }, {
    files,
    commits: [{ id: 'abc1234fff', message: 'newest line', url: 'https://github.com/ponkssol/Solana-OS/commit/abc1234fff' }],
    checks: { passed: 2, failed: 1, pending: 0, failedNames: ['CI'] },
  });
  assert.match(pr, /<b>Solana OS Update<\/b> #pr/);
  assert.match(pr, /╭─ Pull Request Merged ─╮/);
  assert.match(pr, /#12/);
  assert.match(pr, /Fix &lt;vault&gt;/);
  assert.match(pr, /Author <a href="https:\/\/github.com\/author">author<\/a>/);
  assert.match(pr, /cursor\/fix/);
  assert.match(pr, /→ <a href="https:\/\/github.com\/ponkssol\/Solana-OS\/tree\/main">main<\/a>/);
  assert.match(pr, /Draft no/);
  assert.match(pr, /Labels bug, ui/);
  assert.match(pr, /Assignees nanda/);
  assert.match(pr, /Reviewers qa/);
  assert.match(pr, /<pre>Hello code and docs nope<\/pre>/);
  assert.doesNotMatch(pr, /<b>nope<\/b>/);
  assert.match(pr, /Changes 6 commits · 16 files · \+40 −3/);
  assert.match(pr, /▸ Files \(16\)/);
  assert.match(pr, /src\/f0\.ts \+1 −1/);
  assert.match(pr, /and 1 more/);
  assert.doesNotMatch(pr, /src\/f15\.ts/);
  assert.match(pr, /abc1234<\/a> newest line/);
  assert.match(pr, /Merged by <a href="https:\/\/github.com\/merger">merger<\/a>/);
  assert.match(pr, /Merge commit <a href="https:\/\/github.com\/ponkssol\/Solana-OS\/commit\/deadbeefcafebabe">deadbee<\/a>/);
  assert.match(pr, /▸ Checks/);
  assert.match(pr, /2 passed, 1 failed, 0 pending/);
  assert.match(pr, /CI failed/);
  assert.deepEqual(buildNotification('pull_request', {
    ...repo,
    action: 'closed',
    pull_request: {
      number: 12,
      title: 'Fix',
      html_url: 'https://github.com/ponkssol/Solana-OS/pull/12',
      merged: true,
      user: { login: 'author' },
      head: { ref: 'feat' },
      base: { ref: 'main' },
    },
  }).buttons.map((button) => button.text), ['View PR', 'Files', 'Checks']);

  const sync = buildMessage('pull_request', {
    ...repo,
    action: 'synchronize',
    pull_request: {
      number: 3,
      title: 'More commits',
      html_url: 'https://github.com/ponkssol/Solana-OS/pull/3',
      commits: 8,
      user: { login: 'author' },
      head: { ref: 'feat' },
      base: { ref: 'main' },
    },
  }, {
    commits: [{ id: 'aaa1111', message: 'newest', url: 'https://github.com/ponkssol/Solana-OS/commit/aaa1111' }],
  });
  assert.match(sync, /Pull Request Updated/);
  assert.match(sync, /aaa1111/);
  assert.match(sync, /and 7 more/);

  const review = buildMessage('pull_request_review', {
    ...repo,
    action: 'submitted',
    review: {
      state: 'changes_requested',
      body: 'Please **fix** <b>ok</b>',
      html_url: 'https://github.com/ponkssol/Solana-OS/pull/3#pullrequestreview-1',
      user: { login: 'reviewer', html_url: 'https://github.com/reviewer' },
    },
    pull_request: {
      number: 3,
      title: 'More commits',
      html_url: 'https://github.com/ponkssol/Solana-OS/pull/3',
      user: { login: 'author' },
      head: { ref: 'feat' },
      base: { ref: 'main' },
    },
  });
  assert.match(review, /#review/);
  assert.match(review, /Review Submitted/);
  assert.match(review, /Reviewer <a href="https:\/\/github.com\/reviewer">reviewer<\/a>/);
  assert.match(review, /Review changes requested/);
  assert.match(review, /<pre>Please fix ok<\/pre>/);
});

test('other events stay short and in English', () => {
  const issue = buildMessage('issues', {
    ...repo,
    action: 'opened',
    issue: { number: 9, title: 'Boot loop', html_url: 'https://github.com/ponkssol/Solana-OS/issues/9' },
  });
  assert.match(issue, /Issue Opened/);
  assert.match(issue, /#9/);

  const comment = buildMessage('issue_comment', {
    ...repo,
    action: 'created',
    issue: { number: 9, title: 'Boot loop', html_url: 'https://github.com/ponkssol/Solana-OS/issues/9' },
    comment: { body: 'see <script>', html_url: 'https://github.com/ponkssol/Solana-OS/issues/9#issuecomment-1' },
  });
  assert.match(comment, /Issue Comment/);
  assert.match(comment, /see &lt;script&gt;/);

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
  assert.match(release, /#release/);
  assert.match(release, /Prerelease Published/);
  assert.match(release, /v1\.0\.0-alpha\.2/);
  assert.match(release, /Solana-OS-setup\.exe/);
  assert.deepEqual(buildNotification('release', {
    ...repo,
    release: {
      name: 'Solana OS v1',
      tag_name: 'v1.0.0-alpha.2',
      html_url: 'https://github.com/ponkssol/Solana-OS/releases/tag/v1.0.0-alpha.2',
      assets: [
        { name: 'Solana-OS-setup.exe', browser_download_url: 'https://example.com/setup.exe' },
        { name: 'Solana-OS-setup.msi', browser_download_url: 'https://example.com/setup.msi' },
      ],
    },
  }).buttons.map((button) => button.text), ['Release', 'Download .exe', 'Download .msi']);

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
  assert.match(run, /#workflow/);
  assert.match(run, /Workflow Failed/);
  assert.match(run, /Security audit/);
  assert.match(run, /Result failed/);
  assert.match(run, /actions\/runs\/9/);
  assert.deepEqual(buildNotification('workflow_run', {
    ...repo,
    workflow_run: {
      id: 9,
      name: 'CI',
      conclusion: 'success',
      head_branch: 'main',
      html_url: 'https://github.com/ponkssol/Solana-OS/actions/runs/9',
    },
  }).buttons.map((button) => [button.text, button.url]), [
    ['Run', 'https://github.com/ponkssol/Solana-OS/actions/runs/9'],
    ['Logs', 'https://github.com/ponkssol/Solana-OS/actions/runs/9/logs'],
  ]);

  assert.match(buildMessage('create', { ...repo, ref: 'feat', ref_type: 'branch' }), /Branch Created/);
  assert.match(buildMessage('delete', { ...repo, ref: 'v1', ref_type: 'tag' }), /Tag Deleted/);
  assert.match(buildMessage('workflow_dispatch', repo, { note: 'hello <b>' }), /Notification Test/);
  assert.match(buildMessage('workflow_dispatch', repo, { note: 'hello <b>' }), /hello &lt;b&gt;/);
});

test('Jakarta time is YYYY-MM-DD HH:MM:SS +07:00', () => {
  assert.equal(jakartaTime('2026-10-03T09:51:51Z'), '2026-10-03 16:51:51 +07:00');
});

test('split keeps pre blocks closed and buttons belong on the last chunk', () => {
  const text = `<b>Solana OS Update</b> #push\n<pre>${'a'.repeat(5000)}</pre>\n╰──╯`;
  const parts = splitMessage(text);
  assert.ok(parts.length > 1);
  for (const part of parts) {
    assert.ok(part.length <= 4096);
    const opens = (part.match(/<pre>/g) || []).length;
    const closes = (part.match(/<\/pre>/g) || []).length;
    assert.equal(opens, closes);
    assert.ok(part.lastIndexOf('<') <= part.lastIndexOf('>'));
  }
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
  assert.equal(skipReason('push', { deleted: true }), 'branch delete push');
  assert.equal(skipReason('workflow_run', {
    workflow_run: { name: 'Telegram notify', conclusion: 'success', path: '.github/workflows/telegram-notify.yml' },
  }), 'own workflow');
  assert.equal(skipReason('workflow_run', {
    workflow_run: { name: 'CI', conclusion: 'cancelled', path: '.github/workflows/ci.yml' },
  }), 'conclusion cancelled');
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
  assert.match(result.stdout, /TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID/);
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
  assert.match(body[0].text, /Notification Test/);
  assert.match(body[0].text, /ping &lt;b&gt;/);

  const badTopic = run({ ...repo, ref: 'refs/heads/main', commits: [] }, {
    GITHUB_EVENT_NAME: 'push',
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_CHAT_ID: '-1001234567890',
    TELEGRAM_TOPIC_ID: 'not-a-number',
    TELEGRAM_DRY_RUN: '1',
  });
  assert.equal(badTopic.status, 0, badTopic.stderr);
  assert.match(badTopic.stdout, /general chat/);
  const fallback = JSON.parse(badTopic.stdout.slice(badTopic.stdout.indexOf('[')));
  assert.equal(fallback[0].message_thread_id, undefined);
  assert.doesNotMatch(badTopic.stdout + badTopic.stderr, /test-token-value/);
});
