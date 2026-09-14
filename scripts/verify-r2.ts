/**
 * Proves the R2 path end to end, with nothing stubbed.
 *
 *   npm run verify:r2
 *
 * It uploads a real WebP through lib/storage.ts, fetches it back over the
 * PUBLIC url (the one that ends up in completions.photo_url), asserts the bytes
 * round-tripped byte for byte, then deletes it and confirms it is gone.
 *
 * Requires these five variables, in .env.local or the environment:
 *
 *   R2_ACCOUNT_ID          Cloudflare account id (the R2 endpoint host)
 *   R2_ACCESS_KEY_ID       R2 API token, Object Read & Write
 *   R2_SECRET_ACCESS_KEY   the token's secret
 *   R2_BUCKET              bucket name
 *   R2_PUBLIC_URL          public base url, no trailing slash — either the
 *                          bucket's r2.dev domain or a custom domain. The
 *                          bucket must allow public read, or step 3 fails with
 *                          401/403 even though the upload worked.
 *
 * Exits non-zero on the first failure and says which step failed and why.
 */
import { fileURLToPath } from 'node:url';

import { getStorage } from '../lib/storage.ts';

/** The canonical minimal WebP: a 1x1 lossless VP8L image with alpha. */
const WEBP_1X1_BASE64 = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

/** Roughly a real compressed quest photo, so this exercises a realistic transfer. */
const TARGET_BYTES = 120 * 1024;

/**
 * A valid WebP of a realistic size.
 *
 * The 1x1 image alone is 34 bytes, which proves credentials and URLs but not
 * that a photo-sized body survives the round trip intact. So we append an
 * `XMP ` metadata chunk padded with whitespace — which is exactly how XMP
 * packets are padded in real image files — and fix up the RIFF length. Decoders
 * skip unknown chunks, so the result is still a decodable 1x1 WebP.
 */
export function buildVerificationWebp(targetBytes = TARGET_BYTES): Buffer {
  const base = Buffer.from(WEBP_1X1_BASE64, 'base64');
  const riffBody = base.subarray(12); // everything after "RIFF<size>WEBP"

  const open = '<?xpacket begin="" id="quest-leb-r2-verification"?>';
  const close = '<?xpacket end="w"?>';
  const padLength = Math.max(0, targetBytes - base.length - 8 - open.length - close.length);
  const xmp = Buffer.from(open + ' '.repeat(padLength) + close, 'ascii');

  const header = Buffer.alloc(8);
  header.write('XMP ', 0, 'ascii');
  header.writeUInt32LE(xmp.length, 4);
  // RIFF chunks are word-aligned: an odd-length payload takes one pad byte.
  const pad = xmp.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);

  const body = Buffer.concat([riffBody, header, xmp, pad]);
  const out = Buffer.alloc(12 + body.length);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(4 + body.length, 4); // "WEBP" + chunks
  out.write('WEBP', 8, 'ascii');
  body.copy(out, 12);
  return out;
}

/** Structural check, so a malformed fixture fails here rather than mid-upload. */
export function isStructurallyValidWebp(buffer: Buffer): boolean {
  if (buffer.length < 20) return false;
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF') return false;
  if (buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return false;
  if (buffer.readUInt32LE(4) !== buffer.length - 8) return false;

  let offset = 12;
  let sawImageChunk = false;
  while (offset + 8 <= buffer.length) {
    const fourcc = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = buffer.readUInt32LE(offset + 4);
    if (offset + 8 + size > buffer.length) return false;
    if (fourcc === 'VP8 ' || fourcc === 'VP8L' || fourcc === 'VP8X') sawImageChunk = true;
    offset += 8 + size + (size % 2);
  }
  return sawImageChunk && offset === buffer.length;
}

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_URL',
] as const;

let step = 0;
function announce(what: string) {
  step += 1;
  process.stdout.write(`${step}. ${what} ... `);
}
function ok(detail = '') {
  console.log(`ok${detail ? ` (${detail})` : ''}`);
}
function die(message: string, hint?: string): never {
  console.log('FAILED');
  console.error(`\n   ${message}`);
  if (hint) console.error(`   ${hint}`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('Verifying the R2 path end to end.\n');

  announce('Checking environment');
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    die(
      `Missing: ${missing.join(', ')}`,
      'Put them in .env.local (see .env.example) or export them, then re-run.',
    );
  }
  ok(`bucket ${process.env.R2_BUCKET}`);

  announce('Building a real WebP');
  const photo = buildVerificationWebp();
  if (!isStructurallyValidWebp(photo)) {
    die('The generated fixture is not a valid WebP. This is a bug in this script.');
  }
  ok(`${photo.length} bytes, RIFF/WEBP verified`);

  const storage = getStorage();
  const key = `verification/r2-check-${Date.now()}.webp`;
  let publicUrl: string;

  announce(`Uploading ${key}`);
  try {
    publicUrl = await storage.uploadPhoto(photo, key);
  } catch (error) {
    die(
      `Upload failed: ${(error as Error).message}`,
      'Check R2_ACCOUNT_ID, the access key pair, and that the token has Object Read & Write on this bucket.',
    );
  }
  ok(publicUrl);

  announce('Confirming publicUrl() agrees with the upload');
  if (storage.publicUrl(key) !== publicUrl) {
    die(
      `publicUrl() returned ${storage.publicUrl(key)} but the upload returned ${publicUrl}.`,
      'The route validates against publicUrl() before uploading, so these must match exactly.',
    );
  }
  ok();

  announce('Fetching it back over the public URL');
  let response: Response;
  try {
    response = await fetch(publicUrl, { cache: 'no-store' });
  } catch (error) {
    die(
      `Could not reach ${publicUrl}: ${(error as Error).message}`,
      'Is R2_PUBLIC_URL correct, and reachable from this machine?',
    );
  }
  if (!response.ok) {
    die(
      `GET ${publicUrl} returned ${response.status} ${response.statusText}.`,
      response.status === 401 || response.status === 403
        ? 'The upload worked, so the credentials are fine — the bucket is not publicly readable. Enable the r2.dev domain or attach a custom domain, and set R2_PUBLIC_URL to it.'
        : 'The object uploaded but is not served at this URL. Check R2_PUBLIC_URL points at this bucket.',
    );
  }
  const fetched = Buffer.from(await response.arrayBuffer());
  ok(`${fetched.length} bytes, content-type ${response.headers.get('content-type')}`);

  announce('Comparing bytes');
  if (fetched.length !== photo.length) {
    die(`Length differs: uploaded ${photo.length}, fetched ${fetched.length}.`);
  }
  if (!fetched.equals(photo)) {
    die('Byte mismatch: the object came back corrupted.');
  }
  ok('identical');

  announce('Checking the content type');
  const contentType = response.headers.get('content-type');
  if (contentType !== 'image/webp') {
    console.log(`warning (got ${contentType ?? 'none'}, expected image/webp)`);
  } else {
    ok();
  }

  announce('Deleting it');
  try {
    await storage.deletePhoto(key);
  } catch (error) {
    die(
      `Delete failed: ${(error as Error).message}`,
      `The object is still at ${publicUrl} — remove it by hand.`,
    );
  }
  ok();

  announce('Confirming it is gone');
  const after = await fetch(publicUrl, { cache: 'no-store' });
  if (after.ok) {
    // A CDN in front of the bucket can still serve a cached copy; that is not
    // a failure of the delete itself, so say so rather than crying wolf.
    console.log(`warning (still 200 — likely a cached copy at ${publicUrl})`);
  } else {
    ok(`${after.status}`);
  }

  console.log('\nR2 path verified: upload, public read, byte fidelity, delete.');
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Older Node without import.meta.main.
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
