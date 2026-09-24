import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const required = [
  "DATABASE_URL",
  "BLOB_READ_WRITE_TOKEN",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "CRON_SECRET",
  "BANK_NAME",
  "BANK_ACCOUNT_NAME",
  "BANK_ACCOUNT_NUMBER",
];
const optional = ["FFMPEG_PATH", "FFPROBE_PATH", "FRAME_FONT_PATH", "MOTION_VISION_MODEL", "ADS_ANALYSIS_MODEL"];
console.log("Locally available environment:", Object.fromEntries([...required, ...optional].map(name => [name, Boolean(process.env[name] && process.env[name] !== "[SENSITIVE]")])));

if (!process.env.DATABASE_URL) process.exit(1);
const db = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  const files = (await readdir(path.resolve("db/migrations"))).filter(name => name.endsWith(".sql")).sort();
  const [table] = await db`select to_regclass('public.schema_migrations') as name`;
  if (!table.name) {
    console.log("Migration ledger: missing");
    process.exitCode = 2;
  } else {
    const rows = await db`select file_name, checksum from schema_migrations`;
    const applied = new Map(rows.map(row => [row.file_name, row.checksum]));
    const missing = [];
    const changed = [];
    for (const name of files) {
      const checksum = createHash("sha256").update(await readFile(path.resolve("db/migrations", name), "utf8")).digest("hex");
      if (!applied.has(name)) missing.push(name);
      else if (applied.get(name) !== checksum) changed.push(name);
    }
    console.log("Missing migrations:", missing);
    console.log("Checksum mismatch:", changed);
    const [queues] = await db`select
      (select count(*)::int from pg_tables where schemaname='public') as tables,
      to_regclass('public.media_jobs') is not null as media_jobs,
      to_regclass('public.motion_jobs') is not null as motion_jobs,
      to_regclass('public.ads_plans') is not null as ads_plans`;
    console.log("Database objects:", queues);
    if (changed.length) process.exitCode = 3;
  }
} finally {
  await db.end();
}
