import { existsSync } from 'node:fs';
import path from 'node:path';

export const ffprobeBinary = () => {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  const bundled = path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', process.platform, process.arch, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
  return existsSync(bundled) ? bundled : 'ffprobe';
};
