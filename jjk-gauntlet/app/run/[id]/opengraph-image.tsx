import { ImageResponse } from 'next/og';

import { ResultCard } from '@/lib/card.tsx';
import { cardFacts } from '@/lib/share.ts';
import { getStore } from '@/lib/store.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'JJK Gauntlet run result';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getStore().get(id);

  if (!run) {
    return new ImageResponse(
      (
        <div
          style={{
            width: size.width,
            height: size.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0B0B0C',
            color: '#EDE9E3',
            fontSize: 64,
            letterSpacing: 10,
          }}
        >
          JJK GAUNTLET
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(
    (
      <ResultCard
        {...cardFacts(run)}
        width={size.width}
        height={size.height}
        url={`/run/${id}`}
        fullClear={run.result.fullClear}
      />
    ),
    size,
  );
}
