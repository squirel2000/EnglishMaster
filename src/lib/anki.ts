import type { ExampleEntry, LookupResult } from './types';

/**
 * Anki export, preparation stage: this module builds the card payload only.
 * The transport that would deliver it — an AnkiConnect v6 `addNote` action
 * POSTed to `http://127.0.0.1:8765` — is deliberately NOT implemented in
 * this change; it belongs to the future change that enables the link (and
 * flips `isAnkiLinked`). Nothing in this module performs network I/O.
 *
 * Transport-change note: AnkiConnect rejects duplicate notes by default, so
 * re-adding a previously saved term fails unless the transport opts into
 * `options.allowDuplicate` — that policy is the enable-link change's call.
 */

/**
 * The `params.note` object of an AnkiConnect v6 `addNote` action.
 * Field names (`deckName`, `modelName`, `fields.Front`, `fields.Back`,
 * `tags`) follow the AnkiConnect API verbatim.
 */
export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: {
    Front: string;
    Back: string;
  };
  tags: string[];
}

/** Fixed defaults until a settings UI exists (per design: no deck/model picker yet). */
const DECK_NAME = 'EnglishMaster';
const MODEL_NAME = 'Basic';
const NOTE_TAG = 'englishmaster';

/**
 * Whether the AnkiConnect link is enabled. Permanently `false` in this
 * change: the UI renders the export button disabled and never talks to
 * Anki. The future enable-link change flips this flag (or replaces it with
 * a real reachability check) and adds the transport described above.
 */
const ANKI_LINKED = false;

export function isAnkiLinked(): boolean {
  return ANKI_LINKED;
}

/**
 * Assemble a lookup result into an AnkiConnect-compatible note. Pure data
 * transformation: no network requests, no mutation of `result`.
 *
 * Front: the term in bold plus its phonetic when available. Back: simple
 * semantic HTML (bold block labels, lists) readable inside an Anki card —
 * bilingual definitions with their sense examples, supplemental examples
 * (更多例句), synonyms, antonyms, and glossed phrases. A block whose data
 * is empty is omitted entirely.
 */
export function buildAnkiNote(result: LookupResult): AnkiNote {
  return {
    deckName: DECK_NAME,
    modelName: MODEL_NAME,
    fields: {
      Front: buildFront(result),
      Back: buildBack(result),
    },
    tags: [NOTE_TAG],
  };
}

function buildFront(result: LookupResult): string {
  const term = `<b>${escapeHtml(result.term)}</b>`;
  const phonetic = result.pronunciation.phonetic;
  return phonetic ? `${term} ${escapeHtml(phonetic)}` : term;
}

function buildBack(result: LookupResult): string {
  const blocks: string[] = [];

  if (result.definitions.length > 0) {
    const items = result.definitions.map((entry) => {
      const sense = entry.definitionZh
        ? `${escapeHtml(entry.definitionZh)} — ${escapeHtml(entry.definition)}`
        : escapeHtml(entry.definition);
      const example = entry.example ? `<br>${exampleHtml(entry.example)}` : '';
      return `<li>(${escapeHtml(entry.partOfSpeech)}) ${sense}${example}</li>`;
    });
    blocks.push(block('釋義', `<ol>${items.join('')}</ol>`));
  }

  if (result.examples.length > 0) {
    const items = result.examples.map((example) => `<li>${exampleHtml(example)}</li>`);
    blocks.push(block('更多例句', `<ul>${items.join('')}</ul>`));
  }

  if (result.synonyms.length > 0) {
    blocks.push(block('同義', wordListHtml(result.synonyms)));
  }

  if (result.antonyms.length > 0) {
    blocks.push(block('反義', wordListHtml(result.antonyms)));
  }

  if (result.relatedPhrases.length > 0) {
    const items = result.relatedPhrases.map((phrase) => {
      const gloss = phrase.zh ? ` — ${escapeHtml(phrase.zh)}` : '';
      return `<li>${escapeHtml(phrase.en)}${gloss}</li>`;
    });
    blocks.push(block('片語', `<ul>${items.join('')}</ul>`));
  }

  return blocks.join('');
}

/** English sentence in italics, its Chinese translation (when any) beneath. */
function exampleHtml(example: ExampleEntry): string {
  const zh = example.zh ? `<br>${escapeHtml(example.zh)}` : '';
  return `<i>${escapeHtml(example.en)}</i>${zh}`;
}

function wordListHtml(words: string[]): string {
  return `<p>${words.map(escapeHtml).join(', ')}</p>`;
}

function block(label: string, body: string): string {
  return `<div><b>${label}</b>${body}</div>`;
}

/**
 * Escape text for interpolation into the card HTML. Definitions, examples,
 * and phrases come from third-party APIs, so a stray `<`, `&`, or quote
 * must render literally instead of breaking or injecting markup.
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
