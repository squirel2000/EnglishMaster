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

/**
 * An English phrase (`en`) with its Traditional Chinese gloss (`zh`, null
 * when translation is unavailable). Structurally the same bilingual pair as
 * ExampleEntry; the alias keeps phrase call sites self-describing and lets
 * the shapes diverge later without a rename ripple.
 */
export type PhraseEntry = ExampleEntry;

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
  /**
   * Displayed senses. Each carries at most one example in `.example`: either
   * the source's own example for that sense, or — when the sense had none —
   * a Tatoeba supplement positionally assigned by lookup-service in display
   * order. There is no separate example list; every visible example lives
   * on a definition.
   */
  definitions: DefinitionEntry[];
  /** English synonyms aggregated from the source, deduped, at most 8 */
  synonyms: string[];
  /** English antonyms aggregated from the source, deduped, at most 8 */
  antonyms: string[];
  /**
   * Common phrases starting with the term, most frequent first, at most 6,
   * each glossed in Traditional Chinese (zh null when translation fails).
   * Source-independent: normalizers emit [] and lookup-service fills the
   * list from Datamuse.
   */
  relatedPhrases: PhraseEntry[];
  source: 'free-dictionary' | 'wiktionary';
}

export interface TranslationResult {
  original: string;
  translated: string;
}

export type QueryKind = 'dictionary' | 'sentence' | 'empty';

export type LookupErrorCode = 'not-found' | 'service-unavailable';
export type TranslateErrorCode = 'quota-exhausted' | 'service-unavailable';
