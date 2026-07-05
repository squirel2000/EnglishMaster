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

/**
 * A definition entry as normalizers emit it: untranslated, with the sense's
 * own example attached (or none).
 */
function defEntry(definition: string, example: string | null = null): DefinitionEntry {
  return {
    partOfSpeech: 'verb',
    definition,
    definitionZh: null,
    example: example === null ? null : { en: example, zh: null },
  };
}

/** Untranslated supplemental entries, the shape Tatoeba sentences take. */
function toExamples(sentences: string[]): ExampleEntry[] {
  return sentences.map((en) => ({ en, zh: null }));
}

/** Two senses carrying two examples: enough to skip supplementation. */
function sufficientSenses(): DefinitionEntry[] {
  return [
    defEntry('To surrender.', 'They gave up the fight.'),
    defEntry('To stop or quit.', 'Never give up.'),
  ];
}

function makeResult(definitions: DefinitionEntry[]): LookupResult {
  return {
    term: 'give up',
    pronunciation: { audioUrl: null, phonetic: null },
    definitions,
    // Normalizers never fill the supplements list; lookup-service does.
    examples: [],
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
  it('keeps sense examples on their definitions and skips supplementation when they number 2+', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(sufficientSenses()),
    );
    const outcome = await lookupTerm('give up');
    expect(outcome).toEqual({
      ok: true,
      result: expect.objectContaining({
        definitions: sufficientSenses(),
        // No supplements are needed, so the term-level list stays empty.
        examples: [],
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

  it('supplements from Tatoeba when sense examples fall short, deduped against them on the English sentence', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([defEntry('To surrender.', 'a')]),
    );
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['a', 'b', 'c']);
    const outcome = await lookupTerm('give up');
    expect(fetchTatoebaExamples).toHaveBeenCalledWith(
      'give up',
      3,
      expect.anything(),
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // 'a' already belongs to a sense; 1 sense + 2 supplements = 3 total.
      expect(outcome.result.examples).toEqual(toExamples(['b', 'c']));
      expect(outcome.result.definitions[0].example).toEqual({ en: 'a', zh: null });
    }
  });

  it('caps supplements so sense examples plus supplements never exceed 3', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([defEntry('To surrender.', 'a')]),
    );
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['b', 'c', 'd']);
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(toExamples(['b', 'c']));
    }
  });

  it('takes up to 3 supplements when no displayed sense carries an example, deduped within', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([defEntry('To surrender.')]),
    );
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['b', 'b', 'c']);
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(toExamples(['b', 'c']));
    }
  });

  it('counts only the first five displayed definitions when deciding to supplement', async () => {
    // Examples live solely on senses 6-7, which are beyond the display cut:
    // the on-screen count is 0, so supplementation must kick in.
    const definitions = [
      ...Array.from({ length: 5 }, (_, i) => defEntry(`Sense ${i + 1}.`)),
      defEntry('Sense 6.', 'Ex six.'),
      defEntry('Sense 7.', 'Ex seven.'),
    ];
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(definitions));
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['s1', 's2', 's3']);
    const outcome = await lookupTerm('give up');
    expect(fetchTatoebaExamples).toHaveBeenCalled();
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions).toHaveLength(5);
      expect(outcome.result.definitions.map((d) => d.example)).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
      expect(outcome.result.examples).toEqual(toExamples(['s1', 's2', 's3']));
    }
    // Truncated senses stay out of the batch: 5 definitions + 3 supplements.
    expect(translateSegment).toHaveBeenCalledTimes(8);
    expect(translateSegment).not.toHaveBeenCalledWith('Sense 6.');
    expect(translateSegment).not.toHaveBeenCalledWith('Ex six.');
  });

  it('keeps the result when Tatoeba supplementation fails', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([defEntry('To surrender.', 'a')]),
    );
    vi.mocked(fetchTatoebaExamples).mockRejectedValue(new Error('down'));
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // The sense example survives; the total may stay below 2.
      expect(outcome.result.definitions[0].example).toEqual({ en: 'a', zh: null });
      expect(outcome.result.examples).toEqual([]);
    }
  });

  it('falls back to Wiktionary when the primary source has no entry', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(null);
    vi.mocked(lookupWiktionary).mockResolvedValue({
      ...makeResult(sufficientSenses()),
      source: 'wiktionary',
    });
    const outcome = await lookupTerm('kick the bucket');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe('wiktionary');
    }
  });

  it('falls back to Wiktionary when the primary source errors', async () => {
    vi.mocked(lookupFreeDictionary).mockRejectedValue(new Error('timeout'));
    vi.mocked(lookupWiktionary).mockResolvedValue(makeResult(sufficientSenses()));
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
  function echoTranslate() {
    vi.mocked(translateSegment).mockImplementation(async (text) => ({
      ok: true,
      result: { original: text, translated: `中文：${text}` },
    }));
  }

  it('attaches a Traditional Chinese translation to each definition', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(sufficientSenses()),
    );
    echoTranslate();
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions.map((d) => d.definitionZh)).toEqual([
        '中文：To surrender.',
        '中文：To stop or quit.',
      ]);
    }
    expect(translateSegment).toHaveBeenCalledWith('To surrender.');
  });

  it('truncates definitions to the first five and translates only those (with their sense examples)', async () => {
    const definitions = Array.from({ length: 7 }, (_, i) =>
      defEntry(`Sense ${i + 1}.`, `Ex ${i + 1}.`),
    );
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(definitions));
    echoTranslate();
    const outcome = await lookupTerm('sense');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions).toHaveLength(5);
      expect(outcome.result.definitions[0]).toEqual({
        partOfSpeech: 'verb',
        definition: 'Sense 1.',
        definitionZh: '中文：Sense 1.',
        example: { en: 'Ex 1.', zh: '中文：Ex 1.' },
      });
      expect(outcome.result.definitions[4].definitionZh).toBe('中文：Sense 5.');
    }
    // Five sense examples on display: plenty, so no supplementation.
    expect(fetchTatoebaExamples).not.toHaveBeenCalled();
    // 5 definitions + 5 sense examples in the combined batch; senses 6-7
    // (and their examples) are dropped before translation.
    expect(translateSegment).toHaveBeenCalledTimes(10);
    expect(translateSegment).not.toHaveBeenCalledWith('Sense 6.');
    expect(translateSegment).not.toHaveBeenCalledWith('Ex 6.');
  });

  it('nulls definitionZh for a failed segment while keeping the others', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([
        defEntry('To surrender.', 'a'),
        defEntry('To stop or quit.', 'b'),
      ]),
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
        {
          partOfSpeech: 'verb',
          definition: 'To surrender.',
          definitionZh: '放棄。',
          example: { en: 'a', zh: null },
        },
        {
          partOfSpeech: 'verb',
          definition: 'To stop or quit.',
          definitionZh: null,
          example: { en: 'b', zh: null },
        },
      ]);
    }
  });

  it('degrades to English-only definitions when quota is exhausted, lookup still succeeds', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(sufficientSenses()),
    );
    vi.mocked(translateSegment).mockResolvedValue({
      ok: false,
      error: 'quota-exhausted',
    });
    await expect(lookupTerm('give up')).resolves.toEqual({
      ok: true,
      result: expect.objectContaining({
        definitions: sufficientSenses(),
        examples: [],
      }),
    });
  });

  it('translates definitions on the Wiktionary fallback path too', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(null);
    vi.mocked(lookupWiktionary).mockResolvedValue({
      ...makeResult(sufficientSenses()),
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

  it('attaches a Traditional Chinese translation to each sense example', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([
        defEntry('To surrender.', 'They gave up.'),
        defEntry('To stop or quit.', 'Never give up.'),
      ]),
    );
    echoTranslate();
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions.map((d) => d.example)).toEqual([
        { en: 'They gave up.', zh: '中文：They gave up.' },
        { en: 'Never give up.', zh: '中文：Never give up.' },
      ]);
    }
    expect(translateSegment).toHaveBeenCalledWith('They gave up.');
    expect(translateSegment).toHaveBeenCalledWith('Never give up.');
  });

  it('maps sense-example translations onto the right senses when an example-less sense precedes them', async () => {
    // def[0] has no example, so def[1]'s example owns sense segment 0.
    // An offset regression that indexes by definition position
    // (senseBase + defIndex) hands def[1] the first supplement instead.
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([defEntry('Def one.'), defEntry('Def two.', 'Ex two.')]),
    );
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['Sup one.', 'Sup two.']);
    echoTranslate();
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions.map((d) => d.example)).toEqual([
        null,
        { en: 'Ex two.', zh: '中文：Ex two.' },
      ]);
      expect(outcome.result.examples).toEqual([
        { en: 'Sup one.', zh: '中文：Sup one.' },
        { en: 'Sup two.', zh: '中文：Sup two.' },
      ]);
    }
  });

  it('counts duplicate sense examples across senses toward the gate and never dedupes them', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([
        defEntry('To surrender.', 'They gave up.'),
        defEntry('To stop or quit.', 'They gave up.'),
      ]),
    );
    const outcome = await lookupTerm('give up');
    expect(fetchTatoebaExamples).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // Attribution is per-sense: each sense keeps its own copy.
      expect(outcome.result.definitions.map((d) => d.example?.en)).toEqual([
        'They gave up.',
        'They gave up.',
      ]);
      expect(outcome.result.examples).toEqual([]);
    }
  });

  it('translates Tatoeba supplements like sense examples', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([defEntry('To surrender.', 'a')]),
    );
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['b', 'c']);
    echoTranslate();
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions[0].example).toEqual({
        en: 'a',
        zh: '中文：a',
      });
      expect(outcome.result.examples).toEqual([
        { en: 'b', zh: '中文：b' },
        { en: 'c', zh: '中文：c' },
      ]);
    }
  });

  it('nulls zh for a failed example sentence while keeping the others', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([
        defEntry('To surrender.', 'They gave up.'),
        defEntry('To stop or quit.', 'Never give up.'),
      ]),
    );
    vi.mocked(translateSegment).mockImplementation(async (text) => {
      if (text === 'Never give up.') throw new Error('translator crashed');
      return { ok: true, result: { original: text, translated: `中文：${text}` } };
    });
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.definitions.map((d) => d.example)).toEqual([
        { en: 'They gave up.', zh: '中文：They gave up.' },
        { en: 'Never give up.', zh: null },
      ]);
    }
  });

  it('translates definitions, sense examples, and supplements in one parallel batch', async () => {
    // One sense example only, so Tatoeba supplements two more: the batch
    // spans all three segment groups and the echo mapping below proves each
    // translated text lands back on its own segment.
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult([defEntry('Def one.', 'Ex one.'), defEntry('Def two.')]),
    );
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['Sup one.', 'Sup two.']);
    // Hold every translation unresolved until the test releases them, then
    // assert all segments (2 definitions + 1 sense example + 2 supplements)
    // were requested at once. A chained implementation stalls below the
    // expected count and fails the waitFor with a clear "expected 2 to be 5"
    // diff.
    const expectedSegments = 5;
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
      expect(outcome.result.definitions).toEqual([
        {
          partOfSpeech: 'verb',
          definition: 'Def one.',
          definitionZh: '中文：Def one.',
          example: { en: 'Ex one.', zh: '中文：Ex one.' },
        },
        {
          partOfSpeech: 'verb',
          definition: 'Def two.',
          definitionZh: '中文：Def two.',
          example: null,
        },
      ]);
      expect(outcome.result.examples).toEqual([
        { en: 'Sup one.', zh: '中文：Sup one.' },
        { en: 'Sup two.', zh: '中文：Sup two.' },
      ]);
    }
  });
});

describe('lookupTerm related-phrase enrichment', () => {
  it('fetches related phrases in parallel with the translation batch, not after it', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(sufficientSenses()),
    );
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
      expect(segmentsIssued).toBe(4); // 2 definitions + 2 sense examples
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
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(sufficientSenses()),
    );
    vi.mocked(fetchRelatedPhrases).mockRejectedValue(new Error('down'));
    const outcome = await lookupTerm('give up');
    expect(fetchRelatedPhrases).toHaveBeenCalledWith('give up', 6);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.relatedPhrases).toEqual([]);
      expect(outcome.result.definitions).toEqual(sufficientSenses());
      expect(outcome.result.examples).toEqual([]);
    }
  });

  it('keeps related phrases when translation is unavailable', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(sufficientSenses()),
    );
    // beforeEach default: every translateSegment call is service-unavailable.
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.relatedPhrases).toEqual(['give in', 'give away']);
      expect(outcome.result.definitions[0].definitionZh).toBeNull();
    }
  });
});
