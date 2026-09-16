import process from "node:process";
import { del, put } from "@vercel/blob";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Missing DATABASE_URL");
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error("Missing BLOB_READ_WRITE_TOKEN");
}

const db = postgres(databaseUrl, { max: 1, prepare: false });
let uploadedUrl = null;

try {
  const [tables] = await db.unsafe(`
    select
      to_regclass('public.support_conversations') is not null as conversations,
      to_regclass('public.support_messages') is not null as messages,
      to_regclass('public.support_attachments') is not null as attachments
  `);

  if (!tables.conversations || !tables.messages || !tables.attachments) {
    throw new Error("VIP Support database tables are incomplete");
  }
  console.log("database=ok");

  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  const blob = await put("support-chat/health-check.png", onePixelPng, {
    access: "private",
    addRandomSuffix: true,
    contentType: "image/png",
  });
  uploadedUrl = blob.url;
  console.log("blob-upload=ok");

  await del(uploadedUrl);
  uploadedUrl = null;
  console.log("blob-delete=ok");
} finally {
  if (uploadedUrl) await del(uploadedUrl).catch(() => {});
  await db.end({ timeout: 5 });
}
