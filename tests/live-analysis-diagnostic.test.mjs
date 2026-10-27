import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseLiveAnalysis} from '../scripts/diagnose-live-analysis.mjs';
const now=1800000000000;
const live={cachedAt:now,response:[{fixture:{id:123,status:{short:'2H',elapsed:65}},teams:{home:{id:1},away:{id:2}},goals:{home:0,away:0}}]};
const stats=[1,2].map(id=>({team:{id},statistics:[{type:'Total Shots',value:10},{type:'Shots on Goal',value:4},{type:'Ball Possession',value:'50%'},{type:'expected_goals',value:'0.8'}]}));
const details={fixtureId:123,cachedAt:now,statistics:stats,events:[]};
test('offline analysis distinguishes absent provider coverage from cache mismatch using the unchanged real model',()=>{
 const absent=diagnoseLiveAnalysis(live,{...details,statistics:[]},123,now);
 assert.equal(absent.analysis.dataQuality,'básica');assert.equal(absent.input.homeXg,null);
 const mismatched=diagnoseLiveAnalysis(live,{...details,cachedAt:now-300000},123,now);
 assert.equal(mismatched.input.homeXg,0.8);assert.equal(mismatched.analysis.missingMetrics.length,0);assert.equal(mismatched.analysis.homeWin,null);
 assert.ok(mismatched.analysis.issues.some(issue=>issue.includes('separadas')));
});
test('offline diagnosis uses real team IDs, preserves legitimate zero and rejects another fixture or errors',()=>{
 const result=diagnoseLiveAnalysis(live,details,123,now);
 assert.equal(result.input.homeScore,0);assert.equal(result.analysis.modelStatus,'estimación no calibrada');
 assert.equal(result.analysis.homeWin+result.analysis.draw+result.analysis.awayWin,100);
 assert.throws(()=>diagnoseLiveAnalysis(live,{...details,fixtureId:999},123,now));
 assert.throws(()=>diagnoseLiveAnalysis(live,{...details,error:'quota'},123,now));
 assert.throws(()=>diagnoseLiveAnalysis({...live,errors:{quota:'exhausted'}},details,123,now));
 const anotherTeam=diagnoseLiveAnalysis(live,{...details,statistics:[{...stats[0],team:{id:999}},stats[1]]},123,now);
 assert.equal(anotherTeam.input.homeXg,null);assert.equal(anotherTeam.analysis.homeWin,null);
});
