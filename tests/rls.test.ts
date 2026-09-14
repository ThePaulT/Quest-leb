import { beforeEach, describe, expect, it } from 'vitest';

import { getPool, query } from '@/lib/db';

import { createQuest, createUser, resetDatabase } from './helpers';

/**
 * RLS as a browser sees it.
 *
 * Every case here runs with `set local role` to anon or authenticated and the
 * JWT subject bound the way Supabase binds it, so these exercise the real
 * policies — not the owner connection the rest of the suite uses, which
 * bypasses RLS by design.
 */
async function asRole<T>(
  role: 'anon' | 'authenticated',
  userId: string | null,
  fn: (run: (sql: string, params?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    if (userId) {
      await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    }
    const run = async (sql: string, params: unknown[] = []) =>
      (await client.query(sql, params)).rows;
    return await fn(run);
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

let userId: string;
let otherId: string;

beforeEach(async () => {
  await resetDatabase();
  userId = await createUser();
  otherId = await createUser();
});

async function insertCompletion(
  owner: string,
  questId: string,
  status: 'verified' | 'flagged' | 'rejected',
  isPublic = true,
) {
  await query(
    `insert into public.completions
       (user_id, quest_id, lat, lng, accuracy_m, validation_status, is_public)
     values ($1::uuid, $2::uuid, 33.9, 35.5, 10, $3::public.validation_status, $4)`,
    [owner, questId, status, isPublic],
  );
}

describe('quests', () => {
  it('lets anonymous visitors read active quests', async () => {
    await createQuest({ isActive: true });
    await asRole('anon', null, async (run) => {
      expect(await run('select id from public.quests')).toHaveLength(1);
    });
  });

  it('hides inactive quests from anonymous visitors', async () => {
    await createQuest({ isActive: false });
    await asRole('anon', null, async (run) => {
      expect(await run('select id from public.quests')).toHaveLength(0);
    });
  });

  it('refuses quest writes from a signed-in user', async () => {
    await asRole('authenticated', userId, async (run) => {
      await expect(
        run(`insert into public.quests (slug, title_en, title_ar, summary_en, summary_ar,
              region, category, difficulty, location, proof_type)
             values ('x','t','ت','s','س','beirut','urban',1,
               extensions.st_setsrid(extensions.st_makepoint(35.5,33.9),4326)::extensions.geography,
               'photo_at_location')`),
      ).rejects.toThrow();
    });
  });
});

describe('badges', () => {
  it('are readable anonymously', async () => {
    await query(
      `insert into public.badges (slug, name_en, name_ar, rule_type, rule_value)
       values ('b','B','ب','all_complete','{}'::jsonb)`,
    );
    await asRole('anon', null, async (run) => {
      expect(await run('select id from public.badges')).toHaveLength(1);
    });
  });
});

describe('completions', () => {
  it('lets a user read their own rows whatever the verdict', async () => {
    const quest = await createQuest();
    await insertCompletion(userId, quest.id, 'rejected');

    await asRole('authenticated', userId, async (run) => {
      expect(await run('select id from public.completions')).toHaveLength(1);
    });
  });

  it("shows another user's verified public completion", async () => {
    const quest = await createQuest();
    await insertCompletion(otherId, quest.id, 'verified', true);

    await asRole('authenticated', userId, async (run) => {
      expect(await run('select id from public.completions')).toHaveLength(1);
    });
  });

  it("hides another user's rejected completion even when public", async () => {
    const quest = await createQuest();
    await insertCompletion(otherId, quest.id, 'rejected', true);

    await asRole('authenticated', userId, async (run) => {
      expect(await run('select id from public.completions')).toHaveLength(0);
    });
  });

  it("hides another user's private completion", async () => {
    const quest = await createQuest();
    await insertCompletion(otherId, quest.id, 'verified', false);

    await asRole('authenticated', userId, async (run) => {
      expect(await run('select id from public.completions')).toHaveLength(0);
    });
  });

  it('hides everything from anonymous visitors', async () => {
    const quest = await createQuest();
    await insertCompletion(otherId, quest.id, 'verified', true);

    await asRole('anon', null, async (run) => {
      await expect(run('select id from public.completions')).rejects.toThrow();
    });
  });

  it('refuses an insert on behalf of someone else', async () => {
    const quest = await createQuest();
    await asRole('authenticated', userId, async (run) => {
      await expect(
        run(
          `insert into public.completions (user_id, quest_id, validation_status)
           values ($1::uuid, $2::uuid, 'flagged')`,
          [otherId, quest.id],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a client-claimed verified status', async () => {
    const quest = await createQuest();
    await asRole('authenticated', userId, async (run) => {
      await expect(
        run(
          `insert into public.completions (user_id, quest_id, validation_status)
           values ($1::uuid, $2::uuid, 'verified')`,
          [userId, quest.id],
        ),
      ).rejects.toThrow();
    });
  });

  it('refuses a client update, even to the user’s own row', async () => {
    const quest = await createQuest();
    await insertCompletion(userId, quest.id, 'flagged');

    await asRole('authenticated', userId, async (run) => {
      await expect(
        run(`update public.completions set validation_status = 'verified'`),
      ).rejects.toThrow();
    });
  });

  it('refuses a client delete', async () => {
    const quest = await createQuest();
    await insertCompletion(userId, quest.id, 'verified');

    await asRole('authenticated', userId, async (run) => {
      await expect(run('delete from public.completions')).rejects.toThrow();
    });
  });
});

describe('profiles', () => {
  it('lets a user read only their own profile', async () => {
    await asRole('authenticated', userId, async (run) => {
      const rows = (await run('select id from public.profiles')) as { id: string }[];
      expect(rows.map((r) => r.id)).toEqual([userId]);
    });
  });

  it('refuses a self-promotion to admin', async () => {
    await asRole('authenticated', userId, async (run) => {
      await expect(
        run(`update public.profiles set role = 'admin' where id = $1::uuid`, [userId]),
      ).rejects.toThrow();
    });
  });

  it('allows an ordinary profile edit', async () => {
    // Asserted inside the same transaction: asRole always rolls back, so a
    // check after it returns would see the pre-edit row and prove nothing.
    await asRole('authenticated', userId, async (run) => {
      await run(`update public.profiles set display_name = 'Rami' where id = $1::uuid`, [
        userId,
      ]);
      const rows = (await run(
        'select display_name from public.profiles where id = $1::uuid',
        [userId],
      )) as { display_name: string }[];
      expect(rows[0].display_name).toBe('Rami');
    });
  });
});

describe('events', () => {
  it('are invisible and unwritable from any client role', async () => {
    await query(
      `insert into public.events (user_id, event_name) values ($1::uuid, 'proof_submitted')`,
      [userId],
    );

    await asRole('authenticated', userId, async (run) => {
      await expect(run('select id from public.events')).rejects.toThrow();
      await expect(
        run(`insert into public.events (event_name) values ('proof_submitted')`),
      ).rejects.toThrow();
    });
  });
});
