import { id,object,textField,MediaError } from '../media/model';
import { CONTACT_LABELS,type BrandProfile } from '../brand/model';
export type FramePlan={duration:6|10|15;start:number;fit:'contain'|'cover';audio:boolean;headline:string;cta:string;contact:keyof typeof CONTACT_LABELS|'';payments:boolean;trustIndex:number|null;logo:boolean};
export const DEFAULT_FRAME:FramePlan={duration:6,start:0,fit:'contain',audio:true,headline:'',cta:'',contact:'',payments:false,trustIndex:null,logo:true};
export const FRAME={width:720,height:1280,clipX:24,clipY:440,clipWidth:672,clipHeight:480};
function optionalText(value:unknown,max:number){if(value==='')return '';return textField(value,max);}
export function parseFrame(value:unknown):FramePlan {
  const raw=object(value);
  if(![6,10,15].includes(raw.duration as number)||typeof raw.start!=='number'||!Number.isFinite(raw.start)||raw.start<0||raw.start>120||!['contain','cover'].includes(raw.fit as string))throw new MediaError('ช่วงเวลาหรือรูปแบบคลิปไม่ถูกต้อง');
  for(const key of ['audio','payments','logo'])if(typeof raw[key]!=='boolean')throw new MediaError('การตั้งค่ากรอบไม่ถูกต้อง');
  if(raw.contact!==''&&(typeof raw.contact!=='string'||!Object.hasOwn(CONTACT_LABELS,raw.contact)))throw new MediaError('ช่องทางติดต่อไม่ถูกต้อง');
  if(raw.trustIndex!==null&&(!Number.isInteger(raw.trustIndex)||Number(raw.trustIndex)<0||Number(raw.trustIndex)>4))throw new MediaError('ข้อความรับรองไม่ถูกต้อง');
  return {duration:raw.duration as FramePlan['duration'],start:Math.round(raw.start*1000)/1000,fit:raw.fit as FramePlan['fit'],audio:raw.audio as boolean,headline:optionalText(raw.headline,60),cta:optionalText(raw.cta,60),contact:raw.contact as FramePlan['contact'],payments:raw.payments as boolean,trustIndex:raw.trustIndex as number|null,logo:raw.logo as boolean};
}
export function validateFrameBrand(plan:FramePlan,brand:BrandProfile){
  if(plan.contact&&!brand.contacts[plan.contact])throw new MediaError('Brand Kit เวอร์ชันนี้ไม่มีช่องทางติดต่อที่เลือก');
  if(plan.payments&&!brand.paymentMethods.length)throw new MediaError('ยังไม่มีช่องทางชำระเงินใน Brand Kit เวอร์ชันนี้');
  if(plan.trustIndex!==null&&(!brand.claimsConfirmed||!brand.trustStatements[plan.trustIndex]))throw new MediaError('เลือกได้เฉพาะข้อความที่ร้านยืนยันใน Brand Kit');
}
export function parseFrameDraft(value:unknown){const raw=object(value);return {id:id(raw.id),sourceAssetId:id(raw.sourceAssetId),clipAssetId:id(raw.clipAssetId),title:textField(raw.title,100)};}
export function parseFrameRender(value:unknown){const raw=object(value);if(raw.confirmed!==true||!Number.isSafeInteger(raw.revision)||Number(raw.revision)<1)throw new MediaError('กรุณาตรวจตัวอย่างและยืนยันก่อนสร้างวิดีโอ');return {revision:raw.revision as number,frame:parseFrame(raw.frame)};}
