import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.QUICKNODE_RPC_URL ||= 'https://example.invalid/';
const { checkCall, takeTokens } = await import('./server.mjs');

test('allows the methods the app uses', () => {
  for (const method of ['getBalance', 'getLatestBlockhash', 'simulateTransaction', 'sendTransaction',
    'getTokenAccountsByOwner', 'getSignaturesForAddress', 'getHealth', 'getSlot']) {
    assert.equal(checkCall({ method, params: [] }), null, method);
  }
});

test('rejects unknown methods and unfiltered program scans', () => {
  assert.match(checkCall({ method: 'requestAirdrop' }), /not allowed/);
  assert.match(checkCall({ method: 'getProgramAccounts', params: ['Tokenkeg'] }), /filter/);
  assert.equal(checkCall({ method: 'getProgramAccounts', params: ['x', { filters: [{ dataSize: 165 }] }] }), null);
  assert.match(checkCall(null), /Invalid/);
});

test('rate limits per IP', () => {
  const now = 1_000_000;
  let ok = 0;
  for (let i = 0; i < 100; i += 1) if (takeTokens('1.2.3.4', 1, now)) ok += 1;
  assert.equal(ok, 40);
  assert.equal(takeTokens('5.6.7.8', 1, now), true);
  assert.equal(takeTokens('1.2.3.4', 1, now + 1000), true);
});
