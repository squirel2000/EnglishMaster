import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DictionaryResult } from './DictionaryResult';
import type { LookupResult } from '@/lib/types';

const sample: LookupResult = {
  term: 'give up',
  pronunciation: { audioUrl: 'https://example.com/a-us.mp3', phonetic: '/ɡɪv ʌp/' },
  definitions: [
    { partOfSpeech: 'verb', definition: 'To surrender.', definitionZh: '放棄。' },
    { partOfSpeech: 'verb', definition: 'To stop or quit.', definitionZh: null },
  ],
  examples: [
    { en: 'They gave up the search.', zh: '他們放棄了搜尋。' },
    { en: 'Never give up hope.', zh: null },
  ],
  synonyms: ['surrender', 'quit', 'abandon'],
  antonyms: ['persist', 'continue'],
  relatedPhrases: ['give in', 'give up the ghost', 'give away'],
  source: 'free-dictionary',
};

describe('DictionaryResult', () => {
  it('renders term, phonetic, definitions with part of speech, and examples', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByRole('heading', { name: 'give up' })).toBeInTheDocument();
    expect(screen.getByText('/ɡɪv ʌp/')).toBeInTheDocument();
    expect(screen.getByText('To surrender.')).toBeInTheDocument();
    expect(screen.getAllByText('verb').length).toBeGreaterThan(0);
    expect(screen.getByText('They gave up the search.')).toBeInTheDocument();
    expect(screen.getByText('Never give up hope.')).toBeInTheDocument();
  });

  it('shows the Chinese translation as the primary line with the English original alongside', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('放棄。').closest('li');
    expect(item).not.toBeNull();
    const zh = item!.querySelector('.definition-zh');
    const en = item!.querySelector('.definition-en');
    expect(zh).toHaveTextContent('放棄。');
    expect(en).toHaveTextContent('To surrender.');
    // Chinese leads the reading order; English follows as the reference line.
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

  it('omits the examples section when there are no examples', () => {
    render(<DictionaryResult result={{ ...sample, examples: [] }} />);
    expect(screen.queryByText('例句')).not.toBeInTheDocument();
  });

  it('shows each example as the English original with the Chinese translation beneath', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('They gave up the search.').closest('li');
    expect(item).not.toBeNull();
    const en = item!.querySelector('.example-en');
    const zh = item!.querySelector('.example-zh');
    expect(en).toHaveTextContent('They gave up the search.');
    expect(zh).toHaveTextContent('他們放棄了搜尋。');
    // The English original leads; the Chinese aid follows.
    expect(
      en!.compareDocumentPosition(zh!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('falls back to English-only for an example without a Chinese translation', () => {
    render(<DictionaryResult result={sample} />);
    const item = screen.getByText('Never give up hope.').closest('li');
    expect(item).not.toBeNull();
    expect(item!.querySelector('.example-zh')).toBeNull();
  });

  it('renders synonym and antonym sections after the examples', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByText('同義')).toBeInTheDocument();
    expect(screen.getByText('反義')).toBeInTheDocument();
    for (const word of ['surrender', 'quit', 'abandon', 'persist', 'continue']) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
    // Card order: examples first, then synonyms, then antonyms.
    const examplesHeading = screen.getByText('例句');
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

  it('tags English and Chinese lines with lang attributes', () => {
    render(<DictionaryResult result={sample} />);
    // Definitions: bilingual pair plus the English-only fallback.
    expect(screen.getByText('To surrender.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('放棄。')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('To stop or quit.')).toHaveAttribute('lang', 'en');
    // Examples: bilingual pair plus the English-only fallback.
    expect(screen.getByText('They gave up the search.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('他們放棄了搜尋。')).toHaveAttribute('lang', 'zh-Hant');
    expect(screen.getByText('Never give up hope.')).toHaveAttribute('lang', 'en');
  });
});
