import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(file,imports={}){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{exports,URLSearchParams,require:name=>name in imports?imports[name]:require(name)});
 return exports;
}
const navigation=load('lib/liveNavigation.ts');
const {parseFixtureId,requestedFixture,legacyLiveDestination,chooseLiveFixture}=navigation;
test('live fixture IDs reject ambiguous, duplicate, unsafe and injected values',()=>{
 for(const input of [undefined,null,[],['123'],'0','-1','1.5','01',' 123','123&other=1','https://other.test','9007199254740992'])assert.equal(parseFixtureId(input),null);
 assert.equal(parseFixtureId('123'),123);
 assert.equal(requestedFixture('?fixture=123').id,123);
 assert.equal(requestedFixture('?fixture=123&fixture=124').id,null);
 assert.equal(requestedFixture('?fixture=bad').requested,true);
 assert.equal(requestedFixture('').requested,false);
 assert.equal(legacyLiveDestination({fixture:['123','124']}),'/live-tv');
 assert.equal(legacyLiveDestination({fixture:'123',returnTo:'https://other.test'}),'/live-tv?fixture=123');
});
test('selection honors current choice, then available URL ID, saved ID and first fixture',()=>{
 const games=[{id:101},{id:102},{id:103}];
 assert.equal(chooseLiveFixture(games,null,102,103).id,102);
 assert.equal(chooseLiveFixture(games,101,102,103).id,101);
 assert.equal(chooseLiveFixture(games,null,999,103).id,103);
 assert.equal(chooseLiveFixture(games,null,999,888).id,101);
 assert.equal(chooseLiveFixture([],101,102,103),null);
});
test('both old pages issue real Next.js 307 redirects and preserve only validated fixture IDs',async()=>{
 const page=load('app/live/page.tsx',{'@/lib/liveNavigation':navigation}).default;
 const mobile=load('app/live/live-mobile/page.tsx',{'../page':{default:page}}).default;
 const {getURLFromRedirectError,getRedirectStatusCodeFromError}=require('next/dist/client/components/redirect');
 assert.equal(mobile,page);
 for(const handler of [page,mobile])for(const params of [{},{fixture:'123'},{fixture:'not-a-number'},{fixture:['123','124']}]){
  await assert.rejects(()=>handler({searchParams:Promise.resolve(params)}),error=>{
   assert.equal(getURLFromRedirectError(error),params.fixture==='123'?'/live-tv?fixture=123':'/live-tv');
   assert.equal(getRedirectStatusCodeFromError(error),307);return true;
  });
 }
});
test('admin and dashboard have one canonical target and no mobile navigation branch',()=>{
 const admin=fs.readFileSync('app/admin/page.tsx','utf8'),dashboard=fs.readFileSync('app/dashboard/page.tsx','utf8');
 assert.equal((admin.match(/href="\/live-tv"/g)??[]).length,3);
 assert.equal(admin.includes('href="/live/live-mobile"'),false);
 assert.ok(dashboard.includes('const livePath = "/live-tv"'));
 assert.equal(dashboard.includes('setLivePath'),false);assert.equal(dashboard.includes('href="/live"'),false);
 assert.ok(dashboard.includes('?fixture=${id}'));
});
test('canonical terminal retains its auth guard and legacy component files remain as backups',()=>{
 const canonical=fs.readFileSync('app/live-tv/page.tsx','utf8');
 assert.match(canonical,/<AuthGuard>/);assert.ok(canonical.includes('@/components/ui/LiveTvDashboard'));
 assert.ok(fs.existsSync('components/ui/LiveTvMobile.tsx'));
 assert.ok(fs.readFileSync('components/ui/LiveTvMobile.tsx','utf8').includes('export default function LiveTvMobile')); // Backup wrappers stay local and are not test dependencies.
 const middleware=fs.readFileSync('middleware.ts','utf8');assert.ok(middleware.includes('"/live/:path*"'));assert.ok(middleware.includes('"/live-tv/:path*"'));
});
