import { NextResponse } from 'next/server';
import { lookupTerm } from '@/lib/lookup-service';

export async function GET(request: Request): Promise<NextResponse> {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q === '') {
    return NextResponse.json({ error: 'empty-query' }, { status: 400 });
  }
  const outcome = await lookupTerm(q);
  if (!outcome.ok) {
    const status = outcome.error === 'not-found' ? 404 : 502;
    return NextResponse.json({ error: outcome.error }, { status });
  }
  return NextResponse.json(outcome.result);
}
