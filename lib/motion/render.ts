import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { fitPoster, OUTPUT_RESERVE, parsePlan, type MotionPlan } from './model';
import { ffmpegBinary } from './ffmpeg';
const exec = promisify(execFile);
export async function renderMotion(bytes: Buffer, input: MotionPlan) {
  const plan = parsePlan(input);
  const dir = await mkdtemp(path.join(os.tmpdir(),'lazyai-motion-'));
  try {
    const image = sharp(bytes,{ limitInputPixels:40_000_000,failOn:'error' }).rotate();
    const normalized = await image.png().toBuffer({ resolveWithObject:true });
    const frame = fitPoster(normalized.info.width,normalized.info.height,plan.ratio);
    // Keep all source pixels in frame. No OCR text, prices, crop, or generative replacement.
    await sharp(normalized.data).resize(frame.posterWidth,frame.posterHeight).png().toFile(path.join(dir,'poster.png'));
    const highlights = plan.boxes.map((b,i) => {
      const start = i*plan.duration/Math.max(1,plan.boxes.length),end = (i+1)*plan.duration/Math.max(1,plan.boxes.length);
      return `drawbox=x=${Math.round(b.x/100*frame.posterWidth)}:y=${Math.round(b.y/100*frame.posterHeight)}:w=${Math.max(2,Math.round(b.width/100*frame.posterWidth))}:h=${Math.max(2,Math.round(b.height/100*frame.posterHeight))}:color=${b.kind==='price'?'0xFDE047':'0xC4B5FD'}@0.85:t=2:enable='between(t,${start},${end})'`;
    });
    const float = plan.effect === 'float' ? `+6*sin(2*PI*t/${plan.duration})` : '';
    const filters = `[1:v]${highlights.length?highlights.join(','):'null'}[poster];[0:v][poster]overlay=x=(W-w)/2:y=(H-h)/2${float}:shortest=1,format=yuv420p[out]`;
    await writeFile(path.join(dir,'filters.txt'),filters);
    await exec(ffmpegBinary(),[
      '-hide_banner','-loglevel','error','-nostdin','-y','-filter_complex_threads','1',
      '-f','lavfi','-i',`color=c=0x08080e:s=${frame.width}x${frame.height}:r=24:d=${plan.duration}`,
      '-loop','1','-framerate','24','-protocol_whitelist','file','-i','poster.png',
      '-filter_complex_script','filters.txt','-map','[out]','-an','-t',String(plan.duration),
      '-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-maxrate','8M','-bufsize','16M','-movflags','+faststart','output.mp4',
    ],{ cwd:dir,timeout:300_000,maxBuffer:128_000,windowsHide:true });
    const size = (await stat(path.join(dir,'output.mp4'))).size;
    if (!size || size>OUTPUT_RESERVE) throw new Error('output_too_large');
    return { bytes:await readFile(path.join(dir,'output.mp4')),metadata:{width:frame.width,height:frame.height,duration:plan.duration,contentType:'video/mp4'} };
  } finally {
    const target = path.resolve(dir);
    if (!target.startsWith(path.resolve(os.tmpdir())+path.sep) || !path.basename(target).startsWith('lazyai-motion-')) throw new Error('Unsafe temporary directory');
    await rm(target,{recursive:true,force:true});
  }
}
