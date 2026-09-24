import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ffprobeBinary } from './ffprobe';
const exec = promisify(execFile);
export class InvalidMedia extends Error {}
export async function inspectMedia(bytes: Buffer, kind: string) {
  if (kind === 'image') {
    try {
      const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error' });
      const meta = await image.metadata();
      if (!meta.width || !meta.height || !meta.format || !['png','jpeg','webp'].includes(meta.format) || (meta.pages || 1) > 1) throw new Error();
      // Decode all pixels, not just the header; originals (including prices) stay unchanged.
      await image.stats();
      return { width: meta.width, height: meta.height, contentType: `image/${meta.format}` };
    } catch { throw new InvalidMedia('invalid_image'); }
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lazyai-media-'));
  try {
    const file = path.join(dir, 'input'); await writeFile(file, bytes);
    const { stdout } = await exec(ffprobeBinary(), ['-v','error','-protocol_whitelist','file','-format_whitelist','mov,matroska,webm','-show_entries','format=duration,format_name:stream=codec_type,width,height','-of','json',file], { timeout: 30_000, maxBuffer: 256_000, windowsHide: true });
    const result = JSON.parse(stdout); const video = result.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
    const duration = Number(result.format?.duration); const format = String(result.format?.format_name || '');
    if (!video || !Number.isFinite(duration) || duration <= 0 || duration > 120 || !Number.isInteger(video.width) || !Number.isInteger(video.height) || video.width <= 0 || video.height <= 0 || video.width * video.height > 16_777_216 || !/(mov|mp4|webm|matroska)/.test(format)) throw new InvalidMedia('invalid_video');
    return { width: video.width as number, height: video.height as number, duration, contentType: /webm|matroska/.test(format) ? 'video/webm' : 'video/mp4' };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error; throw new InvalidMedia('invalid_video'); }
  finally {
    const target = path.resolve(dir);
    if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('lazyai-media-')) throw new Error('Unsafe temporary path');
    await rm(target, { recursive: true, force: true });
  }
}
