import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
function load(file, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(new URL(file,root),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{exports,Date,console,require:name=>{
    if(name in imports)return imports[name];
    if(name.endsWith('.module.css'))return new Proxy({}, {get:(_,key)=>key==='__esModule'?false:String(key)});
    if(name==='react/jsx-runtime')return require(name);
    throw new Error(`Unexpected import ${name}`);
  }});
  return exports;
}
const data=load('lib/liveData.ts'), engine=load('lib/livePoisson.ts');
// Synthetic UI fixtures only; no effects, sessions or external requests are executed.
export function renderLiveTvFixture({scenario='missing',count=23,longNames=true,logos=false}={}) {
  const now=Date.now();
  const name=longNames?'Club Deportivo Internacional '+ 'EquipoSinEspacios'.repeat(5):'Equipo';
  const crest=logos?'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#37ff91" d="M6 4h36v25L24 44 6 29z"/><circle cx="24" cy="22" r="10" fill="#102440"/></svg>'):'';
  const matches=Array.from({length:count},(_,index)=>({id:1001+index,minuteNumber:65,half:'2H',league:'Campeonato Internacional de Fútbol',country:'World',homeId:1,awayId:2,home:`${name} Local ${index}`,away:`${name} Visitante ${index}`,homeScore:scenario==='known'?2:0,awayScore:scenario==='known'?1:0,homeFlag:crest,awayFlag:crest,apiUpdatedAt:now}));
  const selected=matches[0];
  const stats=scenario==='complete'?[1,2].map(id=>({team:{id},statistics:[{type:'Total Shots',value:10},{type:'Shots on Goal',value:4},{type:'Ball Possession',value:'50%'},{type:'expected_goals',value:0.8}]})):scenario==='partial'?[{team:{id:1},statistics:[{type:'Total Shots',value:0}]}]:[];
  const events=[{type:'Goal',time:{elapsed:60},player:{name:'Nombre de jugador '+ 'ApellidoMuyLargo'.repeat(5)}}];
  const values=[matches,selected,stats,events,false,null,now,null,'14:32:08',selected.id,now,false,now];
  let slot=0;
  const component=load('components/ui/LiveTvDashboard.tsx', {
    react:{...React,useState:()=>[values[slot++],()=>{}],useEffect:()=>{}},
    '@/lib/liveData':data,'@/lib/livePoisson':engine,
  }).default;
  return {html:renderToStaticMarkup(component()),css:fs.readFileSync(new URL('components/ui/LiveTvDashboard.module.css',root),'utf8'),ids:matches.map(match=>match.id)};
}
