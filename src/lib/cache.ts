import { createHash } from "node:crypto";
import { Prisma, type DataSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const memoryCache = new Map<
  string,
  { expiresAt: number; payload: unknown }
>();

export async function cachedSearch<T>(
  source: DataSource,
  query: string,
  limit: number,
  load: () => Promise<T>,
  forceRefresh = false,
): Promise<{ result: T; cacheHit: boolean }> {
  const cacheQuery = `${query}\nlimit=${limit}`;
  const key = createHash("sha256")
    .update(`${source}:${cacheQuery}`)
    .digest("hex");
  const now = Date.now();
  if (!forceRefresh) {
    const localHit = memoryCache.get(key);
    if (localHit && localHit.expiresAt > now) {
      return { result: localHit.payload as T, cacheHit: true };
    }

    if (process.env.DATABASE_URL) {
      try {
        const persisted = await prisma.searchCache.findUnique({ where: { key } });
        if (persisted && persisted.expiresAt.getTime() > now) {
          memoryCache.set(key, {
            expiresAt: persisted.expiresAt.getTime(),
            payload: persisted.payload,
          });
          return { result: persisted.payload as T, cacheHit: true };
        }
      } catch (error) {
        console.warn("No se pudo leer la caché PostgreSQL.", error);
      }
    }
  }

  const result = await load();
  const expiresAt = new Date(now + CACHE_TTL_MS);
  for (const [cachedKey, entry] of memoryCache) {
    if (entry.expiresAt <= now) memoryCache.delete(cachedKey);
  }
  if (memoryCache.size >= 500) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { expiresAt: expiresAt.getTime(), payload: result });

  if (process.env.DATABASE_URL) {
    try {
      await prisma.searchCache.upsert({
        where: { key },
        create: {
          key,
          source,
          query: cacheQuery,
          payload: result as Prisma.InputJsonValue,
          expiresAt,
        },
        update: {
          source,
          query: cacheQuery,
          payload: result as Prisma.InputJsonValue,
          fetchedAt: new Date(now),
          expiresAt,
        },
      });
    } catch (error) {
      console.warn("No se pudo persistir la caché PostgreSQL.", error);
    }
  }

  return { result, cacheHit: false };
}