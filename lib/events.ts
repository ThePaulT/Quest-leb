import type { PoolClient } from 'pg';

import { getPool } from '@/lib/db';

/**
 * Event log.
 *
 * Every meaningful user action writes a row here. Pass a client to enlist the
 * write in a surrounding transaction, so an event never survives a rolled-back
 * action (and never goes missing from one that committed).
 */

export type EventName =
  | 'proof_submitted'
  | 'proof_rejected'
  | 'proof_flagged'
  | 'badge_earned';

export async function recordEvent(
  input: {
    eventName: EventName;
    userId: string | null;
    questId?: string | null;
    metadata?: Record<string, unknown>;
  },
  client?: PoolClient,
): Promise<void> {
  const executor = client ?? getPool();
  await executor.query(
    `insert into public.events (user_id, event_name, quest_id, metadata)
     values ($1::uuid, $2, $3::uuid, $4::jsonb)`,
    [
      input.userId,
      input.eventName,
      input.questId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
