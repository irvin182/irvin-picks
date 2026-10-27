import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
// Offline diagnosis of saved, sanitized responses. No credentials, HTTP or Redis.
function load(relative) {
 const exports={};
 const source=fs.readFileSync(new URL('../'+relative,import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports});
 return exports;
}
const {calculateLivePoisson}=load('lib/livePoisson.ts');
const {readLiveStat}=load('lib/liveData.ts');
export function diagnoseLiveAnalysis(live,details,fixtureId,now=Date.now()) {
 if(!Number.isSafeInteger(fixtureId)||fixtureId<=0||live?.error||Object.keys(live?.errors??{}).length||!Array.isArray(live?.response)||details?.error||Object.keys(details?.errors??{}).length||!Array.isArray(details?.statistics)||String(details.fixtureId)!==String(fixtureId))throw Error('Respuestas inválidas o IDs de partido incompatibles.');
 const fixture=live.response.find(item=>item.fixture?.id===fixtureId);
 if(!fixture)throw Error('El partido no aparece en la respuesta de /api/live.');
 const stat=(side,name)=>readLiveStat(details.statistics,fixture.teams?.[side]?.id??fixture.teams?.[side]?.name,name);
 const age=value=>typeof value==='number'&&Number.isFinite(value)?(now-value)/1000:null;
 const input={homeScore:fixture.goals?.home??null,awayScore:fixture.goals?.away??null,minuteText:fixture.fixture.status?.elapsed==null?'':String(fixture.fixture.status.elapsed),status:fixture.fixture.status?.short,stale:Boolean(live.stale),fixtureAgeSeconds:age(live.cachedAt),statisticsAgeSeconds:age(details.cachedAt),homeXg:stat('home','expected_goals'),awayXg:stat('away','expected_goals'),homeShots:stat('home','Total Shots'),awayShots:stat('away','Total Shots'),homeShotsOn:stat('home','Shots on Goal'),awayShotsOn:stat('away','Shots on Goal'),homePossession:stat('home','Ball Possession'),awayPossession:stat('away','Ball Possession')};
 return {fixtureId,input,eventsUnavailable:Boolean(details.eventsError),analysis:calculateLivePoisson(input)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [livePath,detailsPath,id]=process.argv.slice(2);
  if(!livePath||!detailsPath||!id)throw Error('Uso: node scripts/diagnose-live-analysis.mjs live.json fixture.json ID');
  console.log(JSON.stringify(diagnoseLiveAnalysis(JSON.parse(fs.readFileSync(livePath,'utf8')),JSON.parse(fs.readFileSync(detailsPath,'utf8')),Number(id)),null,2));
 }catch(error){console.error(error instanceof SyntaxError?'JSON inválido.':error.message);process.exitCode=2;}
}
