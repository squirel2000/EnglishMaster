import type { TranslationResult } from '@/lib/types';
import { PronunciationButton } from './PronunciationButton';

interface TranslationResultViewProps {
  result: TranslationResult;
}

export function TranslationResultView({ result }: TranslationResultViewProps) {
  return (
    <section className="sentence-card">
      <div className="sentence-head">
        <div className="entry-section">
          <h3 className="eyebrow">原句</h3>
          <h2 className="sentence-original" lang="en">
            {result.original}
          </h2>
        </div>
        <PronunciationButton text={result.original} audioUrl={null} />
      </div>
      <hr className="entry-divider" />
      <div className="entry-section">
        <h3 className="eyebrow">中文翻譯</h3>
        <p className="sentence-translation" lang="zh-Hant">
          {result.translated}
        </p>
      </div>
    </section>
  );
}
