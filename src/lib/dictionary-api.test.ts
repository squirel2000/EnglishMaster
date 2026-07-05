import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupFreeDictionary } from './dictionary-api';
import { stubFetch } from './test-helpers';
import helloFixture from './__fixtures__/free-dictionary-hello.json';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lookupFreeDictionary', () => {
  it('normalizes definitions, phonetic, sense examples, and picks the US audio', async () => {
    stubFetch(200, helloFixture);
    const result = await lookupFreeDictionary('hello');
    expect(result).not.toBeNull();
    expect(result!.term).toBe('hello');
    expect(result!.source).toBe('free-dictionary');
    expect(result!.pronunciation.audioUrl).toContain('-us.mp3');
    expect(result!.pronunciation.phonetic).toBe('/həˈləʊ/');
    // Each source example attaches to its own sense (Chinese translations
    // are attached later by lookup-service).
    expect(result!.definitions).toContainEqual({
      partOfSpeech: 'interjection',
      definition: 'A greeting said when meeting someone.',
      definitionZh: null,
      example: { en: 'Hello, everyone.', zh: null },
    });
    expect(result!.definitions).toContainEqual({
      partOfSpeech: 'interjection',
      definition: 'A greeting used when answering the telephone.',
      definitionZh: null,
      example: { en: 'Hello? How may I help you?', zh: null },
    });
  });

  it('leaves example null for a sense the source gives no example for', async () => {
    stubFetch(200, helloFixture);
    const result = await lookupFreeDictionary('hello');
    expect(result!.definitions).toContainEqual({
      partOfSpeech: 'noun',
      definition: '"Hello!" or an equivalent greeting.',
      definitionZh: null,
      example: null,
    });
  });

  it('no longer flattens sense examples into the result-level list (it holds only lookup-service supplements)', async () => {
    stubFetch(200, helloFixture);
    const result = await lookupFreeDictionary('hello');
    expect(result!.examples).toEqual([]);
  });

  it('returns null audio when no US recording exists', async () => {
    const noUs = structuredClone(helloFixture);
    noUs[0].phonetics = noUs[0].phonetics.filter(
      (p) => !p.audio?.includes('-us.'),
    );
    stubFetch(200, noUs);
    const result = await lookupFreeDictionary('hello');
    expect(result!.pronunciation.audioUrl).toBeNull();
  });

  it('URL-encodes the term', async () => {
    const mock = stubFetch(200, helloFixture);
    await lookupFreeDictionary('give up');
    expect(mock).toHaveBeenCalledWith(
      'https://api.dictionaryapi.dev/api/v2/entries/en/give%20up',
      expect.anything(),
    );
  });

  it('aggregates meaning- and definition-level synonyms/antonyms, deduped and capped at 8', async () => {
    // Inline fixture: the trimmed hello fixture predates these fields, so
    // build an entry that exercises both levels, duplicates, and the cap.
    stubFetch(200, [
      {
        word: 'happy',
        phonetics: [],
        meanings: [
          {
            partOfSpeech: 'adjective',
            synonyms: ['content', 'cheerful', 'content'],
            antonyms: ['sad'],
            definitions: [
              {
                definition: 'Feeling joy.',
                synonyms: ['joyful', 'cheerful', 'merry'],
                antonyms: ['unhappy', 'sad'],
              },
              // No synonyms/antonyms keys at all on this definition.
              { definition: 'Fortunate.', synonyms: ['lucky', 'fortunate'] },
            ],
          },
          {
            // No synonyms/antonyms keys at the meaning level.
            partOfSpeech: 'verb',
            definitions: [
              {
                definition: 'To make happy.',
                synonyms: ['gladden', 'delight', 'please', 'satisfy'],
              },
            ],
          },
        ],
      },
    ]);
    const result = await lookupFreeDictionary('happy');
    // Document order (entries -> meanings -> definitions), first occurrence
    // wins; 10 unique synonyms collected, capped to the first 8.
    expect(result!.synonyms).toEqual([
      'content',
      'cheerful',
      'joyful',
      'merry',
      'lucky',
      'fortunate',
      'gladden',
      'delight',
    ]);
    expect(result!.antonyms).toEqual(['sad', 'unhappy']);
  });

  it('returns empty synonym/antonym lists when the source omits the fields', async () => {
    stubFetch(200, helloFixture);
    const result = await lookupFreeDictionary('hello');
    expect(result!.synonyms).toEqual([]);
    expect(result!.antonyms).toEqual([]);
  });

  it('always emits empty related phrases (they come from Datamuse in lookup-service)', async () => {
    stubFetch(200, helloFixture);
    const result = await lookupFreeDictionary('hello');
    expect(result!.relatedPhrases).toEqual([]);
  });

  it('returns null on 404 (word not found)', async () => {
    stubFetch(404, { title: 'No Definitions Found' });
    await expect(lookupFreeDictionary('zzzzzz')).resolves.toBeNull();
  });

  it('throws on server error', async () => {
    stubFetch(500, {});
    await expect(lookupFreeDictionary('hello')).rejects.toThrow();
  });
});
