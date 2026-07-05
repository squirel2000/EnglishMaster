import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupFreeDictionary } from './dictionary-api';
import { stubFetch } from './test-helpers';
import helloFixture from './__fixtures__/free-dictionary-hello.json';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lookupFreeDictionary', () => {
  it('normalizes definitions, phonetic, examples, and picks the US audio', async () => {
    stubFetch(200, helloFixture);
    const result = await lookupFreeDictionary('hello');
    expect(result).not.toBeNull();
    expect(result!.term).toBe('hello');
    expect(result!.source).toBe('free-dictionary');
    expect(result!.pronunciation.audioUrl).toContain('-us.mp3');
    expect(result!.pronunciation.phonetic).toBe('/həˈləʊ/');
    expect(result!.definitions).toContainEqual({
      partOfSpeech: 'interjection',
      definition: 'A greeting said when meeting someone.',
      definitionZh: null,
    });
    // Chinese translations are attached later by lookup-service.
    expect(result!.examples).toEqual([
      { en: 'Hello, everyone.', zh: null },
      { en: 'Hello? How may I help you?', zh: null },
    ]);
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

  it('returns null on 404 (word not found)', async () => {
    stubFetch(404, { title: 'No Definitions Found' });
    await expect(lookupFreeDictionary('zzzzzz')).resolves.toBeNull();
  });

  it('throws on server error', async () => {
    stubFetch(500, {});
    await expect(lookupFreeDictionary('hello')).rejects.toThrow();
  });
});
