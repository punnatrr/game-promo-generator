import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";

const migrationsDirectory = path.resolve(process.cwd(), "db", "migrations");
const dryRun = process.argv.includes("--dry-run");
const onlyArgument = process.argv.find((argument) =>
  argument.startsWith("--only=")
);
const onlyFileName = onlyArgument?.slice("--only=".length) || null;

const sameDayPriority = new Map([
  ["20260728_game_content.sql", 10],
  ["20260728_game_calendar.sql", 20],
  ["20260728_game_source_adapters.sql", 30],
]);

function compareMigrationNames(left, right) {
  const leftDate = left.slice(0, 8);
  const rightDate = right.slice(0, 8);
  const dateComparison = leftDate.localeCompare(rightDate);
  if (dateComparison !== 0) return dateComparison;

  const priorityComparison =
    (sameDayPriority.get(left) ?? 100) -
    (sameDayPriority.get(right) ?? 100);
  return priorityComparison || left.localeCompare(right);
}

const allMigrationFiles = (await readdir(migrationsDirectory))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort(compareMigrationNames);

if (onlyFileName && !allMigrationFiles.includes(onlyFileName)) {
  throw new Error(`Migration ${onlyFileName} does not exist.`);
}

const migrationFiles = onlyFileName
  ? allMigrationFiles.filter((fileName) => fileName === onlyFileName)
  : allMigrationFiles;

const migrations = await Promise.all(
  migrationFiles.map(async (fileName) => {
    const sqlText = await readFile(
      path.join(migrationsDirectory, fileName),
      "utf8"
    );

    return {
      fileName,
      sqlText,
      checksum: createHash("sha256").update(sqlText).digest("hex"),
    };
  })
);

if (dryRun) {
  for (const migration of migrations) {
    console.log(`${migration.fileName} ${migration.checksum.slice(0, 12)}`);
  }
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL. Set it before running db:migrate.");
}

const db = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

const MIGRATION_LOCK_ID = 1_627_450_137;

try {
  await db`
    create table if not exists schema_migrations (
      file_name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `;

  await db`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;

  for (const migration of migrations) {
    const [applied] = await db`
      select checksum
      from schema_migrations
      where file_name = ${migration.fileName}
    `;

    if (applied) {
      if (applied.checksum !== migration.checksum) {
        throw new Error(
          `Migration ${migration.fileName} was modified after it was applied.`
        );
      }

      console.log(`skip  ${migration.fileName}`);
      continue;
    }

    await db.begin(async (transaction) => {
      await transaction.unsafe(migration.sqlText, [], { prepare: false });
      await transaction`
        insert into schema_migrations (file_name, checksum)
        values (${migration.fileName}, ${migration.checksum})
      `;
    });

    console.log(`apply ${migration.fileName}`);
  }
} finally {
  try {
    await db`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
  } catch {
    // The connection may already be closed after a migration error.
  }
  await db.end({ timeout: 5 });
}
