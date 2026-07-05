import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import { fetchRelatedPhrases } from './datamuse-api';
import { translateSegment } from './translation-api';
import type { ExampleEntry, LookupErrorCode, LookupResult } from './types';
import { EXTERNAL_API_TIMEOUT_MS as TIMEOUT_MS } from './constants';

const MIN_EXAMPLES = 2;
const MAX_EXAMPLES = 3;
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

  const base = await withGuaranteedExamples(term, result);
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

/**
 * Keep the first MAX_DEFINITIONS definitions (source order reflects common
 * usage) and translate them plus every example sentence to Traditional
 * Chinese in one parallel batch (at most 5 + 3 segments per lookup).
 * Translation is best-effort: a failed or quota-exhausted segment leaves
 * its Chinese text null and must never fail the lookup itself.
 */
async function withTranslations(result: LookupResult): Promise<LookupResult> {
  const definitions = result.definitions.slice(0, MAX_DEFINITIONS);
  const segments = [
    ...definitions.map((entry) => entry.definition),
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
  return {
    ...result,
    definitions: definitions.map((entry, index) => ({
      ...entry,
      definitionZh: zhFor(index),
    })),
    examples: result.examples.map((example, index) => ({
      ...example,
      zh: zhFor(definitions.length + index),
    })),
  };
}

async function withGuaranteedExamples(
  term: string,
  result: LookupResult,
): Promise<LookupResult> {
  // Dedupe up front: duplicate sentences would waste translation quota and
  // collide as React keys, and only unique examples count toward the minimum.
  const unique = dedupeByEnglish(result.examples);
  if (unique.length >= MIN_EXAMPLES) {
    return { ...result, examples: unique.slice(0, MAX_EXAMPLES) };
  }
  try {
    const extra = await fetchTatoebaExamples(
      term,
      MAX_EXAMPLES,
      AbortSignal.timeout(TIMEOUT_MS),
    );
    // Tatoeba supplements enter untranslated and get their Chinese text in
    // the combined batch later.
    const merged = dedupeByEnglish([
      ...unique,
      ...extra.map((en): ExampleEntry => ({ en, zh: null })),
    ]);
    return { ...result, examples: merged.slice(0, MAX_EXAMPLES) };
  } catch {
    // Supplementation must never break an otherwise successful lookup.
    return { ...result, examples: unique };
  }
}

/** First occurrence wins, order preserved. */
function dedupeByEnglish(examples: ExampleEntry[]): ExampleEntry[] {
  const seen = new Set<string>();
  const unique: ExampleEntry[] = [];
  for (const example of examples) {
    if (seen.has(example.en)) continue;
    seen.add(example.en);
    unique.push(example);
  }
  return unique;
}
