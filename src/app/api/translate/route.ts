import { NextResponse } from 'next/server';
import { translateSentence } from '@/lib/translation-api';
import { getTrimmedQuery } from '../query-param';

export async function GET(request: Request): Promise<NextResponse> {
  const q = getTrimmedQuery(request);
  if (q === '') {
    return NextResponse.json({ error: 'empty-query' }, { status: 400 });
  }
  const outcome = await translateSentence(q);
  if (!outcome.ok) {
    const status = outcome.error === 'quota-exhausted' ? 429 : 502;
    return NextResponse.json({ error: outcome.error }, { status });
  }
  return NextResponse.json(outcome.result);
}
