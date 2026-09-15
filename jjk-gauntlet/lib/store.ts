/**
 * Run storage behind one adapter, so routes never touch a driver.
 *
 * Postgres when DATABASE_URL is set (Vercel Postgres, Supabase, Neon — all have
 * a free tier); an in-process Map otherwise, so `npm run dev` works with no
 * database at all. The Map does not survive a serverless cold start, so a real
 * deployment needs DATABASE_URL — /api/runs says so in its response.
 */

import { Pool } from 'pg';

import type { SavedRun } from './share.ts';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function newRunId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export interface RunStore {
  kind: 'postgres' | 'memory';
  save(run: SavedRun): Promise<void>;
  get(id: string): Promise<SavedRun | null>;
  recent(limit: number): Promise<SavedRun[]>;
}

const SCHEMA = `
  create table if not exists runs (
    id          text primary key,
    created_at  timestamptz not null default now(),
    mode        text not null,
    side        text not null,
    seed        text not null,
    payload     jsonb not null
  );
  create index if not exists runs_created_at_idx on runs (created_at desc);
`;

/** Next runs server components and route handlers in separate module graphs,
 *  so a module-level Map is not one Map — it is one per layer. Both the memory
 *  store and the pg pool hang off globalThis so every layer, and every hot
 *  reload, shares the same instance. */
interface RunGlobals {
  memory?: Map<string, SavedRun>;
  pool?: Pool;
  ready?: Promise<void>;
}
const globals = globalThis as typeof globalThis & { __jjkRuns?: RunGlobals };
globals.__jjkRuns ??= {};
const store = globals.__jjkRuns;

function getPool(url: string): Pool {
  store.pool ??= new Pool({
    connectionString: url,
    max: 2,
    ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
  });
  return store.pool;
}

store.memory ??= new Map<string, SavedRun>();
const memory = store.memory;

const memoryStore: RunStore = {
  kind: 'memory',
  async save(run) {
    memory.set(run.id, run);
  },
  async get(id) {
    return memory.get(id) ?? null;
  },
  async recent(limit) {
    return [...memory.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  },
};

export function getStore(): RunStore {
  const url = process.env.DATABASE_URL;
  if (!url) return memoryStore;

  const db = getPool(url);
  store.ready ??= db.query(SCHEMA).then(() => undefined);
  const ready = store.ready;

  return {
    kind: 'postgres',
    async save(run) {
      await ready;
      await db.query(
        `insert into runs (id, mode, side, seed, payload)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set payload = excluded.payload`,
        [run.id, run.mode, run.side, run.seed, JSON.stringify(run)],
      );
    },
    async get(id) {
      await ready;
      const { rows } = await db.query<{ payload: SavedRun }>(
        'select payload from runs where id = $1',
        [id],
      );
      return rows[0]?.payload ?? null;
    },
    async recent(limit) {
      await ready;
      const { rows } = await db.query<{ payload: SavedRun }>(
        'select payload from runs order by created_at desc limit $1',
        [limit],
      );
      return rows.map((r) => r.payload);
    },
  };
}
