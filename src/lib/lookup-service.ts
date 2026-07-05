import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import { translateSegment } from './translation-api';
import type { DefinitionEntry, LookupErrorCode, LookupResult } from './types';
import { EXTERNAL_API_TIMEOUT_MS as TIMEOUT_MS } from './constants';

const MIN_EXAMPLES = 2;
const MAX_EXAMPLES = 3;
const MAX_DEFINITIONS = 5;

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
  return { ok: true, result: await withTranslatedDefinitions(base) };
}

/**
 * Keep the first MAX_DEFINITIONS definitions (source order reflects common
 * usage) and translate them to Traditional Chinese in parallel. Translation
 * is best-effort: a failed or quota-exhausted segment leaves definitionZh
 * null and must never fail the lookup itself.
 */
async function withTranslatedDefinitions(
  result: LookupResult,
): Promise<LookupResult> {
  const definitions = result.definitions.slice(0, MAX_DEFINITIONS);
  const outcomes = await Promise.allSettled(
    definitions.map((entry) => translateSegment(entry.definition)),
  );
  const translated: DefinitionEntry[] = definitions.map((entry, index) => {
    const outcome = outcomes[index];
    return {
      ...entry,
      definitionZh:
        outcome.status === 'fulfilled' && outcome.value.ok
          ? outcome.value.result.translated
          : null,
    };
  });
  return { ...result, definitions: translated };
}

async function withGuaranteedExamples(
  term: string,
  result: LookupResult,
): Promise<LookupResult> {
  if (result.examples.length >= MIN_EXAMPLES) {
    return { ...result, examples: result.examples.slice(0, MAX_EXAMPLES) };
  }
  try {
    const extra = await fetchTatoebaExamples(
      term,
      MAX_EXAMPLES,
      AbortSignal.timeout(TIMEOUT_MS),
    );
    const merged = [...new Set([...result.examples, ...extra])];
    return { ...result, examples: merged.slice(0, MAX_EXAMPLES) };
  } catch {
    // Supplementation must never break an otherwise successful lookup.
    return result;
  }
}
