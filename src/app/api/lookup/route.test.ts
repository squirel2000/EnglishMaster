// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { lookupTerm } from '@/lib/lookup-service';
import type { LookupResult } from '@/lib/types';

vi.mock('@/lib/lookup-service');

const sample: LookupResult = {
  term: 'hello',
  pronunciation: { audioUrl: null, phonetic: '/həˈloʊ/' },
  definitions: [{ partOfSpeech: 'noun', definition: 'A greeting.' }],
  examples: ['Hello, everyone.', 'Hello? Is anyone there?'],
  source: 'free-dictionary',
};

function makeRequest(query: string) {
  return new Request(`http://localhost/api/lookup?q=${encodeURIComponent(query)}`);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/lookup', () => {
  it('returns the lookup result as JSON', async () => {
    vi.mocked(lookupTerm).mockResolvedValue({ ok: true, result: sample });
    const res = await GET(makeRequest('hello'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(sample);
    expect(lookupTerm).toHaveBeenCalledWith('hello');
  });

  it('returns 400 for a blank query', async () => {
    const res = await GET(makeRequest('   '));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'empty-query' });
    expect(lookupTerm).not.toHaveBeenCalled();
  });

  it('returns 404 when the term is not found', async () => {
    vi.mocked(lookupTerm).mockResolvedValue({ ok: false, error: 'not-found' });
    const res = await GET(makeRequest('zzzzzz'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not-found' });
  });

  it('returns 502 when all sources are unavailable', async () => {
    vi.mocked(lookupTerm).mockResolvedValue({
      ok: false,
      error: 'service-unavailable',
    });
    const res = await GET(makeRequest('hello'));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'service-unavailable' });
  });
});
