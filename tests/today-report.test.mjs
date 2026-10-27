import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportHarness,syntheticDay} from './helpers/today-report-harness.mjs';
const small=()=>syntheticDay().slice(0,3);
test('report mounts only the requested print version and keeps all analysed matches in both print layouts',async()=>{
 const h=createReportHarness({fixtures:small()});await h.buttons('Iniciar análisis')[0].props.onClick();
 assert.equal(h.nodes().filter(n=>n.type==='table').length,0);
 assert.equal(h.html().includes('pdf-header'),false);assert.equal(h.html().includes('PDF en vivo —'),false);
 h.values[0]='analysis';assert.equal(h.nodes().filter(n=>n.type==='table').length,3);
 assert.equal(h.nodes().filter(n=>n.type==='tr'&&String(n.key).startsWith('pdf-row-')).length,3);
 h.values[0]='live';assert.equal(h.nodes().filter(n=>String(n.key).startsWith('live-card-')).length,3);
 assert.equal(h.nodes().filter(n=>n.type==='table').length,0);
});
test('new calculations remain sequential with 1200 ms pacing; warm calculations yield without that delay',async()=>{
 let active=0,maxActive=0;const h=createReportHarness({fixtures:small(),compute:async()=>{active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;return {lambdaHome:1.4,lambdaAway:0.9,meta:{source:'synthetic-test'}};}});
 await h.buttons('Iniciar análisis')[0].props.onClick();assert.equal(maxActive,1);assert.equal(h.delays.filter(d=>d===1200).length,3);
 const before=h.delays.length;h.remount();await h.buttons('Iniciar análisis')[0].props.onClick();assert.equal(h.computeIds.length,3);assert.equal(h.delays.slice(before).includes(1200),false);assert.equal(h.delays.slice(before).filter(d=>d===0).length,3);
});
test('rapid duplicate part clicks share the in-flight guard without a duplicate calculation',async()=>{
 let finish;const h=createReportHarness({fixtures:small().slice(0,1),compute:()=>new Promise(resolve=>{finish=()=>resolve({lambdaHome:1.4,lambdaAway:0.9,meta:{source:'synthetic-test'}});})});
 const click=h.buttons('Generar informe de esta parte')[0].props.onClick;const first=click();await click();assert.equal(h.computeIds.length,1);finish();await first;
 assert.equal(h.values[5]['1-0'].rows.length,1);await h.buttons('Generar informe de esta parte')[0].props.onClick();assert.equal(h.computeIds.length,1);
});
test('league filtering and individual part generation calculate only requested fixtures',async()=>{
 const fixtures=syntheticDay();const h=createReportHarness({fixtures});h.values[6]='Liga 001';await h.buttons('Iniciar análisis')[0].props.onClick();assert.deepEqual(h.computeIds,fixtures.filter(f=>f.league.id===1).map(f=>f.fixture.id));
 const single=createReportHarness({fixtures:fixtures.slice(0,12).map(f=>({...f,league:fixtures[0].league}))});await single.buttons('Generar informe de esta parte')[1].props.onClick();assert.deepEqual(single.computeIds,fixtures.slice(10,12).map(f=>f.fixture.id));
});
test('PDF export includes the original columns, rows, percentages and filename without further calculations',async()=>{
 const h=createReportHarness({fixtures:small()});await h.buttons('Iniciar análisis')[0].props.onClick();const ids=[...h.computeIds];h.buttons('Descargar PDF')[0].props.onClick();
 assert.deepEqual(h.computeIds,ids);assert.equal(h.pdfs[0].name,'Irvin_Analytics_2026-10-27.pdf');assert.ok(h.pdfs[0].bytes>0);assert.equal(h.tables.length,3);assert.equal(h.tables.reduce((n,t)=>n+t.body.length,0),3);
 assert.deepEqual(h.tables[0].head[0],['Hora','Partido','Pick','1','X','2','O1.5','O2.5','O3.5','BTTS','goles Esp','Score']);
 const row=h.values[5]['1-0'].rows[0];const table=h.tables[0].body[0];assert.equal(table[3],(row.pH*100).toFixed(1)+'%');assert.equal(table[8],(row.pOver35*100).toFixed(1)+'%');assert.equal(table[9],(row.pBTTS*100).toFixed(1)+'%');assert.equal(table.length,12);
});

test('invalid cached calculation results cannot bypass pacing when a calculation is needed again',async()=>{
 const h=createReportHarness({fixtures:small().slice(0,1),compute:async()=>null});
 await h.buttons('Iniciar análisis')[0].props.onClick();h.remount();const start=h.delays.length;await h.buttons('Iniciar análisis')[0].props.onClick();
 assert.equal(h.computeIds.length,2);assert.equal(h.delays.slice(start).filter(d=>d===1200).length,1);
});

test('already completed omitted parts are skipped without depending on a selection rule',async()=>{
 const fixtures=small();
 const parts=Object.fromEntries(fixtures.map(f=>[`${f.league.id}-0`,{loading:false,rows:[],omitted:[{name:`${f.teams.home.name} vs ${f.teams.away.name}`,league:f.league.name}]}]));
 const h=createReportHarness({fixtures,parts,compute:async()=>{throw Error('Completed parts must not be computed again');}});
 await h.buttons('Iniciar análisis')[0].props.onClick();
 assert.equal(h.values[7].total,0);assert.equal(h.computeIds.length,0);assert.equal(h.delays.length,0);
 assert.deepEqual(h.values[5],parts);
});
