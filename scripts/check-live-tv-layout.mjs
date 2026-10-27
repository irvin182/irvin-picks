import fs from 'node:fs';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const {renderLiveTvFixture}=await import(pathToFileURL(root+'/tests/helpers/live-tv-render.mjs'));
const dir=fs.mkdtempSync(os.tmpdir()+'/irvin-responsive-');
for(const scenario of ['missing','partial','complete','known']){
 const {html,css}=renderLiveTvFixture({scenario,logos:true,longNames:process.env.IRVIN_LAYOUT_SHORT_NAMES!=='1'});
 fs.writeFileSync(`${dir}/${scenario}.html`,`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0} ${css}</style></head><body>${html}</body></html>`);
}
// Isolated profile; HTTP/HTTPS are blocked before opening any fixture. Never uses a real session.
const chrome=spawn(process.env.IRVIN_CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-sync','--disable-extensions','--remote-debugging-port=0','--user-data-dir='+dir+'/profile','about:blank'],{stdio:'ignore'});
let ws;
try{
 for(let i=0;i<300&&!fs.existsSync(dir+'/profile/DevToolsActivePort');i++)await new Promise(r=>setTimeout(r,50));
 if(!fs.existsSync(dir+'/profile/DevToolsActivePort'))throw new Error('Chrome no inició. Configura IRVIN_CHROME_BIN con una instalación local.');
 const [port,endpoint]=fs.readFileSync(dir+'/profile/DevToolsActivePort','utf8').trim().split('\n');
 ws=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let sequence=0;const pending=new Map();
 ws.onmessage=event=>{const message=JSON.parse(event.data);if(pending.has(message.id)){const {resolve,reject,timer}=pending.get(message.id);clearTimeout(timer);pending.delete(message.id);if(message.error)reject(new Error(JSON.stringify(message.error)));else resolve(message.result);}};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP local timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(method,params)=>send(method,params,sessionId);
 await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['http://*','https://*']});
 const results=[];
 for(const [width,height] of [[320,568],[375,812],[390,844],[430,932],[768,1024],[1440,900],[1920,1080],[568,320],[812,375],[844,390],[932,430],[1024,768]])for(const scenario of ['missing','partial','complete','known']){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<960});
  await call('Emulation.setTouchEmulationEnabled',{enabled:width<960});
  await call('Page.navigate',{url:pathToFileURL(`${dir}/${scenario}.html`).href});
  for(let i=0;i<100;i++){
   const state=await call('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(state.result.value==='complete')break;await new Promise(r=>setTimeout(r,20));
  }
  for(const expanded of [false,true]){
   const {result}=await call('Runtime.evaluate',{returnByValue:true,expression:`(()=>{
    const detail=document.querySelector('details');detail.open=${expanded};
    const bad=[];const visible=e=>e.getClientRects().length>0&&e.getBoundingClientRect().height>0;
    for(const e of document.querySelectorAll('[data-ui-card],[data-probability],.matchButton,.header,.teamBlock,.methodologyBody')){
      if(!visible(e))continue;const r=e.getBoundingClientRect();
      const inRail=e.matches('.matchButton')&&innerWidth<960;
      if((!inRail&&(r.left < -1 || r.right > innerWidth+1)) || e.scrollWidth>e.clientWidth+1 || e.scrollHeight>e.clientHeight+1)bad.push({class:e.className,text:e.textContent.slice(0,90),width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight});
    }
    for(const group of document.querySelectorAll('.probabilityGrid,.metricsGrid,.decisionsGrid,.scoreGrid')){
     const children=[...group.children].filter(visible);
     for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
      const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)bad.push({overlap:group.className});
     }
    }
    const rail=document.querySelector('.matchList');
    if(innerWidth<960){
      if(getComputedStyle(rail).overflowX!=='auto')bad.push({rail:'not scrollable'});
      for(const button of rail.querySelectorAll("[data-live-fixture-id]"))if(button.getBoundingClientRect().height<44)bad.push({touch:'too small'});
      rail.scrollLeft=rail.scrollWidth;
      const last=[...rail.querySelectorAll("[data-live-fixture-id]")].at(-1).getBoundingClientRect(),bounds=rail.getBoundingClientRect();
      if(last.right>bounds.right+1||last.left<bounds.left-1)bad.push({rail:'last match inaccessible'});
      rail.scrollLeft=0;
      const score=document.querySelector('.scoreArea').getBoundingClientRect(),panel=document.querySelector('.matchPanel').getBoundingClientRect();
      if(score.bottom>panel.top+1)bad.push({order:'score must precede match selector'});
    }
    return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,buttons:document.querySelectorAll('[data-live-fixture-id]').length,bad};
   })()`});
   const row={width,height,scenario,expanded,...result.value};results.push(row);
  }
  if(width===390&&scenario==='complete'){
    const {result:position}=await call('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const rail=document.querySelector('.matchList');rail.scrollIntoView({block:'center'});const r=rail.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`});
    await call('Input.synthesizeScrollGesture',{...position.value,xDistance:-220,yDistance:0,gestureSourceType:'touch'});
    const {result:touch}=await call('Runtime.evaluate',{returnByValue:true,expression:`document.querySelector('.matchList').scrollLeft>0`});
    if(!touch.value)results.at(-1).bad.push({touch:'swipe did not move selector'});
    await call('Runtime.evaluate',{expression:`[...document.querySelectorAll('[data-live-fixture-id]')].at(-1).focus();document.querySelector('details summary').focus()`});
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    const {result:keyboard}=await call('Runtime.evaluate',{returnByValue:true,expression:`document.querySelector('details').open===false`});
    // The last layout check leaves details open; Space must close it.
    if(!keyboard.value)results.at(-1).bad.push({keyboard:'methodology toggle failed'});
    await call('Runtime.evaluate',{expression:`document.activeElement.blur();document.querySelector('.matchList').style.scrollSnapType='none';document.querySelector('.matchList').scrollLeft=0;window.scrollTo(0,0)`});
  }
  if((width===390&&scenario==='complete')||(width===1440&&scenario==='complete')){
    // Capture the initial view, independent of scroll momentum from the interaction test.
    await call('Page.navigate',{url:pathToFileURL(`${dir}/${scenario}.html`).href+'?capture=initial'});
    for(let i=0;i<100;i++){
      const {result}=await call('Runtime.evaluate',{expression:'document.readyState==="complete" && !!document.querySelector(".matchList")',returnByValue:true});
      if(result.value)break;await new Promise(resolve=>setTimeout(resolve,20));
    }
    await call('Runtime.evaluate',{expression:'document.querySelector("details").open=false;new Promise(resolve=>setTimeout(resolve,250))',awaitPromise:true});
    await call('Runtime.evaluate',{expression:'new Promise(requestAnimationFrame)',awaitPromise:true});
    const {cssContentSize}=await call('Page.getLayoutMetrics');
    const {data}=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(cssContentSize.height),scale:1}});fs.writeFileSync(`${dir}/${width}-${scenario}.png`,Buffer.from(data,'base64'));
  }
 }
 fs.writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));
 const failures=results.filter(r=>r.viewport!==r.width||r.pageWidth>r.width||r.buttons!==23||r.bad.length);
 console.log(JSON.stringify({directory:dir,checks:results.length,failures},null,2));
 fs.writeFileSync('/tmp/irvin-responsive-browser-result.json',JSON.stringify({directory:dir,checks:results.length,failures}));
 process.exitCode=failures.length?1:0;
}finally{ws?.close();chrome.kill('SIGTERM');}
