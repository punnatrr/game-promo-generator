// Run only with media-test-server.mjs. No real environment files are loaded.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55439/postgres';
process.env.MEDIA_TEST_STORAGE = '1';
process.env.NODE_ENV = 'test';
process.env.BLOB_READ_WRITE_TOKEN = '';
process.env.GEMINI_API_KEY = '';
process.env.MOTION_VISION_MODEL = '';
process.env.FFMPEG_PATH = require('../.test-build/brand-tools/node_modules/ffmpeg-static');
process.env.FFPROBE_PATH = require('../.test-build/brand-tools/node_modules/ffprobe-static').path;
await import('./media-worker.mjs');
