import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupTerm } from './lookup-service';
import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import { translateSegment } from './translation-api';
import type { DefinitionEntry, LookupResult } from './types';

vi.mock('./dictionary-api');
vi.mock('./wiktionary-api');
vi.mock('./tatoeba-api');
vi.mock('./translation-api');

const surrenderOnly: DefinitionEntry[] = [
  { partOfSpeech: 'verb', definition: 'To surrender.', definitionZh: null },
];

function makeResult(
  examples: string[],
  definitions: DefinitionEntry[] = surrenderOnly,
): LookupResult {
  return {
    term: 'give up',
    pronunciation: { audioUrl: null, phonetic: null },
    definitions,
    examples,
    source: 'free-dictionary',
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Enrichment is best-effort; by default let translation be unavailable so
  // the pre-existing lookup behaviors are exercised without Chinese text.
  vi.mocked(translateSegment).mockResolvedValue({
    ok: false,
    error: 'service-unavailable',
  });
});

describe('lookupTerm', () => {
  it('returns primary result without supplementation when it has 2+ examples', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['a', 'b', 'c', 'd']),
    );
    const outcome = await lookupTerm('give up');
    expect(outcome).toEqual({
      ok: true,
      result: expect.objectContaining({ examples: ['a', 'b', 'c'] }),
    });
    expect(fetchTatoebaExamples).not.toHaveBeenCalled();
    expect(lookupWiktionary).not.toHaveBeenCalled();
  });

  it('supplements examples from Tatoeba when fewer than 2, dedupes, caps at 3', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a']));
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['a', 'b', 'c']);
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(['a', 'b', 'c']);
    }
  });

  it('keeps the result when Tatoeba supplementation fails', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a']));
    vi.mocked(fetchTatoebaExamples).mockRejectedValue(new Error('down'));
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(['a']);
    }
  });

  it('falls back to Wiktionary when the primary source has no entry', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(null);
    vi.mocked(lookupWiktionary).mockResolvedValue(
      { ...makeResult(['x', 'y']), source: 'wiktionary' },
    );
    const outcome = await lookupTerm('kick the bucket');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe('wiktionary');
    }
  });

  it('falls back to Wiktionary when the primary source errors', async () => {
    vi.mocked(lookupFreeDictionary).mockRejectedValue(new Error('timeout'));
    vi.mocked(lookupWiktionary).mockResolvedValue(makeResult(['x', 'y']));
    const outcome = await lookupTerm('hello');
    expect(outcome.ok).toBe(true);
    expect(lookupWiktionary).toHaveBeenCalledWith('hello', expect.anything());
  });

  it('returns not-found when all sources have no entry', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(null);
    vi.mocked(lookupWiktionary).mockResolvedValue(null);
    await expect(lookupTerm('zzzzzz')).resolves.toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('returns service-unavailable when all sources error', async () => {
    vi.mocked(lookupFreeDictionary).mockRejectedValue(new Error('down'));
    vi.mocked(lookupWiktionary).mockRejectedValue(new Error('down'));
    await expect(lookupTerm('hello')).resolves.toEqual({
      ok: false,
      error: 'service-unavailable',
    });
  });
});

describe('lookupTerm definition enrichment', () => {
  it('attaches a Traditional Chinese translation to each definition', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a', 'b']));
    vi.mocked(translateSegment).mockResolvedValue({
      ok: true,
      result: { original: 'To surrender.', translated: '放棄。' },
    });
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions).toEqual([
        { partOfSpeech: 'verb', definition: 'To surrender.', definitionZh: '放棄。' },
      ]);
    }
    expect(translateSegment).toHaveBeenCalledWith('To surrender.');
  });

  it('truncates definitions to the first five and translates only those', async () => {
    const definitions: DefinitionEntry[] = Array.from({ length: 7 }, (_, i) => ({
      partOfSpeech: 'noun',
      definition: `Sense ${i + 1}.`,
      definitionZh: null,
    }));
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['a', 'b'], definitions),
    );
    vi.mocked(translateSegment).mockImplementation(async (text) => ({
      ok: true,
      result: { original: text, translated: `中文：${text}` },
    }));
    const outcome = await lookupTerm('sense');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions).toHaveLength(5);
      expect(outcome.result.definitions[0]).toEqual({
        partOfSpeech: 'noun',
        definition: 'Sense 1.',
        definitionZh: '中文：Sense 1.',
      });
      expect(outcome.result.definitions[4].definitionZh).toBe('中文：Sense 5.');
    }
    expect(translateSegment).toHaveBeenCalledTimes(5);
  });

  it('nulls definitionZh for a failed segment while keeping the others', async () => {
    const definitions: DefinitionEntry[] = [
      { partOfSpeech: 'verb', definition: 'To surrender.', definitionZh: null },
      { partOfSpeech: 'verb', definition: 'To stop or quit.', definitionZh: null },
    ];
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['a', 'b'], definitions),
    );
    vi.mocked(translateSegment).mockImplementation(async (text) => {
      if (text === 'To surrender.') {
        return { ok: true, result: { original: text, translated: '放棄。' } };
      }
      throw new Error('translator crashed');
    });
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions).toEqual([
        { partOfSpeech: 'verb', definition: 'To surrender.', definitionZh: '放棄。' },
        { partOfSpeech: 'verb', definition: 'To stop or quit.', definitionZh: null },
      ]);
    }
  });

  it('degrades to English-only definitions when quota is exhausted, lookup still succeeds', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a', 'b']));
    vi.mocked(translateSegment).mockResolvedValue({
      ok: false,
      error: 'quota-exhausted',
    });
    await expect(lookupTerm('give up')).resolves.toEqual({
      ok: true,
      result: expect.objectContaining({
        definitions: [
          { partOfSpeech: 'verb', definition: 'To surrender.', definitionZh: null },
        ],
      }),
    });
  });

  it('translates definitions on the Wiktionary fallback path too', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(null);
    vi.mocked(lookupWiktionary).mockResolvedValue({
      ...makeResult(['x', 'y']),
      source: 'wiktionary',
    });
    vi.mocked(translateSegment).mockResolvedValue({
      ok: true,
      result: { original: 'To surrender.', translated: '放棄。' },
    });
    const outcome = await lookupTerm('kick the bucket');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe('wiktionary');
      expect(outcome.result.definitions[0].definitionZh).toBe('放棄。');
    }
  });
});
