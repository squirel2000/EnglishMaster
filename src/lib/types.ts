export interface Pronunciation {
  /** URL of a US audio recording, if the dictionary provides one */
  audioUrl: string | null;
  /** IPA transcription, e.g. /həˈloʊ/ */
  phonetic: string | null;
}

export interface DefinitionEntry {
  partOfSpeech: string;
  definition: string;
  /** Traditional Chinese translation of the definition; null when unavailable */
  definitionZh: string | null;
}

export interface ExampleEntry {
  /** English example sentence */
  en: string;
  /** Traditional Chinese translation of the sentence; null when unavailable */
  zh: string | null;
}

export interface LookupResult {
  term: string;
  pronunciation: Pronunciation;
  definitions: DefinitionEntry[];
  examples: ExampleEntry[];
  /** English synonyms aggregated from the source, deduped, at most 8 */
  synonyms: string[];
  /** English antonyms aggregated from the source, deduped, at most 8 */
  antonyms: string[];
  source: 'free-dictionary' | 'wiktionary';
}

export interface TranslationResult {
  original: string;
  translated: string;
}

export type QueryKind = 'dictionary' | 'sentence' | 'empty';

export type LookupErrorCode = 'not-found' | 'service-unavailable';
export type TranslateErrorCode = 'quota-exhausted' | 'service-unavailable';
