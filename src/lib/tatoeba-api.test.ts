import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTatoebaExamples } from './tatoeba-api';
import { stubFetch } from './test-helpers';

const tatoebaBody = {
  data: [
    { id: 1, text: 'Give up.', lang: 'eng' },
    { id: 2, text: 'He gives up.', lang: 'eng' },
    { id: 3, text: 'Never give up hope.', lang: 'eng' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTatoebaExamples', () => {
  it('returns sentence texts', async () => {
    stubFetch(200, tatoebaBody);
    await expect(fetchTatoebaExamples('give up', 3)).resolves.toEqual([
      'Give up.',
      'He gives up.',
      'Never give up hope.',
    ]);
  });

  it('sends required query parameters including sort', async () => {
    const mock = stubFetch(200, tatoebaBody);
    await fetchTatoebaExamples('give up', 3);
    const calledUrl = new URL(mock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.tatoeba.org/unstable/sentences',
    );
    expect(calledUrl.searchParams.get('lang')).toBe('eng');
    expect(calledUrl.searchParams.get('q')).toBe('"give up"');
    expect(calledUrl.searchParams.get('sort')).toBe('relevance');
    expect(calledUrl.searchParams.get('limit')).toBe('3');
  });

  it('throws on non-ok response', async () => {
    stubFetch(400, { message: 'Required parameter "sort" missing' });
    await expect(fetchTatoebaExamples('give up', 3)).rejects.toThrow();
  });
});
