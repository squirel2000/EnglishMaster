export interface Pronunciation {
  /** URL of a US audio recording, if the dictionary provides one */
  audioUrl: string | null;
  /** IPA transcription, e.g. /həˈloʊ/ */
  phonetic: string | null;
}

export interface ExampleEntry {
  /** English example sentence */
  en: string;
  /** Traditional Chinese translation of the sentence; null when unavailable */
  zh: string | null;
}

export interface DefinitionEntry {
  partOfSpeech: string;
  definition: string;
  /** Traditional Chinese translation of the definition; null when unavailable */
  definitionZh: string | null;
  /**
   * The sense's own example: the first example the source provides for this
   * definition (at most one per sense); null when the source gives none.
   */
  example: ExampleEntry | null;
}

export interface LookupResult {
  term: string;
  pronunciation: Pronunciation;
  definitions: DefinitionEntry[];
  /**
   * Supplemental examples (更多例句): term-level sentences added by
   * lookup-service (Tatoeba) when the displayed senses carry fewer than two
   * examples of their own. Never attributed to a specific sense; normalizers
   * always emit an empty list.
   */
  examples: ExampleEntry[];
  /** English synonyms aggregated from the source, deduped, at most 8 */
  synonyms: string[];
  /** English antonyms aggregated from the source, deduped, at most 8 */
  antonyms: string[];
  /**
   * Common phrases starting with the term, most frequent first, at most 6.
   * Source-independent: normalizers emit [] and lookup-service fills the
   * list from Datamuse.
   */
  relatedPhrases: string[];
  source: 'free-dictionary' | 'wiktionary';
}

export interface TranslationResult {
  original: string;
  translated: string;
}

export type QueryKind = 'dictionary' | 'sentence' | 'empty';

export type LookupErrorCode = 'not-found' | 'service-unavailable';
export type TranslateErrorCode = 'quota-exhausted' | 'service-unavailable';
