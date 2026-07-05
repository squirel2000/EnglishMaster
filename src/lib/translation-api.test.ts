import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateSentence } from './translation-api';
import { stubFetch } from './test-helpers';

function myMemoryBody(overrides: Record<string, unknown> = {}) {
  return {
    responseData: { translatedText: '您今天好嗎？', match: 0.99 },
    quotaFinished: false,
    responseStatus: 200,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('translateSentence', () => {
  it('translates an English sentence to Traditional Chinese', async () => {
    stubFetch(200, myMemoryBody());
    await expect(
      translateSentence('How are you doing today?'),
    ).resolves.toEqual({
      ok: true,
      result: {
        original: 'How are you doing today?',
        translated: '您今天好嗎？',
      },
    });
  });

  it('requests the en|zh-TW language pair', async () => {
    const mock = stubFetch(200, myMemoryBody());
    await translateSentence('Hello there.');
    const calledUrl = new URL(mock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.mymemory.translated.net/get',
    );
    expect(calledUrl.searchParams.get('q')).toBe('Hello there.');
    expect(calledUrl.searchParams.get('langpair')).toBe('en|zh-TW');
  });

  it('reports quota exhaustion', async () => {
    stubFetch(200, myMemoryBody({ quotaFinished: true }));
    await expect(translateSentence('Hello.')).resolves.toEqual({
      ok: false,
      error: 'quota-exhausted',
    });
  });

  it('reports service-unavailable on API-level error status', async () => {
    stubFetch(200, myMemoryBody({ responseStatus: 403 }));
    await expect(translateSentence('Hello.')).resolves.toEqual({
      ok: false,
      error: 'service-unavailable',
    });
  });

  it('reports service-unavailable on HTTP or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(translateSentence('Hello.')).resolves.toEqual({
      ok: false,
      error: 'service-unavailable',
    });
  });
});
