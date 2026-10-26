import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { compareLiveTv } from '../scripts/diagnose-live-tv.mjs';
const require = createRequire(import.meta.url);
// Exercise the installed Next implementation, with isolated in-memory storage and a controlled clock.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const {unstable_cache} = require('next/dist/server/web/spec-extension/unstable-cache.js');
const {workAsyncStorage} = require('next/dist/server/app-render/work-async-storage.external.js');

test('installed Next cache can return one stale fixture while four refresh in the background', async () => {
  let now = 0, entry, storedAt, calls = 0, finish;
  const incrementalCache = {
    generateCacheKey: async key => key,
    get: async () => entry ? {value: entry, isStale: now - storedAt >= 300000} : null,
    set: async (_key, value) => {entry = value; storedAt = now;},
  };
  const read = unstable_cache(async () => {
    calls++;
    if (calls === 1) return {ids: [101], cachedAt: now};
    await new Promise(resolve => { finish = resolve; });
    return {ids: [101, 102, 103, 104], cachedAt: now};
  }, ['local-live-cache-test'], {revalidate: 300});
  const request = async () => {
    const store = {incrementalCache, isStaticGeneration: false};
    const data = await workAsyncStorage.run(store, read);
    await new Promise(resolve => setImmediate(resolve));
    return {data, pending: Object.values(store.pendingRevalidates ?? {})};
  };
  assert.deepEqual((await request()).data.ids, [101]);
  now = 299000;
  assert.deepEqual((await request()).data.ids, [101]); assert.equal(calls, 1);
  now = 301000;
  const stale = await request();
  assert.deepEqual(stale.data.ids, [101]); assert.equal(calls, 2);
  finish(); await Promise.all(stale.pending);
  // The screen still holds the stale response until its next five-minute polling tick.
  now = 601000;
  const fresh = await request();
  assert.deepEqual(fresh.data.ids, [101, 102, 103, 104]);
  // A refresh may already be due again; finish any pending work before leaving the test.
  if (fresh.pending.length) { finish(); await Promise.all(fresh.pending); }
});

test('offline diagnostic identifies exact matches, omissions, unexpected and duplicate IDs and stale snapshots', () => {
  const payload = {response: [101,102,103,104].map(id => ({fixture: {id}})), cachedAt: 1000};
  assert.equal(compareLiveTv(payload, [104,103,102,101], 2000).exactMatch, true);
  const missing = compareLiveTv(payload, [101], 302000);
  assert.deepEqual(missing.missingIds, [102,103,104]);
  assert.equal(missing.revalidationDue, true);
  assert.equal(missing.cacheAgeSeconds, 301);
  const invalid = compareLiveTv(payload, [101,101,999], 2000);
  assert.deepEqual(invalid.duplicateRenderedIds, [101]);
  assert.deepEqual(invalid.unexpectedIds, [999]);
  assert.equal(invalid.exactMatch, false);
  assert.equal(compareLiveTv({response: []}, [], 2000).cacheAgeSeconds, null);
  assert.throws(() => compareLiveTv({error: 'quota', response: []}, []));
  assert.throws(() => compareLiveTv({response: [{fixture: {id: null}}]}, []));
});
