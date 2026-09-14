import { afterAll } from 'vitest';

import { getPool } from '@/lib/db';

// A signing secret for tokens minted in tests. Must be set before anything
// reads it, which is why this lives in setupFiles rather than a test file.
process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret-not-used-anywhere-real';

afterAll(async () => {
  await getPool().end();
});
