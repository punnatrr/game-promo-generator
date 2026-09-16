import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import postgres from 'postgres';
const require=createRequire(import.meta.url);
process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres';
process.env.MEDIA_TEST_STORAGE='1';process.env.NODE_ENV='test';process.env.GEMINI_API_KEY='';process.env.MOTION_VISION_MODEL='';
process.env.FFMPEG_PATH=require('../.test-build/brand-tools/node_modules/ffmpeg-static');
process.env.FFPROBE_PATH=require('../.test-build/brand-tools/node_modules/ffprobe-static').path;
const {getDb}=require('../.test-build/media-worker/db.js');
const {runOne}=require('../.test-build/media-worker/media/worker.js');
const {inspectMedia}=require('../.test-build/media-worker/media/inspect.js');
const {runMotion,claimMotion,expireMotionReviews}=require('../.test-build/media-worker/motion/worker.js');
const {DEFAULT_PLAN,parsePlan,OUTPUT_RESERVE}=require('../.test-build/media-worker/motion/model.js');
const {renderMotion}=require('../.test-build/media-worker/motion/render.js');
const db=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
const origin='http://localhost:3107';
const request=(path,cookie='',options={})=>fetch(origin+path,{...options,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...options.headers}});
async function account(){const r=await request('/api/auth/sign-up','',{method:'POST',body:JSON.stringify({email:`motion-${randomUUID()}@example.test`,password:randomUUID()})});assert.equal(r.status,200);return {cookie:r.headers.get('set-cookie').split(';')[0],user:(await r.json()).user};}
test('motion plans reject unsafe coordinates and unsupported renderer settings',()=>{
  for(const boxes of [[{x:-1,y:0,width:10,height:10,kind:'price'}],[{x:90,y:0,width:20,height:10,kind:'price'}],[{x:0,y:0,width:NaN,height:10,kind:'visual'}],Array(7).fill({x:0,y:0,width:20,height:10,kind:'price'})])assert.throws(()=>parsePlan({...DEFAULT_PLAN,boxes}));
  assert.throws(()=>parsePlan({...DEFAULT_PLAN,ratio:'9:16;movie=https://evil'}));
  assert.throws(()=>parsePlan({...DEFAULT_PLAN,duration:3600}));
});
test('actual FFmpeg creates bounded MP4 with all poster corners visible',async()=>{
  const source=await sharp({create:{width:400,height:400,channels:3,background:'#f0f0f0'}}).composite([{input:Buffer.from('<svg width="400" height="400"><rect x="0" y="0" width="40" height="40" fill="red"/><rect x="360" y="360" width="40" height="40" fill="blue"/><text x="80" y="220" font-size="50" fill="black">270 THB</text></svg>')}]).png().toBuffer();
  await writeFile('.test-build/motion-poster.png',source);
  const output=await renderMotion(source,{...DEFAULT_PLAN,effect:'still',boxes:[{x:18,y:40,width:65,height:20,kind:'price'}]});
  await writeFile('.test-build/motion-result.mp4',output.bytes);
  const metadata=await inspectMedia(output.bytes,'video');assert.equal(metadata.width,720);assert.equal(metadata.height,1280);assert.equal(metadata.duration,6);assert.ok(output.bytes.length<OUTPUT_RESERVE);
  const {execFileSync}=await import('node:child_process');
  execFileSync(process.env.FFMPEG_PATH,['-loglevel','error','-y','-ss','1','-i','.test-build/motion-result.mp4','-frames:v','1','.test-build/motion-frame.png'],{windowsHide:true});
  const {data,info}=await sharp('.test-build/motion-frame.png').raw().toBuffer({resolveWithObject:true});
  const pixel=(x,y)=>[...data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3)];
  const red=pixel(45,325),blue=pixel(675,955);assert.ok(red[0]>180&&red[2]<80);assert.ok(blue[2]>180&&blue[0]<80);
});
test('M3 API + PostgreSQL + real worker: entitlements, approval, idempotency, leases, quota and cleanup',async()=>{
 try{
  assert.equal((await request('/api/motion')).status,401);
  const a=await account(),b=await account();
  const bytes=await sharp({create:{width:320,height:180,channels:3,background:'#8b5cf6'}}).png().toBuffer();
  const asset=await (await request('/api/assets',a.cookie,{method:'POST',body:JSON.stringify({name:'motion-source.png',size:bytes.length,contentType:'image/png',requestKey:randomUUID()})})).json();
  assert.equal((await request(`/api/assets/${asset.id}/local-upload`,a.cookie,{method:'PUT',body:bytes})).status,202);await runOne();
  const [shop]=await db`select id from shops where owner_user_id=${a.user.id}`;
  const draft={id:randomUUID(),sourceAssetId:asset.id,title:'โมชั่นโปรโมชั่น'};
  const create=(payload=draft,cookie=a.cookie)=>request('/api/motion',cookie,{method:'POST',body:JSON.stringify(payload)});
  assert.equal((await create()).status,403);
  await db`insert into motion_entitlements values (${shop.id},true,2)`;
  assert.equal((await create()).status,201);assert.equal((await create()).status,201);
  assert.equal((await create({...draft,title:'different'})).status,409);
  assert.equal((await request('/api/motion',a.cookie,{method:'POST',headers:{Origin:'https://elsewhere.test'},body:JSON.stringify(draft)})).status,403);
  assert.equal((await request(`/api/assets/${asset.id}`,a.cookie,{method:'DELETE'})).status,409);
  assert.equal((await request(`/api/assets/${asset.id}/preview`,b.cookie)).status,404);
  assert.equal((await request(`/api/assets/${asset.id}/preview`,a.cookie)).status,200);
  await runMotion();
  const list=async()=>(await request('/api/motion',a.cookie)).json();
  let current=(await list()).jobs.find(j=>j.id===draft.id);assert.equal(current.state,'review');assert.equal(current.analysis_source,'manual');
  const payload={revision:current.revision,plan:{...DEFAULT_PLAN,boxes:[{x:10,y:60,width:80,height:20,kind:'price'}]},confirmed:true};
  const render=(body=payload,cookie=a.cookie,jobId=draft.id)=>request(`/api/motion/${jobId}`,cookie,{method:'POST',body:JSON.stringify(body)});
  assert.equal((await render({...payload,confirmed:false})).status,400);
  assert.equal((await render({...payload,revision:1})).status,409);
  assert.equal((await render(payload,b.cookie)).status,404);
  const dup=await Promise.all([render(),render()]);assert.deepEqual(dup.map(r=>r.status),[202,202]);
  let state=await list();assert.equal(state.entitlement.reserved,1);assert.equal(state.entitlement.used,0);
  current=state.jobs.find(j=>j.id===draft.id);
  assert.equal((await request(`/api/assets/${current.output_asset_id}`,a.cookie,{method:'DELETE'})).status,409);
  assert.equal((await request(`/api/assets/${current.output_asset_id}`,a.cookie)).status,404);
  const claims=await Promise.all([claimMotion(),claimMotion()]);assert.equal(claims.filter(Boolean).length,1);
  await db`update motion_jobs set lease_until=now()-interval '1 second' where id=${draft.id}`;
  // A delayed queue must still give the completed video its full retention window.
  await db`update media_assets set expires_at=now()-interval '1 day' where id=${current.output_asset_id}`;
  await runMotion();
  state=await list();current=state.jobs.find(j=>j.id===draft.id);assert.equal(current.state,'succeeded');assert.equal(state.entitlement.used,1);assert.equal(state.entitlement.reserved,0);
  const video=await request(`/api/assets/${current.output_asset_id}`,a.cookie);assert.equal(video.status,200);const output=Buffer.from(await video.arrayBuffer());assert.equal((await inspectMedia(output,'video')).duration,6);
  const [storage]=await db`select * from usage_buckets where shop_id=${shop.id} and meter='storage_bytes'`;assert.equal(Number(storage.used_units),bytes.length+output.length);assert.equal(Number(storage.reserved_units),0);
  const [retention]=await db`select expires_at>now()+interval '29 days' as full_window from media_assets where id=${current.output_asset_id}`;assert.equal(retention.full_window,true);
  assert.equal((await render()).status,202);assert.equal((await list()).entitlement.used,1);
  const [charge]=await db`select count(*)::int as n from motion_ledger l join motion_reservations r on r.id=l.reservation_id where r.job_id=${draft.id} and l.event='charge'`;assert.equal(charge.n,1);
  const pending={...draft,id:randomUUID()};await create(pending);await runMotion();const second=(await list()).jobs.find(j=>j.id===pending.id);
  await render({...payload,revision:second.revision},a.cookie,pending.id);
  const third={...draft,id:randomUUID()};await create(third);await runMotion(); // oldest queued render succeeds before analysis
  await runMotion();const thirdState=(await list()).jobs.find(j=>j.id===third.id);
  assert.equal((await render({...payload,revision:thirdState.revision},a.cookie,third.id)).status,409);
  assert.equal((await request(`/api/motion/${third.id}`,a.cookie,{method:'DELETE'})).status,200);
  // Separate future budget for deterministic failure/recovery cases, only in this loopback test.
  await db`update usage_buckets set limit_units=5 where shop_id=${shop.id} and meter='video_render'`;
  const failed={...draft,id:randomUUID()};await create(failed);await runMotion();const failurePlan=(await list()).jobs.find(j=>j.id===failed.id);
  await render({...payload,revision:failurePlan.revision},a.cookie,failed.id);
  const actual=process.env.FFMPEG_PATH;process.env.FFMPEG_PATH='missing-motion-ffmpeg';
  for(let i=0;i<3;i++){
    await db`update motion_jobs set available_at=now() where id=${failed.id}`;
    await db`update motion_attempts set started_at=now()-interval '2 hours' where job_id=${failed.id}`;
    await runMotion();
  }
  process.env.FFMPEG_PATH=actual;
  assert.equal((await list()).entitlement.reserved,1);
  await db`update motion_jobs set available_at=now() where id=${failed.id}`;await db`update motion_attempts set started_at=now()-interval '2 hours' where job_id=${failed.id}`;await runMotion();
  state=await list();assert.equal(state.jobs.find(j=>j.id===failed.id).state,'failed');assert.equal(state.entitlement.reserved,0);assert.equal(state.entitlement.used,2);
  const expired={...draft,id:randomUUID()};await create(expired);await db`update motion_jobs set review_deadline=now()-interval '1 second' where id=${expired.id}`;await expireMotionReviews();assert.equal((await list()).jobs.find(j=>j.id===expired.id).state,'cancelled');
  const cancelled={...draft,id:randomUUID()};await create(cancelled);await runMotion();const cancelPlan=(await list()).jobs.find(j=>j.id===cancelled.id);
  await render({...payload,revision:cancelPlan.revision},a.cookie,cancelled.id);assert.equal((await list()).entitlement.reserved,1);
  assert.equal((await request(`/api/motion/${cancelled.id}`,a.cookie,{method:'DELETE'})).status,200);
  assert.equal((await request(`/api/motion/${cancelled.id}`,a.cookie,{method:'DELETE'})).status,200);
  state=await list();assert.equal(state.entitlement.reserved,0);assert.equal(state.entitlement.used,2);assert.equal(state.jobs.find(j=>j.id===cancelled.id).state,'cancelled');
  assert.equal(Number((await db`select reserved_units from usage_buckets where shop_id=${shop.id} and meter='storage_bytes'`)[0].reserved_units),0);
  assert.equal((await db`select count(*)::int as n from usage_events where user_id=${a.user.id}`)[0].n,0);
 }finally{await db.end();await getDb().end();}
});
