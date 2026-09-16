import {getDb} from '../db';
import {readMedia} from '../media/storage';
import type {BrandProfile} from '../brand/model';
export async function boundedMedia(pathname:string,max:number,expected?:number){
  const file=await readMedia(pathname);
  if(!file||file.size>max||(expected!==undefined&&file.size!==expected)){await file?.stream.cancel();throw new Error('media_unavailable');}
  const reader=file.stream.getReader(),parts:Uint8Array[]=[];let size=0;
  const timeout=setTimeout(()=>{void reader.cancel();},60000);
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max){await reader.cancel();throw new Error('media_limit');}parts.push(part.value);}}finally{clearTimeout(timeout);}
  if(size!==file.size)throw new Error('media_incomplete');return Buffer.concat(parts);
}
export async function frameBrand(shopId:string,version:number,includeLogo:boolean){
  const db=getDb();const [row]=await db<{profile:BrandProfile}[]>`select profile from brand_profiles where shop_id=${shopId} and version=${version}`;
  if(!row)throw new Error('brand_unavailable');
  let logo:Buffer|undefined;
  if(includeLogo&&row.profile.logoId){
    const [asset]=await db`select l.blob_pathname from brand_logos l join shops s on s.owner_user_id=l.owner_user_id where l.id=${row.profile.logoId}::uuid and s.id=${shopId} and l.ready`;
    if(!asset)throw new Error('logo_unavailable');logo=await boundedMedia(asset.blob_pathname,2*1024*1024);
  }
  return {brand:row.profile,logo};
}
