import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupWiktionary, stripHtml } from './wiktionary-api';
import bucketFixture from './__fixtures__/wiktionary-kick-the-bucket.json';

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('To <a href="/wiki/die">die</a>.')).toBe('To die.');
    expect(stripHtml('<span></span>  hello   <b>world</b>')).toBe('hello world');
  });
});

describe('lookupWiktionary', () => {
  it('normalizes idiom definitions and strips HTML from examples', async () => {
    stubFetch(200, bucketFixture);
    const result = await lookupWiktionary('kick the bucket');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('wiktionary');
    expect(result!.pronunciation).toEqual({ audioUrl: null, phonetic: null });
    expect(result!.definitions[0]).toEqual({
      partOfSpeech: 'verb',
      definition: 'To die.',
    });
    expect(result!.examples).toEqual([
      'The old horse finally kicked the bucket.',
      'I think my sewing machine has kicked the bucket.',
    ]);
    expect(JSON.stringify(result)).not.toContain('<');
  });

  it('converts spaces to underscores in the page URL', async () => {
    const mock = stubFetch(200, bucketFixture);
    await lookupWiktionary('kick the bucket');
    expect(mock).toHaveBeenCalledWith(
      'https://en.wiktionary.org/api/rest_v1/page/definition/kick_the_bucket',
      expect.anything(),
    );
  });

  it('returns null on 404', async () => {
    stubFetch(404, {});
    await expect(lookupWiktionary('zzzzzz')).resolves.toBeNull();
  });

  it('returns null when there is no English section', async () => {
    stubFetch(200, { de: [] });
    await expect(lookupWiktionary('hallo')).resolves.toBeNull();
  });

  it('throws on server error', async () => {
    stubFetch(500, {});
    await expect(lookupWiktionary('hello')).rejects.toThrow();
  });
});
