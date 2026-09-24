// Windows-only disposable real PostgreSQL fixture. No .env file is loaded here.
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import postgresClient from 'postgres';
import { initdb, postgres, pg_ctl } from '../.test-build/brand-tools/node_modules/@embedded-postgres/windows-x64/dist/index.js';
const exec = promisify(execFile);
await mkdir('.test-build', { recursive: true });
const directory = await mkdtemp(path.resolve('.test-build/media-pg-'));
await exec(initdb, ['-D', directory, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C'], { windowsHide: true, timeout: 60_000 });
const pg = spawn(postgres, ['-D', directory, '-h', '127.0.0.1', '-p', '55439'], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
const databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:55439/postgres';
const db = postgresClient(databaseUrl, { max: 1, prepare: false, connect_timeout: 2 });
let next;
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  next?.kill(); await db.end({ timeout: 2 });
  await exec(pg_ctl, ['-D', directory, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 15_000 }).catch(() => { pg.kill(); });
  process.exit();
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
try {
  for (let attempt = 0; ; attempt++) { try { await db`select 1`; break; } catch (error) { if (attempt >= 20) throw error; await new Promise(resolve => setTimeout(resolve, 250)); } }
  const [cluster] = await db`show data_directory`;
  if (path.resolve(cluster.data_directory).toLowerCase() !== directory.toLowerCase()) throw new Error('Fixture port already belongs to another PostgreSQL cluster.');
  await db.unsafe(await readFile('db/schema.sql', 'utf8'));
  await db.unsafe(await readFile('db/migrations/20260914_brand_kit.sql', 'utf8'));
  await db.unsafe(await readFile('db/migrations/20260914_media_library.sql', 'utf8'));
  await db.unsafe(await readFile('db/migrations/20260914_motion_studio.sql', 'utf8'));
  await db.unsafe(await readFile('db/migrations/20260915_video_frame.sql', 'utf8'));
  await db.unsafe(await readFile('db/migrations/20260920_ads_planner.sql', 'utf8'));
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3107'], {
    windowsHide: true, stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, MEDIA_TEST_STORAGE: '1', CRON_SECRET: 'isolated-fixture-secret', BLOB_READ_WRITE_TOKEN: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '', GOOGLE_API_KEY: '', MOTION_VISION_MODEL: '', ADS_ANALYSIS_MODEL:'', AUTH_SESSION_COOKIE_NAME: 'brand_test_session', NODE_ENV: 'development' },
  });
  next.on('exit', stop);
  console.log('M2 isolated PostgreSQL and local storage ready: http://localhost:3107/dashboard/library');
} catch { console.error('Could not start isolated media test environment; check fixture ports and cluster ownership.'); process.exitCode = 1; await stop(); }
