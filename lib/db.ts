import postgres from "postgres";

let client: postgres.Sql | null = null;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  if (!client) {
    client = postgres(databaseUrl, {
      max: 5,
      prepare: false,
    });
  }

  return client;
}
