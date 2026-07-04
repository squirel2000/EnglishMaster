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

  function play() {
    if (audioUrl) {
      void new Audio(audioUrl).play();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button type="button" onClick={play} aria-label={`播放 ${text} 的美式發音`}>
      🔊 發音
    </button>
  );
}
