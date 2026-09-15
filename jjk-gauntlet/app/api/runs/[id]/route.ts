import { NextResponse } from 'next/server';

import { getStore } from '@/lib/store.ts';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getStore().get(id);
  if (!run) return NextResponse.json({ error: 'No such run.' }, { status: 404 });
  return NextResponse.json(run);
}
