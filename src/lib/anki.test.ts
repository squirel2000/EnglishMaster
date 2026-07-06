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

  it('assembles synonyms, antonyms, and glossed phrases on the back', () => {
    const back = buildAnkiNote(full).fields.Back;
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
      synonyms: [],
      antonyms: [],
      relatedPhrases: [],
    });
    expect(note.fields.Back).toContain('釋義');
    for (const label of ['同義', '反義', '片語']) {
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
    expect(back).toContain('R&amp;B');
    expect(back).toContain('rock &amp; roll — 搖&lt;滾&gt;');
  });

  it('escapes already-escaped source text again rather than trusting it', () => {
    // Source data is plain text by contract; an entity in it is literal
    // characters the learner should see, so double-escaping is deliberate.
    const note = buildAnkiNote({
      ...full,
      definitions: [
        {
          partOfSpeech: 'noun',
          definition: 'Ampersand written as &amp; in HTML.',
          definitionZh: null,
          example: null,
        },
      ],
    });
    expect(note.fields.Back).toContain('Ampersand written as &amp;amp; in HTML.');
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

/**
 * Whether a definition's `.example` was the sense's own or a Tatoeba
 * supplement positionally assigned by lookup-service, buildAnkiNote sees
 * only `ExampleEntry | null` on the definition — provenance is invisible
 * here (Task 1 unified them upstream). These tests prove the back HTML
 * always inlines each definition's example beside it, and that no separate
 * example block or heading is assembled anywhere, for both a fully
 * populated result and a partially populated one.
 */
describe('buildAnkiNote — no standalone example block on the back', () => {
  // Every shown sense carries its own example directly from the source.
  const fullyExampled: LookupResult = {
    term: 'serendipity',
    pronunciation: { audioUrl: null, phonetic: '/ˌsɛr.ənˈdɪp.ɪ.ti/' },
    definitions: [
      {
        partOfSpeech: 'noun',
        definition: 'The occurrence of events by chance in a happy way.',
        definitionZh: '意外發現美好事物的能力。',
        example: {
          en: 'Finding this book was pure serendipity.',
          zh: '發現這本書純粹是巧合帶來的驚喜。',
        },
      },
      {
        partOfSpeech: 'noun',
        definition: 'A fortunate happenstance.',
        definitionZh: '幸運的意外。',
        example: {
          en: 'It was serendipity that brought them together.',
          zh: '是命運的巧合讓他們相遇。',
        },
      },
    ],
    synonyms: ['fluke', 'chance'],
    antonyms: ['misfortune'],
    relatedPhrases: [{ en: 'serendipity effect', zh: '巧合效應' }],
    source: 'wiktionary',
  };

  it('assembles a full result with every definition example inline and no separate example section', () => {
    const back = buildAnkiNote(fullyExampled).fields.Back;

    // Each definition's example is inline, directly after its sense text.
    expect(back).toContain(
      '(noun) 意外發現美好事物的能力。 — The occurrence of events by chance in a happy way.' +
        '<br><i>Finding this book was pure serendipity.</i><br>發現這本書純粹是巧合帶來的驚喜。',
    );
    expect(back).toContain(
      '(noun) 幸運的意外。 — A fortunate happenstance.' +
        '<br><i>It was serendipity that brought them together.</i><br>是命運的巧合讓他們相遇。',
    );

    // There is exactly one 釋義 block (the definitions list), not a second
    // block carrying overflow/supplement examples.
    const senseBlockCount = back.split('<b>釋義</b>').length - 1;
    expect(senseBlockCount).toBe(1);

    // No standalone example heading/label/wrapper exists anywhere on the back.
    expect(back).not.toContain('更多例句');
    expect(back).not.toMatch(/<b>例句<\/b>/);
    // Exactly two <i> example sentences total — one per definition, none
    // duplicated into a second section.
    expect(back.match(/<i>/g)?.length).toBe(2);
  });

  it('assembles a partially populated result (some definitions without examples) the same way, still with no separate example section', () => {
    const partial: LookupResult = {
      ...fullyExampled,
      definitions: [
        fullyExampled.definitions[0],
        { ...fullyExampled.definitions[1], example: null },
      ],
      synonyms: [],
      antonyms: [],
      relatedPhrases: [],
    };
    const back = buildAnkiNote(partial).fields.Back;

    // The exampled sense keeps its inline example.
    expect(back).toContain(
      '(noun) 意外發現美好事物的能力。 — The occurrence of events by chance in a happy way.' +
        '<br><i>Finding this book was pure serendipity.</i><br>發現這本書純粹是巧合帶來的驚喜。',
    );
    // The unexampled sense renders with no trailing <br><i> at all.
    expect(back).toContain('(noun) 幸運的意外。 — A fortunate happenstance.</li>');

    expect(back).not.toContain('更多例句');
    expect(back).not.toMatch(/<b>例句<\/b>/);
    const senseBlockCount = back.split('<b>釋義</b>').length - 1;
    expect(senseBlockCount).toBe(1);
    // Only the one example that exists renders, nowhere else.
    expect(back.match(/<i>/g)?.length).toBe(1);
  });
});
