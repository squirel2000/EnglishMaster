import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import { fetchRelatedPhrases } from './datamuse-api';
import { translateSegment } from './translation-api';
import type { ExampleEntry, LookupErrorCode, LookupResult } from './types';
import { EXTERNAL_API_TIMEOUT_MS as TIMEOUT_MS } from './constants';

/** Sense examples plus supplements must total 2-3 visible sentences. */
const MIN_TOTAL_EXAMPLES = 2;
const MAX_TOTAL_EXAMPLES = 3;
const MAX_DEFINITIONS = 5;
const MAX_RELATED_PHRASES = 6;

export type LookupOutcome =
  | { ok: true; result: LookupResult }
  | { ok: false; error: LookupErrorCode };

export async function lookupTerm(term: string): Promise<LookupOutcome> {
  let result: LookupResult | null = null;
  let sawServiceError = false;

  try {
    result = await lookupFreeDictionary(term, AbortSignal.timeout(TIMEOUT_MS));
  } catch {
    sawServiceError = true;
  }

  if (!result) {
    try {
      result = await lookupWiktionary(term, AbortSignal.timeout(TIMEOUT_MS));
    } catch {
      sawServiceError = true;
    }
  }

  if (!result) {
    return { ok: false, error: sawServiceError ? 'service-unavailable' : 'not-found' };
  }

  // Only the first MAX_DEFINITIONS senses are displayed (source order
  // reflects common usage), so truncate before the example guarantee:
  // senses beyond the cut must not count toward the on-screen example
  // total, nor consume translation quota.
  const displayed: LookupResult = {
    ...result,
    definitions: result.definitions.slice(0, MAX_DEFINITIONS),
  };
  const base = await withSupplementalExamples(term, displayed);
  // The translation batch and the Datamuse phrase fetch are independent
  // enrichment arms, so they run in parallel. Each owns its own failures
  // (null Chinese text / empty phrase list); the extra catch keeps a
  // rejecting phrase source from sinking an otherwise successful lookup,
  // mirroring the Tatoeba supplementation principle.
  const [translated, relatedPhrases] = await Promise.all([
    withTranslations(base),
    fetchRelatedPhrases(term, MAX_RELATED_PHRASES).catch((): string[] => []),
  ]);
  return { ok: true, result: { ...translated, relatedPhrases } };
}

/** The examples attached to the displayed senses, in definition order. */
function senseExamplesOf(result: LookupResult): ExampleEntry[] {
  return result.definitions.flatMap((entry) =>
    entry.example ? [entry.example] : [],
  );
}

/**
 * Guarantee 2-3 visible example sentences per entry. Sense examples on the
 * displayed definitions count first; only when they number fewer than
 * MIN_TOTAL_EXAMPLES does Tatoeba fill the gap with term-level supplemental
 * examples (更多例句), deduped on the English sentence against the sense
 * examples and one another. Supplements are never attributed to a specific
 * sense: Tatoeba sentences are term-level data, so pinning one to a sense
 * would fake an attribution the source never made.
 */
async function withSupplementalExamples(
  term: string,
  result: LookupResult,
): Promise<LookupResult> {
  const senseExamples = senseExamplesOf(result);
  if (senseExamples.length >= MIN_TOTAL_EXAMPLES) {
    return { ...result, examples: [] };
  }
  try {
    const candidates = await fetchTatoebaExamples(
      term,
      MAX_TOTAL_EXAMPLES,
      AbortSignal.timeout(TIMEOUT_MS),
    );
    const seen = new Set(senseExamples.map((example) => example.en));
    const supplements: ExampleEntry[] = [];
    for (const en of candidates) {
      if (senseExamples.length + supplements.length >= MAX_TOTAL_EXAMPLES) break;
      if (seen.has(en)) continue;
      seen.add(en);
      // Supplements enter untranslated and get their Chinese text in the
      // combined batch later.
      supplements.push({ en, zh: null });
    }
    return { ...result, examples: supplements };
  } catch {
    // Supplementation must never break an otherwise successful lookup.
    return { ...result, examples: [] };
  }
}

/**
 * Translate every displayed text segment to Traditional Chinese in one
 * parallel batch: the (already truncated) definitions, their attached sense
 * examples, and the supplemental examples — at most 5 + 5 segments per
 * lookup. Translation is best-effort: a failed or quota-exhausted segment
 * leaves its Chinese text null and must never fail the lookup itself.
 */
async function withTranslations(result: LookupResult): Promise<LookupResult> {
  const senseExamples = senseExamplesOf(result);
  // Segment layout: [0, senseBase) definitions, [senseBase, supplementBase)
  // sense examples in definition order, [supplementBase, ...) supplements.
  const senseBase = result.definitions.length;
  const supplementBase = senseBase + senseExamples.length;
  const segments = [
    ...result.definitions.map((entry) => entry.definition),
    ...senseExamples.map((example) => example.en),
    ...result.examples.map((example) => example.en),
  ];
  const outcomes = await Promise.allSettled(
    segments.map((text) => translateSegment(text)),
  );
  const zhFor = (index: number): string | null => {
    const outcome = outcomes[index];
    return outcome.status === 'fulfilled' && outcome.value.ok
      ? outcome.value.result.translated
      : null;
  };
  // Walks the sense-example segment group in step with the definitions that
  // carry an example, mirroring the order senseExamplesOf() emitted them in.
  let senseIndex = senseBase;
  return {
    ...result,
    definitions: result.definitions.map((entry, index) => ({
      ...entry,
      definitionZh: zhFor(index),
      example: entry.example
        ? { ...entry.example, zh: zhFor(senseIndex++) }
        : null,
    })),
    examples: result.examples.map((example, index) => ({
      ...example,
      zh: zhFor(supplementBase + index),
    })),
  };
}
