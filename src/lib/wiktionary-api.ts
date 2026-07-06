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
  for (const usage of usages) {
    for (const def of usage.definitions) {
      const text = stripHtml(def.definition);
      // A definition that strips to nothing is skipped along with its
      // examples: an example belongs to its sense, and the sense is not shown.
      if (text === '') continue;
      definitions.push({
        partOfSpeech: usage.partOfSpeech.toLowerCase(),
        definition: text,
        // Chinese translations are attached later by lookup-service.
        definitionZh: null,
        example: firstSenseExample(def),
      });
    }
  }
  if (definitions.length === 0) return null;

  return {
    term,
    pronunciation: { audioUrl: null, phonetic: null },
    definitions,
    // Wiktionary's definition endpoint carries no thesaurus data.
    synonyms: [],
    antonyms: [],
    // Related phrases are attached later by lookup-service (Datamuse).
    relatedPhrases: [],
    source: 'wiktionary',
  };
}

/**
 * The sense's own example: the first source example that still has text
 * after HTML stripping (at most one per sense), or null when none does.
 */
function firstSenseExample(def: WiktionaryDefinition): ExampleEntry | null {
  for (const example of def.examples ?? []) {
    const stripped = stripHtml(example);
    // Chinese translations are attached later by lookup-service.
    if (stripped !== '') return { en: stripped, zh: null };
  }
  return null;
}
