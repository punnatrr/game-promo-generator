// Run only against scripts/media-test-server.mjs (isolated loopback PostgreSQL).
// Playwright is supplied by the local browser tooling, not the production bundle.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const db=postgres('postgresql://postgres:postgres@127.0.0.1:55439/postgres',{max:1,connect_timeout:3});
const origin='http://localhost:3107';
const report={routes:[],checks:[],errors:[]};
const [cluster]=await db`show data_directory`;
assert.ok(path.resolve(cluster.data_directory).toLowerCase().startsWith(path.resolve('.test-build/media-pg-').toLowerCase()),'Must use disposable fixture');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 await mkdir('.test-build/ux',{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 // Use the real sign-up form and real auth/database endpoints.
 await page.goto(origin+'/sign-up');
 await page.waitForLoadState('networkidle');
 await page.getByLabel('ชื่อที่แสดง').fill('ร้านทดสอบ UX');
 const email=`ux-${randomUUID()}@example.test`;
 await page.getByLabel("อีเมล").fill(email);
 await page.getByLabel("รหัสผ่าน").fill(randomUUID());
 assert.equal(await page.getByLabel("อีเมล").inputValue(),email);
 const signupResponse=page.waitForResponse(r=>r.url().endsWith('/api/auth/sign-up') && r.request().method()==='POST');
 await page.getByRole('button',{name:'สร้างบัญชี',exact:true}).click();
 const signup=await signupResponse;
 console.log('Sign-up HTTP',signup.status());
 if (!signup.ok()) console.log(await signup.text());
 await page.waitForURL(origin+'/');
 await page.getByRole('heading',{name:'สร้างภาพโปรโมชัน'}).waitFor();
 report.checks.push('Sign-up → real session → Creator Studio');
 const [user]=await db`select id from users where email=${email}`;
 await page.goto(origin+'/dashboard/brand');
 await page.getByLabel("ชื่อร้าน").fill('ร้านทดสอบ UX');
 await page.getByRole('button',{name:'บันทึกข้อมูลร้าน',exact:true}).click();
 await page.getByText('บันทึกข้อมูลร้านแล้ว ข้อมูลเวอร์ชันก่อนหน้ายังคงอยู่').waitFor();
 const [shop]=await db`select id,current_brand_version from shops where owner_user_id=${user.id}`;
 assert.equal(shop.current_brand_version,1);
 report.checks.push('Brand form → API → versioned database save → success feedback');
 await db`insert into ads_entitlements values (${shop.id},true,20)`;
 await db`insert into motion_entitlements values (${shop.id},true,20)`;
 // Real planner creation, acknowledgement and text download.
 await page.goto(origin+'/dashboard/ads');
 await page.getByLabel("ชื่อแผน").fill('แผนทดสอบ UX');
 await page.getByLabel("เกม").fill('ROV');
 await page.getByLabel("ข้อความโพสต์").fill('แพ็ก ROV 270 บาท ติดต่อร้านเพื่อสอบถามเงื่อนไข');
 await page.getByLabel("งบรวม (บาท)").fill('700');
 await page.getByLabel("จำนวนวัน").fill('7');
 await page.locator('button[type=submit]').click();
 await page.getByRole('button',{name:'ดาวน์โหลดแผนข้อความ',exact:true}).waitFor();
 const saved=await db`select id from ads_plans where shop_id=${shop.id}`;
 assert.equal(saved.length,1);
 await page.getByLabel('ตรวจข้อมูลและสมมติฐานแล้ว รับทราบว่ายังไม่ใช่การยิงโฆษณา').check();
 await page.getByRole('button',{name:'ยืนยันว่าตรวจแผนแล้ว',exact:true}).click();
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='ยืนยันว่าตรวจแผนแล้ว'));
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'ดาวน์โหลดแผนข้อความ',exact:true}).click();
 const download=await downloadPromise;assert.ok((await download.suggestedFilename()).endsWith('.txt'));
 report.checks.push('Ads brief → real API/SQL → acknowledge → download');
 // Test permission-sensitive routes only with a local test administrator.
 await db`update users set role='admin' where id=${user.id}`;
 const routes=['/dashboard','/','/dashboard/brand','/dashboard/library','/dashboard/history','/dashboard/motion','/dashboard/frame','/dashboard/ads','/dashboard/support','/pricing','/checkout?plan=pro','/game-calendar','/game-news','/admin','/admin/payments','/admin/support','/admin/game-calendar','/admin/game-calendar/games','/admin/game-calendar/sources','/admin/game-tracker','/admin/game-tracker/games','/admin/game-tracker/sources'];
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:950});
  for(const route of routes) {
   const response=await page.goto(origin+route); assert.ok(response.status()<400,route+' HTTP status');
   await page.waitForLoadState('networkidle');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.creator-topnav')).display==='flex');
   if (['/','/dashboard/motion','/dashboard/frame','/dashboard/ads'].includes(route)) {
    const layout=await page.locator('.creator-workspace').evaluate(el=>{const [left,right]=el.children;const a=left.getBoundingClientRect(),b=right.getBoundingClientRect();return {left:a.width,right:b.width,side:b.x>a.x,below:b.y>a.y+a.height-2};});
    assert.ok(width>760?layout.side&&layout.right>layout.left:layout.below,route+' input/canvas arrangement');
   }
   const h1=await page.locator('h1').first().textContent({timeout:15000});assert.ok(h1?.trim(),route+' heading');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
   const overlay=await page.locator('[data-nextjs-dialog]').count();
   const unnamed = await page.locator('input,select,textarea').evaluateAll(elements => elements.filter(el => el.getClientRects().length && !el.closest('[aria-hidden=true]') && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.labels?.length && el.type !== 'hidden').map(el => ({tag:el.tagName,type:el.type,placeholder:el.getAttribute('placeholder')})));
   report.routes.push({route,width,heading:h1.trim(),overflow,overlay,unnamed});
   await page.screenshot({path:`.test-build/ux/${width}-${route.replace(/[^a-z0-9]+/gi,'_')||'home'}.png`,fullPage:false});
   console.log(`${overflow?'OVERFLOW':'PASS'} ${width} ${route}`);
  }
 }
 await writeFile('.test-build/ux/report.json',JSON.stringify(report,null,2));
 await page.goto(origin+'/dashboard');
 await page.waitForLoadState('networkidle');
 await page.locator('.account-menu summary').click();
 assert.equal(await page.locator('.account-menu[open]').count(),1);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.account-menu[open]').count(),0);
 assert.equal(await page.locator('.account-menu summary').evaluate(el=>el===document.activeElement),true);
 report.checks.push('Account menu opens, Escape closes and restores focus');
 // Upload/generation payload is intercepted: no paid AI calls.
 const bytes=await sharp({create:{width:320,height:320,channels:3,background:'#595386'}}).png().toBuffer();
 let generateRequests=0;
 await page.route('**/api/generate',async route=>{
  generateRequests++;
  const body=route.request().postDataBuffer().toString();
  for(const name of ['image1','image2','image3','targetShop','aspectRatio','aiModel','imageQuality','outputCount'])assert.ok(body.includes(`name="${name}"`),name+' payload');
  await route.fulfill({json:{image:`data:image/png;base64,${bytes.toString('base64')}`}});
 });
 await page.goto(origin+'/');
 await page.waitForLoadState('networkidle');
 for(const name of ['image1','image2','image3'])await page.locator(`input[name=${name}]`).setInputFiles({name:name+'.png',mimeType:'image/png',buffer:bytes});
 await page.getByLabel("ชื่อร้านของเรา").fill('ร้านทดสอบ UX');
 assert.equal(await page.locator('.advanced-settings').getAttribute('open'),null);
 await page.getByRole('button',{name:'สร้างภาพโปรโมท',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('button[type=submit]')?.getAttribute('aria-busy')!=='true');
 assert.equal(generateRequests,1);
 report.checks.push('Generator: three uploads, hidden advanced values in payload, single submit, mocked AI result');
 await page.goto(origin+'/dashboard/history');
 await page.waitForLoadState('networkidle');
 assert.ok(await page.getByRole('link',{name:'ดาวน์โหลด',exact:true}).count());
 report.checks.push('Generated local image is retained and downloadable in history');
 // Explicit failure path must preserve locally stored images.
 await page.route('**/api/history/me',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
 await page.reload();await page.locator('main [role=alert]').waitFor();
 assert.ok(await page.getByRole('link',{name:'ดาวน์โหลด',exact:true}).count());
 report.checks.push('History API failure preserves local work and offers recovery');
 await writeFile('.test-build/ux/report.json',JSON.stringify(report,null,2));
 assert.deepEqual(report.errors,[],'Browser runtime errors');
 assert.equal(report.routes.filter(r=>r.overflow||r.overlay).length,0,'Route layout/overlay errors; inspect report');
 console.log(JSON.stringify({checks:report.checks,routes:report.routes.length,errors:report.errors}));
} finally {await browser.close();await db.end();}
