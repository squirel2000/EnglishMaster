import type { TranslateErrorCode, TranslationResult } from './types';

const BASE_URL = 'https://api.mymemory.translated.net/get';
const TIMEOUT_MS = 8000;

export type TranslateOutcome =
  | { ok: true; result: TranslationResult }
  | { ok: false; error: TranslateErrorCode };

interface MyMemoryResponse {
  responseData: { translatedText: string };
  quotaFinished: boolean;
  responseStatus: number;
}

export async function translateSentence(
  sentence: string,
): Promise<TranslateOutcome> {
  const url = new URL(BASE_URL);
  url.searchParams.set('q', sentence);
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
      result: { original: sentence, translated: body.responseData.translatedText },
    };
  } catch {
    return { ok: false, error: 'service-unavailable' };
  }
}
