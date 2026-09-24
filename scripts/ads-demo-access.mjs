// Fixed loopback fixture only. Create ads-ui@example.test through the local browser first.
import postgres from 'postgres';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {EMPTY_BRAND}=require('../.test-build/media-worker/brand/model.js');
const db=postgres('postgresql://postgres:postgres@127.0.0.1:55439/postgres',{max:1,connect_timeout:2});
try{
  const [cluster]=await db`show data_directory`;
  if(!path.resolve(cluster.data_directory).toLowerCase().startsWith(path.resolve('.test-build/media-pg-').toLowerCase()))throw new Error('Not the disposable fixture');
  await db.begin(async tx=>{
    const [user]=await tx`select id from users where email='ads-ui@example.test'`;
    if(!user)throw new Error('Create the local demo account first');
    await tx`insert into shops(owner_user_id) values (${user.id}) on conflict do nothing`;
    const [shop]=await tx`select * from shops where owner_user_id=${user.id} for update`;
    if(!shop.current_brand_version){await tx`insert into brand_profiles(shop_id,version,profile,created_by) values (${shop.id},1,${tx.json({...EMPTY_BRAND,shopName:'ร้านตัวอย่าง M5',defaultCta:'ทักมาดูแพ็กที่ต้องการ',contacts:{...EMPTY_BRAND.contacts,line:'@demo-shop'}})},${user.id})`;await tx`update shops set current_brand_version=1 where id=${shop.id}`;}
    await tx`insert into ads_entitlements values (${shop.id},true,20) on conflict do nothing`;
  });
  console.log('Local M5 demo access granted');
}finally{await db.end();}
