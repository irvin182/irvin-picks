import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { compareLiveTv } from '../scripts/diagnose-live-tv.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name in imports) return imports[name];
    if (name === 'react/jsx-runtime') return require(name);
    throw new Error(`Unexpected import ${name}`);
  }, Date, Response, AbortController, AbortSignal, console, ...globals });
  return exports;
}
// Synthetic fixtures are test inputs only; no external service is contacted.
const matches = ['1H', 'HT', '2H', 'ET'].map((half, index) => ({
  id: index + 101, half, minuteNumber: 30 + index, league: `League ${index}`,
  country: `Country ${index}`, home: `Home ${index}`, away: `Away ${index}`,
  homeScore: 0, awayScore: 0, homeFlag: '', awayFlag: '', apiUpdatedAt: Date.now(),
}));
function dashboard(selected = matches[0], fetch = async () => Response.json({statistics: [], events: []}), initialMatches = matches) {
  const values = [initialMatches, selected, [], [], false, null, Date.now(), null, '12:00:00', selected.id];
  const writes = [], effects = [];
  let index = 0;
  const component = load('components/ui/LiveTvDashboard.tsx', {
    react: {...React, useState: () => { const slot = index++; return [values[slot], value => { writes.push([slot, value]); values[slot] = typeof value === 'function' ? value(values[slot]) : value; }]; }, useEffect: fn => effects.push(fn)},
    '@/lib/livePoisson': {calculateLivePoisson: () => ({})},
  }, { fetch, setInterval: () => 1, clearInterval: () => {}, document: {visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {}} }).default;
  const render = () => { index = 0; effects.length = 0; return component(); };
  return {tree: render(), render, writes, effects};
}
function buttons(element) {
  if (!element || typeof element !== 'object') return [];
  const children = React.Children.toArray(element.props?.children);
  return [...(element.type === 'button' ? [element] : []), ...children.flatMap(buttons)];
}
test('Live TV renders all four leagues and states and selects each fixture independently', () => {
  for (const selected of matches) {
    const view = dashboard(selected);
    const list = buttons(view.tree);
    assert.equal(list.length, 4);
    assert.equal(list.filter(button => button.props['aria-pressed']).length, 1);
    list.forEach((button, index) => {
      button.props.onClick();
      if (matches[index].id !== selected.id) assert.equal(view.writes.at(-1)[1].id, matches[index].id);
    });
  }
});
test('detail requests use the selected ID; cleanup rejects a late response from the previous fixture', async () => {
  let resolve, url, signal;
  const pending = new Promise(done => { resolve = done; });
  const view = dashboard(matches[2], async (request, options) => { url = request; signal = options.signal; return pending; });
  const cleanup = view.effects[2]();
  assert.equal(url, '/api/fixture?id=103');
  cleanup();
  assert.equal(signal.aborted, true);
  resolve(Response.json({statistics: [{team: {name: 'Previous'}}], events: []}));
  await new Promise(done => setImmediate(done));
  assert.equal(view.writes.length, 0);
});
test('provider detail errors are displayed as unavailable, not valid statistics', async () => {
  const view = dashboard(matches[0], async () => Response.json({error: 'quota'}, {status: 503}));
  const cleanup = view.effects[2]();
  await new Promise(done => setImmediate(done));
  assert.ok(view.writes.some(([slot, value]) => slot === 7 && value.includes('no disponibles')));
  assert.ok(!view.writes.some(([slot]) => slot === 9));
  cleanup();
});
test('live route serves shared snapshots with freshness metadata and private headers', async () => {
  let calls = 0;
  const fixtures = matches.map(match => ({fixture: {id: match.id, status: {short: match.half}}, league: {name: match.league}}));
  const route = load('app/api/live/route.ts', {
    'next/server': {NextResponse: {json: (data, init) => Response.json(data, init)}},
    'next-auth/jwt': {getToken: async () => ({role: 'ADMIN'})},
    '@/lib/security': {rateLimit: () => ({ok: true}), getClientIp: () => 'local'},
    '@/lib/supabaseAdmin': {supabaseAdmin: {}},
    '@/lib/liveFixturesCache': {LIVE_POLL_SECONDS: 30, readLiveFixtures: async () => {
      calls++; return {data: {response: fixtures, results: 4, errors: []}, updatedAt: 1000, stale: true};
    }},
  }, {process: {env: {NEXTAUTH_SECRET: 'synthetic-test-only'}}});
  const result = await route.GET(new Request('https://local.invalid/api/live'));
  const payload = await result.json();
  assert.deepEqual(payload.response, fixtures);
  assert.equal(payload.cachedAt, 1000); assert.equal(payload.stale, true);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal(calls, 1);
});

test('live polling maps all returned fixtures and preserves the list on controlled errors', async () => {
  const fixtures = matches.map(match => ({fixture: {id: match.id, status: {short: match.half}}, teams: {home: {name: match.home}, away: {name: match.away}}}));
  const good = dashboard(matches[0], async url => {
    assert.equal(url, '/api/live');
    return Response.json({response: fixtures, cachedAt: Date.now()});
  });
  const stop = good.effects[1]();
  await new Promise(done => setImmediate(done));
  assert.deepEqual(Array.from(good.writes.find(([slot]) => slot === 0)[1], match => match.id), matches.map(match => match.id));
  stop();
  for (const payload of [{error: 'quota'}, {response: null}]) {
    const failed = dashboard(matches[0], async () => Response.json(payload));
    const stopFailed = failed.effects[1]();
    await new Promise(done => setImmediate(done));
    assert.equal(failed.writes.some(([slot]) => slot === 0), false);
    assert.ok(failed.writes.some(([slot, value]) => slot === 5 && value));
    stopFailed();
  }
});

test('rapid A-B-C-D-A selection never uses another fixture statistics, even with reversed responses', async () => {
  const games = matches.map(match => ({...match, home: 'Same home name'}));
  const values = [games, games[0], [], [], false, null, Date.now(), null, '12:00:00', null];
  const pending = [], effects = [];
  let slot = 0, effectSlot = 0, previousId, cleanup, predictionInput;
  const component = load('components/ui/LiveTvDashboard.tsx', {
    react: {...React,
      useState: () => { const key = slot++; return [values[key], value => {values[key] = typeof value === 'function' ? value(values[key]) : value;}]; },
      useEffect: fn => {effects[effectSlot++] = fn;},
    },
    '@/lib/livePoisson': {calculateLivePoisson: input => {predictionInput = input; return {};}},
  }, {fetch: (url, options) => new Promise(resolve => pending.push({url, signal: options.signal, resolve})),
    setInterval: () => 1, clearInterval: () => {}, document: {visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {}}}).default;
  function render() {
    slot = 0; effectSlot = 0;
    const tree = component();
    if (previousId !== values[1].id) {
      cleanup?.(); previousId = values[1].id; cleanup = effects[2]();
    }
    return tree;
  }
  const settle = async (request, shots) => {
    request.resolve(Response.json({statistics: [{team: {name: 'Same home name'}, statistics: [{type: 'Total Shots', value: shots}]}], events: []}));
    await new Promise(done => setImmediate(done));
    render();
  };
  let tree = render();
  await settle(pending[0], 17);
  assert.equal(predictionInput.homeShots, 17);
  // Mimic an automatic fallback after a live list update: ID gating must work even without a click clearing stats.
  values[1] = games[1]; tree = render();
  assert.equal(predictionInput.homeShots, 0);
  for (const index of [2, 3, 0]) {
    buttons(tree)[index].props.onClick(); tree = render();
    assert.equal(predictionInput.homeShots, 0);
  }
  assert.deepEqual(pending.map(request => request.url), [101,102,103,104,101].map(id => `/api/fixture?id=${id}`));
  for (const request of pending.slice(1, -1).reverse()) {
    assert.equal(request.signal.aborted, true);
    await settle(request, 99);
    assert.equal(predictionInput.homeShots, 0);
  }
  await settle(pending.at(-1), 11);
  assert.equal(predictionInput.homeShots, 11);
  assert.equal(values[9], 101);
  cleanup();
});

test('the four received IDs exactly match rendered IDs after replacing an older one-match list', async () => {
  const payload = {response: matches.map(match => ({fixture: {id: match.id, status: {short: match.half}},
    league: {name: match.league, country: match.country}, teams: {home: {name: match.home}, away: {name: match.away}}})), cachedAt: Date.now()};
  const view = dashboard(matches[0], async () => Response.json(payload), [matches[0]]);
  assert.equal(buttons(view.tree).length, 1);
  const stop = view.effects[1]();
  await new Promise(resolve => setImmediate(resolve));
  const tree = view.render();
  const renderedIds = buttons(tree).map(button => button.props['data-live-fixture-id']);
  const diagnosis = compareLiveTv(payload, renderedIds);
  assert.equal(diagnosis.exactMatch, true);
  assert.equal(diagnosis.receivedIds.length, 4);
  assert.equal(diagnosis.renderedIds.length, 4);
  assert.deepEqual(diagnosis.missingIds, []);
  for (let index = 0; index < 4; index++) {
    buttons(view.render())[index].props.onClick();
    const selected = buttons(view.render()).filter(button => button.props['aria-pressed']);
    assert.deepEqual(selected.map(button => button.props['data-live-fixture-id']), [matches[index].id]);
  }
  stop();
});

test('browser checks shared cache every 30 seconds without overlapping requests and refreshes on visibility', async () => {
  const effects = [], writes = [], timers = [], listeners = new Map(), requests = [];
  const values = [matches, matches[0], [], [], false, null, Date.now(), null, '12:00:00', 101];
  let index = 0;
  const document = {visibilityState: 'visible', addEventListener: (event, fn) => listeners.set(event, fn),
    removeEventListener: event => listeners.delete(event)};
  const component = load('components/ui/LiveTvDashboard.tsx', {
    react: {...React, useState: () => {const slot = index++; return [values[slot], value => writes.push([slot, value])];}, useEffect: fn => effects.push(fn)},
    '@/lib/livePoisson': {calculateLivePoisson: () => ({})},
  }, {document, fetch: url => new Promise(resolve => requests.push({url, resolve})),
    setInterval: (fn, ms) => {timers.push({fn, ms}); return 1;}, clearInterval: () => {}}).default;
  component();
  const stop = effects[1]();
  assert.equal(timers[0].ms, 30000); assert.equal(requests.length, 1);
  timers[0].fn(); timers[0].fn(); assert.equal(requests.length, 1);
  requests[0].resolve(Response.json({response: [], cachedAt: Date.now(), stale: true}));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(writes.some(([slot, value]) => slot === 5 && value?.includes('última captura válida')));
  document.visibilityState = 'hidden'; timers[0].fn(); assert.equal(requests.length, 1);
  document.visibilityState = 'visible'; listeners.get('visibilitychange')(); assert.equal(requests.length, 2);
  stop(); assert.equal(listeners.size, 0);
  const writeCount = writes.length;
  requests[1].resolve(Response.json({response: [], cachedAt: Date.now()}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, writeCount);
});
