import { and, eq, gt, inArray } from "drizzle-orm";

import { getDb } from "./db.js";
import { cacheEntries, type CacheValue } from "./schema.js";

export async function getCacheValue<T>(key: string) {
  const [entry] = await getDb()
    .select({ value: cacheEntries.value })
    .from(cacheEntries)
    .where(and(eq(cacheEntries.key, key), gt(cacheEntries.expiresAt, new Date())))
    .limit(1);

  return (entry?.value as T | undefined) ?? null;
}

export async function setCacheValue(key: string, value: CacheValue, ttlSeconds: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  await getDb()
    .insert(cacheEntries)
    .values({
      key,
      value,
      expiresAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: {
        value,
        expiresAt,
        updatedAt: now,
      },
    });
}

export async function deleteCacheValues(keys: string[]) {
  if (keys.length === 0) return;

  await getDb().delete(cacheEntries).where(inArray(cacheEntries.key, keys));
}
