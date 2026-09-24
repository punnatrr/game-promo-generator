// Real local API, browser and FFmpeg check; isolated database only, no paid generation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import sharp from 'sharp';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
process.env.DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55439/postgres';
process.env.MEDIA_TEST_STORAGE='1';process.env.NODE_ENV='test';process.env.GEMINI_API_KEY='';process.env.MOTION_VISION_MODEL='';
process.env.FFMPEG_PATH=require('../.test-build/brand-tools/node_modules/ffmpeg-static');process.env.FFPROBE_PATH=require('../.test-build/brand-tools/node_modules/ffprobe-static').path;
const {runOne}=require('../.test-build/media-worker/media/worker.js'),{runMotion}=require('../.test-build/media-worker/motion/worker.js'),{getDb}=require('../.test-build/media-worker/db.js'),{inspectMedia}=require('../.test-build/media-worker/media/inspect.js');
const db=postgres(process.env.DATABASE_URL,{max:1});const [cluster]=await db`show data_directory`;assert.ok(path.resolve(cluster.data_directory).toLowerCase().startsWith(path.resolve('.test-build/media-pg-').toLowerCase()));
const browser=await chromium.launch({channel:'msedge',headless:true}),origin='http://localhost:3107',checks=[];
try{
 await mkdir('.test-build/studio',{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const email=`studio-${randomUUID()}@example.test`,password=randomUUID();
 const signup=await context.request.post(origin+'/api/auth/sign-up',{headers:{Origin:origin},data:{email,password,displayName:'Studio Test'}});assert.equal(signup.status(),200);
 const {user}=await signup.json();
 await page.goto(origin+'/dashboard/motion');await page.getByRole('button',{name:'＋ อัปโหลดภาพ',exact:true}).waitFor();
 const brand=await (await context.request.get(origin+'/api/brand')).json();const savedBrand=await context.request.put(origin+'/api/brand',{headers:{Origin:origin},data:{profile:{...brand.profile,shopName:'Studio Test'},version:brand.version}});assert.equal(savedBrand.status(),200);
 const [shop]=await db`select id from shops where owner_user_id=${user.id}`;await db`insert into motion_entitlements values (${shop.id},true,10)`;
 const poster=await sharp(Buffer.from('<svg width="720" height="720"><rect width="720" height="720" fill="#251647"/><circle cx="540" cy="210" r="160" fill="#624aa0"/><text x="65" y="120" font-size="38" fill="#bdaaee">LAZY GAME SHOP</text><text x="65" y="380" font-size="90" fill="white">GAME PASS</text><text x="65" y="500" font-size="76" fill="#d5ff84">270 THB</text><text x="65" y="630" font-size="28" fill="white">TODAY ONLY</text></svg>')).png().toBuffer();
 await page.getByLabel('อัปโหลดภาพต้นฉบับ').setInputFiles({name:'game-promo.png',mimeType:'image/png',buffer:poster});
 await page.waitForFunction(()=>document.querySelector('select')?.value);
 for(let i=0;i<10;i++){await runOne();const [asset]=await db`select state from media_assets where shop_id=${shop.id} and name='game-promo.png'`;if(asset?.state==='ready')break;}
 await page.getByRole('button',{name:'เตรียมตัวอย่างวิดีโอ',exact:true}).waitFor();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='เตรียมตัวอย่างวิดีโอ')?.disabled);
 await page.getByLabel('การเคลื่อนไหว').selectOption('still');await page.getByLabel('ขนาดวิดีโอ').selectOption('1:1');
 await page.getByRole('button',{name:'เตรียมตัวอย่างวิดีโอ',exact:true}).click();
 await page.waitForResponse(r=>r.url().endsWith('/api/motion')&&r.request().method()==='GET');
 await runMotion();await page.getByLabel('ตรวจภาพและกรอบไฮไลต์แล้ว ใช้โควตา 1 คลิปเมื่อสร้างสำเร็จ').waitFor();
 assert.equal(await page.getByLabel('การเคลื่อนไหว').inputValue(),'still');assert.equal(await page.getByLabel('ขนาดวิดีโอ').inputValue(),'1:1');
 await page.screenshot({path:'.test-build/studio/motion-preview-desktop.png'});
 await page.getByLabel('ตรวจภาพและกรอบไฮไลต์แล้ว ใช้โควตา 1 คลิปเมื่อสร้างสำเร็จ').check();
 await page.getByRole('button',{name:'สร้างวิดีโอ',exact:true}).click();
 await page.waitForResponse(r=>/\/api\/motion\/[a-f0-9-]+$/.test(r.url())&&r.request().method()==='POST');
 console.log('Rendering actual MP4');await runMotion();await page.getByRole('link',{name:'ดาวน์โหลด MP4',exact:true}).waitFor();
 const downloadEvent=page.waitForEvent('download');await page.getByRole('link',{name:'ดาวน์โหลด MP4',exact:true}).click();const download=await downloadEvent;await download.saveAs('.test-build/studio/motion-result.mp4');const metadata=await inspectMedia(await readFile('.test-build/studio/motion-result.mp4'),'video');assert.equal(metadata.duration,6);assert.equal(metadata.width,metadata.height);
 await page.screenshot({path:'.test-build/studio/motion-result-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('.creator-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:'.test-build/studio/motion-result-mobile.png'});
 await page.getByRole('button',{name:'สร้างอีกเวอร์ชัน',exact:true}).last().click();assert.ok(await page.getByLabel('ภาพจากคลัง').inputValue());assert.equal(await page.getByLabel('ขนาดวิดีโอ').inputValue(),'1:1');checks.push('Direct upload → real media validation → preserved settings → review → real FFmpeg render → playable/downloadable 6s square MP4 → new version preserves source');
 await page.goto(origin+'/dashboard/library');await page.getByRole('link',{name:'ใช้สร้างวิดีโอ',exact:true}).click();await page.waitForURL('**/dashboard/motion?asset=*');await page.waitForFunction(()=>document.querySelector('select')?.value);checks.push('Library → reuse image directly in video Studio');
 // Returning daily user lands on the last creator feature after signing in.
 await context.request.post(origin+'/api/auth/sign-out',{headers:{Origin:origin}});await page.goto(origin+'/sign-in');await page.waitForLoadState('networkidle');await page.getByLabel('อีเมล').fill(email);await page.getByLabel('รหัสผ่าน').fill(password);await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL('**/dashboard/motion');checks.push('Sign-in returns to last creator feature');
 // Use the rendered clip and source in the frame editor, including automatic preview and revision approval.
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/dashboard/frame');await page.getByLabel('ภาพจากคลัง').waitFor();
 const assets=await (await context.request.get(origin+'/api/assets')).json();const source=assets.assets.find(a=>a.name==='game-promo.png'),clip=assets.assets.find(a=>a.kind==='video'&&a.state==='ready');
 await page.getByLabel('ภาพจากคลัง').selectOption(source.id);await page.getByLabel('คลิปจากคลัง').selectOption(clip.id);await page.getByRole('button',{name:'เตรียมกรอบจากข้อมูลร้าน',exact:true}).click();
 await page.getByRole('img',{name:'ตัวอย่างกรอบโปรโมชั่นและข้อมูลร้าน',exact:true}).waitFor();
 const confirm=page.getByLabel('ตรวจภาพ ข้อความ ข้อมูลร้าน และช่วงคลิปแล้ว ยืนยันใช้โควตา 1 คลิป');await confirm.check();await page.getByRole('button',{name:'ยืนยันและสร้าง MP4',exact:true}).click();await page.waitForResponse(r=>/\/api\/frame\/[a-f0-9-]+$/.test(r.url())&&r.request().method()==='POST');
 console.log('Rendering actual framed MP4');await runMotion();await page.locator('.creator-canvas').getByRole('link',{name:'ดาวน์โหลด MP4',exact:true}).waitFor();await page.screenshot({path:'.test-build/studio/frame-result-desktop.png'});checks.push('Frame image + clip → automatic preview → confirmed revision → real MP4 result in canvas');
 await db`update users set role='admin' where id=${user.id}`;
 await page.goto(origin+'/admin/game-tracker/games');await page.getByLabel('slug เช่น delta-force').waitFor();assert.equal(await page.locator('input').evaluateAll(es=>es.filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).length),0);checks.push('Admin game fields expose accessible labels');
 assert.deepEqual(errors,[]);await writeFile('.test-build/studio/report.json',JSON.stringify({checks,metadata,errors},null,2));console.log(JSON.stringify({checks,metadata,errors}));
}finally{await browser.close();await db.end();await getDb().end();}
