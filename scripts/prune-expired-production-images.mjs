import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
const db = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const removed = await db`delete from generated_images where expires_at<=now() returning id`;
  console.log('expired_images_removed', removed.length);
  await db`vacuum (analyze) generated_images`;
  console.log('vacuum_complete');
} finally { await db.end({ timeout: 5 }); }
