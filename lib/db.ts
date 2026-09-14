import { Pool, type QueryResultRow } from 'pg';

import { requireEnv } from '@/lib/env';

/**
 * Server-side Postgres access.
 *
 * This connects as the database owner, which bypasses RLS — the same posture as
 * Supabase's service role. It is server-only: importing this from a client
 * component is a bug, and the missing-env error will say so loudly.
 *
 * RLS still matters. It is the boundary for anything holding an anon or user
 * JWT (the browser, PostgREST). This pool is the trusted path that runs
 * validators and writes verified rows, which is exactly why no client may.
 */

declare global {
  // Reused across hot reloads in dev and across warm invocations in serverless,
  // so we do not open a new pool per request and exhaust the free-tier limit.
  var __questLebPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__questLebPool) {
    globalThis.__questLebPool = new Pool({
      connectionString: requireEnv('DATABASE_URL'),
      // Supabase's free tier is small; keep the ceiling well under it.
      max: 4,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__questLebPool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as unknown[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run a function inside a transaction, rolling back on any throw. */
export async function transaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Mirrors public.is_within_geofence. Fails closed on an unknown quest. */
export async function isWithinGeofence(
  questId: string,
  lat: number,
  lng: number,
): Promise<boolean> {
  const row = await queryOne<{ within: boolean }>(
    'select public.is_within_geofence($1::uuid, $2::float8, $3::float8) as within',
    [questId, lat, lng],
  );
  return row?.within ?? false;
}
