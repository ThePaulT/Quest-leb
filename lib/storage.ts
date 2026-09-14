import { AwsClient } from 'aws4fetch';

import { requireEnv } from '@/lib/env';

/**
 * Photo storage adapter.
 *
 * Routes call uploadPhoto and nothing else — no route imports an S3 or R2
 * client directly. Swapping R2 for anything else means adding an implementation
 * here and changing one line in getStorage().
 *
 * Image bytes never reach Postgres: this returns a URL, and that URL is what
 * gets stored.
 */

export interface Storage {
  /** Returns the public URL of the stored object. */
  uploadPhoto(buffer: Buffer | Uint8Array, key: string): Promise<string>;
}

/**
 * Cloudflare R2 over its S3-compatible API.
 *
 * aws4fetch rather than @aws-sdk/client-s3 on purpose: it is a few kilobytes
 * instead of megabytes, it runs on the edge runtime, and R2 egress is free so
 * the SDK's retry and transfer machinery buys us nothing here.
 */
export class R2Storage implements Storage {
  private readonly client: AwsClient;
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    this.client = new AwsClient({
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      service: 's3',
      region: 'auto',
    });
    this.endpoint = `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`;
    this.bucket = requireEnv('R2_BUCKET');
    this.publicUrl = requireEnv('R2_PUBLIC_URL').replace(/\/+$/, '');
  }

  async uploadPhoto(buffer: Buffer | Uint8Array, key: string): Promise<string> {
    const objectKey = normalizeKey(key);
    const body = new Uint8Array(buffer);

    const response = await this.client.fetch(
      `${this.endpoint}/${this.bucket}/${objectKey}`,
      {
        method: 'PUT',
        body,
        headers: {
          'content-type': 'image/webp',
          'content-length': String(body.byteLength),
          // Photos are immutable: the key carries a timestamp, so a changed
          // photo is a new key. Cache hard and never pay egress twice.
          'cache-control': 'public, max-age=31536000, immutable',
        },
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new StorageError(
        `R2 upload failed for ${objectKey}: ${response.status} ${response.statusText} ${detail}`.trim(),
      );
    }

    return `${this.publicUrl}/${objectKey}`;
  }
}

export class StorageError extends Error {
  override name = 'StorageError';
}

/**
 * Reject anything that could escape the intended prefix or produce a key the
 * bucket will not round-trip. Keys are built server-side from ids, so a
 * violation here is a bug, not user input — fail loudly.
 */
function normalizeKey(key: string): string {
  const trimmed = key.replace(/^\/+/, '');
  if (trimmed === '' || trimmed.includes('..') || /[\s#?]/.test(trimmed)) {
    throw new StorageError(`Invalid storage key: ${JSON.stringify(key)}`);
  }
  return trimmed;
}

let cached: Storage | undefined;

/** The single entry point. Construction is lazy so envs are read at use, not import. */
export function getStorage(): Storage {
  if (!cached) {
    cached = new R2Storage();
  }
  return cached;
}

/** Test seam: lets integration tests exercise routes without a live R2 bucket. */
export function setStorage(storage: Storage | undefined): void {
  cached = storage;
}

/** The canonical object key for a completion photo. */
export function completionPhotoKey(
  userId: string,
  questId: string,
  timestamp: Date = new Date(),
): string {
  return `completions/${userId}/${questId}-${timestamp.getTime()}.webp`;
}
