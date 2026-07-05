import type { LookupResult } from '@/lib/types';
import { PronunciationButton } from './PronunciationButton';

interface DictionaryResultProps {
  result: LookupResult;
}

export function DictionaryResult({ result }: DictionaryResultProps) {
  return (
    <section className="entry-card">
      <div className="entry-head">
        <h2 className="headword">{result.term}</h2>
        <div className="entry-audio">
          {result.pronunciation.phonetic && (
            <span className="phonetic">{result.pronunciation.phonetic}</span>
          )}
          <PronunciationButton
            text={result.term}
            audioUrl={result.pronunciation.audioUrl}
          />
        </div>
      </div>
      <hr className="entry-divider" />
      <div className="entry-section">
        <h3 className="eyebrow">釋義</h3>
        <ol className="definitions" role="list">
          {result.definitions.map((entry, index) => (
            <li key={index} className="definition-item">
              <span className="pos-tag">{entry.partOfSpeech}</span>
              {entry.definitionZh ? (
                <span className="definition-text definition-bilingual">
                  <span className="definition-zh" lang="zh-Hant">
                    {entry.definitionZh}
                  </span>
                  <span className="definition-en" lang="en">
                    {entry.definition}
                  </span>
                </span>
              ) : (
                <span className="definition-text" lang="en">
                  {entry.definition}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      {result.examples.length > 0 && (
        <div className="entry-section">
          <h3 className="eyebrow">例句</h3>
          <ul className="examples" role="list">
            {result.examples.map((example) => (
              <li key={example.en} className="example-item">
                <span className="example-en" lang="en">
                  {example.en}
                </span>
                {example.zh && (
                  <span className="example-zh" lang="zh-Hant">
                    {example.zh}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ThesaurusSection label="同義" words={result.synonyms} />
      <ThesaurusSection label="反義" words={result.antonyms} />
    </section>
  );
}

/** Synonym/antonym word chips; renders nothing when the list is empty. */
function ThesaurusSection({ label, words }: { label: string; words: string[] }) {
  if (words.length === 0) return null;
  return (
    <div className="entry-section">
      <h3 className="eyebrow">{label}</h3>
      <ul className="thesaurus-list" role="list">
        {words.map((word) => (
          <li key={word} className="thesaurus-item" lang="en">
            {word}
          </li>
        ))}
      </ul>
    </div>
  );
}
