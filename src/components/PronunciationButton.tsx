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
    <button type="button" onClick={play} aria-label={`播放 ${text} 的美式發音`}>
      🔊 發音
    </button>
  );
}
