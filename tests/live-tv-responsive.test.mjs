import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLiveTvFixture } from './helpers/live-tv-render.mjs';

test('responsive UI retains all 23 selectable fixture IDs, including very long names',()=>{
  const {html,ids}=renderLiveTvFixture();
  const rendered=Array.from(html.matchAll(/data-live-fixture-id="(\d+)"/g),match=>Number(match[1]));
  assert.deepEqual(rendered,ids);
  assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1);
});
test('methodology is collapsed by default; warnings and confidence are still accessible',()=>{
  const {html}=renderLiveTvFixture();
  assert.match(html,/<details class="methodology"><summary>Cómo interpretar el análisis<\/summary>/);
  assert.equal(/<details[^>]*\bopen\b/.test(html),false);
  assert.ok(html.includes('Confianza no evaluable'));
  assert.ok(html.includes('SIN RECOMENDACIÓN VALIDADA'));
  const complete=renderLiveTvFixture({scenario:'complete'}).html;
  const methodologicalText=complete.indexOf('Supone independencia');
  assert.ok(methodologicalText>complete.indexOf('<details'));
  assert.ok(methodologicalText<complete.indexOf('</details>'));
});
test('probability cards distinguish unavailable data, observed facts and uncalibrated estimates',()=>{
  const absent=renderLiveTvFixture({scenario:'missing'}).html;
  assert.ok(absent.includes('data-probability="missing"'));
  assert.equal(absent.includes('data-probability="estimated"'),false);
  assert.equal(absent.includes('null%'),false); assert.equal(absent.includes('undefined%'),false);
  const known=renderLiveTvFixture({scenario:'known'}).html;
  assert.ok(known.includes('data-probability="observed"'));
  assert.ok(known.includes('100%'));
  const complete=renderLiveTvFixture({scenario:'complete'}).html;
  assert.ok(complete.includes('data-probability="estimated"'));
  assert.ok(complete.includes('Estimación'));
  assert.ok(complete.includes('estimación no calibrada'));
});
