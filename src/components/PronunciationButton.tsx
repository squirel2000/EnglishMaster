'use client';

interface PronunciationButtonProps {
  /** English text to pronounce (word, phrase, or sentence). */
  text: string;
  /** URL of a US recording; falls back to speech synthesis when absent. */
  audioUrl?: string | null;
}

function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function PronunciationButton({ text, audioUrl }: PronunciationButtonProps) {
  const canSpeak = ttsAvailable();
  if (!audioUrl && !canSpeak) return null;

  function speakWithTts() {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  function play() {
    if (audioUrl) {
      new Audio(audioUrl).play().catch(() => {
        if (canSpeak) speakWithTts();
      });
      return;
    }
    speakWithTts();
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`播放 ${text} 的美式發音`}
      className="pron-btn"
    >
      <svg
        className="pron-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M4 9v6h3.5l4.5 4V5l-4.5 4H4z"
          fill="currentColor"
          stroke="none"
        />
        <path
          d="M15.8 8.7a5 5 0 0 1 0 6.6"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M18.3 6.2a8.5 8.5 0 0 1 0 11.6"
          strokeWidth="1.7"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      發音
    </button>
  );
}
