import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {metaFile,metaRow,parseMetaSetup}=require('../.test-build/media-worker/ads/meta-export.js');
const columns=require('../lib/ads/meta-columns.json');
const {DEFAULT_BRIEF}=require('../.test-build/media-worker/ads/model.js');
const b={...DEFAULT_BRIEF,title:'โปร ROV',game:'ROV',caption:'270 บาท',budget:3000,days:10};
const setup={pageId:'123456789',storyId:'987654321',creativeType:'Photo Page Post Ad',start:'2026-10-01T09:00',ageMin:18,ageMax:65,confirmed:true};
test('Meta template preserves 456-column order and UTF16 TSV; new objects are always paused',()=>{
  assert.equal(columns.length,456);assert.equal(new Set(columns).size,456);
  const checked=parseMetaSetup(setup,Date.parse('2026-09-21T00:00Z'));const row=metaRow(b,checked);const bytes=metaFile(b,checked);
  assert.deepEqual([...bytes.subarray(0,2)],[255,254]);const lines=bytes.subarray(2).toString('utf16le').split('\r\n');assert.equal(lines[0],columns.join('\t'));assert.equal(lines[1].split('\t').length,456);
  for(const key of ['Campaign Status','Ad Set Run Status','Ad Status'])assert.equal(row[key],'PAUSED');
  for(const key of ['Campaign ID','Ad Set ID','Ad ID','Image Hash','Video ID','Custom Audiences','Flexible Inclusions','Regional Regulated Categories','Body'])assert.equal(row[key],undefined);
  assert.equal(row['Story ID'],'s:987654321');assert.equal(row['Link Object ID'],'o:123456789');assert.equal(row['Ad Set Lifetime Budget'],'3000.00');assert.equal(row['Ad Set Daily Budget'],undefined);
  assert.equal(row['Ad Set Time Start'],'10/01/2026 9:00:00 am');assert.equal(row['Ad Set Time Stop'],'10/11/2026 9:00:00 am');
  assert.ok(metaFile({...b,title:'โปร "พิเศษ"'},setup).subarray(2).toString('utf16le').includes('"โปร ""พิเศษ"""'));
});
test('Meta export refuses incompatible plans, invalid dates, formula names and unconfirmed settings',()=>{
  for(const change of [{goal:'sales'},{country:'US'},{warmAudience:true},{audience:'เฉพาะกลุ่ม'},{title:'=SUM(1,2)'}])assert.throws(()=>metaRow({...b,...change},setup));
  const now=Date.parse('2026-09-21T00:00Z');
  for(const change of [{pageId:'o:123'},{storyId:'pfbidABC'},{confirmed:false},{start:'2026-02-30T09:00'},{start:'2026-09-21T07:01'},{ageMin:17},{ageMin:60,ageMax:30},{creativeType:'custom'}])assert.throws(()=>parseMetaSetup({...setup,...change},now));
});
test('Meta export endpoint checks owner, prior acknowledgement and same-origin before creating a file',async()=>{
  const db=postgres('postgresql://postgres:postgres@127.0.0.1:55439/postgres',{max:1,connect_timeout:3});const origin='http://localhost:3107';
  const request=(url,cookie='',body,method='POST',originHeader=origin)=>fetch(origin+url,{method,headers:{Origin:originHeader,Cookie:cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  try{
    const [cluster]=await db`show data_directory`;assert.ok(path.resolve(cluster.data_directory).toLowerCase().startsWith(path.resolve('.test-build/media-pg-').toLowerCase()));
    const response=await request('/api/auth/sign-up','',{email:`meta-${randomUUID()}@example.test`,password:randomUUID()});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],user=(await response.json()).user;
    const {EMPTY_BRAND}=require('../.test-build/media-worker/brand/model.js');await request('/api/brand',cookie,{version:0,profile:{...EMPTY_BRAND,shopName:'Meta test'}},'PUT');
    const [shop]=await db`select id from shops where owner_user_id=${user.id}`;await db`insert into ads_entitlements values (${shop.id},true,5)`;
    const id=randomUUID();assert.equal((await request('/api/ads-plans',cookie,{id,brief:b})).status,201);
    const url=`/api/ads-plans/${id}/meta-export`;
    const future=new Date(Date.now()+86400000+7*3600000).toISOString().slice(0,16);const data={...setup,start:future};
    assert.equal((await request(url,'',data)).status,401);assert.equal((await request(url,cookie,data)).status,409);
    await request(`/api/ads-plans/${id}`,cookie,{confirmed:true});
    assert.equal((await request(url,cookie,data,'POST','https://evil.test')).status,403);
    assert.equal((await request(`/api/ads-plans/${randomUUID()}/meta-export`,cookie,data)).status,404);
    assert.equal((await request(url,cookie,{...data,confirmed:false})).status,400);
    const exportResponse=await request(url,cookie,data);assert.equal(exportResponse.status,200);assert.equal(exportResponse.headers.get('x-meta-template'),'meta-export-20260921-456');
    const bytes=Buffer.from(await exportResponse.arrayBuffer());assert.ok(bytes.subarray(2).toString('utf16le').includes('PAUSED'));assert.equal((await db`select count(*)::int as n from ads_plans where shop_id=${shop.id}`)[0].n,1);
  }finally{await db.end();}
});
