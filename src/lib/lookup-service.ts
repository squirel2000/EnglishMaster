import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import { fetchRelatedPhrases } from './datamuse-api';
import { translateSegment } from './translation-api';
import type {
  ExampleEntry,
  LookupErrorCode,
  LookupResult,
  PhraseEntry,
} from './types';
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
  // Two waves of enrichment. Wave 1 gathers raw English material from the
  // independent sources in parallel: Tatoeba supplements and Datamuse
  // phrases. Wave 2 is the single translation batch over every displayed
  // segment — it runs after the gathering (not beside it) because the
  // phrases it must gloss only exist once Datamuse returns. Each arm owns
  // its own failures (missing supplements / empty phrase list); the extra
  // catch keeps a rejecting phrase source from sinking an otherwise
  // successful lookup, mirroring the Tatoeba supplementation principle.
  const [base, phrases] = await Promise.all([
    withSupplementalExamples(term, displayed),
    fetchRelatedPhrases(term, MAX_RELATED_PHRASES).catch((): string[] => []),
  ]);
  // Phrases enter untranslated and get their Traditional Chinese gloss in
  // the combined batch, exactly like Tatoeba supplements.
  const relatedPhrases: PhraseEntry[] = phrases.map((en) => ({ en, zh: null }));
  const translated = await withTranslations({ ...base, relatedPhrases });
  return { ok: true, result: translated };
}

/**
 * The examples currently attached to the displayed definitions, in
 * definition order. Before assignment this is sense-owned examples only;
 * after `withSupplementalExamples` runs, positionally-assigned Tatoeba
 * supplements are indistinguishable from a sense's own and are included too.
 */
function examplesOf(result: LookupResult): ExampleEntry[] {
  return result.definitions.flatMap((entry) =>
    entry.example ? [entry.example] : [],
  );
}

/**
 * Guarantee 2-3 visible example sentences per entry. Sense examples on the
 * displayed definitions count first; only when they number fewer than
 * MIN_TOTAL_EXAMPLES does Tatoeba fill the gap with term-level supplemental
 * sentences, deduped on the English sentence against the sense examples and
 * one another. Unlike the source's own sense examples, Tatoeba sentences
 * carry no sense attribution, so a supplement is assigned to the next
 * example-less definition in *display* order — not fetch order — making its
 * presentation indistinguishable from a sense's own example. Definitions
 * that already have one are left untouched; any definitions still without
 * one when supplements run out simply stay that way (no crash, no partial
 * state).
 */
async function withSupplementalExamples(
  term: string,
  result: LookupResult,
): Promise<LookupResult> {
  const senseExamples = examplesOf(result);
  if (senseExamples.length >= MIN_TOTAL_EXAMPLES) {
    return result;
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
    let nextSupplement = 0;
    return {
      ...result,
      definitions: result.definitions.map((entry) => {
        if (entry.example || nextSupplement >= supplements.length) return entry;
        return { ...entry, example: supplements[nextSupplement++] };
      }),
    };
  } catch {
    // Supplementation must never break an otherwise successful lookup.
    return result;
  }
}

/**
 * Translate every displayed text segment to Traditional Chinese in one
 * parallel batch: the (already truncated) definitions, their attached
 * examples (a sense's own, or a positionally-assigned Tatoeba supplement —
 * indistinguishable by this point), and the related phrases — at most
 * 5 definitions + 5 examples + 6 phrases per lookup. Translation is
 * best-effort: a failed or quota-exhausted segment leaves its Chinese text
 * null and must never fail the lookup itself.
 */
async function withTranslations(result: LookupResult): Promise<LookupResult> {
  const examples = examplesOf(result);
  // Segment layout: [0, senseBase) definitions, [senseBase, phraseBase)
  // examples in definition order (sparse: only definitions that carry one
  // contribute a segment), [phraseBase, ...) related phrases.
  const senseBase = result.definitions.length;
  const phraseBase = senseBase + examples.length;
  const segments = [
    ...result.definitions.map((entry) => entry.definition),
    ...examples.map((example) => example.en),
    ...result.relatedPhrases.map((phrase) => phrase.en),
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
  // Walks the example segment group in step with the definitions that carry
  // one, mirroring the order examplesOf() emitted them in.
  let exampleIndex = senseBase;
  return {
    ...result,
    definitions: result.definitions.map((entry, index) => ({
      ...entry,
      definitionZh: zhFor(index),
      example: entry.example
        ? { ...entry.example, zh: zhFor(exampleIndex++) }
        : null,
    })),
    relatedPhrases: result.relatedPhrases.map((phrase, index) => ({
      ...phrase,
      zh: zhFor(phraseBase + index),
    })),
  };
}
