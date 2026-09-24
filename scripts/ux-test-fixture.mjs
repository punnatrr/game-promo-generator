import postgres from 'postgres';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const db=postgres('postgresql://postgres:postgres@127.0.0.1:55439/postgres',{max:1,onnotice:()=>{}});
try {
  const [cluster]=await db`show data_directory`;
  if(!path.resolve(cluster.data_directory).toLowerCase().startsWith(path.resolve('.test-build/media-pg-').toLowerCase()))throw new Error('Not the disposable test cluster');
  for(const file of ['20260728_game_content.sql','20260728_game_calendar.sql','20260729_admin_activity_review.sql','20260801_subscription_phase1.sql','20260801_subscription_phase2.sql','20260822_vip_support_chat.sql','20260824_trial_codes.sql']) await db.unsafe(await readFile(`db/migrations/${file}`,'utf8'));
  await db.unsafe(await readFile('db/seed-plans.sql','utf8'));
  console.log('Isolated UI fixture schemas and plans ready');
} finally {await db.end();}
