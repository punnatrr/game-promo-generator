import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runOne, sweepExpired } = require('../.test-build/media-worker/media/worker.js');
const { runMotion, expireMotionReviews } = require('../.test-build/media-worker/motion/worker.js');
const { getDb } = require('../.test-build/media-worker/db.js');
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
let nextSweep = 0;
try {
  do {
    if (Date.now() >= nextSweep) { await expireMotionReviews(); await sweepExpired(); nextSweep = Date.now() + 60_000; }
    const mediaProcessed = await runOne();
    const motionProcessed = await runMotion();
    const processed = mediaProcessed || motionProcessed;
    if (process.argv.includes('--once')) break;
    if (!processed) await new Promise(resolve => setTimeout(resolve, 2000));
  } while (!stopping);
} catch { console.error('Media worker unavailable; check database/storage configuration.'); process.exitCode = 1; }
finally { await getDb().end({ timeout: 5 }); }
