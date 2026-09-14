/**
 * Environment access.
 *
 * Read through these helpers rather than touching process.env directly, so a
 * missing variable fails loudly at the point of use with a name you can act on,
 * instead of surfacing later as `undefined` in a signature or a URL.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
