import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SEGMENT_CACHE_CAPACITY,
  clearSegmentCache,
  translateSegment,
  translateSentence,
} from './translation-api';
import { stubFetch } from './test-helpers';

function myMemoryBody(overrides: Record<string, unknown> = {}) {
  return {
    responseData: { translatedText: '您今天好嗎？', match: 0.99 },
    quotaFinished: false,
    responseStatus: 200,
    ...overrides,
  };
}

/** Stub fetch with a fresh Response per call, echoing the query as `中文:<q>`. */
function stubFetchEcho() {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const q = new URL(String(input)).searchParams.get('q') ?? '';
    return new Response(
      JSON.stringify(
        myMemoryBody({ responseData: { translatedText: `中文:${q}`, match: 0.99 } }),
      ),
      { status: 200 },
    );
  });
  vi.stubGlobal('fetch', mock);
  return mock;
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

  it('bypasses the segment cache: identical sentences fetch every time', async () => {
    clearSegmentCache();
    const mock = stubFetchEcho();
    await translateSegment('Hello there.'); // seed the segment cache
    await translateSentence('Hello there.');
    await translateSentence('Hello there.');
    // 1 segment request + 2 sentence requests: sentence-mode translation
    // deliberately neither reads nor seeds the segment cache.
    expect(mock).toHaveBeenCalledTimes(3);
  });
});

describe('translateSegment', () => {
  beforeEach(() => {
    clearSegmentCache();
  });

  it('translates a single segment to Traditional Chinese', async () => {
    stubFetch(200, myMemoryBody({ responseData: { translatedText: '放棄。' } }));
    await expect(translateSegment('To surrender.')).resolves.toEqual({
      ok: true,
      result: { original: 'To surrender.', translated: '放棄。' },
    });
  });

  it('requests the en|zh-TW language pair from the MyMemory endpoint', async () => {
    const mock = stubFetch(200, myMemoryBody());
    await translateSegment('give up');
    const calledUrl = new URL(mock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.mymemory.translated.net/get',
    );
    expect(calledUrl.searchParams.get('q')).toBe('give up');
    expect(calledUrl.searchParams.get('langpair')).toBe('en|zh-TW');
  });

  it('reports quota exhaustion', async () => {
    stubFetch(200, myMemoryBody({ quotaFinished: true }));
    await expect(translateSegment('To surrender.')).resolves.toEqual({
      ok: false,
      error: 'quota-exhausted',
    });
  });

  it('reports service-unavailable on HTTP or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(translateSegment('To surrender.')).resolves.toEqual({
      ok: false,
      error: 'service-unavailable',
    });
  });

  it('serves a repeated segment from the cache without another request', async () => {
    const mock = stubFetch(
      200,
      myMemoryBody({ responseData: { translatedText: '放棄。' } }),
    );
    await translateSegment('To surrender.');
    await expect(translateSegment('To surrender.')).resolves.toEqual({
      ok: true,
      result: { original: 'To surrender.', translated: '放棄。' },
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures, so a later retry hits the network again', async () => {
    stubFetch(200, myMemoryBody({ quotaFinished: true }));
    await expect(translateSegment('To surrender.')).resolves.toEqual({
      ok: false,
      error: 'quota-exhausted',
    });
    const mock = stubFetch(
      200,
      myMemoryBody({ responseData: { translatedText: '放棄。' } }),
    );
    await expect(translateSegment('To surrender.')).resolves.toEqual({
      ok: true,
      result: { original: 'To surrender.', translated: '放棄。' },
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest cached segment first once capacity is reached', async () => {
    const mock = stubFetchEcho();
    for (let i = 0; i < SEGMENT_CACHE_CAPACITY; i += 1) {
      await translateSegment(`segment ${i}`);
    }
    expect(mock).toHaveBeenCalledTimes(SEGMENT_CACHE_CAPACITY);

    // One more unique segment evicts the oldest entry ("segment 0")...
    await translateSegment('one more segment');
    // ..."segment 1" is still cached...
    await expect(translateSegment('segment 1')).resolves.toEqual({
      ok: true,
      result: { original: 'segment 1', translated: '中文:segment 1' },
    });
    expect(mock).toHaveBeenCalledTimes(SEGMENT_CACHE_CAPACITY + 1);
    // ...but "segment 0" was evicted and needs a fresh request.
    await translateSegment('segment 0');
    expect(mock).toHaveBeenCalledTimes(SEGMENT_CACHE_CAPACITY + 2);
  });
});
