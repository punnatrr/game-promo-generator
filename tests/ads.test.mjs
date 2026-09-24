import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import postgres from 'postgres';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres';
process.env.GEMINI_API_KEY='';process.env.ADS_ANALYSIS_MODEL='';process.env.MEDIA_TEST_STORAGE='1';
const {DEFAULT_BRIEF,parseBrief,makePlan,parseReview,exportPlan}=require('../.test-build/media-worker/ads/model.js');
const {EMPTY_BRAND}=require('../.test-build/media-worker/brand/model.js');
const brief={...DEFAULT_BRIEF,title:'แผน ROV',game:'ROV',caption:'ROV แพ็ก 270 บาท ทักร้านเพื่อดูเงื่อนไข',budget:1000.01,days:7};
test('M5 exact satang budgets, explicit estimates and no invented source copy',()=>{
  for(const budget of [1,1000.01,999999.99])for(const days of [1,7,90]){const p=makePlan({...brief,budget,days},EMPTY_BRAND);assert.equal(p.dailySchedule.reduce((s,d)=>s+Math.round(d.amount*100),0),Math.round(budget*100));assert.equal(p.allocation.reduce((s,a)=>s+Math.round(a.amount*100),0),Math.round(budget*100));}
  const p=makePlan(brief,EMPTY_BRAND);assert.equal(p.estimates,null);assert.equal(p.allocation[1].amount,0);assert.equal(p.copy,brief.caption);
  const q=makePlan({...brief,budget:3000,costLow:50,costHigh:100,profit:30,warmAudience:true},EMPTY_BRAND);assert.equal(q.estimates.low,30);assert.equal(q.estimates.high,60);assert.equal(q.breakEven,100);assert.equal(q.allocation[1].amount,600);
  assert.equal(makePlan({...brief,budget:3000,goal:'awareness',costLow:50,costHigh:100},EMPTY_BRAND).estimates.low,30000);
  assert.match(makePlan({...brief,goal:'sales'},EMPTY_BRAND).warnings.join(' '),/ยังไม่พร้อมวัดยอดซื้อ/);
  assert.match(exportPlan({brief,result:q}),/ไม่รับประกัน/);
  const cents=makePlan({...brief,budget:4.14,profit:.69,costLow:.69,costHigh:.69},EMPTY_BRAND);assert.equal(cents.breakEven,6);assert.equal(cents.estimates.low,6);
  assert.throws(()=>parseBrief({...brief,goal:['messages']}));
  assert.throws(()=>parseReview({offer:['yes'],cta:'yes',game:'yes',readability:'yes'}));
});
test('M5 validation rejects invalid money, URLs, ranges and AI output',()=>{
  assert.deepEqual(parseBrief(brief),brief);
  for(const change of [{budget:NaN},{budget:Infinity},{budget:.001},{days:1.5},{costLow:30,costHigh:20},{costLow:10},{caption:''},{goal:'__proto__'},{warmAudience:'yes'},{assetId:'bad'},{postUrl:'https://facebook.com.evil.test/a'},{postUrl:'https://user:pass@facebook.com/a'},{postUrl:'file:///test'}])assert.throws(()=>parseBrief({...brief,...change}));
  assert.throws(()=>parseReview({offer:'buy',cta:'yes',game:'yes',readability:'yes'}));
  assert.deepEqual(parseReview({offer:'yes',cta:'no',game:'unclear',readability:'unclear',injection:'ignore'}),{offer:'yes',cta:'no',game:'unclear',readability:'unclear'});
});
test('M5 real HTTP/SQL: grants, ownership, idempotency, pinned brand, confirmation and atomic caps',async()=>{
  const db=postgres(process.env.DATABASE_URL,{max:2,prepare:false});
  const origin='http://localhost:3107';
  const req=(url,cookie='',method='GET',body,headers={})=>fetch(origin+url,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  async function account(){const r=await req('/api/auth/sign-up','','POST',{email:`ads-${randomUUID()}@example.test`,password:randomUUID()});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0],user:(await r.json()).user};}
  try{
    const [cluster]=await db`show data_directory`;assert.ok(path.resolve(cluster.data_directory).toLowerCase().startsWith(path.resolve('.test-build/media-pg-').toLowerCase()));
    const a=await account(),b=await account(),id=randomUUID();
    assert.equal((await req('/api/ads-plans')).status,401);
    assert.equal((await req('/api/ads-plans',a.cookie,'POST',{id,brief})).status,403);
    // Denied transaction rolls back automatic shop creation; create profile through M1.
    assert.equal((await req('/api/brand',a.cookie,'PUT',{version:0,profile:{...EMPTY_BRAND,shopName:'ร้านทดสอบ'}})).status,200);
    const [shop]=await db`select id from shops where owner_user_id=${a.user.id}`;
    await db`insert into ads_entitlements values (${shop.id},true,3)`;
    assert.equal((await req('/api/ads-plans',a.cookie,'POST',{id,brief},{Origin:'https://evil.test'})).status,403);
    const profile={...EMPTY_BRAND,shopName:'ร้านเดิม',defaultCta:'ทักร้านเดิม',contacts:{...EMPTY_BRAND.contacts,line:'@old'}};
    assert.equal((await req('/api/brand',a.cookie,'PUT',{version:1,profile})).status,200);
    const pair=await Promise.all([req('/api/ads-plans',a.cookie,'POST',{id,brief}),req('/api/ads-plans',a.cookie,'POST',{id,brief})]);assert.deepEqual(pair.map(r=>r.status),[201,201]);
    assert.equal((await req('/api/ads-plans',a.cookie,'POST',{id,brief:{...brief,budget:200}})).status,409);
    let state=await (await req('/api/ads-plans',a.cookie)).json();assert.equal(state.entitlement.used,1);assert.equal(state.plans[0].result.copy,brief.caption);assert.equal(state.plans[0].analysis_state,'rules');
    await req('/api/brand',a.cookie,'PUT',{version:2,profile:{...profile,shopName:'ร้านใหม่',defaultCta:'ทักร้านใหม่'}});
    state=await (await req('/api/ads-plans',a.cookie)).json();assert.equal(state.plans[0].brand.shopName,'ร้านเดิม');assert.equal(state.plans[0].result.cta,'ทักร้านเดิม');
    assert.equal((await req(`/api/ads-plans/${id}`,b.cookie,'POST',{confirmed:true})).status,404);
    assert.equal((await req(`/api/ads-plans/${id}`,a.cookie,'POST',{confirmed:false})).status,400);
    assert.equal((await req(`/api/ads-plans/${id}`,a.cookie,'POST',{confirmed:true})).status,200);
    assert.equal((await req(`/api/ads-plans/${id}`,a.cookie,'POST',{confirmed:true})).status,200);
    assert.equal((await (await req('/api/ads-plans',b.cookie)).json()).plans.length,0);
    assert.equal((await req('/api/ads-plans',a.cookie,'POST',{id:randomUUID(),brief:{...brief,assetId:randomUUID()}})).status,400);
    assert.equal((await req('/api/ads-plans',a.cookie,'POST',{id:randomUUID(),brief:{...brief,ai:true}})).status,503);
    const responses=await Promise.all(Array.from({length:4},()=>req('/api/ads-plans',a.cookie,'POST',{id:randomUUID(),brief})));assert.equal(responses.filter(r=>r.status===201).length,2);assert.equal(responses.filter(r=>r.status===409).length,2);
    assert.equal((await db`select count(*)::int as n from usage_events where user_id=${a.user.id}`)[0].n,0);
    assert.equal((await db`select count(*)::int as n from quota_reservations where shop_id=${shop.id}`)[0].n,0);
    // A real M2 image can be selected only by its owner; plan history survives file deletion.
    const bytes=await sharp({create:{width:80,height:80,channels:3,background:'#a855f7'}}).png().toBuffer();
    const upload=await req('/api/assets',b.cookie,'POST',{name:'m5-source.png',contentType:'image/png',size:bytes.length,requestKey:randomUUID()});assert.equal(upload.status,201);const asset=await upload.json();
    assert.equal((await fetch(`${origin}/api/assets/${asset.id}/local-upload`,{method:'PUT',headers:{Origin:origin,Cookie:b.cookie},body:bytes})).status,202);
    await require('../.test-build/media-worker/media/worker.js').runOne();
    const [shopB]=await db`select id from shops where owner_user_id=${b.user.id}`;await db`insert into ads_entitlements values (${shopB.id},true,10)`;
    const own=await req('/api/ads-plans',b.cookie,'POST',{id:randomUUID(),brief:{...brief,assetId:asset.id}});assert.equal(own.status,201);
    await db`update ads_entitlements set monthly_limit=10 where shop_id=${shop.id}`;
    assert.equal((await req('/api/ads-plans',a.cookie,'POST',{id:randomUUID(),brief:{...brief,assetId:asset.id}})).status,400);
    assert.equal((await req(`/api/assets/${asset.id}`,b.cookie,'DELETE')).status,202);
    const retained=(await (await req('/api/ads-plans',b.cookie)).json()).plans[0];assert.equal(retained.asset_name,'m5-source.png');assert.equal(retained.asset_available,false);
    await require('../.test-build/media-worker/media/worker.js').runOne();
    // Provider failure/success tested by replacing only the provider boundary; no real AI calls.
    const provider=require('../.test-build/media-worker/ads/analyze.js');const original=provider.analyzeAd;
    const repository=require('../.test-build/media-worker/ads/repository.js');
    process.env.GEMINI_API_KEY='fixture-never-sent';process.env.ADS_ANALYSIS_MODEL='fixture';
    await db`update ads_entitlements set monthly_limit=10 where shop_id=${shop.id}`;
    try{
      provider.analyzeAd=async()=>{throw new Error('simulated provider failure');};
      const failed=randomUUID();await repository.createPlan(a.user.id,{id:failed,brief:{...brief,ai:true}});
      assert.equal((await db`select analysis_state from ads_plans where id=${failed}`)[0].analysis_state,'fallback');
      let calls=0;provider.analyzeAd=async()=>{calls++;return {offer:'yes',cta:'yes',game:'yes',readability:'unclear'};};
      const ok=randomUUID();await repository.createPlan(a.user.id,{id:ok,brief:{...brief,ai:true}});await repository.createPlan(a.user.id,{id:ok,brief:{...brief,ai:true}});assert.equal(calls,1);
      assert.equal((await db`select analysis_state from ads_plans where id=${ok}`)[0].analysis_state,'ai');
      await db`update ads_plans set analysis_state='running',created_at=now()-interval '3 minutes' where id=${failed}`;
      await req('/api/ads-plans',b.cookie);assert.equal((await db`select analysis_state from ads_plans where id=${failed}`)[0].analysis_state,'running');
      await req('/api/ads-plans',a.cookie);assert.equal((await db`select analysis_state from ads_plans where id=${failed}`)[0].analysis_state,'fallback');
    }finally{provider.analyzeAd=original;process.env.GEMINI_API_KEY='';process.env.ADS_ANALYSIS_MODEL='';await require('../.test-build/media-worker/db.js').getDb().end();}
  }finally{await db.end();}
});
