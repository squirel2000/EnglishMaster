import type { TranslationResult } from '@/lib/types';
import { PronunciationButton } from './PronunciationButton';

interface TranslationResultViewProps {
  result: TranslationResult;
}

export function TranslationResultView({ result }: TranslationResultViewProps) {
  return (
    <section>
      <h2>整句翻譯</h2>
      <p lang="en">{result.original}</p>
      <PronunciationButton text={result.original} audioUrl={null} />
      <p lang="zh-Hant">{result.translated}</p>
    </section>
  );
}
