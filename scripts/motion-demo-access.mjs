// Grant the known disposable browser-review account access only on the fixed loopback fixture.
import postgres from 'postgres';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {EMPTY_BRAND}=require('../.test-build/media-worker/brand/model.js');
const db=postgres('postgresql://postgres:postgres@127.0.0.1:55439/postgres',{max:1,connect_timeout:2});
try {
  await db.begin(async tx=>{
    const [user]=await tx`select id from users where email='motion-ui@example.test'`;
    if(!user)throw new Error('Create the demo account through the local sign-up page first.');
    await tx`insert into shops(owner_user_id) values (${user.id}) on conflict do nothing`;
    const [shop]=await tx`select * from shops where owner_user_id=${user.id} for update`;
    if(shop.current_brand_version===0){await tx`insert into brand_profiles(shop_id,version,profile,created_by) values (${shop.id},1,${tx.json(EMPTY_BRAND)},${user.id})`;await tx`update shops set current_brand_version=1 where id=${shop.id}`;}
    await tx`insert into motion_entitlements values (${shop.id},true,10) on conflict do nothing`;
  });
  console.log('Local demo video access granted.');
}finally{await db.end();}
