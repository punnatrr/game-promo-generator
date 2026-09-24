import {id,object,MediaError} from '../media/model';
import type {BrandProfile} from '../brand/model';

export const GOALS={messages:'อยากให้คนทัก',visits:'อยากให้คนเข้าเว็บ',awareness:'อยากให้คนรู้จักร้าน',sales:'อยากได้ยอดซื้อบนเว็บ'} as const;
export const MODES={steady:'ประหยัดงบ / กระจายหลายวัน',focused:'เน้นผลลัพธ์ / ทดสอบแล้วปรับ'} as const;
export type Brief={title:string;postUrl:string;caption:string;game:string;assetId:string|null;budget:number;days:number;goal:keyof typeof GOALS;mode:keyof typeof MODES;country:string;audience:string;warmAudience:boolean;trackingReady:boolean;profit:number|null;costLow:number|null;costHigh:number|null;ai:boolean};
export const DEFAULT_BRIEF:Brief={title:'',postUrl:'',caption:'',game:'',assetId:null,budget:1500,days:7,goal:'messages',mode:'steady',country:'ไทย',audience:'',warmAudience:false,trackingReady:false,profit:null,costLow:null,costHigh:null,ai:false};
function text(v:unknown,label:string,max:number,required=false){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v)||required&&!v.trim())throw new MediaError(`${label}ไม่ถูกต้อง`);return v.trim();}
function number(v:unknown,min:number,max:number,label:string){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||Math.abs(v*100-Math.round(v*100))>1e-6)throw new MediaError(`${label}ไม่ถูกต้อง`);return v;}
export function parseBrief(value:unknown):Brief{
  const r=object(value);const postUrl=text(r.postUrl,'ลิงก์โพสต์',1000);
  if(postUrl){try{const u=new URL(postUrl);if(u.protocol!=='https:'||u.username||u.password||u.port||!['facebook.com','www.facebook.com','m.facebook.com','fb.watch'].includes(u.hostname))throw new Error();}catch{throw new MediaError('ใช้ลิงก์ Facebook แบบ https:// เท่านั้น');}}
  if(typeof r.goal!=='string'||typeof r.mode!=='string'||!Object.hasOwn(GOALS,r.goal)||!Object.hasOwn(MODES,r.mode))throw new MediaError('เลือกเป้าหมายและรูปแบบแผน');
  for(const key of ['warmAudience','trackingReady','ai'])if(typeof r[key]!=='boolean')throw new MediaError('ตัวเลือกไม่ถูกต้อง');
  const days=number(r.days,1,90,'จำนวนวัน');if(!Number.isInteger(days))throw new MediaError('จำนวนวันต้องเป็นจำนวนเต็ม');
  const costLow=r.costLow===null?null:number(r.costLow,.01,1000000,'ต้นทุนต่ำ');const costHigh=r.costHigh===null?null:number(r.costHigh,.01,1000000,'ต้นทุนสูง');
  if((costLow===null)!==(costHigh===null)||costLow!==null&&costHigh!==null&&costLow>costHigh)throw new MediaError('ระบุต้นทุนต่ำและสูงให้ครบ โดยค่าต่ำไม่เกินค่าสูง');
  return {title:text(r.title,'ชื่อแผน',100,true),postUrl,caption:text(r.caption,'ข้อความโพสต์',4000,true),game:text(r.game,'ชื่อเกม',80,true),assetId:r.assetId===null?null:id(r.assetId),budget:number(r.budget,1,1000000,'งบ'),days,goal:r.goal as Brief['goal'],mode:r.mode as Brief['mode'],country:text(r.country,'ประเทศ',80,true),audience:text(r.audience,'กลุ่มลูกค้า',300),warmAudience:r.warmAudience as boolean,trackingReady:r.trackingReady as boolean,profit:r.profit===null?null:number(r.profit,.01,1000000,'กำไรต่อรายการ'),costLow,costHigh,ai:r.ai as boolean};
}
export const REVIEW_LABELS={offer:'ข้อเสนอชัดเจน',cta:'มีคำชวนให้ทำต่อ',game:'ชื่อเกมตรงกับโพสต์',readability:'ข้อความในภาพอ่านง่าย'} as const;
export type Review=Record<keyof typeof REVIEW_LABELS,'yes'|'no'|'unclear'>;
export function parseReview(raw:unknown):Review{const r=object(raw);for(const key of Object.keys(REVIEW_LABELS))if(typeof r[key]!=='string'||!['yes','no','unclear'].includes(r[key] as string))throw new MediaError('ผลวิเคราะห์ไม่ถูกต้อง');return {offer:r.offer,cta:r.cta,game:r.game,readability:r.readability} as Review;}
export function makePlan(b:Brief,brand:BrandProfile){
  const total=Math.round(b.budget*100),base=Math.floor(total/b.days),extra=total%b.days;
  const warm=b.warmAudience?Math.floor(total/5):0;
  const objective={messages:'Engagement · ตรวจตัวเลือกการรับข้อความในบัญชี',visits:'Traffic · คนเข้าเว็บไซต์',awareness:'Awareness · การรับรู้',sales:'Sales · ยอดซื้อบนเว็บไซต์'}[b.goal];
  const unit={messages:'การสนทนา',visits:'คลิก',awareness:'ครั้งที่แสดงโฆษณา',sales:'รายการซื้อ'}[b.goal];
  const estimates=b.costLow!==null&&b.costHigh!==null?{low:Math.floor(total*(b.goal==='awareness'?1000:1)/Math.round(b.costHigh*100)),high:Math.floor(total*(b.goal==='awareness'?1000:1)/Math.round(b.costLow*100)),unit,lowCost:b.costLow,highCost:b.costHigh}:null;
  const warnings:string[]=[];
  if(b.postUrl)warnings.push('ลิงก์เก็บไว้อ้างอิงเท่านั้น ระบบไม่ได้ดึงโพสต์จาก Facebook');
  if(b.goal==='sales'&&!b.trackingReady)warnings.push('ยังไม่พร้อมวัดยอดซื้อ: ต้องตั้งค่าและทดสอบเหตุการณ์ซื้อก่อนใช้แผน Sales');
  if(!b.assetId)warnings.push('ยังไม่ได้เลือกสื่อ ตรวจภาพหรือคลิปจริงก่อนนำแผนไปใช้');
  if(!Object.values(brand.contacts).some(Boolean))warnings.push('ยังไม่มีช่องทางติดต่อใน Brand Kit กรุณาเติมข้อมูลก่อนเผยแพร่');
  warnings.push('ชื่อวัตถุประสงค์เป็นคำแนะนำ ต้องตรวจตัวเลือกและเงื่อนไขในบัญชี Meta ก่อนตั้งแคมเปญจริง');
  return {version:1,objective,unit,dailyAverage:b.budget/b.days,dailySchedule:Array.from({length:b.days},(_,i)=>({day:i+1,amount:(base+(i<extra?1:0))/100})),allocation:[{label:'เข้าถึงลูกค้าใหม่',amount:(total-warm)/100},{label:'กลับไปหาคนที่เคยสนใจ',amount:warm/100}],allocationReason:b.warmAudience?'กันงบ 20% เป็นจุดเริ่มต้นสำหรับกลุ่มที่คุณระบุว่ามีแล้ว ปรับตามผลจริงและขนาดกลุ่ม':'ยังไม่มีกลุ่มเดิมที่พร้อมใช้ จึงรวมงบไว้กลุ่มเดียว ไม่แบ่งงบยิงซ้ำ',estimates,breakEven:b.profit===null?null:Math.ceil(total/Math.round(b.profit*100)),warnings,
    audience:b.audience||`เริ่มจากผู้เล่น ${b.game} ใน${b.country} แล้วดูผลจริงก่อนแยกกลุ่มเพิ่มเติม`,
    strategy:b.mode==='steady'?'รักษางบเฉลี่ยตามจำนวนวันที่เลือก เริ่มสื่อหลักหนึ่งชิ้นและตรวจผลระหว่างทาง':'เริ่มทดสอบสื่อทีละแบบด้วยงบเฉลี่ยเดิม เปลี่ยนเพียงหนึ่งอย่างต่อรอบ และยังไม่เพิ่มงบจนมีผลจริง',
    placement:'ตรวจตัวอย่างใน Feed และตำแหน่งแนวตั้งก่อนเลือกตำแหน่งที่สื่อแสดงครบ ราคาและข้อความไม่ถูกตัด',
    experiment:'ทดสอบภาพหรือประโยคเปิดอย่างใดอย่างหนึ่ง เก็บข้อเสนอ ราคา กลุ่ม และงบให้เทียบกันได้',
    kpi:{messages:'ดูจำนวนการสนทนาที่มีคุณภาพ ต้นทุนต่อการสนทนา และจำนวนคนที่ซื้อจริง',visits:'ดูคลิกและการเปิดหน้าเว็บจริง ไม่ใช้จำนวนคลิกแทนยอดขาย',awareness:'ดูการแสดงโฆษณา การเข้าถึง และความถี่จากรายงานจริง',sales:'ดูรายการซื้อที่วัดได้ ต้นทุนต่อการซื้อ และกำไรหลังค่าโฆษณา'}[b.goal],
    copy:b.caption,cta:brand.defaultCta||'ระบุคำชวนและช่องทางที่ร้านใช้จริง',checklist:['ตรวจชื่อเกม แพ็ก ราคา และวันหมดโปรโมชั่นจากต้นฉบับ','ตรวจช่องทางติดต่อและข้อความรับรองที่ร้านยืนยันได้','ตรวจงบรวม จำนวนวัน และความพร้อมตอบลูกค้า','จดงบที่ใช้และผลจริงระหว่างรัน เพื่อปรับแผนครั้งถัดไป']};
}
export type PlanResult=ReturnType<typeof makePlan>;
export type SavedPlan={id:string;brief:Brief;result:PlanResult;brand_version:number;brand:BrandProfile;created_at:string;accepted_at:string|null;analysis_state:'rules'|'running'|'ai'|'fallback';review:Review|null;asset_name:string|null;asset_available:boolean};
export type PlannerState={plans:SavedPlan[];entitlement:{enabled:boolean;limit:number;used:number};aiAvailable:boolean};
export function exportPlan(p:SavedPlan){return [
  `แผน: ${p.brief.title}`,`เกม: ${p.brief.game}`,`งบ ${p.brief.budget} บาท / ${p.brief.days} วัน`,
  `สถานะ: ${p.accepted_at?'ตรวจแผนแล้ว':'รอตรวจแผน'} · ข้อมูลร้านเวอร์ชัน ${p.brand_version}`,
  p.brief.postUrl?`ลิงก์อ้างอิง: ${p.brief.postUrl}`:'',p.asset_name?`สื่อ: ${p.asset_name}${p.asset_available?'':' (ไม่พร้อมใช้แล้ว)'}`:'ยังไม่เลือกสื่อ',
  p.result.objective,p.result.strategy,...p.result.allocation.map(a=>`${a.label}: ${a.amount} บาท`),p.result.allocationReason,
  p.result.audience,p.result.placement,p.result.experiment,p.result.kpi,`ข้อความต้นฉบับ:\n${p.result.copy}`,`CTA จากร้าน: ${p.result.cta}`,
  p.result.estimates?`สมมติฐานต้นทุน ${p.result.estimates.lowCost}–${p.result.estimates.highCost} บาท${p.brief.goal==='awareness'?' ต่อ 1,000 ครั้ง':' ต่อผลลัพธ์'}: ประมาณ ${p.result.estimates.low}–${p.result.estimates.high} ${p.result.unit} (ไม่รับประกัน)`:'ยังไม่มีสมมติฐานต้นทุน จึงไม่แสดงประมาณการ',
  p.result.breakEven!==null?`จำนวนขายเพื่อชดเชยค่าแอด: ${p.result.breakEven} รายการ ตามกำไรที่กรอก ไม่ใช่ยอดขายคาดการณ์`:'',
  p.review?`AI ตรวจเบื้องต้น:\n${Object.entries(REVIEW_LABELS).map(([k,v])=>`${v}: ${{yes:'พบ',no:'ควรปรับ',unclear:'ยังสรุปไม่ได้'}[p.review![k as keyof Review]]}`).join('\n')}`:'ยังไม่มีผลตรวจจาก AI',
  ...p.result.checklist,...p.result.warnings,`งบรายวัน:\n${p.result.dailySchedule.map(d=>`วันที่ ${d.day}: ${d.amount} บาท`).join('\n')}`,
  'เอกสารวางแผนเท่านั้น ยังไม่ได้เผยแพร่หรือใช้เงินโฆษณา',
].filter(Boolean).join('\n\n');}
