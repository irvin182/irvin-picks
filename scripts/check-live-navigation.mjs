// Synthetic admin render and viewport visibility checks; no real login or network.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {webkit}=require(process.env.IRVIN_PLAYWRIGHT_CORE||'playwright-core');
const source=fs.readFileSync(new URL('../app/admin/page.tsx',import.meta.url),'utf8');
let slot=0;const exports={};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{
 if(name==='react')return{...React,useState:initial=>{const index=slot++;return[index===0?{user:{role:'ADMIN'}}:index===1?false:typeof initial==='function'?initial():initial,()=>{}];},useEffect:()=>{},useMemo:fn=>fn()};
 if(name==='next-auth/react')return{};
 if(name==='next/link')return{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
 if(name==='react/jsx-runtime')return require(name);throw Error('Unexpected import '+name);
}});
const html=renderToStaticMarkup(React.createElement(exports.default));
const browser=await webkit.launch({headless:true}),results=[];
try{for(const width of [320,375,390,430,768,1440,1920]){
 const context=await browser.newContext({viewport:{width,height:900},isMobile:width<1024,hasTouch:width<1024});
 await context.route('**/*',route=>route.abort());const page=await context.newPage();
 // Only responsive visibility utilities are needed to inspect the actual link JSX.
 await page.setContent('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>.hidden{display:none}@media(min-width:1024px){.lg\\:hidden{display:none}.lg\\:block{display:block}}</style>'+html);
 const links=await page.locator('a').evaluateAll(anchors=>anchors.filter(a=>a.getClientRects().length>0&&/IA LIVE|Live TV/.test(a.textContent)).map(a=>({label:a.textContent.trim(),href:a.getAttribute('href')})));
 if(links.length!==2||links.some(link=>link.href!=='/live-tv'))throw Error('Non-canonical navigation: '+JSON.stringify({width,links}));
 results.push({width,links});await context.close();
}}finally{await browser.close();}
console.log(JSON.stringify({checks:results.length,results},null,2));
