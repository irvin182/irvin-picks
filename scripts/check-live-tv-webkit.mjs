// Real WebKit, actual React dashboard and synthetic local HTTP responses only.
// Install a compatible playwright-core/WebKit outside this repo; point
// IRVIN_PLAYWRIGHT_CORE and PLAYWRIGHT_BROWSERS_PATH to that temporary runtime.
import fs from 'node:fs';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {renderLiveTvFixture} from '../tests/helpers/live-tv-render.mjs';
const require=createRequire(import.meta.url);
const {webkit}=require(process.env.IRVIN_PLAYWRIGHT_CORE||'playwright-core');
const {webpack}=require('next/dist/compiled/webpack/webpack');
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=fs.mkdtempSync(os.tmpdir()+'/irvin-webkit-audit-');
const css=fs.readFileSync(root+'components/ui/LiveTvDashboard.module.css','utf8');
const classes=Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match=>[match[1],match[1]]));
fs.writeFileSync(dir+'/css-loader.cjs',`module.exports=()=>${JSON.stringify('module.exports='+JSON.stringify(classes))}`);
fs.writeFileSync(dir+'/ts-loader.cjs',`module.exports=source=>require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(source,{compilerOptions:{target:7,module:99,jsx:4,esModuleInterop:true}}).outputText;`);
fs.writeFileSync(dir+'/entry.js',`import React from 'react';import {createRoot} from 'react-dom/client';import Dashboard from ${JSON.stringify(root+'components/ui/LiveTvDashboard.tsx')};createRoot(document.getElementById('root')).render(React.createElement(Dashboard));`);
await new Promise((resolve,reject)=>webpack({mode:'development',context:root,entry:dir+'/entry.js',output:{path:dir,filename:'bundle.js'},devtool:false,resolve:{extensions:['.tsx','.ts','.js'],modules:[root+'node_modules'],alias:{'@':root}},module:{rules:[{test:/\.tsx?$/,use:dir+'/ts-loader.cjs'},{test:/\.css$/,use:dir+'/css-loader.cjs'}]}},(error,stats)=>error||stats.hasErrors()?reject(error??new Error(stats.toString({all:false,errors:true}))):resolve()));
const bundle=fs.readFileSync(dir+'/bundle.js','utf8');
const browser=await webkit.launch({headless:true});
const results=[],parity=new Map();
try{
 for(const width of [320,375,390,430,768,1440,1920])for(const longNames of [false,true]){
  const mobile=width<960;
  const context=await browser.newContext({viewport:{width,height:mobile?844:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
  for(const scenario of ['missing','partial','complete','desync','error','events-error']){
   const fixture=renderLiveTvFixture({scenario:scenario==='events-error'?'complete':scenario,longNames,logos:true}),errors=[],requests=[];
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='https://irvin.test')return route.abort();
    if(url.pathname==='/live-tv')return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`});
    if(url.pathname==='/bundle.js')return route.fulfill({contentType:'text/javascript',body:bundle});
    requests.push(url.pathname+url.search);
    if(url.pathname==='/api/live')return route.fulfill({json:{cachedAt:fixture.cachedAt,stale:false,response:fixture.matches.map(match=>({fixture:{id:match.id,status:{elapsed:match.minuteNumber,short:match.half}},league:{id:match.leagueId,name:match.league,country:match.country,logo:match.leagueLogo},teams:{home:{id:match.homeId,name:match.home,logo:match.homeFlag},away:{id:match.awayId,name:match.away,logo:match.awayFlag}},goals:{home:match.homeScore,away:match.awayScore}}))}});
    if(url.pathname==='/api/fixture'){
     if(scenario==='error')return route.fulfill({status:503,json:{error:'Estadísticas no disponibles temporalmente.'}});
     const id=Number(url.searchParams.get('id'));
     if(id===1002)await new Promise(resolve=>setTimeout(resolve,200));
     const statistics=fixture.statistics.map(row=>({...row,statistics:row.statistics.map(stat=>({...stat,value:stat.type==='Total Shots'&&scenario==='complete'?10+id-1001:stat.value}))}));
     try{return await route.fulfill({json:{fixtureId:id,statistics,events:[],eventsError:scenario==='events-error'?'Eventos no disponibles temporalmente; las estadísticas sí están disponibles.':null,cachedAt:fixture.cachedAt-(scenario==='desync'?300000:0)}});}catch{return;}
    }
    return route.abort();
   });
   const storageBlocked=width===375&&!longNames&&scenario==='complete';
   if(storageBlocked)await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError');}});});
   await page.goto('https://irvin.test/live-tv'+(scenario==='complete'?'?fixture=1003':''));
   await page.waitForFunction(()=>document.querySelector('.metricsGrid')&&document.querySelector('.analysis')?.getAttribute('aria-busy')==='false');
   const measured=await page.evaluate(()=>{
    const bad=[];
    for(const e of document.querySelectorAll('[data-ui-card],[data-probability],.dataNotice,.teamBlock,.header')){
     const r=e.getBoundingClientRect();if(r.left< -1||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)bad.push(e.className);
    }
    for(const group of document.querySelectorAll('.probabilityGrid,.metricsGrid,.decisionsGrid,.scoreGrid')){
     const children=[...group.children];
     for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
      const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)bad.push('overlap: '+group.className);
     }
    }
    const selectedId=Number(document.querySelector('[data-live-fixture-id][aria-pressed="true"]').dataset.liveFixtureId);
    return{selectedId,groups:document.querySelectorAll('.matchGroup').length,metrics:[...document.querySelectorAll('.metric')].map(e=>({title:e.querySelector('h3').textContent,value:e.querySelector('p').textContent})),pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,buttons:document.querySelectorAll('[data-live-fixture-id]').length,probabilities:[...document.querySelectorAll('[data-probability]')].map(e=>({kind:e.dataset.probability,value:e.querySelector('strong').textContent})),notice:document.querySelector('.dataNotice')?.textContent??'',alert:document.querySelector('.alert')?.textContent??'',bad};
   });
   if(measured.pageWidth>width||measured.viewport!==width||measured.buttons!==23||errors.length||requests.filter(r=>r==='/api/live').length!==1||requests.filter(r=>r.startsWith('/api/fixture')).length!==1)measured.bad.push('runtime, dimensions, IDs or duplicate requests');
   if(['complete','events-error'].includes(scenario)&&!measured.probabilities.some(p=>p.kind==='estimated'))measured.bad.push('complete statistics did not enable estimates');
   if(!['complete','events-error'].includes(scenario)&&measured.probabilities.some(p=>p.kind==='estimated'))measured.bad.push('insufficient or mismatched data enabled estimates');
   if(scenario==='desync'&&!measured.notice.includes('separadas'))measured.bad.push('missing synchronization reason');
   if(scenario==='error'&&!measured.notice.includes('no disponibles'))measured.bad.push('provider error not explained');
   if(scenario==='events-error'&&!measured.alert.includes('Eventos'))measured.bad.push('events failure not explained');
   if(measured.groups!==3||measured.metrics.length!==5)measured.bad.push('missing league group or statistics card');
   if(scenario==='complete'&&measured.selectedId!==1003)measured.bad.push('fixture URL not selected');
   const key=scenario+longNames+measured.selectedId,serialized=JSON.stringify(measured.probabilities);
   if(parity.has(key)&&parity.get(key)!==serialized)measured.bad.push('mobile/desktop probability difference');else parity.set(key,serialized);
   // Actual React selection, aborted delayed request, and subsequent marker/statistics pairing.
   if(width===390&&!longNames&&scenario==='complete'){
    await page.locator('[data-live-fixture-id="1002"]').tap();await page.waitForTimeout(30);
    await page.locator('[data-live-fixture-id="1003"]').tap();
    await page.waitForFunction(()=>document.querySelector('.metricsGrid').textContent.includes('12 - 12'));
    await page.waitForTimeout(250);
    if(!await page.locator('[data-live-fixture-id="1003"]').getAttribute('aria-pressed').then(value=>value==='true'))measured.bad.push('selection lost');
    if(!await page.locator('.metricsGrid').textContent().then(text=>text.includes('12 - 12')&&!text.includes('11 - 11')))measured.bad.push('mixed fixture statistics');
    await page.setViewportSize({width:844,height:390});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))measured.bad.push('landscape overflow');
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-live-fixture-id="1001"]').tap();await page.waitForFunction(()=>document.querySelector('.metricsGrid').textContent.includes('10 - 10'));
    const beforeRefresh=requests.length;
    await page.locator('.refreshButton').tap();
    await page.waitForFunction(()=>document.querySelector('.analysis').getAttribute('aria-busy')==='false');
    await page.waitForTimeout(100);
    await page.locator('.refreshButton').evaluate(button=>button.click());
    if(requests.length-beforeRefresh!==2||!await page.locator('.refreshButton').isDisabled())measured.bad.push('manual refresh duplicated or bypassed cooldown');
    if(requests.slice(beforeRefresh).some(url=>url!=='/api/live'&&url!=='/api/fixture?id=1001'))measured.bad.push('manual refresh bypassed normal cache URL');
    if(await page.evaluate(()=>localStorage.getItem('irvin_analytics_selected_match_id'))!=='1001')measured.bad.push('selection not remembered');
    await page.goto('https://irvin.test/live-tv');
    await page.waitForFunction(()=>document.querySelector('.analysis')?.getAttribute('aria-busy')==='false');
    if(await page.locator('[data-live-fixture-id="1001"]').getAttribute('aria-pressed')!=='true')measured.bad.push('saved selection not restored');
    const beforeInvalid=requests.length;
    await page.goto('https://irvin.test/live-tv?fixture=999999');
    await page.waitForFunction(()=>document.querySelector('.analysis')?.getAttribute('aria-busy')==='false');
    if(!await page.locator('.matchPanel').textContent().then(text=>text.includes('no está disponible')))measured.bad.push('unavailable fixture not explained');
    if(requests.slice(beforeInvalid).some(url=>url.includes('999999')))measured.bad.push('arbitrary fixture requested from provider path');

   }
   if(!longNames&&scenario==='complete'&&[390,1440].includes(width)){
    await page.goto('https://irvin.test/live-tv?fixture=1003');
    await page.waitForFunction(()=>document.querySelector('.analysis')?.getAttribute('aria-busy')==='false');
    await page.screenshot({path:`${dir}/${width}-webkit.png`,fullPage:true});
   }
   results.push({width,longNames,scenario,...measured,errors});await page.close();
  }
  await context.close();
 }
}finally{await browser.close();}
const failures=results.filter(result=>result.bad.length);
fs.writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({directory:dir,checks:results.length,failures},null,2));
process.exitCode=failures.length?1:0;
