import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupWiktionary, stripHtml } from './wiktionary-api';
import { stubFetch } from './test-helpers';
import bucketFixture from './__fixtures__/wiktionary-kick-the-bucket.json';

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
      definitionZh: null,
    });
    // Chinese translations are attached later by lookup-service.
    expect(result!.examples).toEqual([
      { en: 'The old horse finally kicked the bucket.', zh: null },
      { en: 'I think my sewing machine has kicked the bucket.', zh: null },
    ]);
    expect(JSON.stringify(result)).not.toContain('<');
    // Wiktionary provides no thesaurus data; the lists are always empty.
    expect(result!.synonyms).toEqual([]);
    expect(result!.antonyms).toEqual([]);
    // Related phrases come from Datamuse in lookup-service, never the source.
    expect(result!.relatedPhrases).toEqual([]);
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
