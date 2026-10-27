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

test('PRO TERMINAL 2.0 restores sporting identity without inventing data or confidence',()=>{
  const {html}=renderLiveTvFixture();
  assert.ok(html.includes('PRO TERMINAL'));
  assert.ok(html.includes('2.0'));
  assert.ok(html.includes('Panel de análisis'));
  assert.ok(html.includes('data-score-side="home"'));
  assert.ok(html.includes('data-score-side="away"'));
  assert.ok(html.includes('Confianza no evaluable'));
  assert.equal(html.includes('data-probability="estimated"'),false);
});


test('mobile uses a single accessible match rail and score before selection, with provider crests',()=>{
  const {html}=renderLiveTvFixture({logos:true});
  assert.equal((html.match(/aria-label="Marcador"/g)??[]).length,1);
  assert.ok(html.indexOf('aria-label="Marcador"')<html.indexOf('aria-label="Selector de partidos"'));
  assert.match(html,/role="region" aria-label="Partidos disponibles; desplaza para ver más" tabindex="0"/);
  assert.equal((html.match(/data-live-fixture-id=/g)??[]).length,23);
  assert.ok(html.includes('data:image/svg+xml,'));
});


test('unavailable reasons distinguish missing provider metrics from incompatible cache timestamps',()=>{
  const partial=renderLiveTvFixture({scenario:'partial'}).html;
  assert.ok(partial.includes('Sin datos:'));assert.ok(partial.includes('xG visitante'));
  const desync=renderLiveTvFixture({scenario:'desync'}).html;
  assert.ok(desync.includes('separadas por más de un minuto'));
  assert.equal(desync.includes('data-probability="estimated"'),false);
  assert.ok(desync.includes('0.8 - 0.8'));
  const absent=renderLiveTvFixture().html;
  assert.ok(absent.includes('no contiene datos de los equipos'));
  assert.ok(absent.includes('Sin datos / Sin datos'));
});
