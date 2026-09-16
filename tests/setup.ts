import { afterAll } from 'vitest';

import { getPool, query } from '@/lib/db';

// A signing secret for tokens minted in tests. Must be set before anything
// reads it, which is why this lives in setupFiles rather than a test file.
process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret-not-used-anywhere-real';

afterAll(async () => {
  // Leave the database as we found it. Tests and local development share one
  // database, and a run used to leave its fixtures behind — including quests
  // with is_active = true, which then showed up as bogus pins on the map.
  try {
    await query('truncate public.events, public.user_badges, public.completions cascade');
    await query('truncate public.badges cascade');
    await query('truncate public.quests cascade');
    await query('delete from auth.users');
  } finally {
    await getPool().end();
  }
});
