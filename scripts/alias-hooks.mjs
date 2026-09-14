/**
 * Resolves the `@/*` TypeScript path alias for plain `node` runs.
 *
 * Next's bundler and Vitest each resolve `@/*` from their own config, but bare
 * Node knows nothing about tsconfig `paths`, so a standalone script importing
 * anything under lib/ dies with ERR_MODULE_NOT_FOUND. This hook teaches the
 * Node resolver the same mapping, without adding a runtime dependency or
 * forcing lib/ to use relative imports.
 *
 * Registered by scripts/register-aliases.mjs; see the db:* and verify:* scripts.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);

// Node's ESM resolver never infers an extension, and type stripping needs the
// real `.ts` file, so try the same candidates tsconfig would.
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) {
    return nextResolve(specifier, context);
  }

  const base = new URL(specifier.slice(2), projectRoot);
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = new URL(base.href + suffix);
    if (existsSync(fileURLToPath(candidate))) {
      return nextResolve(candidate.href, context);
    }
  }

  throw Object.assign(
    new Error(
      `Cannot resolve "${specifier}" from the @/* alias. Looked for ` +
        CANDIDATE_SUFFIXES.map((s) => `${specifier}${s}`).join(', '),
    ),
    { code: 'ERR_MODULE_NOT_FOUND' },
  );
}
