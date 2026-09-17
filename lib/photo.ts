/**
 * Client-side photo preparation.
 *
 * CLAUDE.md sets the contract: WebP, at most 1200px on the long edge, under
 * 200KB, done before upload. The server independently enforces a 400KB
 * ceiling, so this is about respecting the visitor's data allowance and the
 * free tier — not about trusting the client.
 *
 * Browser-only: it needs canvas and createImageBitmap.
 */

export const MAX_LONG_EDGE = 1200;
export const TARGET_BYTES = 200 * 1024;

/** Quality ladder. Each step is a re-encode, so keep it short. */
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5, 0.4];

export interface PreparedPhoto {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  /** True when even the lowest quality step stayed above the target. */
  overTarget: boolean;
}

/** Scales so the long edge is at most MAX_LONG_EDGE. Never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  longEdge: number = MAX_LONG_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= longEdge) return { width, height };
  const scale = longEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export class PhotoError extends Error {
  override name = 'PhotoError';
}

/**
 * Re-encodes a camera file to WebP under the target size.
 *
 * Steps down through the quality ladder rather than binary-searching: a phone
 * photo lands under 200KB within a step or two, and each extra encode is a
 * visible pause on a mid-range handset.
 */
export async function preparePhoto(file: File | Blob): Promise<PreparedPhoto> {
  if (typeof createImageBitmap !== 'function') {
    throw new PhotoError('This browser cannot process photos.');
  }

  let bitmap: ImageBitmap;
  try {
    // Honour the camera's orientation tag; otherwise portrait shots land sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('That file could not be read as an image.');
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new PhotoError('This browser cannot process photos.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let best: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    const blob = await toBlob(canvas, quality);
    best = blob;
    if (blob.size <= TARGET_BYTES) break;
  }

  if (!best) throw new PhotoError('The photo could not be prepared.');

  return {
    blob: best,
    width,
    height,
    bytes: best.size,
    overTarget: best.size > TARGET_BYTES,
  };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new PhotoError('This browser cannot encode WebP.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}
