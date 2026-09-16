// Only upgrade an existing disposable fixture; never read live .env files.
import postgres from 'postgres';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
const db=postgres('postgresql://postgres:postgres@127.0.0.1:55439/postgres',{max:1,connect_timeout:2});
try{
  const [cluster]=await db`show data_directory`;
  if(!path.resolve(cluster.data_directory).toLowerCase().startsWith(path.resolve('.test-build/media-pg-').toLowerCase()))throw new Error('Not a disposable media test cluster');
  const [column]=await db`select 1 from information_schema.columns where table_name='motion_jobs' and column_name='mode'`;
  if(!column)await db.unsafe(await readFile('db/migrations/20260915_video_frame.sql','utf8'));
  console.log('M4 disposable fixture ready.');
}finally{await db.end();}
