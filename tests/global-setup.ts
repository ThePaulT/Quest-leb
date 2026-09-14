import { Pool } from 'pg';

/**
 * Integration tests run against a real Postgres with the real migrations
 * applied — not mocks. Bring one up first:
 *
 *   npm run db:start   (Docker: the full Supabase stack)
 *   npm run db:local   (no Docker: database only, via the supabase/dev shim)
 *
 * and point DATABASE_URL at it.
 */
export default async function setup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Start a database (npm run db:local) and export ' +
        'the connection string it prints before running the tests.',
    );
  }

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  try {
    const { rows } = await pool.query<{ present: boolean }>(
      `select count(*) = 6 as present
         from information_schema.tables
        where table_schema = 'public'
          and table_name in ('quests','profiles','completions','badges','user_badges','events')`,
    );
    if (!rows[0]?.present) {
      throw new Error(
        'The database at DATABASE_URL has no schema. Run: npm run db:local:reset',
      );
    }
  } finally {
    await pool.end();
  }
}
