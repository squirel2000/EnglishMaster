import type { TranslateErrorCode, TranslationResult } from './types';
import { EXTERNAL_API_TIMEOUT_MS as TIMEOUT_MS } from './constants';

const BASE_URL = 'https://api.mymemory.translated.net/get';

/** Maximum number of translated segments kept in the in-memory cache. */
export const SEGMENT_CACHE_CAPACITY = 500;

/** Segment cache: source text -> translated text, oldest entry evicted first. */
const segmentCache = new Map<string, string>();

export type TranslateOutcome =
  | { ok: true; result: TranslationResult }
  | { ok: false; error: TranslateErrorCode };

interface MyMemoryResponse {
  responseData: { translatedText: string };
  quotaFinished: boolean;
  responseStatus: number;
}

/**
 * Single MyMemory request for one piece of English text. Owns the endpoint,
 * quotaFinished detection, and error semantics for every translation path.
 */
async function requestTranslation(text: string): Promise<TranslateOutcome> {
  const url = new URL(BASE_URL);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', 'en|zh-TW');
  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: 'service-unavailable' };
    const body = (await res.json()) as MyMemoryResponse;
    if (body.quotaFinished) return { ok: false, error: 'quota-exhausted' };
    if (body.responseStatus !== 200) {
      return { ok: false, error: 'service-unavailable' };
    }
    return {
      ok: true,
      result: { original: text, translated: body.responseData.translatedText },
    };
  } catch {
    return { ok: false, error: 'service-unavailable' };
  }
}

export async function translateSentence(
  sentence: string,
): Promise<TranslateOutcome> {
  return requestTranslation(sentence);
}

/**
 * Translate one short segment (e.g. a definition or example sentence) with a
 * module-level cache so repeated lookups never spend translation quota twice.
 * Only successful translations are cached; when the cache is full the oldest
 * entry is evicted first (FIFO via Map insertion order).
 */
export async function translateSegment(text: string): Promise<TranslateOutcome> {
  const cached = segmentCache.get(text);
  if (cached !== undefined) {
    return { ok: true, result: { original: text, translated: cached } };
  }
  const outcome = await requestTranslation(text);
  if (outcome.ok) {
    if (segmentCache.size >= SEGMENT_CACHE_CAPACITY) {
      const oldest = segmentCache.keys().next().value;
      if (oldest !== undefined) segmentCache.delete(oldest);
    }
    segmentCache.set(text, outcome.result.translated);
  }
  return outcome;
}

/** Test-only helper: empty the segment translation cache. */
export function clearSegmentCache(): void {
  segmentCache.clear();
}
