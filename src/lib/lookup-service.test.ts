import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupTerm } from './lookup-service';
import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import { fetchRelatedPhrases } from './datamuse-api';
import { translateSegment } from './translation-api';
import type { DefinitionEntry, ExampleEntry, LookupResult } from './types';

vi.mock('./dictionary-api');
vi.mock('./wiktionary-api');
vi.mock('./tatoeba-api');
vi.mock('./datamuse-api');
vi.mock('./translation-api');

const surrenderOnly: DefinitionEntry[] = [
  { partOfSpeech: 'verb', definition: 'To surrender.', definitionZh: null },
];

/** Untranslated example entries, the shape normalizers hand to lookup-service. */
function toExamples(sentences: string[]): ExampleEntry[] {
  return sentences.map((en) => ({ en, zh: null }));
}

function makeResult(
  examples: string[],
  definitions: DefinitionEntry[] = surrenderOnly,
): LookupResult {
  return {
    term: 'give up',
    pronunciation: { audioUrl: null, phonetic: null },
    definitions,
    examples: toExamples(examples),
    // Non-empty on purpose: together with the exact translation batch-count
    // assertions below, these prove thesaurus words never enter the batch.
    synonyms: ['syn'],
    antonyms: ['ant'],
    // Normalizers always emit an empty list; Datamuse fills it later.
    relatedPhrases: [],
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
  // Non-empty on purpose: together with the exact translation batch-count
  // assertions below, this proves phrases never enter the translation batch.
  vi.mocked(fetchRelatedPhrases).mockResolvedValue(['give in', 'give away']);
});

describe('lookupTerm', () => {
  it('returns primary result without supplementation when it has 2+ examples', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['a', 'b', 'c', 'd']),
    );
    const outcome = await lookupTerm('give up');
    expect(outcome).toEqual({
      ok: true,
      result: expect.objectContaining({
        examples: toExamples(['a', 'b', 'c']),
        // Thesaurus lists pass through untouched (and untranslated).
        synonyms: ['syn'],
        antonyms: ['ant'],
        // Datamuse phrases attach untranslated, capped at 6 by the fetch.
        relatedPhrases: ['give in', 'give away'],
      }),
    });
    expect(fetchRelatedPhrases).toHaveBeenCalledWith('give up', 6);
    expect(fetchTatoebaExamples).not.toHaveBeenCalled();
    expect(lookupWiktionary).not.toHaveBeenCalled();
  });

  it('supplements examples from Tatoeba when fewer than 2, dedupes on the English sentence, caps at 3', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a']));
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['a', 'b', 'c']);
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(toExamples(['a', 'b', 'c']));
    }
  });

  it('dedupes duplicate primary examples without calling Tatoeba when 2+ remain', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a', 'a', 'b']));
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(toExamples(['a', 'b']));
    }
    expect(fetchTatoebaExamples).not.toHaveBeenCalled();
  });

  it('supplements from Tatoeba when duplicates leave fewer than 2 unique examples', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a', 'a']));
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['b']);
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(toExamples(['a', 'b']));
    }
  });

  it('keeps the result when Tatoeba supplementation fails', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a']));
    vi.mocked(fetchTatoebaExamples).mockRejectedValue(new Error('down'));
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(toExamples(['a']));
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
    // 5 definitions + 2 examples in the combined batch; senses 6-7 dropped.
    expect(translateSegment).toHaveBeenCalledTimes(7);
    expect(translateSegment).not.toHaveBeenCalledWith('Sense 6.');
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
        examples: toExamples(['a', 'b']),
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
      // Phrase enrichment is source-independent and runs on fallback too.
      expect(outcome.result.relatedPhrases).toEqual(['give in', 'give away']);
    }
  });
});

describe('lookupTerm example enrichment', () => {
  function echoTranslate() {
    vi.mocked(translateSegment).mockImplementation(async (text) => ({
      ok: true,
      result: { original: text, translated: `中文：${text}` },
    }));
  }

  it('attaches a Traditional Chinese translation to each example', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['They gave up.', 'Never give up.']),
    );
    echoTranslate();
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual([
        { en: 'They gave up.', zh: '中文：They gave up.' },
        { en: 'Never give up.', zh: '中文：Never give up.' },
      ]);
    }
    expect(translateSegment).toHaveBeenCalledWith('They gave up.');
    expect(translateSegment).toHaveBeenCalledWith('Never give up.');
  });

  it('translates Tatoeba-supplemented examples like source examples', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a']));
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['b', 'c']);
    echoTranslate();
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual([
        { en: 'a', zh: '中文：a' },
        { en: 'b', zh: '中文：b' },
        { en: 'c', zh: '中文：c' },
      ]);
    }
  });

  it('nulls zh for a failed example sentence while keeping the others', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['They gave up.', 'Never give up.']),
    );
    vi.mocked(translateSegment).mockImplementation(async (text) => {
      if (text === 'Never give up.') throw new Error('translator crashed');
      return { ok: true, result: { original: text, translated: `中文：${text}` } };
    });
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual([
        { en: 'They gave up.', zh: '中文：They gave up.' },
        { en: 'Never give up.', zh: null },
      ]);
    }
  });

  it('translates definitions and examples in one parallel batch', async () => {
    const definitions: DefinitionEntry[] = [
      { partOfSpeech: 'verb', definition: 'Def one.', definitionZh: null },
      { partOfSpeech: 'verb', definition: 'Def two.', definitionZh: null },
    ];
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['Ex one.', 'Ex two.'], definitions),
    );
    // Hold every translation unresolved until the test releases them, then
    // assert all segments (2 definitions + 2 examples) were requested at
    // once. A chained implementation stalls below the expected count and
    // fails the waitFor with a clear "expected 2 to be 4" diff.
    const expectedSegments = 4;
    let issued = 0;
    let releaseAll!: () => void;
    const allIssued = new Promise<void>((resolve) => {
      releaseAll = resolve;
    });
    vi.mocked(translateSegment).mockImplementation(async (text) => {
      issued += 1;
      await allIssued;
      return { ok: true, result: { original: text, translated: `中文：${text}` } };
    });
    const pending = lookupTerm('give up');
    await vi.waitFor(() => expect(issued).toBe(expectedSegments));
    releaseAll();
    const outcome = await pending;
    expect(issued).toBe(expectedSegments);
    // The Datamuse phrases (mocked non-empty) never enter the batch.
    expect(translateSegment).not.toHaveBeenCalledWith('give in');
    expect(translateSegment).not.toHaveBeenCalledWith('give away');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions.map((d) => d.definitionZh)).toEqual([
        '中文：Def one.',
        '中文：Def two.',
      ]);
      expect(outcome.result.examples.map((e) => e.zh)).toEqual([
        '中文：Ex one.',
        '中文：Ex two.',
      ]);
    }
  });
});

describe('lookupTerm related-phrase enrichment', () => {
  it('fetches related phrases in parallel with the translation batch, not after it', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a', 'b']));
    // Hold both enrichment arms open and require each to have started while
    // the other is still unresolved. A sequential implementation stalls one
    // side and fails the waitFor with a clear diff.
    let phrasesRequested = false;
    let releasePhrases!: () => void;
    const phrasesGate = new Promise<void>((resolve) => {
      releasePhrases = resolve;
    });
    vi.mocked(fetchRelatedPhrases).mockImplementation(async () => {
      phrasesRequested = true;
      await phrasesGate;
      return ['give in'];
    });
    let segmentsIssued = 0;
    let releaseSegments!: () => void;
    const segmentsGate = new Promise<void>((resolve) => {
      releaseSegments = resolve;
    });
    vi.mocked(translateSegment).mockImplementation(async (text) => {
      segmentsIssued += 1;
      await segmentsGate;
      return { ok: true, result: { original: text, translated: `中文：${text}` } };
    });
    const pending = lookupTerm('give up');
    await vi.waitFor(() => {
      expect(phrasesRequested).toBe(true);
      expect(segmentsIssued).toBe(3); // 1 definition + 2 examples
    });
    releaseSegments();
    releasePhrases();
    const outcome = await pending;
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.relatedPhrases).toEqual(['give in']);
      expect(outcome.result.definitions[0].definitionZh).toBe('中文：To surrender.');
    }
  });

  it('keeps the lookup and returns empty phrases when the phrase source rejects unexpectedly', async () => {
    // The module contract is to resolve [] on failure; the orchestration
    // still isolates a rejection so no enrichment arm can sink the lookup.
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a', 'b']));
    vi.mocked(fetchRelatedPhrases).mockRejectedValue(new Error('down'));
    const outcome = await lookupTerm('give up');
    expect(fetchRelatedPhrases).toHaveBeenCalledWith('give up', 6);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.relatedPhrases).toEqual([]);
      expect(outcome.result.definitions).toEqual(surrenderOnly);
      expect(outcome.result.examples).toEqual(toExamples(['a', 'b']));
    }
  });

  it('keeps related phrases when translation is unavailable', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a', 'b']));
    // beforeEach default: every translateSegment call is service-unavailable.
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.relatedPhrases).toEqual(['give in', 'give away']);
      expect(outcome.result.definitions[0].definitionZh).toBeNull();
    }
  });
});
