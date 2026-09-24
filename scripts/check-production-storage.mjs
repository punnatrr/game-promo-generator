import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
const db = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const tables = await db`select relname as table,pg_total_relation_size(oid) as bytes from pg_class where relnamespace='public'::regnamespace and relkind='r' order by pg_total_relation_size(oid) desc limit 15`;
  console.log('largest_tables', tables.map(row => ({ table: row.table, mb: Math.round(Number(row.bytes) / 1048576) })));
  const candidates = [
    ['generated_images', 'expires_at'],
    ['generations', 'created_at'],
    ['daily_images', 'created_at'],
    ['crawler_runs', 'started_at'],
    ['notifications', 'created_at'],
  ];
  for (const [name, date] of candidates) {
    const columns = await db`select column_name from information_schema.columns where table_schema='public' and table_name=${name}`;
    if (!columns.some(row => row.column_name === date)) continue;
    const age = date === 'expires_at' ? 'now()' : "now()-interval '90 days'";
    const [row] = await db.unsafe(`select count(*)::int as old_rows from ${name} where ${date}<${age}`);
    console.log(name, date, row.old_rows);
  }
  const images = await db`select expires_at<=now() as expired,count(*)::int as rows,round(sum(pg_column_size(image_url))::numeric/1048576,1) as image_mb from generated_images group by expires_at<=now()`;
  console.log('generated_image_payloads', images);
} finally { await db.end({ timeout: 5 }); }
