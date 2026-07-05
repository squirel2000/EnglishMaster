import type { DefinitionEntry, LookupResult } from './types';

const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

interface ApiPhonetic {
  text?: string;
  audio?: string;
}

interface ApiDefinition {
  definition: string;
  example?: string;
}

interface ApiMeaning {
  partOfSpeech: string;
  definitions: ApiDefinition[];
}

interface ApiEntry {
  word: string;
  phonetics: ApiPhonetic[];
  meanings: ApiMeaning[];
}

export async function lookupFreeDictionary(
  term: string,
  signal?: AbortSignal,
): Promise<LookupResult | null> {
  const res = await fetch(BASE_URL + encodeURIComponent(term), { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`free dictionary responded ${res.status}`);
  const entries = (await res.json()) as ApiEntry[];
  if (!Array.isArray(entries) || entries.length === 0) return null;
  return normalize(term, entries);
}

function normalize(term: string, entries: ApiEntry[]): LookupResult {
  const definitions: DefinitionEntry[] = [];
  const examples: string[] = [];
  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      for (const def of meaning.definitions) {
        definitions.push({
          partOfSpeech: meaning.partOfSpeech,
          definition: def.definition,
        });
        if (def.example) examples.push(def.example);
      }
    }
  }
  return {
    term,
    pronunciation: {
      audioUrl: pickUsAudio(entries),
      phonetic: pickPhonetic(entries),
    },
    definitions,
    examples,
    source: 'free-dictionary',
  };
}

function pickUsAudio(entries: ApiEntry[]): string | null {
  for (const entry of entries) {
    for (const phonetic of entry.phonetics) {
      if (phonetic.audio && phonetic.audio.includes('-us.')) {
        return phonetic.audio;
      }
    }
  }
  return null;
}

function pickPhonetic(entries: ApiEntry[]): string | null {
  for (const entry of entries) {
    for (const phonetic of entry.phonetics) {
      if (phonetic.text) return phonetic.text;
    }
  }
  return null;
}
