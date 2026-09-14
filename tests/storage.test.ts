import { describe, expect, it } from 'vitest';

import { StorageError, completionPhotoKey } from '@/lib/storage';

describe('completionPhotoKey', () => {
  it('builds the documented key shape', () => {
    const at = new Date('2026-09-14T10:00:00.000Z');
    expect(completionPhotoKey('user-1', 'quest-1', at)).toBe(
      `completions/user-1/quest-1-${at.getTime()}.webp`,
    );
  });

  it('changes on every submission, so photos are immutable per upload', () => {
    const a = completionPhotoKey('u', 'q', new Date(1));
    const b = completionPhotoKey('u', 'q', new Date(2));
    expect(a).not.toBe(b);
  });
});

describe('R2Storage key validation', () => {
  // Constructed lazily so the env check runs before the key check.
  const env = {
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'bucket',
    R2_PUBLIC_URL: 'https://cdn.example.test',
  };

  async function withEnv<T>(fn: () => Promise<T>): Promise<T> {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try {
      return await fn();
    } finally {
      process.env = saved;
    }
  }

  it.each(['../escape.webp', 'has space.webp', 'query?.webp', ''])(
    'refuses the key %j',
    async (key) => {
      await withEnv(async () => {
        const { R2Storage } = await import('@/lib/storage');
        const storage = new R2Storage();
        await expect(storage.uploadPhoto(Buffer.from('x'), key)).rejects.toBeInstanceOf(
          StorageError,
        );
      });
    },
  );

  it('publicUrl predicts the upload URL without writing anything', async () => {
    await withEnv(async () => {
      const { R2Storage } = await import('@/lib/storage');
      const storage = new R2Storage();
      // The route relies on this matching uploadPhoto's return value exactly:
      // it validates against the predicted URL and only then uploads.
      expect(storage.publicUrl('completions/u/q-1.webp')).toBe(
        'https://cdn.example.test/completions/u/q-1.webp',
      );
    });
  });

  it('publicUrl refuses an unsafe key too', async () => {
    await withEnv(async () => {
      const { R2Storage } = await import('@/lib/storage');
      const storage = new R2Storage();
      expect(() => storage.publicUrl('../escape.webp')).toThrow(StorageError);
    });
  });

  it('fails loudly when an environment variable is missing', async () => {
    const saved = { ...process.env };
    for (const k of Object.keys(env)) delete process.env[k];
    try {
      const { R2Storage } = await import('@/lib/storage');
      expect(() => new R2Storage()).toThrow(/R2_/);
    } finally {
      process.env = saved;
    }
  });
});
