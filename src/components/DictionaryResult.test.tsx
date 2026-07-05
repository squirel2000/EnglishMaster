import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DictionaryResult } from './DictionaryResult';
import type { LookupResult } from '@/lib/types';

const sample: LookupResult = {
  term: 'give up',
  pronunciation: { audioUrl: 'https://example.com/a-us.mp3', phonetic: '/ɡɪv ʌp/' },
  definitions: [
    { partOfSpeech: 'verb', definition: 'To surrender.' },
    { partOfSpeech: 'verb', definition: 'To stop or quit.' },
  ],
  examples: ['They gave up the search.', 'Never give up hope.'],
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
});
