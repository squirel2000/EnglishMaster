import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import type { LookupErrorCode, LookupResult } from './types';

const TIMEOUT_MS = 8000;
const MIN_EXAMPLES = 2;
const MAX_EXAMPLES = 3;

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

  return { ok: true, result: await withGuaranteedExamples(term, result) };
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
