// Browser-only verification against the already signed-in local demo tab.
// Set a normal Windows download directory through Chrome; agent-browser's
// `download` command canonicalizes it to an extended path that Chrome may reject.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,readFile,copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const exec=promisify(execFile);
const cli=path.resolve('.test-build/brand-tools/node_modules/agent-browser/bin/agent-browser.js');
const session=process.argv[2]||'motion-check';
const command=(...args)=>exec(process.execPath,[cli,'--session',session,...args],{windowsHide:true,timeout:30_000});
const page=(await command('get','url')).stdout.trim();
if(!['http://localhost:3107/dashboard/motion','http://localhost:3107/dashboard/frame'].includes(page))throw new Error('Open the local motion demo page first.');
const endpoint=(await command('get','cdp-url')).stdout.trim();
if(new URL(endpoint).hostname!=='127.0.0.1')throw new Error('Only the local test browser is allowed.');
const directory=await mkdtemp(path.resolve('.test-build/motion-download-'));
const socket=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let sequence=0;const pending=new Map();let filename;
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
let finish,rejectDownload;
const completed=new Promise((resolve,reject)=>{finish=resolve;rejectDownload=reject;});
const timeout=setTimeout(()=>rejectDownload(new Error('Download did not finish within 30 seconds')),30_000);
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id){const request=pending.get(message.id);if(request){pending.delete(message.id);if(message.error)request.reject(new Error(message.error.message));else request.resolve(message.result);}return;}
  if(message.method==='Browser.downloadWillBegin')filename=message.params.suggestedFilename;
  if(message.method==='Browser.downloadProgress'&&message.params.state==='completed')finish();
  if(message.method==='Browser.downloadProgress'&&message.params.state==='canceled')rejectDownload(new Error('Chrome cancelled the download'));
});
try{
  const {browserContextIds}=await send('Target.getBrowserContexts');
  for(const context of [undefined,...browserContextIds])await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory,eventsEnabled:true,...(context?{browserContextId:context}:{})});
  await Promise.all([completed,command('click','a[href^="/api/assets/"]')]);
  if(!filename||path.basename(filename)!==filename||!filename.endsWith('.mp4'))throw new Error('Unexpected download filename');
  const bytes=await readFile(path.join(directory,filename));
  if(bytes.toString('ascii',4,8)!=='ftyp')throw new Error('Downloaded file is not MP4');
  const artifact=path.resolve(page.endsWith('/frame')?'.test-build/frame-browser-result.mp4':'.test-build/motion-browser-result.mp4');
  await copyFile(path.join(directory,filename),artifact);
  console.log(JSON.stringify({downloaded:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),artifact}));
}finally{clearTimeout(timeout);socket.close();}
