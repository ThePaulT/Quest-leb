import { randomUUID } from 'node:crypto';

import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

import { query, queryOne } from '@/lib/db';
import { requireEnv } from '@/lib/env';

/**
 * Mints a session token for local work. NEVER available in production.
 *
 * The Docker-less local database (supabase/dev/) is a plain Postgres with no
 * GoTrue, so there is no way to sign in and therefore no way to exercise the
 * submission flow. This issues a token signed with the same SUPABASE_JWT_SECRET
 * the API already verifies, for a throwaway local user.
 *
 * Two independent guards, because an endpoint that hands out credentials must
 * not be one typo away from shipping:
 *   1. NODE_ENV must not be production.
 *   2. ALLOW_DEV_SIGN_IN must be exactly '1'.
 *
 * Both are checked on every request, and the route 404s otherwise so its
 * existence is not even advertised.
 */
const DEV_EMAIL = 'dev@quest-leb.local';

function devSignInAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_SIGN_IN === '1';
}

export async function POST(): Promise<NextResponse> {
  if (!devSignInAllowed()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Reuse one local user so completions accumulate the way they would for a
  // real person, rather than a fresh identity per sign-in.
  let user = await queryOne<{ id: string }>(
    `select id from auth.users where email = $1`,
    [DEV_EMAIL],
  );

  if (!user) {
    const id = randomUUID();
    await query(`insert into auth.users (id, email) values ($1::uuid, $2)`, [id, DEV_EMAIL]);
    user = { id };
  }

  const secret = new TextEncoder().encode(requireEnv('SUPABASE_JWT_SECRET'));
  const token = await new SignJWT({ role: 'authenticated', email: DEV_EMAIL })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret);

  return NextResponse.json({ token, email: DEV_EMAIL });
}

/** Lets the sign-in page show the developer option only when it would work. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ available: devSignInAllowed() });
}
