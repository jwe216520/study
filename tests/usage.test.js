import test from 'node:test';
import assert from 'node:assert/strict';
import {createMonitorHandler,monitorConfig,readCloudflare,readSupabase} from '../lib/usage-server.js';
import {usageLevel,materialUsage} from '../lib/usage.js';
const config={admin:'owner',account:'account',cfToken:'private-cf',sbToken:'private-sb',project:'abcdefghijklmnopqrst'};
const now=new Date('2026-10-07T23:59:00Z');
const request=(token='owner')=>new Request('https://study.example/api/usage',{headers:token?{Authorization:`Bearer ${token}`}:{}});
test('monitor configuration distinguishes missing and invalid URLs without crashing the route',async()=>{
 const valid=monitorConfig({NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',MONITOR_SUPABASE_TOKEN:'test-token'});
 assert.equal(valid.project,'abcdefghijklmnopqrst');assert.equal(valid.projectError,'');
 for(const url of [undefined,'not-a-url','https://invalid.local','http://abcdefghijklmnopqrst.supabase.co']){
  const result=monitorConfig({NEXT_PUBLIC_SUPABASE_URL:url,MONITOR_SUPABASE_TOKEN:'test-token'});
  assert.equal(result.project,'');assert.match(result.projectError,/Build variables/);
  const report=await readSupabase(result,()=>{throw new Error('Must not query an invalid project');});
  assert.equal(report.status,'error');assert.equal(report.message,result.projectError);
 }
});
test('server authentication network failures are service failures rather than expired sessions',async()=>{
 const handler=createMonitorHandler({getConfig:()=>config,authenticate:async()=>{throw new TypeError('fetch failed');}});
 const response=await handler(request());assert.equal(response.status,503);
 assert.match((await response.json()).error,/伺服器無法連線/);
 const failed=await readSupabase(config,async()=>{throw new TypeError('fetch failed');},now);
 assert.equal(failed.status,'error');assert.match(failed.message,/查詢失敗/);
 assert.match(failed.metrics.database.message,/Supabase 統計服務/);
});
test('usage endpoint rejects unauthenticated and non-owner before any management request',async()=>{
 let calls=0;const handler=createMonitorHandler({getConfig:()=>config,authenticate:async t=>t==='Bearer invalid'?null:{id:t.slice(7)},fetcher:async()=>{calls++;throw Error('Must not fetch');}});
 assert.equal((await handler(request(null))).status,401);assert.equal((await handler(request('invalid'))).status,401);assert.equal((await handler(request('other'))).status,403);assert.equal(calls,0);
});
test('authorized metrics remain private; cache avoids repeated upstream queries and expires at UTC rollover',async()=>{
 let calls=0,current=now;
 const fetcher=async(url,options)=>{calls++;const body=JSON.parse(options.body);if(url.includes('cloudflare')){assert(!body.query.includes('dimensions'));return Response.json({data:{viewer:{accounts:[{total:[{sum:{requests:90000,errors:2}}],study:[{sum:{requests:120,errors:1}}]}]}}});}
 assert(url.endsWith('/database/query/read-only'));assert(body.query.startsWith('select '));return Response.json([{bytes:'1000000'}]);};
 const handler=createMonitorHandler({getConfig:()=>config,authenticate:async t=>({id:t.slice(7)}),fetcher,clock:()=>current});
 const first=await handler(request());assert.equal(first.headers.get('cache-control'),'private, no-store');const payload=await first.json();assert.equal(payload.cloudflare.requests,90000);assert.equal(payload.supabase.metrics.database.value,1);assert.equal(calls,3);assert(!JSON.stringify(payload).includes('private-cf'));assert(!JSON.stringify(payload).includes('private-sb'));
 assert.equal((await (await handler(request())).json()).cached,true);assert.equal(calls,3);assert.equal((await handler(request('other'))).status,403);
 current=new Date('2026-10-08T00:00:01Z');await handler(request());assert.equal(calls,6);
});
test('missing credentials, empty datasets, and partial failures never masquerade as zero',async()=>{
 assert.equal((await readCloudflare({})).status,'unconfigured');
 const empty=await readCloudflare(config,async()=>Response.json({data:{viewer:{accounts:[{total:[],study:[]}]}}}),now);assert.equal(empty.requests,null);
 const partial=await readSupabase(config,async(_url,options)=>JSON.parse(options.body).query.includes('storage.objects')?new Response('',{status:403}):Response.json([{bytes:200000000}]),now);
 assert.equal(partial.metrics.database.value,200);assert.equal(partial.metrics.storage.value,null);assert.match(partial.metrics.storage.message,/授權/);
 const fail=await readCloudflare(config,async()=>Response.json({errors:[{message:'secret private-cf'}]}),now);assert.equal(fail.status,'error');assert(!fail.message.includes('private-cf'));
});
test('thresholds and conservative material accounting',()=>{
 assert.equal(usageLevel(null,100),'unknown');assert.equal(usageLevel(70,100),'warning');assert.equal(usageLevel(90,100),'critical');assert.equal(usageLevel(100,100),'danger');
 assert.deepEqual(materialUsage([{bytes:100,status:'ready'},{bytes:200,status:'delete_pending'},{bytes:400,status:'deleted'},{bytes:300,status:'uploading'}]),{bytes:600,count:3,pending:2});
});
