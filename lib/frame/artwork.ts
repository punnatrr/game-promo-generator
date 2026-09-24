import sharp,{type OverlayOptions} from 'sharp';
import path from 'node:path';
import {CONTACT_LABELS,type BrandProfile} from '../brand/model';
import {parseFrame,validateFrameBrand,type FramePlan} from './model';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
async function textImage(value:string,width:number,height:number,size:number,color='#ffffff'){
  const fontfile=process.env.FRAME_FONT_PATH||path.join(process.cwd(),'node_modules/@expo-google-fonts/prompt/400Regular/Prompt_400Regular.ttf');
  const result=await sharp({text:{text:`<span foreground="${color}">${escape(value)}</span>`,font:'Prompt '+size,fontfile,width,rgba:true,align:'center',wrap:'word-char'}}).png().toBuffer();
  return sharp(result).resize(width,height,{fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
}
export async function frameArtwork(image:Buffer,input:FramePlan,brand:BrandProfile,logo?:Buffer){
  const plan=parseFrame(input);validateFrameBrand(plan,brand);
  const primary=/^#[0-9a-f]{6}$/i.test(brand.primaryColor)?brand.primaryColor:'#a855f7';
  const backdrop=Buffer.from(`<svg width="720" height="1280"><rect width="720" height="440" fill="#08080e"/><rect y="920" width="720" height="360" fill="#08080e"/><rect x="0" y="80" width="720" height="4" fill="${primary}"/><rect x="24" y="968" width="672" height="64" rx="14" fill="${primary}"/></svg>`);
  const layers:OverlayOptions[]=[{input:backdrop,top:0,left:0}];
  const poster=await sharp(image,{limitInputPixels:40_000_000}).rotate().resize(672,290,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
  layers.push({input:poster.data,left:Math.floor((720-poster.info.width)/2),top:92+Math.floor((290-poster.info.height)/2)});
  async function add(text:string,top:number,height:number,size:number,width=672,left=24){if(!text)return;const rendered=await textImage(text,width,height,size);layers.push({input:rendered.data,top:top+Math.floor((height-rendered.info.height)/2),left:left+Math.floor((width-rendered.info.width)/2)});}
  if(plan.logo&&brand.logoId&&logo){const normalized=await sharp(logo,{limitInputPixels:16_000_000}).resize(56,56,{fit:'inside'}).png().toBuffer();layers.push({input:normalized,left:24,top:12});}
  await add(brand.shopName,14,52,26,plan.logo&&logo?592:672,plan.logo&&logo?104:24);
  await add(plan.headline,386,44,26);
  await add(plan.cta,978,44,26);
  if(plan.contact)await add(`${CONTACT_LABELS[plan.contact]}: ${brand.contacts[plan.contact]}`,1052,64,22);
  if(plan.payments)await add(brand.paymentMethods.join(' · '),1128,48,20);
  if(plan.trustIndex!==null)await add(brand.trustStatements[plan.trustIndex],1190,62,20);
  return sharp({create:{width:720,height:1280,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toBuffer();
}
