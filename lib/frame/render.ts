import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,stat,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {frameArtwork} from './artwork';
import {parseFrame,type FramePlan} from './model';
import type {BrandProfile} from '../brand/model';
import {OUTPUT_RESERVE} from '../motion/model';
import {inspectMedia} from '../media/inspect';
import {ffmpegBinary} from '../motion/ffmpeg';
const exec=promisify(execFile);
export async function renderFrame(image:Buffer,clip:Buffer,input:FramePlan,brand:BrandProfile,logo?:Buffer){
  const plan=parseFrame(input);const metadata=await inspectMedia(clip,'video');
  if(!metadata.duration||plan.start+plan.duration>metadata.duration+0.001)throw new Error('clip_range');
  const directory=await mkdtemp(path.join(os.tmpdir(),'lazyai-frame-'));
  try{
    await writeFile(path.join(directory,'clip'),clip);await writeFile(path.join(directory,'frame.png'),await frameArtwork(image,plan,brand,logo));
    const scale=plan.fit==='cover'?'scale=672:480:force_original_aspect_ratio=increase:force_divisible_by=2,crop=672:480':'scale=672:480:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=672:480:(ow-iw)/2:(oh-ih)/2:color=black';
    const filters=`[0:v]setsar=1,${scale},setsar=1,pad=720:1280:24:440:color=0x08080e,setsar=1[clip];[clip][1:v]overlay=0:0:shortest=1,format=yuv420p[out]`;
    await writeFile(path.join(directory,'filters.txt'),filters);
    await exec(ffmpegBinary(),['-hide_banner','-loglevel','error','-nostdin','-y','-filter_complex_threads','1','-ss',String(plan.start),'-protocol_whitelist','file','-format_whitelist','mov,matroska,webm','-i','clip','-loop','1','-i','frame.png','-filter_complex_script','filters.txt','-map','[out]',...(plan.audio?['-map','0:a:0?','-c:a','aac','-b:a','128k']:['-an']),'-t',String(plan.duration),'-r','24','-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-maxrate','8M','-bufsize','16M','-movflags','+faststart','output.mp4'],{cwd:directory,timeout:300000,maxBuffer:128000,windowsHide:true});
    const filename=path.join(directory,'output.mp4');const size=(await stat(filename)).size;
    if(!size||size>OUTPUT_RESERVE)throw new Error('output_limit');
    return {bytes:await readFile(filename),metadata:{width:720,height:1280,duration:plan.duration,contentType:'video/mp4'}};
  }finally{
    const target=path.resolve(directory);if(!target.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(target).startsWith('lazyai-frame-'))throw new Error('Unsafe temporary path');await rm(target,{recursive:true,force:true});
  }
}
