// Isolated report harness: real JSX, calculations and PDF; synthetic data, no effects or network.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export const reportPath='app/reports/today/page.tsx';
export function syntheticDay(){
 return Array.from({length:329},(_,i)=>({fixture:{id:50000+i,date:'2026-10-27T18:00:00Z'},league:{id:i%114+1,name:'Liga '+String(i%114+1).padStart(3,'0'),country:'World'},teams:{home:{name:'Local '+i},away:{name:'Visitante '+i}}}));
}
export function createReportHarness({source=fs.readFileSync(reportPath,'utf8'),fixtures=syntheticDay(),parts={},pdfImportFailure=()=>false,compute=async()=>({lambdaHome:1.4,lambdaAway:0.9,meta:{source:'synthetic-test'}})}={}){
 const values=[null,'2026-10-27',fixtures,'Datos sintéticos',false,parts,'',{running:false,done:0,total:0,currentLabel:''}];
 const refs=[],delays=[],computeIds=[],tables=[],pdfs=[],moduleRequests=[];let slot=0,refSlot=0;
 const exports={};
 const react={...React,useEffect:()=>{},useMemo:fn=>fn(),useRef:initial=>{const i=refSlot++;return refs[i]??(refs[i]={current:initial});},useState:initial=>{const i=slot++;if(!(i in values))values[i]=initial;return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
 class TestPdf extends jsPDF{constructor(...args){super(...args);this.setCreationDate(new Date('2026-10-27T12:00:00Z'));this.setFileId('0123456789ABCDEF0123456789ABCDEF');this.save=name=>{pdfs.push({name,bytes:this.output('arraybuffer').byteLength});return this;};}}
 const imports={react,'react/jsx-runtime':require('react/jsx-runtime'),'@/app/utils/stats':{apiGet:()=>{throw Error('Network forbidden in isolated report test');},computeLambdasFromFixture:async id=>{computeIds.push(id);return compute(id);}},jspdf:TestPdf,'jspdf-autotable':(doc,options)=>{tables.push(JSON.parse(JSON.stringify(options)));return autoTable(doc,options);}};
 const code=ts.transpileModule(source+'\nexport {calcProbs, probOver, probBTTS};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(name==='jspdf'||name==='jspdf-autotable'){moduleRequests.push(name);if(pdfImportFailure())throw Error('Synthetic PDF import failure');}if(name.endsWith('.module.css'))return new Proxy({}, {get:(_,key)=>key==='__esModule'?false:String(key)});if(name in imports)return imports[name];throw Error('Unexpected import '+name);},console:{...console,error:()=>{}},Date,performance,setTimeout:(fn,ms)=>{delays.push(ms);queueMicrotask(fn);return 0;},window:{print:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}});
 function render(){slot=0;refSlot=0;return exports.default();}
 function nodes(node,out=[]){if(Array.isArray(node))node.forEach(n=>nodes(n,out));else if(React.isValidElement(node)){out.push(node);nodes(node.props.children,out);}return out;}
 function text(node){if(Array.isArray(node))return node.map(text).join('');if(React.isValidElement(node))return text(node.props.children);return node==null?'':String(node);}
 function buttons(label){return nodes(render()).filter(node=>node.type==='button'&&(text(node).includes(label)||(label==='Iniciar análisis'&&text(node).includes('Analizar ligas visibles'))));}
 return {values,refs,delays,computeIds,tables,pdfs,moduleRequests,functions:exports,render,remount:()=>{refs.length=0;values[0]=null;values[5]={};values[7]={running:false,done:0,total:0,currentLabel:''};},nodes:()=>nodes(render()),html:()=>renderToStaticMarkup(render()),buttons,text};
}
