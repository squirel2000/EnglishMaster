import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranslationResultView } from './TranslationResultView';
import type { TranslationResult } from '@/lib/types';

const sample: TranslationResult = {
  original: 'How are you doing today?',
  translated: '您今天好嗎？',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TranslationResultView', () => {
  it('renders the original sentence and its translation', () => {
    render(<TranslationResultView result={sample} />);
    expect(screen.getByText('How are you doing today?')).toBeInTheDocument();
    expect(screen.getByText('您今天好嗎？')).toBeInTheDocument();
  });

  it('offers TTS pronunciation of the original sentence when supported', () => {
    vi.stubGlobal('speechSynthesis', { speak: vi.fn() });
    render(<TranslationResultView result={sample} />);
    expect(
      screen.getByRole('button', {
        name: /播放 How are you doing today\? 的美式發音/,
      }),
    ).toBeInTheDocument();
  });

  it('still shows the translation when TTS is unsupported', () => {
    // jsdom has no speechSynthesis: the button hides, content remains.
    render(<TranslationResultView result={sample} />);
    expect(screen.getByText('您今天好嗎？')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
