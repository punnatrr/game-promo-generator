export type LeadSourceRecord={
  sourceType:string;
  sourceUrl?:string|null;
  sourceExternalId?:string|null;
  authorName?:string|null;
  authorIdentifier?:string|null;
  text:string;
  publishedAt?:string|null;
  metadata?:Record<string,unknown>;
};
export interface LeadSourceAdapter {
  readonly key:string;
  normalize(input:unknown):Promise<LeadSourceRecord[]>;
}
export class ManualLeadSource implements LeadSourceAdapter {
  readonly key="MANUAL";
  async normalize(input:unknown){
    if(!input || typeof input!=="object")throw new Error("INVALID_MANUAL_LEAD");
    const value=input as Record<string,unknown>;
    const text=typeof value.text==="string"?value.text.trim():"";
    if(!text)throw new Error("EMPTY_LEAD_TEXT");
    return [{sourceType:typeof value.sourceType==="string"?value.sourceType:"MANUAL",sourceUrl:typeof value.sourceUrl==="string"?value.sourceUrl:null,authorName:typeof value.authorName==="string"?value.authorName:null,text}];
  }
}
export class CsvLeadSource implements LeadSourceAdapter {
  readonly key="CSV";
  async normalize(input:unknown){
    if(!Array.isArray(input))throw new Error("INVALID_CSV_ROWS");
    return input.map((row,index)=>{
      if(!row || typeof row!=="object")throw new Error(`INVALID_CSV_ROW_${index+1}`);
      const v=row as Record<string,unknown>;
      const text=typeof v.text==="string"?v.text.trim():"";
      if(!text)throw new Error(`EMPTY_CSV_ROW_${index+1}`);
      return {sourceType:typeof v.source==="string"?v.source:"CSV",sourceUrl:typeof v.source_url==="string"?v.source_url:null,authorName:typeof v.author==="string"?v.author:null,text,publishedAt:typeof v.created_at==="string"?v.created_at:null,metadata:{location:typeof v.location==="string"?v.location:null}};
    });
  }
}
export class WebhookLeadSource implements LeadSourceAdapter {
  readonly key:string="WEBHOOK";
  async normalize(input:unknown){return new ManualLeadSource().normalize(input);}
}
export class MetaAuthorizedSource extends WebhookLeadSource { readonly key:string="META_AUTHORIZED"; }
