import type { DefinitionEntry, LookupResult } from './types';

const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

interface ApiPhonetic {
  text?: string;
  audio?: string;
}

interface ApiDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface ApiMeaning {
  partOfSpeech: string;
  definitions: ApiDefinition[];
  synonyms?: string[];
  antonyms?: string[];
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

const MAX_THESAURUS_ITEMS = 8;

function normalize(term: string, entries: ApiEntry[]): LookupResult {
  const definitions: DefinitionEntry[] = [];
  // Sets keep insertion order, so first occurrence in document order wins.
  const synonyms = new Set<string>();
  const antonyms = new Set<string>();
  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      addWords(synonyms, meaning.synonyms);
      addWords(antonyms, meaning.antonyms);
      for (const def of meaning.definitions) {
        addWords(synonyms, def.synonyms);
        addWords(antonyms, def.antonyms);
        definitions.push({
          partOfSpeech: meaning.partOfSpeech,
          definition: def.definition,
          // Chinese translations are attached later by lookup-service.
          definitionZh: null,
          // The source example stays with its own sense, never flattened.
          example: def.example ? { en: def.example, zh: null } : null,
        });
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
    synonyms: [...synonyms].slice(0, MAX_THESAURUS_ITEMS),
    antonyms: [...antonyms].slice(0, MAX_THESAURUS_ITEMS),
    // Related phrases are attached later by lookup-service (Datamuse).
    relatedPhrases: [],
    source: 'free-dictionary',
  };
}

/** Collects words into the set; a missing source field contributes nothing. */
function addWords(target: Set<string>, words?: string[]) {
  for (const word of words ?? []) target.add(word);
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
