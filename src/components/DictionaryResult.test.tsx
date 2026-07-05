import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DictionaryResult } from './DictionaryResult';
import type { LookupResult } from '@/lib/types';

const sample: LookupResult = {
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
  // Term-level supplements (更多例句), never attributed to a sense.
  examples: [
    { en: 'Never give up hope.', zh: '永不放棄希望。' },
    { en: 'Do not give up now.', zh: null },
  ],
  synonyms: ['surrender', 'quit', 'abandon'],
  antonyms: ['persist', 'continue'],
  relatedPhrases: [
    { en: 'give in', zh: '讓步' },
    // No gloss: the chip must fall back to English-only.
    { en: 'give up the ghost', zh: null },
    { en: 'give away', zh: '贈送' },
  ],
  source: 'free-dictionary',
};

describe('DictionaryResult', () => {
  it('renders term, phonetic, definitions with part of speech, sense examples, and supplements', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByRole('heading', { name: 'give up' })).toBeInTheDocument();
    expect(screen.getByText('/ɡɪv ʌp/')).toBeInTheDocument();
    expect(screen.getByText('To surrender.')).toBeInTheDocument();
    expect(screen.getAllByText('verb').length).toBeGreaterThan(0);
    expect(screen.getByText('They gave up the search.')).toBeInTheDocument();
    expect(screen.getByText('Never give up hope.')).toBeInTheDocument();
  });

  it('shows the Chinese translation as the primary text with the English original alongside', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('放棄。').closest('li');
    expect(item).not.toBeNull();
    const zh = item!.querySelector('.definition-zh');
    const en = item!.querySelector('.definition-en');
    expect(zh).toHaveTextContent('放棄。');
    expect(en).toHaveTextContent('To surrender.');
    // Chinese leads the reading order; English follows immediately after,
    // inside the same definition line.
    expect(zh!.parentElement).toBe(en!.parentElement);
    expect(
      zh!.compareDocumentPosition(en!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('falls back to English-only when a definition has no Chinese translation', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('To stop or quit.').closest('li');
    expect(item).not.toBeNull();
    expect(item!.querySelector('.definition-zh')).toBeNull();
    expect(item!.querySelector('.definition-en')).toBeNull();
    expect(screen.getByText('To stop or quit.')).toBeInTheDocument();
  });

  it('renders the sense example inside its own definition item, after the definition line', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('放棄。').closest('li');
    expect(item).not.toBeNull();
    const en = item!.querySelector('.example-en');
    const zh = item!.querySelector('.example-zh');
    expect(en).toHaveTextContent('They gave up the search.');
    expect(zh).toHaveTextContent('他們放棄了搜尋。');
    // The definition line leads; the sense example follows beneath it, the
    // English original first and the Chinese aid after.
    const definitionLine = item!.querySelector('.definition-zh');
    expect(
      definitionLine!.compareDocumentPosition(en!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      en!.compareDocumentPosition(zh!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders no example line for a sense without an attributed example', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('To stop or quit.').closest('li');
    expect(item).not.toBeNull();
    expect(item!.querySelector('.sense-example')).toBeNull();
    expect(item!.querySelector('.example-en')).toBeNull();
  });

  it('falls back to English-only for a sense example without a Chinese translation', () => {
    const enOnlyExample: LookupResult = {
      ...sample,
      definitions: [
        {
          ...sample.definitions[0],
          example: { en: 'They gave up the search.', zh: null },
        },
      ],
    };
    render(<DictionaryResult result={enOnlyExample} />);
    const item = screen.getByText('放棄。').closest('li');
    expect(item!.querySelector('.example-en')).toHaveTextContent(
      'They gave up the search.',
    );
    expect(item!.querySelector('.example-zh')).toBeNull();
  });

  it('renders a pronunciation button wired to the audio URL', () => {
    render(<DictionaryResult result={sample} />);
    expect(
      screen.getByRole('button', { name: /播放 give up 的美式發音/ }),
    ).toBeInTheDocument();
  });

  it('omits the phonetic line when absent', () => {
    render(
      <DictionaryResult
        result={{ ...sample, pronunciation: { audioUrl: null, phonetic: null } }}
      />,
    );
    expect(screen.queryByText(/^\//)).not.toBeInTheDocument();
  });

  it('shows supplemental examples under a 更多例句 heading', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByText('更多例句')).toBeInTheDocument();
    expect(screen.getByText('Never give up hope.')).toBeInTheDocument();
    expect(screen.getByText('Do not give up now.')).toBeInTheDocument();
  });

  it('omits the 更多例句 section when there are no supplements, keeping sense examples', () => {
    render(<DictionaryResult result={{ ...sample, examples: [] }} />);
    expect(screen.queryByText('更多例句')).not.toBeInTheDocument();
    // The sense example belongs to its definition and stays visible.
    expect(screen.getByText('They gave up the search.')).toBeInTheDocument();
  });

  it('shows each supplement as the English original with the Chinese translation beneath', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('Never give up hope.').closest('li');
    expect(item).not.toBeNull();
    const en = item!.querySelector('.example-en');
    const zh = item!.querySelector('.example-zh');
    expect(en).toHaveTextContent('Never give up hope.');
    expect(zh).toHaveTextContent('永不放棄希望。');
    // The English original leads; the Chinese aid follows.
    expect(
      en!.compareDocumentPosition(zh!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('falls back to English-only for a supplement without a Chinese translation', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('Do not give up now.').closest('li');
    expect(item).not.toBeNull();
    expect(item!.querySelector('.example-zh')).toBeNull();
  });

  it('renders synonym and antonym sections after the supplemental examples', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByText('同義')).toBeInTheDocument();
    expect(screen.getByText('反義')).toBeInTheDocument();
    for (const word of ['surrender', 'quit', 'abandon', 'persist', 'continue']) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
    // Card order: supplements first, then synonyms, then antonyms.
    const examplesHeading = screen.getByText('更多例句');
    const synonymsHeading = screen.getByText('同義');
    const antonymsHeading = screen.getByText('反義');
    expect(
      examplesHeading.compareDocumentPosition(synonymsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      synonymsHeading.compareDocumentPosition(antonymsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('tags synonym and antonym words as English', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByText('surrender')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('persist')).toHaveAttribute('lang', 'en');
  });

  it('omits the synonyms section when the list is empty', () => {
    render(<DictionaryResult result={{ ...sample, synonyms: [] }} />);
    expect(screen.queryByText('同義')).not.toBeInTheDocument();
    // The antonyms section is guarded independently and stays visible.
    expect(screen.getByText('反義')).toBeInTheDocument();
  });

  it('omits the antonyms section when the list is empty', () => {
    render(<DictionaryResult result={{ ...sample, antonyms: [] }} />);
    expect(screen.queryByText('反義')).not.toBeInTheDocument();
    expect(screen.getByText('同義')).toBeInTheDocument();
  });

  it('renders the related-phrases section last, after the antonyms', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByText('片語')).toBeInTheDocument();
    for (const phrase of ['give in', 'give up the ghost', 'give away']) {
      expect(screen.getByText(phrase)).toBeInTheDocument();
    }
    expect(screen.getByText('give up the ghost')).toHaveAttribute('lang', 'en');
    // Card order ends: ...antonyms, then related phrases.
    const antonymsHeading = screen.getByText('反義');
    const phrasesHeading = screen.getByText('片語');
    expect(
      antonymsHeading.compareDocumentPosition(phrasesHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('omits the related-phrases section when the list is empty', () => {
    render(<DictionaryResult result={{ ...sample, relatedPhrases: [] }} />);
    expect(screen.queryByText('片語')).not.toBeInTheDocument();
    // Neighboring sections are guarded independently and stay visible.
    expect(screen.getByText('同義')).toBeInTheDocument();
    expect(screen.getByText('反義')).toBeInTheDocument();
  });

  it('pairs each related phrase with its Traditional Chinese gloss inside the chip', () => {
    render(<DictionaryResult result={sample} />);
    const chip = screen.getByText('give in').closest('li');
    expect(chip).not.toBeNull();
    const en = chip!.querySelector('.phrase-en');
    const zh = chip!.querySelector('.phrase-zh');
    expect(en).toHaveTextContent('give in');
    expect(zh).toHaveTextContent('讓步');
    expect(en).toHaveAttribute('lang', 'en');
    expect(zh).toHaveAttribute('lang', 'zh-Hant');
    // The English phrase leads; its gloss follows within the same chip.
    expect(
      en!.compareDocumentPosition(zh!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('falls back to an English-only chip for a phrase without a gloss', () => {
    render(<DictionaryResult result={sample} />);
    const chip = screen.getByText('give up the ghost').closest('li');
    expect(chip).not.toBeNull();
    expect(chip!.querySelector('.phrase-zh')).toBeNull();
    // Bilingual neighbors are unaffected by this chip's degradation.
    expect(screen.getByText('讓步')).toBeInTheDocument();
    expect(screen.getByText('贈送')).toBeInTheDocument();
  });

  it('tags English and Chinese lines with lang attributes', () => {
    render(<DictionaryResult result={sample} />);
    // Definitions: bilingual pair plus the English-only fallback.
    expect(screen.getByText('To surrender.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('放棄。')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('To stop or quit.')).toHaveAttribute('lang', 'en');
    // Sense example: bilingual pair.
    expect(screen.getByText('They gave up the search.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('他們放棄了搜尋。')).toHaveAttribute('lang', 'zh-Hant');
    // Supplements: bilingual pair plus the English-only fallback.
    expect(screen.getByText('Never give up hope.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('永不放棄希望。')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('Do not give up now.')).toHaveAttribute('lang', 'en');
  });
});
