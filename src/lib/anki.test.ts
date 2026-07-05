import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAnkiNote, isAnkiLinked } from './anki';
import type { LookupResult } from './types';

const full: LookupResult = {
  term: 'give up',
  pronunciation: { audioUrl: 'https://example.com/a-us.mp3', phonetic: '/ɡɪv ʌp/' },
  definitions: [
    {
      partOfSpeech: 'verb',
      definition: 'To surrender.',
      definitionZh: '放棄。',
      example: { en: 'They gave up the search.', zh: '他們放棄了搜尋。' },
    },
    {
      partOfSpeech: 'verb',
      definition: 'To stop or quit.',
      definitionZh: null,
      example: null,
    },
  ],
  examples: [
    { en: 'Never give up hope.', zh: '永不放棄希望。' },
    { en: 'Do not give up now.', zh: null },
  ],
  synonyms: ['surrender', 'quit'],
  antonyms: ['persist'],
  relatedPhrases: [
    { en: 'give in', zh: '讓步' },
    { en: 'give up the ghost', zh: null },
  ],
  source: 'free-dictionary',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildAnkiNote', () => {
  it('targets the fixed deck and model with stable tags', () => {
    const note = buildAnkiNote(full);
    expect(note.deckName).toBe('EnglishMaster');
    expect(note.modelName).toBe('Basic');
    expect(note.tags).toEqual(['englishmaster']);
    // AnkiConnect Basic model expects exactly these two fields.
    expect(Object.keys(note.fields)).toEqual(['Front', 'Back']);
  });

  it('puts the term and phonetic on the front', () => {
    expect(buildAnkiNote(full).fields.Front).toBe('<b>give up</b> /ɡɪv ʌp/');
  });

  it('omits the phonetic from the front when absent', () => {
    const note = buildAnkiNote({
      ...full,
      pronunciation: { audioUrl: null, phonetic: null },
    });
    expect(note.fields.Front).toBe('<b>give up</b>');
  });

  it('assembles bilingual definitions with their sense examples on the back', () => {
    const back = buildAnkiNote(full).fields.Back;
    expect(back).toContain('釋義');
    expect(back).toContain('(verb) 放棄。 — To surrender.');
    expect(back).toContain('<i>They gave up the search.</i><br>他們放棄了搜尋。');
    // English-only fallback keeps the sense line intact.
    expect(back).toContain('(verb) To stop or quit.');
  });

  it('assembles supplements, synonyms, antonyms, and glossed phrases on the back', () => {
    const back = buildAnkiNote(full).fields.Back;
    expect(back).toContain('更多例句');
    expect(back).toContain('<i>Never give up hope.</i><br>永不放棄希望。');
    expect(back).toContain('<i>Do not give up now.</i>');
    expect(back).toContain('同義');
    expect(back).toContain('surrender, quit');
    expect(back).toContain('反義');
    expect(back).toContain('persist');
    expect(back).toContain('片語');
    expect(back).toContain('give in — 讓步');
    expect(back).toContain('give up the ghost');
  });

  it('omits every empty block from the back', () => {
    const note = buildAnkiNote({
      ...full,
      examples: [],
      synonyms: [],
      antonyms: [],
      relatedPhrases: [],
    });
    expect(note.fields.Back).toContain('釋義');
    for (const label of ['更多例句', '同義', '反義', '片語']) {
      expect(note.fields.Back).not.toContain(label);
    }
  });

  it('omits the definitions block when the entry has none', () => {
    const note = buildAnkiNote({ ...full, definitions: [] });
    expect(note.fields.Back).not.toContain('釋義');
  });

  it('keeps a sense line free of example markup when the sense has none', () => {
    const note = buildAnkiNote({
      ...full,
      definitions: [full.definitions[1]],
      examples: [],
      synonyms: [],
      antonyms: [],
      relatedPhrases: [],
    });
    expect(note.fields.Back).not.toContain('<i>');
    expect(note.fields.Back).not.toContain('—');
  });

  it('escapes third-party text so it cannot inject markup', () => {
    const hostile: LookupResult = {
      ...full,
      term: 'AT&T <wow>',
      pronunciation: { audioUrl: null, phonetic: '/x "y"/' },
      definitions: [
        {
          partOfSpeech: 'noun',
          definition: 'Tom & Jerry <script>alert("x")</script>',
          definitionZh: '湯姆<與>傑利',
          example: { en: 'a & b', zh: 'c < d' },
        },
      ],
      examples: [{ en: '1 < 2 & 3', zh: null }],
      synonyms: ['R&B'],
      antonyms: [],
      relatedPhrases: [{ en: 'rock & roll', zh: '搖<滾>' }],
    };
    const note = buildAnkiNote(hostile);
    expect(note.fields.Front).toBe('<b>AT&amp;T &lt;wow&gt;</b> /x &quot;y&quot;/');
    const back = note.fields.Back;
    expect(back).not.toContain('<script>');
    expect(back).toContain('Tom &amp; Jerry &lt;script&gt;');
    expect(back).toContain('湯姆&lt;與&gt;傑利');
    expect(back).toContain('<i>a &amp; b</i><br>c &lt; d');
    expect(back).toContain('1 &lt; 2 &amp; 3');
    expect(back).toContain('R&amp;B');
    expect(back).toContain('rock &amp; roll — 搖&lt;滾&gt;');
  });

  it('does not mutate the lookup result', () => {
    const input = structuredClone(full);
    buildAnkiNote(input);
    expect(input).toEqual(full);
  });

  it('performs no network requests', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    buildAnkiNote(full);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('isAnkiLinked', () => {
  it('reports the Anki link as not enabled, without any network request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(isAnkiLinked()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
