import type { DefinitionEntry, ExampleEntry, LookupResult } from './types';

const BASE_URL = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

interface WiktionaryDefinition {
  definition: string;
  examples?: string[];
}

interface WiktionaryUsage {
  partOfSpeech: string;
  definitions: WiktionaryDefinition[];
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function lookupWiktionary(
  term: string,
  signal?: AbortSignal,
): Promise<LookupResult | null> {
  const page = term.trim().replace(/\s+/g, '_');
  const res = await fetch(BASE_URL + encodeURIComponent(page), { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`wiktionary responded ${res.status}`);
  const body = (await res.json()) as Record<string, WiktionaryUsage[]>;
  const usages = body.en;
  if (!usages || usages.length === 0) return null;

  const definitions: DefinitionEntry[] = [];
  const examples: ExampleEntry[] = [];
  for (const usage of usages) {
    for (const def of usage.definitions) {
      const text = stripHtml(def.definition);
      if (text !== '') {
        definitions.push({
          partOfSpeech: usage.partOfSpeech.toLowerCase(),
          definition: text,
          // Chinese translation is attached later by lookup-service.
          definitionZh: null,
        });
      }
      for (const example of def.examples ?? []) {
        const stripped = stripHtml(example);
        // Chinese translation is attached later by lookup-service.
        if (stripped !== '') examples.push({ en: stripped, zh: null });
      }
    }
  }
  if (definitions.length === 0) return null;

  return {
    term,
    pronunciation: { audioUrl: null, phonetic: null },
    definitions,
    examples,
    // Wiktionary's definition endpoint carries no thesaurus data.
    synonyms: [],
    antonyms: [],
    source: 'wiktionary',
  };
}
