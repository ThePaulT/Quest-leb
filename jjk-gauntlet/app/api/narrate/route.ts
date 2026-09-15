import { NextResponse } from 'next/server';

import type { RoundResult } from '@/lib/engine.ts';
import { narrateRound } from '@/lib/narrate.ts';
import type { Side } from '@/lib/types.ts';

interface Body {
  side: Side;
  round: RoundResult;
  runOver?: boolean;
  fullClear?: boolean;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }

  if (!body?.round?.teamIds || !Array.isArray(body.round.teamIds) || !body.side) {
    return NextResponse.json({ error: 'Missing round or side.' }, { status: 400 });
  }

  const { story, source } = await narrateRound(body);
  return NextResponse.json({ story, source });
}
