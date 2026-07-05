import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRelatedPhrases } from './datamuse-api';
import { stubFetch } from './test-helpers';

// Real shape: frequency-scored, already sorted by score descending.
const datamuseBody = [
  { word: 'give in', score: 11022 },
  { word: 'give up', score: 9035 },
  { word: 'give away', score: 6023 },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRelatedPhrases', () => {
  it('returns phrase strings in source (frequency) order', async () => {
    stubFetch(200, datamuseBody);
    await expect(fetchRelatedPhrases('give', 6)).resolves.toEqual([
      'give in',
      'give up',
      'give away',
    ]);
  });

  it('queries phrases starting with the term, capped and time-limited', async () => {
    const mock = stubFetch(200, datamuseBody);
    await fetchRelatedPhrases('give', 6);
    const calledUrl = new URL(mock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.datamuse.com/words',
    );
    expect(calledUrl.searchParams.get('sp')).toBe('give *');
    expect(calledUrl.searchParams.get('max')).toBe('6');
    // The module owns the timeout, so the request must carry an abort signal.
    expect(mock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns an empty list when the source has no matching phrases', async () => {
    stubFetch(200, []);
    await expect(fetchRelatedPhrases('zzzzzz', 6)).resolves.toEqual([]);
  });

  it('returns an empty list when the request times out', async () => {
    // What fetch rejects with when AbortSignal.timeout fires.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new DOMException('The operation timed out.', 'TimeoutError'),
      ),
    );
    await expect(fetchRelatedPhrases('give', 6)).resolves.toEqual([]);
  });

  it('returns an empty list on a non-ok response', async () => {
    stubFetch(500, {});
    await expect(fetchRelatedPhrases('give', 6)).resolves.toEqual([]);
  });

  it('returns an empty list on a malformed body', async () => {
    stubFetch(200, { unexpected: 'shape' });
    await expect(fetchRelatedPhrases('give', 6)).resolves.toEqual([]);
  });
});
