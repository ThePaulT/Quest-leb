import { jwtVerify } from 'jose';

import { requireEnv } from '@/lib/env';

/**
 * Access-token verification.
 *
 * Supabase signs access tokens with the project's JWT secret (HS256), so we
 * verify locally rather than calling GoTrue on every request: no network hop,
 * no egress against the free tier's 5GB, and it works against a local database
 * in tests with a genuinely signed token rather than a stubbed client.
 */

export class UnauthorizedError extends Error {
  override name = 'UnauthorizedError';
}

let cachedSecret: Uint8Array | undefined;

function secret(): Uint8Array {
  if (!cachedSecret) {
    cachedSecret = new TextEncoder().encode(requireEnv('SUPABASE_JWT_SECRET'));
  }
  return cachedSecret;
}

/** Extracts and verifies the bearer token, returning the user id (JWT `sub`). */
export async function requireUserId(request: Request): Promise<string> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    throw new UnauthorizedError('Missing bearer token');
  }

  try {
    const { payload } = await jwtVerify(match[1], secret());
    if (typeof payload.sub !== 'string' || payload.sub === '') {
      throw new UnauthorizedError('Token has no subject');
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired token');
  }
}
