import { existsSync } from 'node:fs';
import path from 'node:path';

export const ffmpegBinary = () => {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const bundled = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  return existsSync(bundled) ? bundled : 'ffmpeg';
};
