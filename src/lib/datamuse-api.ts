import { EXTERNAL_API_TIMEOUT_MS as TIMEOUT_MS } from './constants';

const BASE_URL = 'https://api.datamuse.com/words';

interface DatamuseWord {
  word: string;
}

/**
 * Fetch common phrases starting with the term via Datamuse's wildcard
 * search (`sp=<term> *`), most frequent first — the source is already
 * sorted by score. Related phrases are best-effort enrichment, so unlike
 * the lookup-source siblings this module owns both the timeout and the
 * failure semantics: a non-ok response, malformed body, or timeout
 * resolves to an empty list and never throws.
 */
export async function fetchRelatedPhrases(
  term: string,
  max: number,
): Promise<string[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('sp', `${term} *`);
  url.searchParams.set('max', String(max));
  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as Array<Partial<DatamuseWord> | null>;
    if (!Array.isArray(body)) return [];
    // Keep only well-formed entries and dedupe so React chip keys stay unique.
    const words = body
      .map((entry) => entry?.word)
      .filter((word): word is string => typeof word === 'string');
    return [...new Set(words)];
  } catch {
    return [];
  }
}
