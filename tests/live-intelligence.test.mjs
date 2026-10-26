import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, {exports});
  return exports;
}
const {calculateLivePoisson: predict} = load('lib/livePoisson.ts');
const {readLiveStat, liveValue} = load('lib/liveData.ts');
const basic = {homeScore:0,awayScore:0,minuteText:'65',status:'2H',fixtureAgeSeconds:0};
const complete = {...basic,homeShots:12,awayShots:8,homeShotsOn:5,awayShotsOn:3,homePossession:'55%',awayPossession:'45%',homeXg:1.5,awayXg:0.8,statisticsAgeSeconds:0};
const marketKeys = ['homeWin','draw','awayWin','over15','over25','over35','bttsYes','bttsNo','nextGoalHome','nextGoalDraw','nextGoalAway'];
const sums = result => {
  for (const keys of [['homeWin','draw','awayWin'],['bttsYes','bttsNo'],['nextGoalHome','nextGoalDraw','nextGoalAway']]) {
    assert.ok(Math.abs(keys.reduce((sum,key)=>sum+result[key],0)-100)<1e-8);
  }
};
test('missing statistics do not create zero shots, 50% possession or high confidence at minute 75', () => {
  const result=predict({...basic,minuteText:'75'});
  assert.equal(result.dataQuality,'básica');
  for(const key of marketKeys) assert.equal(result[key],null,key);
  assert.equal(result.confidence,null);assert.equal(result.irvinScore,null);
  assert.equal(readLiveStat([], 'Home', 'Total Shots'),null);
  assert.equal(readLiveStat([], 'Home', 'Ball Possession'),null);
  assert.equal(liveValue(null,'%'),'No disponible');
});
test('partial data are intermediate; missing xG or one team blocks predictions', () => {
  const partial=predict({...basic,homeShots:0,awayShots:0});
  assert.equal(partial.dataQuality,'intermedia');assert.equal(partial.homeWin,null);
  assert.ok(partial.missingMetrics.includes('homeXg'));
  for(const key of ['homeXg','awayXg','homeShotsOn','awayPossession']) {
    const result=predict({...complete,[key]:null});
    assert.equal(result.modelStatus,'no evaluable');assert.equal(result.confidence,null);
  }
});
test('provider zeros are preserved; null, empty, boolean, malformed and negative values stay absent', () => {
  for(const value of [null,undefined,'',' ','N/A','12%',false,-1,Infinity,NaN]) {
    assert.equal(readLiveStat([{team:{id:1},statistics:[{type:'Total Shots',value}]}],1,'Total Shots'),null);
  }
  assert.equal(readLiveStat([{team:{id:1},statistics:[{type:'Total Shots',value:0}]}],1,'Total Shots'),0);
  assert.equal(readLiveStat([{team:{id:1},statistics:[{type:'Ball Possession',value:'0%'}]}],1,'Ball Possession'),0);
  assert.equal(readLiveStat([{team:{id:1},statistics:[{type:'Total Shots',value:1.2}]}],1,'Total Shots'),null);
  assert.equal(readLiveStat([{team:{id:1,name:'United'},statistics:[{type:'Total Shots',value:0}]},{team:{id:2,name:'United'},statistics:[{type:'Total Shots',value:10}]}],2,'Total Shots'),10);
});
test('complete data produce coherent exploratory probabilities and never evaluated confidence', () => {
  const result=predict(complete);
  assert.equal(result.dataQuality,'avanzada');assert.equal(result.modelStatus,'estimación no calibrada');
  for(const key of marketKeys) assert.ok(Number.isFinite(result[key])&&result[key]>=0&&result[key]<=100,key);
  sums(result);
  assert.ok(result.over15>=result.over25 && result.over25>=result.over35);
  assert.equal(result.confidence,null);assert.equal(result.next10Card,null);assert.equal(result.next10Corner,null);
  const lambda=(1.5+0.8)/65*25;
  assert.ok(Math.abs(result.nextGoalDraw-100*Math.exp(-lambda))<=0.01);
  assert.ok(Math.abs(result.over15-100*(1-Math.exp(-lambda)*(1+lambda)))<=0.01);
});
test('already observed events are factual 100%, never heuristic 92% or capped 95%', () => {
  const result=predict({...basic,homeScore:2,awayScore:1});
  assert.equal(result.bttsYes,100);assert.equal(result.bttsNo,0);
  assert.equal(result.over15,100);assert.equal(result.over25,100);assert.equal(result.over35,null);
  assert.equal(result.homeWin,null);assert.equal(result.confidence,null);
  assert.ok(result.settled.includes('btts'));
});
test('unknown score, invalid minute, stale snapshots and unsupported periods are insufficient', () => {
  for(const patch of [{fixtureAgeSeconds:null},{fixtureAgeSeconds:301},{homeScore:null},{minuteText:'unknown'},{minuteText:'-3'},{stale:true},{status:'ET'},{status:'PEN'},{status:undefined},{status:'1H',minuteText:'65'},{status:'2H',minuteText:'20'}]) {
    const result=predict({...complete,...patch});
    assert.equal(result.dataQuality,'insuficiente'); assert.equal(result.homeWin,null);
  }
});
test('stale or unknown statistics and contradictory values cannot enable predictions', () => {
  for(const patch of [{statisticsAgeSeconds:null},{statisticsAgeSeconds:601},{statisticsAgeSeconds:61},{homeShots:0,homeShotsOn:0},{homeShotsOn:30},{awayPossession:'80%'}]) {
    const result=predict({...complete,...patch});
    assert.equal(result.dataQuality,'intermedia');assert.equal(result.homeWin,null);
  }
});
test('HT uses 45 minutes, first half is observed; FT reports facts; live added time is not invented', () => {
  const half=predict({...complete,homeScore:1,status:'HT',minuteText:'HT'});
  assert.equal(half.firstHalfHomeWin,100);
  const lambda=(1.5+0.8)/45*45;
  assert.ok(Math.abs(half.nextGoalDraw-100*Math.exp(-lambda))<=0.01);
  const final=predict({...basic,homeScore:2,awayScore:0,status:'FT',minuteText:'FT'});
  assert.deepEqual([final.homeWin,final.draw,final.awayWin],[100,0,0]);
  assert.equal(final.bttsYes,0);assert.equal(final.nextGoalDraw,100);assert.equal(final.modelStatus,'resultado observado');
  const late=predict({...complete,minuteText:'90'});
  assert.equal(late.homeWin,null);assert.equal(late.next10Goal,null);
  assert.equal(predict({...complete,minuteText:'5',status:'1H'}).homeWin,null);
});
test('zero xG is observed data but cannot assert a zero future scoring rate without a prior', () => {
  const result=predict({...complete,homeXg:0});
  assert.equal(result.dataQuality,'avanzada');assert.equal(result.homeWin,null);assert.equal(result.confidence,null);
  assert.equal(predict({...complete,minuteText:'15',status:'1H',homeXg:100,awayXg:100}).homeWin,null);
  assert.equal(predict({...complete,homeXg:Number.MIN_VALUE,awayXg:Number.MIN_VALUE}).homeWin,null);
});
test('probabilities normalize and preserve symmetry over a deterministic range of inputs', () => {
  for(const minute of [15,30,44,60,80,89]) for(const xg of [0.1,0.8,1.5]) for(const score of [0,1,3]) {
    const result=predict({...complete,minuteText:String(minute),status:minute<45?'1H':'2H',homeScore:score,awayScore:score,homeXg:xg,awayXg:xg});
    sums(result);
    assert.ok(Math.abs(result.homeWin-result.awayWin)<=0.01+1e-9);
    assert.ok(result.over15>=result.over25 && result.over25>=result.over35);
  }
});
