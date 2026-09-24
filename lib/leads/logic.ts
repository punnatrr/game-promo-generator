import { createHash } from "node:crypto";
import type { LeadIntent, LeadTemperature, RuleAnalysis } from "./types";

const BUYER_PHRASES = ["หา","หาร้าน","มีร้าน","ร้านไหน","เติมที่ไหน","รับเติมไหม","รับไหม","ต้องการ","อยากเติม","ซื้อ","สนใจ"];
const PRICE_PHRASES = ["ราคา","เท่าไหร่","เท่าไร","กี่บาท","ถูก","เรท"];
const PACKAGE_PHRASES = ["แพ็ก","แพค","package"];
const AVAILABILITY_PHRASES = ["มีไหม","มีมั้ย","รับไหม","รับเติมไหม","พร้อมไหม"];
const PROMO_PHRASES = ["โปร","โปรโมชั่น","promotion","ส่วนลด"];
const PAYMENT_PHRASES = ["จ่าย","โอน","พร้อมเพย์","บัตร","ทรูมันนี่","wallet","payment"];
const COMPARE_PHRASES = ["ถูกกว่า","ร้านไหนถูก","เทียบราคา","เรทไหนดี","ราคาไหนดี"];
const SELLER_PHRASES = ["ร้านเรารับเติม","รับเติมเกม","โปรโมชั่นร้าน","เปิดร้าน","รับตัวแทน","เรทราคาส่ง","ตัวแทนจำหน่าย","ทักร้านได้","เติมกับร้าน"];
const SPAM_PHRASES = ["เครดิตฟรี","รับทรัพย์","คาสิโน","พนัน","เว็บตรง"];

export function normalizeLeadText(value:string){
  return value.normalize("NFKC").replace(/\s+/g," ").trim().toLocaleLowerCase("th");
}
export function normalizedTextHash(value:string){
  return createHash("sha256").update(normalizeLeadText(value)).digest("hex");
}
function hits(text:string, words:string[]){return words.filter(word=>text.includes(word));}
export function temperatureFromScore(score:number):LeadTemperature{
  if(score>=80)return "HOT";
  if(score>=60)return "WARM";
  if(score>=40)return "POSSIBLE";
  return "LOW";
}
export function detectIntent(textValue:string):{intent:LeadIntent;confidence:number;matched:string[]}{
  const text=normalizeLeadText(textValue);
  const matched=[...new Set([...hits(text,BUYER_PHRASES),...hits(text,PRICE_PHRASES),...hits(text,PACKAGE_PHRASES),...hits(text,AVAILABILITY_PHRASES),...hits(text,PROMO_PHRASES),...hits(text,PAYMENT_PHRASES),...hits(text,COMPARE_PHRASES)])];
  if(hits(text,COMPARE_PHRASES).length)return {intent:"COMPARE_PRICE",confidence:.92,matched};
  if(hits(text,PROMO_PHRASES).length && hits(text,BUYER_PHRASES).length)return {intent:"ASK_PROMOTION",confidence:.86,matched};
  if(hits(text,PAYMENT_PHRASES).length && hits(text,BUYER_PHRASES).length)return {intent:"ASK_PAYMENT",confidence:.84,matched};
  if(hits(text,PRICE_PHRASES).length)return {intent:"ASK_PRICE",confidence:.92,matched};
  if(hits(text,PACKAGE_PHRASES).length)return {intent:"ASK_PACKAGE",confidence:.8,matched};
  if(hits(text,AVAILABILITY_PHRASES).length)return {intent:"ASK_AVAILABILITY",confidence:.78,matched};
  if(hits(text,BUYER_PHRASES).length)return {intent:"LOOKING_FOR_STORE",confidence:.9,matched};
  return {intent:"OTHER",confidence:.45,matched};
}
export function extractProduct(textValue:string){
  const text=normalizeLeadText(textValue);
  const currencyMatch=text.match(/\b(vp|uc|cp|robux|robu?x|coin|coins|crystals?|genesis crystals?|bonds?|diamond|diamonds?)\b/i);
  const thaiRobux=/โรบัค(?:ซ์)?/.test(text)?"ROBUX":null;
  const amountMatches=[...text.matchAll(/(?:^|\s|\D)(\d{2,6}(?:[,.]\d{3})?)(?=\s*(?:vp|uc|cp|robux|robu?x|coin|coins|crystals?|bonds?|diamond|diamonds?|โรบัค|คูปอง|$))/gi)];
  const raw=amountMatches[0]?.[1]?.replace(/,/g,"");
  return {
    currency:(thaiRobux || currencyMatch?.[1]?.toUpperCase() || null)?.replace("ROBOX","ROBUX") || null,
    amount: raw ? Number(raw) : null,
    package: raw ? raw : null,
  };
}
function detectBudget(text:string){
  const m=text.match(/(?:งบ|budget)\s*(?:ไม่เกิน|ประมาณ|ราว)?\s*(\d{2,7}(?:[,.]\d{3})?)/i);
  return m ? Number(m[1].replace(/,/g,"")) : null;
}
export function analyzeByRules(textValue:string, gameConfidence=0):RuleAnalysis{
  const text=normalizeLeadText(textValue);
  const sellerHits=hits(text,SELLER_PHRASES);
  const spamHits=hits(text,SPAM_PHRASES);
  const {intent,confidence,matched}=detectIntent(text);
  const product=extractProduct(text);
  const buyerHits=hits(text,BUYER_PHRASES);
  const priceHits=hits(text,PRICE_PHRASES);
  const isSeller=sellerHits.length>0 && buyerHits.length===0;
  const isSpam=spamHits.length>0;
  let score=0;
  score+=Math.round(Math.min(35,buyerHits.length*15));
  score+=Math.round(Math.min(20,priceHits.length*12));
  score+=Math.round(Math.min(15,gameConfidence*15));
  if(product.amount!==null)score+=12;
  if(product.currency)score+=8;
  if(intent!=="OTHER")score+=8;
  if(/ด่วน|ตอนนี้|วันนี้|ทันที|now|urgent/.test(text))score+=5;
  if(isSeller)score-=55;
  if(isSpam)score-=70;
  score=Math.max(0,Math.min(100,score));
  const buyerConfidence=Math.max(0,Math.min(1,(score/100)+(isSeller?-0.35:0)));
  const language=/[ก-๙]/.test(text)?"th":"en";
  const summary=isSeller?"ข้อความมีลักษณะเป็นโพสต์จากร้าน/ผู้ขาย จึงไม่ควรอยู่ Buyer Feed":isSpam?"ข้อความมีลักษณะสแปม จึงควรตรวจสอบก่อน":intent==="ASK_PRICE"?"ลูกค้ากำลังสอบถามราคาและมีสัญญาณซื้อ":intent==="LOOKING_FOR_STORE"?"ลูกค้ากำลังมองหาร้านเติมเกม":intent==="ASK_PACKAGE"?"ลูกค้ากำลังสอบถามแพ็กหรือจำนวนที่ต้องการ":"พบข้อความที่อาจเกี่ยวข้องกับการซื้อเติมเกม";
  return {intent,intentConfidence:confidence,buyerConfidence,isSeller,isSpam,matchedKeywords:matched,product,budget:detectBudget(text),location:null,platform:null,region:null,device:null,urgency:/ด่วน|ตอนนี้|วันนี้|ทันที|now|urgent/.test(text)?"high":"normal",paymentMethod:null,language,leadScore:score,temperature:temperatureFromScore(score),summary};
}

export type GameDictionaryItem={id:string;slug:string;name:string;iconUrl:string|null;aliases:string[]};
export function detectGame(textValue:string,games:GameDictionaryItem[]){
  const text=normalizeLeadText(textValue);
  let best:{game:GameDictionaryItem;alias:string;score:number}|null=null;
  for(const game of games){
    for(const alias of game.aliases){
      const normalized=normalizeLeadText(alias);
      if(!normalized || !text.includes(normalized))continue;
      let score=.78+Math.min(.2,normalized.length/40);
      if(text===normalized)score=.99;
      if(!best || score>best.score)best={game,alias,score};
    }
  }
  return best?{...best.game,confidence:Math.min(.99,best.score),matchedAlias:best.alias}:null;
}
