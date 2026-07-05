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
  it('normalizes idiom definitions and strips HTML from attached sense examples', async () => {
    stubFetch(200, bucketFixture);
    const result = await lookupWiktionary('kick the bucket');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('wiktionary');
    expect(result!.pronunciation).toEqual({ audioUrl: null, phonetic: null });
    // Each sense carries its own first source example, HTML-stripped
    // (Chinese translations are attached later by lookup-service).
    expect(result!.definitions).toEqual([
      {
        partOfSpeech: 'verb',
        definition: 'To die.',
        definitionZh: null,
        example: { en: 'The old horse finally kicked the bucket.', zh: null },
      },
      {
        partOfSpeech: 'verb',
        definition: 'To break down such that it cannot be repaired.',
        definitionZh: null,
        example: { en: 'I think my sewing machine has kicked the bucket.', zh: null },
      },
    ]);
    // No flattening: result-level examples hold only lookup-service supplements.
    expect(result!.examples).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('<');
    // Wiktionary provides no thesaurus data; the lists are always empty.
    expect(result!.synonyms).toEqual([]);
    expect(result!.antonyms).toEqual([]);
    // Related phrases come from Datamuse in lookup-service, never the source.
    expect(result!.relatedPhrases).toEqual([]);
  });

  it('attaches only the first non-empty example and null when a sense has none', async () => {
    stubFetch(200, {
      en: [
        {
          partOfSpeech: 'Noun',
          language: 'English',
          definitions: [
            {
              definition: 'A sense with several examples.',
              // First candidate strips to nothing; the next real one wins.
              examples: ['<b> </b>', 'First <i>real</i> example.', 'Second example.'],
            },
            { definition: 'A sense without examples.' },
          ],
        },
      ],
    });
    const result = await lookupWiktionary('thing');
    expect(result!.definitions).toEqual([
      {
        partOfSpeech: 'noun',
        definition: 'A sense with several examples.',
        definitionZh: null,
        example: { en: 'First real example.', zh: null },
      },
      {
        partOfSpeech: 'noun',
        definition: 'A sense without examples.',
        definitionZh: null,
        example: null,
      },
    ]);
  });

  it('drops examples of a definition whose text strips to empty', async () => {
    stubFetch(200, {
      en: [
        {
          partOfSpeech: 'Verb',
          language: 'English',
          definitions: [
            { definition: '<span></span>', examples: ['Orphan example.'] },
            { definition: 'To remain.' },
          ],
        },
      ],
    });
    const result = await lookupWiktionary('remain');
    // The empty definition is skipped along with its example: an example
    // belongs to a sense, and its sense is not shown.
    expect(result!.definitions).toEqual([
      {
        partOfSpeech: 'verb',
        definition: 'To remain.',
        definitionZh: null,
        example: null,
      },
    ]);
    expect(result!.examples).toEqual([]);
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
