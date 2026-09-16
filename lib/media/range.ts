export function byteRange(header:string,size:number):{start:number;end:number}|null {
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||(!match[1]&&!match[2]))return null;
  const first=Number(match[1]),last=Number(match[2]);
  if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last))return null;
  const start=match[1]?first:Math.max(0,size-last);
  const end=match[1]?(match[2]?Math.min(last,size-1):size-1):size-1;
  return start<0||start>=size||end<start||(!match[1]&&last===0)?null:{start,end};
}
export function sliceStream(stream:ReadableStream<Uint8Array>,start:number,end:number){
  const reader=stream.getReader();let position=0,closed=false;
  return new ReadableStream<Uint8Array>({async pull(controller){
    try{while(!closed){const chunk=await reader.read();if(chunk.done){closed=true;controller.close();break;}const offset=position;position+=chunk.value.length;
      if(position>start){const data=chunk.value.subarray(Math.max(0,start-offset),Math.min(chunk.value.length,end-offset+1));if(data.length)controller.enqueue(data);}
      if(position>end){closed=true;await reader.cancel();controller.close();break;}
      if(position>start)break;
    }}catch(error){closed=true;controller.error(error);await reader.cancel().catch(()=>{});}
  },async cancel(reason){closed=true;await reader.cancel(reason);}});
}
