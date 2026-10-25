import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code, {exports, require: n => {if (n in imports) return imports[n]; throw new Error(`Unexpected import ${n}`)}, console, process: {env:{APIFOOTBALL_KEY:'test-only'}}, URL, URLSearchParams, Headers, Response, AbortSignal, AbortController, setTimeout, clearTimeout, ...globals});
  return exports;
}
test('query validation preserves prediction, statistics and report queries', () => {
  const {validApiFootballQuery: valid} = load('lib/apiFootballQuery.ts');
  for (const [path, query] of [['leagues','current=true'],['leagues','team=33&current=true'],['fixtures','team=33&season=2026&last=20'],['teams/statistics','league=39&team=33&season=2026'],['teams','search=Manchester'],['fixtures/headtohead','h2h=33-34&last=10'],['fixtures/events','fixture=123'],['predictions','fixture=123']]) assert.equal(valid(path,new URLSearchParams(query)),true,query);
  for (const [path, query] of [['status','id=1'],['fixtures','id=1&id=2'],['fixtures','id=1&key=secret'],['fixtures','next=999'],['fixtures','date=2026-02-30'],['fixtures','team=1%26live%3Dall'],['../status','id=1'],['fixtures','']]) assert.equal(valid(path,new URLSearchParams(query)),false,query);
});
test('exhausted budget never fetches or retries, including incident bootstrap', async () => {
  let calls=0, used=7503;
  const redis={get:async()=>used,eval:async()=>0};
  const budget=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>redis}},{fetch:async()=>{calls++;throw new Error('must not call')}});
  for(let i=0;i<10;i++) assert.equal(await budget.reserveApiFootballRequest(),false);
  assert.equal(calls,0);
  used=null;
  const IncidentDate=class extends Date {constructor(...args){super(...(args.length?args:['2026-10-25T12:00:00Z']))}};
  let observation;
  const incident=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>({get:async()=>null,eval:async(_s,_k,args)=>{observation=args[0]}})}},{Date:IncidentDate,fetch:async()=>{calls++;}});
  assert.equal(await incident.reserveApiFootballRequest(),false);
  assert.equal(observation,7503);
  assert.equal(calls,0);
});
test('unknown new day synchronizes real consumption once; failure stays closed', async () => {
  const FutureDate=class extends Date {constructor(...args){super(...(args.length?args:['2026-10-26T12:00:00Z']))}};
  let used=null, locked=false, calls=0;
  const redis={get:async()=>used,set:async()=>{if(locked)return null;locked=true;return 'OK'},eval:async(script,_keys,args)=>{if(script.includes('math.max')){used=Math.max(used??0,args[0]);return used}if(used===null||used>=7000)return 0;used++;return 1}};
  const budget=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>redis}},{Date:FutureDate,fetch:async()=>{calls++;return Response.json({response:{requests:{current:6998,limit_day:7500}},errors:[]})}});
  const results=await Promise.all(Array.from({length:20},()=>budget.reserveApiFootballRequest()));
  assert.equal(calls,1);assert.ok(results.filter(Boolean).length<=2);assert.ok(used<=7000);
  used=null;
  assert.equal(await budget.reserveApiFootballRequest(),false);assert.equal(calls,1);
  await budget.observeApiFootballUsage(1,'2026-10-25');assert.equal(used,null);
});
test('provider fetch validates destinations, prevents retries and observes headers',async()=>{
  let calls=0,allowed=true,observed;
  const budget={DAILY_LIMIT:7000,quotaWindow:()=>({day:'2026-10-25'}),reserveApiFootballRequest:async()=>allowed,observeApiFootballUsage:async n=>{observed=n}};
  const api=load('lib/apiFootballFetch.ts',{'@/lib/apiFootballBudget':budget},{fetch:async(_url,init)=>{calls++;assert.equal(init.redirect,'error');return Response.json({response:[]},{headers:{'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'496'}})}});
  for(const url of ['http://v3.football.api-sports.io/fixtures','https://evil.test/fixtures','https://v3.football.api-sports.io:444/fixtures','https://user@v3.football.api-sports.io/fixtures','https://v3.football.api-sports.io/status']) await assert.rejects(api.apiFootballFetch(url));
  assert.equal(calls,0);
  await api.apiFootballFetch('https://v3.football.api-sports.io/fixtures?id=1');assert.equal(calls,1);assert.equal(observed,7004);
  allowed=false;await assert.rejects(api.apiFootballFetch('https://v3.football.api-sports.io/fixtures?id=1'),{name:'ApiFootballBudgetExceeded'});assert.equal(calls,1);
});
test('Redis unavailable fails closed', async()=>{
  const budget=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>{throw new Error('offline')}}});
  assert.equal(await budget.reserveApiFootballRequest(),false);
});
test('live prediction model returns finite probabilities without network',()=>{
  const {calculateLivePoisson}=load('lib/livePoisson.ts');
  const result=calculateLivePoisson({homeScore:1,awayScore:0,minuteText:'65',homeShots:10,awayShots:7,homeShotsOn:4,awayShotsOn:2,homePossession:'55%',awayPossession:'45%'});
  for(const key of ['homeWin','draw','awayWin','over25','bttsYes']) assert.ok(Number.isFinite(result[key])&&result[key]>=0&&result[key]<=100,key);
});
const next = {NextResponse:{json:(data,init)=>Response.json(data,init),redirect:url=>new Response(null,{status:307,headers:{location:url}})}};
test('protected proxy rejects unauthorized, expired and replaced subscriptions; admits legitimate endpoints',async()=>{
  let token=null, user=null, providerCalls=0;
  const query=load('lib/apiFootballQuery.ts');
  const proxy=load('app/api/stats/api-football/[...endpoint]/route.ts',{
    'next/server':next,
    'next/cache':{unstable_cache:fn=>fn},
    'next-auth/jwt':{getToken:async()=>token},
    '@/lib/security':{rateLimit:()=>({ok:true}),getClientIp:()=> 'test'},
    '@/lib/supabaseAdmin':{supabaseAdmin:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:user,error:null})})})})}},
    '@/lib/apiFootballQuery':query,
    '@/lib/apiFootballFetch':{apiFootballFetch:async()=>{providerCalls++;return Response.json({response:[],errors:[]})}},
  });
  const invoke=()=>proxy.GET(new Request('https://local.test/api/stats/api-football/leagues?current=true'),{params:Promise.resolve({endpoint:['leagues']})});
  assert.equal((await invoke()).status,401);
  token={plan:'premium',id:'user',sessionId:'current',expires_at:'2020-01-01'};assert.equal((await invoke()).status,401);
  token={plan:'premium',id:'user',sessionId:'current'};user={active:true,blocked:false,active_session_id:'replaced'};assert.equal((await invoke()).status,401);
  user={...user,active_session_id:'current',blocked:true};assert.equal((await invoke()).status,401);
  user={...user,blocked:false};assert.equal((await invoke()).status,200);assert.equal(providerCalls,1);
  token={...token,plan:'free'};assert.equal((await invoke()).status,401);assert.equal(providerCalls,1);
});
test('both diagnostic routes are local-only and quota errors are controlled',async()=>{
  let calls=0,token={role:'ADMIN'};
  const auth={'getToken':async()=>token};
  const status=load('app/api/stats/api-football/status/route.ts',{'next/server':next,'next-auth/jwt':auth,'@/lib/apiFootballBudget':{getApiFootballBudget:async()=>({used:7503,limit:7000})}},{fetch:()=>{calls++;throw new Error('forbidden')}});
  assert.equal((await status.GET()).status,200);assert.equal(calls,0);
  const failed=load('app/api/stats/api-football/status/route.ts',{'next/server':next,'next-auth/jwt':auth,'@/lib/apiFootballBudget':{getApiFootballBudget:async()=>{throw new Error('offline')}}});
  assert.equal((await failed.GET()).status,503);
  const alias=load('app/api/odds/the-odds-api/route.ts',{'@/app/api/stats/api-football/status/route':status});assert.equal((await alias.GET()).status,200);
  token=null;assert.equal((await status.GET()).status,401);assert.equal((await alias.GET()).status,401);
  token={role:'USER',plan:'premium'};assert.equal((await status.GET()).status,401);assert.equal(calls,0);
});
test('fixture and live reject absent sessions before accessing provider',async()=>{
  let calls=0;
  const imports={
    'next/server':next,'next/cache':{unstable_cache:fn=>fn},'next-auth/jwt':{getToken:async()=>null},
    '@/lib/security':{rateLimit:()=>({ok:true}),getClientIp:()=> 'test'},
    '@/lib/apiFootballFetch':{apiFootballFetch:async()=>{calls++;throw new Error('forbidden')}},
    '@/lib/supabaseAdmin':{supabaseAdmin:{}},
  };
  for(const route of ['fixture','live']) {
    const api=load(`app/api/${route}/route.ts`,imports);assert.equal((await api.GET(new Request('https://local.test/api/'+route+'?id=1'))).status,401);
  }
  assert.equal(calls,0);
});
test('demo returns a controlled 503 when quota is exhausted',async()=>{
  let calls=0;
  const api=load('app/api/demo-live/route.ts',{'@/lib/security':{rateLimit:()=>({ok:true}),getClientIp:()=> 'test'},'next/server':next,'next/cache':{unstable_cache:fn=>fn},'@/lib/apiFootballFetch':{apiFootballFetch:async()=>{calls++;throw new Error('quota exhausted')}}});
  assert.equal((await api.GET()).status,503);assert.equal(calls,1);
});
test('subscription checkout preserves all three plan prices without real payments',async()=>{
  let calls=0;
  const amounts=[];
  class Stripe {checkout={sessions:{create:async input=>{calls++;amounts.push(input.line_items[0].price_data.unit_amount);assert.equal(input.mode,'subscription');return {url:'https://checkout.stripe.com/test'}}}}}
  const api=load('app/api/checkout/route.ts',{'next/server':next,stripe:{default:Stripe}},{process:{env:{STRIPE_SECRET_KEY:'test-only'}}});
  assert.equal((await api.GET(new Request('https://local.test/api/checkout?plan=unknown'))).status,400);assert.equal(calls,0);
  for(const plan of ['beta','premium','vip']) assert.equal((await api.GET(new Request('https://local.test/api/checkout?plan='+plan))).status,307);
  assert.deepEqual(amounts,[990,1990,3990]);
});
test('predictions keep a finite fallback without retrying a quota failure',async()=>{
  let calls=0;
  const stats=load('app/utils/stats.ts',{}, {fetch:async()=>{calls++;return Response.json({error:'quota exhausted'},{status:503})}});
  const result=await stats.computeLambdasFromFixture(100);
  assert.ok(Number.isFinite(result.lambdaHome)&&result.lambdaHome>0);
  assert.ok(Number.isFinite(result.lambdaAway)&&result.lambdaAway>0);
  assert.equal(calls,1);
});
test('UTC windows change at midnight, independently of Madrid DST',()=>{
  const {quotaWindow}=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>{throw new Error('not needed')}}});
  const before=quotaWindow(new Date('2026-10-25T23:59:59.999Z'));
  const after=quotaWindow(new Date('2026-10-26T00:00:00.000Z'));
  assert.equal(before.day,'2026-10-25');assert.equal(new Date(before.reset*1000).toISOString(),'2026-10-26T00:00:00.000Z');
  assert.equal(after.day,'2026-10-26');assert.equal(new Date(after.reset*1000).toISOString(),'2026-10-27T00:00:00.000Z');
});
test('Redis read and atomic reservation failures both block provider calls',async()=>{
  let calls=0;
  for(const redis of [{get:async()=>{throw new Error('offline')}},{get:async()=>6999,eval:async()=>{throw new Error('offline')}}]){
    const budget=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>redis}},{fetch:async()=>{calls++;throw new Error('forbidden')}});
    assert.equal(await budget.reserveApiFootballRequest(),false);
  }
  assert.equal(calls,0);
});
test('quota synchronization 429 blocks subsequent attempts without retries',async()=>{
  const FutureDate=class extends Date {constructor(...args){super(...(args.length?args:['2026-10-26T12:00:00Z']))}};
  let used=null,calls=0;
  const redis={get:async()=>used,set:async()=> 'OK',eval:async(script,_keys,args)=>{if(script.includes('math.max'))used=Math.max(used??0,args[0]);return 0}};
  const budget=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>redis}},{Date:FutureDate,fetch:async()=>{calls++;return new Response(null,{status:429})}});
  assert.equal(await budget.reserveApiFootballRequest(),false);assert.equal(used,7000);
  assert.equal(await budget.reserveApiFootballRequest(),false);assert.equal(calls,1);
});
test('missing provider headers and quota errors in HTTP 200 close the budget',async()=>{
  for(const response of [Response.json({response:[]}),Response.json({errors:{requests:'Daily quota limit reached'}},{headers:{'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'1000'}})]){
    let observed;
    const budget={DAILY_LIMIT:7000,quotaWindow:()=>({day:'2026-10-25'}),reserveApiFootballRequest:async()=>true,observeApiFootballUsage:async n=>{observed=n}};
    const api=load('lib/apiFootballFetch.ts',{'@/lib/apiFootballBudget':budget},{fetch:async()=>response});
    if(response.headers.has('x-ratelimit-requests-limit')) await assert.rejects(api.apiFootballFetch('https://v3.football.api-sports.io/fixtures?id=1'),{name:'ApiFootballProviderError'});
    else await api.apiFootballFetch('https://v3.football.api-sports.io/fixtures?id=1');
    assert.equal(observed,7000);
  }
});
test('midnight between reservation and fetch never sends an unreserved request',async()=>{
  let calls=0,windows=0;
  const budget={DAILY_LIMIT:7000,quotaWindow:()=>({day:++windows===1?'2026-10-25':'2026-10-26'}),reserveApiFootballRequest:async()=>true};
  const api=load('lib/apiFootballFetch.ts',{'@/lib/apiFootballBudget':budget},{fetch:async()=>{calls++}});
  await assert.rejects(api.apiFootballFetch('https://v3.football.api-sports.io/fixtures?id=1'),{name:'ApiFootballBudgetExceeded'});assert.equal(calls,0);
});

test('Preview uses its own observed baseline rather than the production incident',async()=>{
  const IncidentDate=class extends Date {constructor(...args){super(...(args.length?args:['2026-10-25T12:00:00Z']))}};
  let used=null,calls=0;
  const redis={get:async()=>used,set:async()=> 'OK',eval:async(script,_keys,args)=>{if(script.includes('math.max')){used=args[0];return used}if(used>=7000)return 0;used++;return 1}};
  const budget=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>redis}},{Date:IncidentDate,process:{env:{VERCEL_ENV:'preview',APIFOOTBALL_KEY:'preview-test-only'}},fetch:async()=>{calls++;return Response.json({errors:[],response:{requests:{current:41,limit_day:7500}}})}});
  assert.equal(await budget.reserveApiFootballRequest(),true);assert.equal(used,42);assert.equal(calls,1);
});
test('fixture checks the current subscriber session before spending quota',async()=>{
  let user={active:true,blocked:false,active_session_id:'replaced'},calls=0;
  const api=load('app/api/fixture/route.ts',{
    'next/server':next,'next/cache':{unstable_cache:fn=>fn},'next-auth/jwt':{getToken:async()=>({id:'test',sessionId:'current',plan:'premium'})},
    '@/lib/security':{rateLimit:()=>({ok:true}),getClientIp:()=> 'test'},
    '@/lib/supabaseAdmin':{supabaseAdmin:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:user,error:null})})})})}},
    '@/lib/apiFootballFetch':{apiFootballFetch:async()=>{calls++;return Response.json({response:[],errors:[]})}},
  });
  const req=new Request('https://local.test/api/fixture?id=1');
  assert.equal((await api.GET(req)).status,401);assert.equal(calls,0);
  user={...user,active_session_id:'current'};assert.equal((await api.GET(req)).status,200);assert.equal(calls,2);
  user={...user,blocked:true};assert.equal((await api.GET(req)).status,401);assert.equal(calls,2);
});
test('public demo rate limit prevents provider access',async()=>{
  let calls=0;
  const api=load('app/api/demo-live/route.ts',{'next/server':next,'next/cache':{unstable_cache:fn=>fn},'@/lib/security':{rateLimit:()=>({ok:false}),getClientIp:()=> 'test'},'@/lib/apiFootballFetch':{apiFootballFetch:async()=>{calls++;throw new Error('forbidden')}}});
  assert.equal((await api.GET(new Request('https://local.test/api/demo-live'))).status,429);assert.equal(calls,0);
});
test('malformed or error provider payloads never become statistics',async()=>{
  const headers={'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7000'};
  const budget={DAILY_LIMIT:7000,quotaWindow:()=>({day:'2026-10-26'}),reserveApiFootballRequest:async()=>true,observeApiFootballUsage:async()=>{}};
  for(const response of [Response.json({errors:{parameters:'invalid'},response:[]},{headers}),Response.json({message:'unavailable'},{headers}),Response.json({response:{}},{headers}),new Response('not json',{headers})]){
    const api=load('lib/apiFootballFetch.ts',{'@/lib/apiFootballBudget':budget},{fetch:async()=>response});
    await assert.rejects(api.apiFootballFetch('https://v3.football.api-sports.io/fixtures?id=1'),{name:'ApiFootballProviderError'});
  }
  const api=load('lib/apiFootballFetch.ts',{'@/lib/apiFootballBudget':budget},{fetch:async()=>Response.json({errors:[],response:{goals:{}}},{headers})});
  assert.equal((await api.apiFootballFetch('https://v3.football.api-sports.io/teams/statistics?team=1&league=39&season=2026')).status,200);
});
test('statistics, live, fixture and demo recover after UTC reset without cached failures',async()=>{
  let time='2026-10-25T23:59:59.999Z',sportsCalls=0,statusCalls=0;
  const Clock=class extends Date {constructor(...args){super(...(args.length?args:[time]))}};
  const state=new Map([['irvin:api-football:quota:v2:2026-10-25',7503]]);
  const redis={get:async key=>state.get(key)??null,set:async(key,value)=>{if(state.has(key))return null;state.set(key,value);return 'OK'},eval:async(script,keys,args)=>{const key=keys[0];if(script.includes('math.max')){const n=Math.max(state.get(key)??0,args[0]);state.set(key,n);if(keys[1])state.set(keys[1],args[2]);return n}const n=state.get(key);if(n==null||n>=args[0])return 0;state.set(key,n+1);return 1}};
  const budget=load('lib/apiFootballBudget.ts',{'@/lib/apiFootballRedis':{getApiFootballRedis:()=>redis}},{Date:Clock,fetch:async()=>{statusCalls++;return Response.json({errors:[],response:{requests:{current:37,limit_day:7500}}})}});
  const api=load('lib/apiFootballFetch.ts',{'@/lib/apiFootballBudget':budget},{fetch:async()=>{sportsCalls++;return Response.json({errors:[],results:1,response:[{fixture:{id:123},statistics:[],events:[]}]},{headers:{'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':String(7500-37-sportsCalls)}})}});
  const cache=new Map();
  const imports={
    'next/server':next,'next/cache':{unstable_cache:(fn,keys)=>async()=>{const key=JSON.stringify(keys);if(cache.has(key))return cache.get(key);const value=await fn();cache.set(key,value);return value}},
    'next-auth/jwt':{getToken:async()=>({id:'test',sessionId:'current',role:'USER',plan:'premium'})},
    '@/lib/security':{rateLimit:()=>({ok:true}),getClientIp:()=> 'test'},
    '@/lib/supabaseAdmin':{supabaseAdmin:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{active:true,blocked:false,active_session_id:'current'},error:null})})}),update:()=>({eq:()=>({eq:async()=>({error:null})})})})}},
    '@/lib/apiFootballFetch':api,'@/lib/apiFootballQuery':load('lib/apiFootballQuery.ts'),
  };
  const stats=load('app/api/stats/api-football/[...endpoint]/route.ts',imports);
  const live=load('app/api/live/route.ts',imports),fixture=load('app/api/fixture/route.ts',imports),demo=load('app/api/demo-live/route.ts',imports);
  const endpoints=[()=>stats.GET(new Request('https://local.test/api/stats/api-football/fixtures?id=123'),{params:Promise.resolve({endpoint:['fixtures']})}),()=>live.GET(new Request('https://local.test/api/live')),()=>fixture.GET(new Request('https://local.test/api/fixture?id=123')),()=>demo.GET(new Request('https://local.test/api/demo-live'))];
  for(const invoke of endpoints){const response=await invoke();assert.equal(response.status,503);const body=await response.json();assert.equal('response' in body,false);assert.equal('statistics' in body,false);}
  assert.equal(sportsCalls,0);assert.equal(statusCalls,0);assert.equal(cache.size,0);
  time='2026-10-26T00:00:00.000Z';
  for(const invoke of endpoints)assert.equal((await invoke()).status,200);
  assert.equal(statusCalls,1);assert.equal(sportsCalls,5);assert.equal(state.get('irvin:api-football:quota:v2:2026-10-26'),42);
  for(const invoke of endpoints)assert.equal((await invoke()).status,200);
  assert.equal(sportsCalls,5);assert.equal(statusCalls,1);
  state.set('irvin:api-football:quota:v2:2026-10-26',7000);
  const blocked=await stats.GET(new Request('https://local.test/api/stats/api-football/fixtures?id=124'),{params:Promise.resolve({endpoint:['fixtures']})});
  assert.equal(blocked.status,503);assert.equal(sportsCalls,5);
});
test('synthetic subscribers can log in on beta, premium and vip, and revoked sessions are rejected',async()=>{
  let configuration,user;
  const database={from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:user,error:null})})}),update:values=>({eq:async()=>{Object.assign(user,values);return {error:null}}}),insert:async()=>{assert.equal(table,'login_attempts');return {error:null}}})};
  load('app/api/auth/[...nextauth]/route.ts',{
    'next-auth':{default:options=>{configuration=options;return ()=>{}}},
    'next-auth/providers/credentials':{default:options=>options},
    bcryptjs:{default:{compare:async(password,hash)=>password==='test-password'&&hash==='test-hash'}},
    '@/lib/supabaseAdmin':{supabaseAdmin:database},'@/lib/loginLogger':{saveLogin:async()=>{}},
  },{process:{env:{NEXTAUTH_SECRET:'synthetic-test-only'}},crypto:{randomUUID:()=> 'synthetic-session'}});
  for(const plan of ['beta','premium','vip']){
    user={id:'synthetic',email:'subscriber@example.invalid',password:'test-hash',plan,active:true,blocked:false,expires_at:'2099-01-01'};
    const signedIn=await configuration.providers[0].authorize({email:user.email,password:'test-password'},{headers:{}});
    assert.equal(signedIn.plan,plan);assert.equal(signedIn.role,'USER');assert.equal(signedIn.sessionId,'synthetic-session');
    const token=await configuration.callbacks.jwt({token:{},user:signedIn});assert.equal(token.forceLogout,false);
    const session=await configuration.callbacks.session({session:{user:{}},token});assert.equal(session.user.plan,plan);
    user.active_session_id='replaced';assert.equal((await configuration.callbacks.jwt({token})).forceLogout,true);
    user.blocked=true;assert.equal(await configuration.providers[0].authorize({email:user.email,password:'test-password'},{headers:{}}),null);
  }
});
test('predictions use available team statistics instead of the quota-error fallback',async()=>{
  const target={fixture:{id:123,timestamp:1800000000},league:{id:39,season:2026},teams:{home:{id:1},away:{id:2}}};
  const history=Array.from({length:12},(_,i)=>({fixture:{id:i+1,timestamp:1790000000+i*86400,status:{short:'FT'}},league:{id:39,season:2026},teams:{home:{id:1},away:{id:2}},goals:{home:2,away:1}}));
  const stats=load('app/utils/stats.ts',{}, {fetch:async url=>{
    const parsed=new URL(url,'https://local.test');
    if(parsed.pathname.endsWith('/teams/statistics'))return Response.json({errors:[],response:{goals:{for:{average:{home:'1.8',away:'1.2',total:'1.5'}}}}});
    return Response.json({errors:[],response:parsed.searchParams.has('id')?[target]:history});
  }});
  const result=await stats.computeLambdasFromFixture(123);
  assert.ok(Number.isFinite(result.lambdaHome)&&result.lambdaHome>0);assert.ok(Number.isFinite(result.lambdaAway)&&result.lambdaAway>0);
  assert.notEqual(result.meta.source,'generic_fallback');assert.notEqual(result.meta.source,'error');
});
test('Free Preview has a 90-call ceiling; the 7500 production plan remains capped at 7000',()=>{
  const imports={'@/lib/apiFootballRedis':{getApiFootballRedis:()=>{throw new Error('not needed')}}};
  const preview=load('lib/apiFootballBudget.ts',imports,{process:{env:{VERCEL_ENV:'preview'}}});
  const production=load('lib/apiFootballBudget.ts',imports,{process:{env:{VERCEL_ENV:'production'}}});
  assert.equal(preview.apiFootballEffectiveLimit(100),90);
  assert.equal(preview.apiFootballEffectiveLimit(7500),7000);
  assert.equal(production.apiFootballEffectiveLimit(7500),7000);
  assert.equal(production.apiFootballEffectiveLimit(100),0);
});
test('Free account response headers preserve actual observed usage rather than a budget offset',async()=>{
  let observed,providerLimit;
  const budget={DAILY_LIMIT:7000,quotaWindow:()=>({day:'2026-10-26'}),reserveApiFootballRequest:async()=>true,observeApiFootballUsage:async(used,_day,limit)=>{observed=used;providerLimit=limit}};
  const api=load('lib/apiFootballFetch.ts',{'@/lib/apiFootballBudget':budget},{fetch:async()=>Response.json({errors:[],response:[]},{headers:{'x-ratelimit-requests-limit':'100','x-ratelimit-requests-remaining':'58'}})});
  await api.apiFootballFetch('https://v3.football.api-sports.io/fixtures?id=1');
  assert.equal(observed,42);assert.equal(providerLimit,100);
});
