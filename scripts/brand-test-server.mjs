// Disposable local PostgreSQL-compatible database. Never loads .env.local here.
// Install test-only tools under ignored .test-build/brand-tools; see docs/brand-kit-m1.md.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { PGlite } from "../.test-build/brand-tools/node_modules/@electric-sql/pglite/dist/index.js";
import { PGLiteSocketServer } from "../.test-build/brand-tools/node_modules/@electric-sql/pglite-socket/dist/index.js";

const db = await PGlite.create();
const schema = (await readFile("db/schema.sql", "utf8")).replace("create extension if not exists pgcrypto;", "");
await db.exec(schema);
await db.exec(await readFile("db/migrations/20260914_brand_kit.sql", "utf8"));
if (process.argv.includes('--media')) await db.exec(await readFile("db/migrations/20260914_media_library.sql", "utf8"));
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 55439, maxConnections: 10 });
await server.start();
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3107"], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55439/postgres", MEDIA_TEST_STORAGE: process.argv.includes('--media') ? '1' : '', BLOB_READ_WRITE_TOKEN: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", GOOGLE_API_KEY: "", AUTH_SESSION_COOKIE_NAME: "brand_test_session", NODE_ENV: "development" },
});
console.log("Brand Kit disposable database ready. Test app: http://localhost:3107");
async function stop() { child.kill(); await server.stop(); await db.close(); process.exit(0); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", stop);
