import columns from './meta-columns.json';
import {MediaError,object} from '../media/model';
import type {Brief} from './model';
export const META_TEMPLATE='meta-export-20260921-456';
export type MetaSetup={pageId:string;storyId:string;creativeType:'Photo Page Post Ad'|'Video Page Post Ad'|'Link Page Post Ad';start:string;ageMin:number;ageMax:number;confirmed:boolean};
export function parseMetaSetup(value:unknown,now=Date.now()):MetaSetup{
  const r=object(value);
  for(const k of ['pageId','storyId'])if(typeof r[k]!=='string'||!/^\d{5,30}$/.test(r[k] as string))throw new MediaError('ระบุ Page ID และ Post ID เป็นตัวเลข ไม่ใช่ลิงก์ pfbid');
  if(!['Photo Page Post Ad','Video Page Post Ad','Link Page Post Ad'].includes(r.creativeType as string))throw new MediaError('เลือกชนิดโพสต์ที่ตรงกับโพสต์จริง');
  if(typeof r.start!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.start))throw new MediaError('ระบุวันและเวลาเริ่ม');
  const time=Date.parse(r.start+':00+07:00');
  if(!Number.isFinite(time)||new Date(time+7*3600000).toISOString().slice(0,16)!==r.start||time<now+15*60000||time>now+365*86400000)throw new MediaError('เวลาเริ่มต้องถูกต้อง และล่วงหน้า 15 นาทีถึง 1 ปี');
  if(!Number.isInteger(r.ageMin)||!Number.isInteger(r.ageMax)||(r.ageMin as number)<18||(r.ageMax as number)>65||(r.ageMin as number)>(r.ageMax as number))throw new MediaError('ช่วงอายุต้องอยู่ระหว่าง 18–65 ปี');
  if(r.confirmed!==true)throw new MediaError('กรุณายืนยันเพจ โพสต์ ประเทศ สกุลเงิน และเขตเวลาก่อนส่งออก');
  return {pageId:r.pageId as string,storyId:r.storyId as string,creativeType:r.creativeType as MetaSetup['creativeType'],start:r.start,ageMin:r.ageMin as number,ageMax:r.ageMax as number,confirmed:true};
}
function dateCell(time:number){const d=new Date(time+7*3600000);const pad=(v:number)=>String(v).padStart(2,'0');return `${pad(d.getUTCMonth()+1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()} ${d.getUTCHours()%12||12}:${pad(d.getUTCMinutes())}:00 ${d.getUTCHours()<12?'am':'pm'}`;}
export function metaRow(brief:Brief,setup:MetaSetup){
  if(brief.goal!=='messages')throw new MediaError('แม่แบบนี้รองรับเฉพาะเป้าหมายคนทักผ่าน Messenger');
  if(brief.warmAudience||brief.audience.trim())throw new MediaError('รุ่นนี้ส่งออกกลุ่มกว้างหนึ่งกลุ่ม กรุณาสร้างแผนใหม่โดยไม่ระบุกลุ่มเดิมหรือกลุ่มเฉพาะ');
  if(!['ไทย','ประเทศไทย','TH','Thailand'].includes(brief.country))throw new MediaError('แม่แบบรุ่นนี้รองรับกลุ่มเป้าหมายประเทศไทยเท่านั้น');
  if(/^[\s]*[=+@-]/.test(brief.title))throw new MediaError('ชื่อแผนต้องไม่เริ่มด้วยเครื่องหมายสูตร = + - @');
  const start=Date.parse(setup.start+':00+07:00');
  const row:Record<string,string>={
    'Campaign Name':brief.title,'Campaign Status':'PAUSED','Campaign Objective':'Outcome Engagement','Buying Type':'AUCTION','New Objective':'Yes',
    'Ad Set Name':`${brief.title} - Messenger`,'Ad Set Run Status':'PAUSED',
    'Ad Set Time Start':dateCell(start),'Ad Set Time Stop':dateCell(start+brief.days*86400000),
    'Ad Set Lifetime Budget':brief.budget.toFixed(2),'Destination Type':'MESSENGER',
    'Link Object ID':`o:${setup.pageId}`,'Countries':'TH','Age Min':String(setup.ageMin),'Age Max':String(setup.ageMax),
    'Optimization Goal':'CONVERSATIONS','Billing Event':'IMPRESSIONS','Ad Set Bid Strategy':'Highest volume or value',
    'Story ID':`s:${setup.storyId}`,'Ad Name':`${brief.title} - โพสต์เดิม`,'Ad Status':'PAUSED','Creative Type':setup.creativeType,'Call to Action':'MESSAGE_PAGE',
  };
  return row;
}
export function metaFile(brief:Brief,setup:MetaSetup){
  const row=metaRow(brief,setup);
  const cell=(value:string)=>/[\t\r\n"]/.test(value)?`"${value.replaceAll('"','""')}"`:value;
  const data=columns.map(cell).join('\t')+'\r\n'+columns.map(k=>cell(row[k]||'')).join('\t')+'\r\n';
  return Buffer.concat([Buffer.from([255,254]),Buffer.from(data,'utf16le')]);
}
