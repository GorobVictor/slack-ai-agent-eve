import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema.js";

type Database = ReturnType<typeof createDb>;

let db: Database | null = null;

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to use the storage database");
  }

  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export function getDb() {
  db ??= createDb();
  return db;
}
