import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PronunciationButton } from './PronunciationButton';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubSpeechSynthesis() {
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      lang = '';
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  return speak;
}

describe('PronunciationButton', () => {
  it('plays the audio file when audioUrl is provided', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'Audio').mockImplementation(
      function() { return { play } as unknown as HTMLAudioElement; },
    );
    render(
      <PronunciationButton text="hello" audioUrl="https://example.com/hello-us.mp3" />,
    );
    await userEvent.click(screen.getByRole('button', { name: /發音/ }));
    expect(window.Audio).toHaveBeenCalledWith('https://example.com/hello-us.mp3');
    expect(play).toHaveBeenCalled();
  });

  it('falls back to en-US speech synthesis when there is no audio file', async () => {
    const speak = stubSpeechSynthesis();
    render(<PronunciationButton text="give up" audioUrl={null} />);
    await userEvent.click(screen.getByRole('button', { name: /發音/ }));
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as { text: string; lang: string };
    expect(utterance.text).toBe('give up');
    expect(utterance.lang).toBe('en-US');
  });

  it('renders nothing when no audio and no speech synthesis support', () => {
    // jsdom has no speechSynthesis by default.
    const { container } = render(
      <PronunciationButton text="hello" audioUrl={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not play anything before the user clicks', () => {
    const speak = stubSpeechSynthesis();
    render(<PronunciationButton text="hello" audioUrl={null} />);
    expect(speak).not.toHaveBeenCalled();
  });
});
