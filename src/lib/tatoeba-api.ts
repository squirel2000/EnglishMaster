const BASE_URL = 'https://api.tatoeba.org/unstable/sentences';

interface TatoebaSentence {
  text: string;
}

interface TatoebaResponse {
  data: TatoebaSentence[];
}

export async function fetchTatoebaExamples(
  term: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('lang', 'eng');
  // Quote the term so multi-word phrases match as a unit.
  url.searchParams.set('q', `"${term}"`);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`tatoeba responded ${res.status}`);
  const body = (await res.json()) as TatoebaResponse;
  return body.data.map((sentence) => sentence.text);
}
