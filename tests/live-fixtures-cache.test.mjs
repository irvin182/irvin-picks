import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness() {
  let now = 1000000, calls = 0, fail = false, offline = false, malformed = false, finish;
  const entries = new Map();
  const get = key => {
    const entry = entries.get(key);
    return entry && entry.expires > now ? entry.value : null;
  };
  const redis = {
    get: async key => {if (offline) throw new Error('Redis offline'); return get(key);},
    set: async (key, value, options) => {
      if (offline) throw new Error('Redis offline');
      if (options.nx && get(key) !== null) return null;
      entries.set(key, {value, expires: now + options.ex * 1000}); return 'OK';
    },
    eval: async (_script, keys, args) => {
      if (offline) throw new Error('Redis offline');
      if (get(keys[0]) !== args[0]) return 0;
      entries.set(keys[1], {value: JSON.parse(args[1]), expires: now + args[2] * 1000}); return 1;
    },
  };
  const exports = {};
  const Clock = class extends Date { static now() { return now; } };
  const source = ts.transpileModule(fs.readFileSync('lib/liveFixturesCache.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  let owner = 0, pause = false;
  vm.runInNewContext(source, {exports, Date: Clock, AbortSignal, require: name => ({
    'node:crypto': {randomUUID: () => `owner-${++owner}`},
    '@/lib/apiFootballRedis': {getApiFootballRedis: () => redis},
    '@/lib/apiFootballFetch': {apiFootballFetch: async url => {
      assert.equal(url, 'https://v3.football.api-sports.io/fixtures?live=all'); calls++;
      if (pause) await new Promise(resolve => {finish = resolve;});
      if (fail) throw new Error('quota or provider unavailable');
      return Response.json(malformed ? {errors: {quota: 'exhausted'}, response: []} : {
        response: Array.from({length: calls === 1 ? 1 : 4}, (_, i) => ({fixture: {id: i + 101}})), errors: [],
      });
    }},
  })[name]});
  return {read: exports.readLiveFixtures, entries, get calls(){return calls;},
    advance: seconds => {now += seconds * 1000;}, fail: () => {fail = true;}, recover: () => {fail = false; malformed = false;},
    offline: () => {offline = true;}, malformed: () => {malformed = true;}, pause: () => {pause = true;},
    resume: () => {pause = false; finish();},
  };
}

test('100 readers share one refresh; new fixtures are returned immediately at expiry without a Next stale cycle', async () => {
  const h = harness();
  assert.equal((await h.read()).data.response.length, 1);
  h.advance(299);
  const cached = await Promise.all(Array.from({length: 100}, h.read));
  assert.ok(cached.every(value => !value.stale && value.data.response.length === 1)); assert.equal(h.calls, 1);
  h.advance(1);
  const refreshed = await Promise.all(Array.from({length: 100}, h.read));
  assert.equal(h.calls, 2);
  assert.ok(refreshed.some(value => !value.stale && value.data.response.length === 4));
  assert.equal((await h.read()).data.response.length, 4);
  assert.equal(h.calls, 2);
});

test('failed refresh preserves good data with a stale flag and a full five-minute retry gate', async () => {
  const h = harness();
  const first = await h.read();
  h.advance(300); h.fail();
  const stale = await h.read();
  assert.equal(stale.stale, true); assert.equal(stale.updatedAt, first.updatedAt);
  assert.equal(stale.data.response.length, 1); assert.equal(h.calls, 2);
  await Promise.all(Array.from({length: 100}, h.read)); assert.equal(h.calls, 2);
  h.advance(299); await h.read(); assert.equal(h.calls, 2);
  h.advance(1); h.recover();
  assert.equal((await h.read()).data.response.length, 4); assert.equal(h.calls, 3);
});

test('cold errors and malformed provider envelopes never become cached match data or cause per-user retries', async () => {
  const h = harness(); h.malformed();
  await assert.rejects(h.read());
  for (let i = 0; i < 10; i++) await assert.rejects(h.read());
  assert.equal(h.calls, 1);
  assert.equal([...h.entries.keys()].some(key => key.endsWith('snapshot')), false);
  h.advance(300); h.recover();
  assert.equal((await h.read()).data.response.length, 4);
});

test('Redis failure closes access to the provider; a cold concurrent reader cannot bypass the shared gate', async () => {
  const offline = harness(); offline.offline(); await assert.rejects(offline.read()); assert.equal(offline.calls, 0);
  const h = harness(); h.pause();
  const owner = h.read(); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(h.read()); assert.equal(h.calls, 1);
  h.resume(); await owner;
  assert.equal((await h.read()).stale, false); assert.equal(h.calls, 1);
});

test('continuous multi-user polling does not exceed 288 live provider attempts per UTC-sized 24-hour period', async () => {
  const h = harness();
  for (let seconds = 0; seconds < 86400; seconds += 30) {
    await Promise.allSettled(Array.from({length: 3}, h.read)); h.advance(30);
  }
  assert.equal(h.calls, 288);
});
