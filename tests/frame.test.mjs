import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import postgres from 'postgres';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres';process.env.MEDIA_TEST_STORAGE='1';process.env.NODE_ENV='test';process.env.GEMINI_API_KEY='';process.env.MOTION_VISION_MODEL='';
process.env.FFMPEG_PATH=require('../.test-build/brand-tools/node_modules/ffmpeg-static');process.env.FFPROBE_PATH=require('../.test-build/brand-tools/node_modules/ffprobe-static').path;
const {getDb}=require('../.test-build/media-worker/db.js');
const {runOne,sweepExpired}=require('../.test-build/media-worker/media/worker.js');
const {runMotion}=require('../.test-build/media-worker/motion/worker.js');
const {DEFAULT_FRAME,parseFrame,validateFrameBrand}=require('../.test-build/media-worker/frame/model.js');
const {renderFrame}=require('../.test-build/media-worker/frame/render.js');
const {frameArtwork}=require('../.test-build/media-worker/frame/artwork.js');
const {EMPTY_BRAND}=require('../.test-build/media-worker/brand/model.js');
const db=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
const origin='http://localhost:3107';
const request=(path,cookie='',options={})=>fetch(origin+path,{...options,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...options.headers}});
const post=(path,cookie,data)=>request(path,cookie,{method:'POST',body:JSON.stringify(data)});
async function account(){const response=await post('/api/auth/sign-up','',{email:`frame-${randomUUID()}@example.test`,password:randomUUID()});assert.equal(response.status,200);return {cookie:response.headers.get('set-cookie').split(';')[0],user:(await response.json()).user};}
const profile={...EMPTY_BRAND,shopName:'ร้านทดสอบ M4',defaultCta:'ทักมาสั่งซื้อ',contacts:{...EMPTY_BRAND.contacts,line:'@testshop'},paymentMethods:['PromptPay'],trustStatements:['ร้านตรวจสอบรายการก่อนเติม'],claimsConfirmed:true};
const plan={...DEFAULT_FRAME,headline:'โปรโมชั่นเกมวันนี้',cta:'ทักเลย',contact:'line',payments:true,trustIndex:0};
let poster,clip;
function probe(filename){return JSON.parse(execFileSync(process.env.FFPROBE_PATH,['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',filename],{windowsHide:true,encoding:'utf8'}));}
test('M4 validation preserves trusted brand choices and rejects malformed frame plans',()=>{
  assert.throws(()=>parseFrame({...plan,start:-1}));assert.throws(()=>parseFrame({...plan,fit:'file:///bad'}));assert.throws(()=>parseFrame({...plan,duration:120}));assert.throws(()=>parseFrame({...plan,headline:'x'.repeat(61)}));assert.throws(()=>parseFrame({...plan,contact:'invented'}));
  assert.throws(()=>validateFrameBrand(plan,EMPTY_BRAND));assert.throws(()=>validateFrameBrand({...plan,trustIndex:1},profile));validateFrameBrand(plan,profile);
});
test('M4 real renderer: Thai frame, untouched poster, clip fit, audio and mute',async()=>{
  poster=await sharp({create:{width:400,height:400,channels:3,background:'#f0f0f0'}}).composite([{input:Buffer.from('<svg width="400" height="400"><rect width="40" height="40" fill="red"/><rect x="360" y="360" width="40" height="40" fill="blue"/><text x="80" y="220" font-size="50">270 THB</text></svg>')}]).png().toBuffer();
  await writeFile('.test-build/frame-poster.png',poster);
  execFileSync(process.env.FFMPEG_PATH,['-v','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=10','-f','lavfi','-i','sine=frequency=440:duration=10','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','.test-build/frame-clip.mp4'],{windowsHide:true,timeout:30000});
  clip=await readFile('.test-build/frame-clip.mp4');
  await writeFile('.test-build/frame-preview.png',await frameArtwork(poster,plan,profile));
  const output=await renderFrame(poster,clip,plan,profile);await writeFile('.test-build/frame-result.mp4',output.bytes);
  let info=probe('.test-build/frame-result.mp4');assert.equal(info.streams.find(s=>s.codec_type==='video').width,720);assert.equal(info.streams.find(s=>s.codec_type==='video').height,1280);assert.ok(info.streams.some(s=>s.codec_type==='audio'));assert.ok(Math.abs(Number(info.format.duration)-6)<.1);
  execFileSync(process.env.FFMPEG_PATH,['-v','error','-i','.test-build/frame-result.mp4','-f','null','-'],{windowsHide:true});
  execFileSync(process.env.FFMPEG_PATH,['-v','error','-y','-ss','1','-i','.test-build/frame-result.mp4','-frames:v','1','.test-build/frame-export.png'],{windowsHide:true});
  const {data,info:im}=await sharp('.test-build/frame-export.png').raw().toBuffer({resolveWithObject:true});const pixel=(x,y)=>[...data.subarray((y*im.width+x)*im.channels,(y*im.width+x)*im.channels+3)];
  const red=pixel(230,105),blue=pixel(490,370);assert.ok(red[0]>180&&red[2]<80);assert.ok(blue[2]>180&&blue[0]<80);
  const muted=await renderFrame(poster,clip,{...plan,audio:false,fit:'cover',start:2},profile);await writeFile('.test-build/frame-muted.mp4',muted.bytes);info=probe('.test-build/frame-muted.mp4');assert.equal(info.streams.filter(s=>s.codec_type==='audio').length,0);
  await assert.rejects(()=>renderFrame(poster,clip,{...plan,start:8},profile));
});
test('M4 HTTP + database + worker: owner isolation, pinned brand, protected clip, shared quota and ranges',async()=>{
  try{
    const a=await account(),b=await account();
    async function upload(name,type,bytes){const response=await post('/api/assets',a.cookie,{name,contentType:type,size:bytes.length,requestKey:randomUUID()});assert.equal(response.status,201);const asset=await response.json();assert.equal((await request(`/api/assets/${asset.id}/local-upload`,a.cookie,{method:'PUT',body:bytes})).status,202);await runOne();return asset;}
    const image=await upload('โปรโมชั่น.png','image/png',poster),video=await upload('คลิปเกม.mp4','video/mp4',clip);
    const [shop]=await db`select id from shops where owner_user_id=${a.user.id}`;
    const draft={id:randomUUID(),sourceAssetId:image.id,clipAssetId:video.id,title:'ชุดกรอบโปรโมชั่น'};
    assert.equal((await post('/api/frame',a.cookie,draft)).status,403);
    await db`insert into motion_entitlements values (${shop.id},true,2)`;
    assert.equal((await request('/api/brand',a.cookie,{method:'PUT',body:JSON.stringify({version:1,profile})})).status,200);
    assert.equal((await post('/api/frame',a.cookie,draft)).status,201);assert.equal((await post('/api/frame',a.cookie,draft)).status,201);
    assert.equal((await post('/api/frame',a.cookie,{...draft,title:'different'})).status,409);
    assert.equal((await request(`/api/frame/${draft.id}`,b.cookie)).status,404);
    assert.equal((await post(`/api/frame/${draft.id}/preview`,b.cookie,plan)).status,404);
    assert.equal((await request(`/api/assets/${video.id}`,a.cookie,{method:'DELETE'})).status,409);
    assert.equal((await request('/api/brand',a.cookie,{method:'PUT',body:JSON.stringify({version:2,profile:{...profile,shopName:'ชื่อใหม่',contacts:{...profile.contacts,line:'@new'}}})})).status,200);
    const detail=await (await request(`/api/frame/${draft.id}`,a.cookie)).json();assert.equal(detail.brandVersion,2);assert.equal(detail.brand.contacts.line,'@testshop');
    const preview=await post(`/api/frame/${draft.id}/preview`,a.cookie,plan);assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/png');
    assert.equal((await post(`/api/frame/${draft.id}/preview`,a.cookie,{...plan,trustIndex:4})).status,400);
    const range=await request(`/api/assets/${video.id}?inline=1`,a.cookie,{headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),clip.subarray(0,32));
    const suffix=await request(`/api/assets/${video.id}?inline=1`,a.cookie,{headers:{Range:'bytes=-16'}});assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),clip.subarray(-16));
    assert.equal((await request(`/api/assets/${video.id}?inline=1`,a.cookie,{headers:{Range:'bytes=999999999-'}})).status,416);
    assert.equal((await request(`/api/assets/${video.id}?inline=1`,b.cookie,{headers:{Range:'bytes=0-31'}})).status,404);
    const render={revision:detail.revision,frame:plan,confirmed:true};
    assert.equal((await post(`/api/frame/${draft.id}`,a.cookie,{...render,confirmed:false})).status,400);
    assert.equal((await post(`/api/frame/${draft.id}`,a.cookie,{...render,frame:{...plan,start:9}})).status,400);
    const responses=await Promise.all([post(`/api/frame/${draft.id}`,a.cookie,render),post(`/api/frame/${draft.id}`,a.cookie,render)]);assert.deepEqual(responses.map(r=>r.status),[202,202]);
    assert.equal((await (await request('/api/motion',a.cookie)).json()).jobs.length,0);
    assert.equal((await (await request('/api/frame',a.cookie)).json()).entitlement.reserved,1);
    await db`update media_assets set expires_at=now()-interval '1 second' where id=${video.id}`;await sweepExpired();assert.equal((await db`select state from media_assets where id=${video.id}`)[0].state,'ready');
    await db`update media_assets set expires_at=now()+interval '30 days' where id=${video.id}`;
    await runMotion();const state=await (await request('/api/frame',a.cookie)).json();assert.equal(state.jobs[0].state,'succeeded');assert.equal(state.entitlement.used,1);assert.equal(state.entitlement.reserved,0);
    const output=await request(`/api/assets/${state.jobs[0].output_asset_id}`,a.cookie);assert.equal(output.status,200);await writeFile('.test-build/frame-api-result.mp4',Buffer.from(await output.arrayBuffer()));assert.ok(probe('.test-build/frame-api-result.mp4').streams.some(s=>s.codec_type==='audio'));
    assert.equal((await db`select count(*)::int as n from usage_events where user_id=${a.user.id}`)[0].n,0);
  }finally{await db.end();await getDb().end();}
});
