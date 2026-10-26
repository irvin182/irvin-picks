import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const cli = process.env.IRVIN_REDIS_CLI, socket = process.env.IRVIN_REDIS_SOCKET;
const exec = promisify(execFile);
test('real isolated Redis: concurrent live refresh uses one gate and expired owners cannot publish', {skip: !cli || !socket}, async () => {
  const prefix = `irvin:test:live:${randomUUID()}:`;
  const translate = key => prefix + key.split(':').at(-1);
  async function command(...args) {
    const {stdout} = await exec(cli, ['-s', socket, '--raw', ...args.map(String)]);
    if (/^(ERR|WRONGTYPE|NOAUTH)/.test(stdout)) throw new Error('Local Redis command failed');
    return stdout.trim() || null;
  }
  const redis = {
    get: async key => {const value = await command('GET', translate(key)); return value?.startsWith('{') ? JSON.parse(value) : value;},
    set: (key, value, options) => command('SET', translate(key), value, ...(options.nx ? ['NX'] : []), 'EX', options.ex),
    eval: async (script, keys, args) => Number(await command('EVAL', script, keys.length, ...keys.map(translate), ...args)),
  };
  let now = Date.now(), calls = 0, fail = false;
  const Clock = class extends Date {static now() {return now;}};
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('lib/liveFixturesCache.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(source, {exports, Date: Clock, AbortSignal, require: name => ({
    'node:crypto': {randomUUID}, '@/lib/apiFootballRedis': {getApiFootballRedis: () => redis},
    '@/lib/apiFootballFetch': {apiFootballFetch: async () => {
      calls++; if (fail) throw new Error('unavailable');
      return Response.json({response: Array.from({length:calls === 1 ? 1 : 4}, (_, i) => ({fixture:{id:101+i}})), errors:[]});
    }},
  })[name]});
  const snapshotKey = 'irvin:api-football:live:v1:snapshot', gateKey = 'irvin:api-football:live:v1:refresh';
  try {
    await exports.readLiveFixtures();
    now += 300000; await command('DEL', translate(gateKey));
    await Promise.all(Array.from({length: 100}, () => exports.readLiveFixtures()));
    assert.equal(calls, 2);
    assert.equal((await exports.readLiveFixtures()).data.response.length, 4);
    assert.ok(Number(await command('TTL', translate(gateKey))) > 0);
    assert.equal(await redis.eval(exports.PUBLISH_LIVE_SCRIPT, [gateKey, snapshotKey], ['wrong-owner', '{}', 60]), 0);
    assert.equal((await redis.get(snapshotKey)).data.response.length, 4);
    now += 300000; await command('DEL', translate(gateKey)); fail = true;
    assert.equal((await exports.readLiveFixtures()).stale, true);
    await Promise.all(Array.from({length: 30}, () => exports.readLiveFixtures()));
    assert.equal(calls, 3); assert.equal((await redis.get(snapshotKey)).data.response.length, 4);
  } finally {await command('DEL', translate(snapshotKey), translate(gateKey));}
});
