import type { LookupResult, PhraseEntry } from '@/lib/types';
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
              <span className="definition-body">
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
                {entry.example && (
                  <span className="sense-example">
                    <span className="example-en" lang="en">
                      {entry.example.en}
                    </span>
                    {entry.example.zh && (
                      <span className="example-zh" lang="zh-Hant">
                        {entry.example.zh}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {/* Term-level supplements only; sense examples live inside their own
          definition item above. */}
      {result.examples.length > 0 && (
        <div className="entry-section">
          <h3 className="eyebrow">更多例句</h3>
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
      <WordChipsSection label="同義" words={result.synonyms} />
      <WordChipsSection label="反義" words={result.antonyms} />
      <PhraseChipsSection label="片語" phrases={result.relatedPhrases} />
    </section>
  );
}

/**
 * A labelled row of English word chips (synonyms, antonyms); renders
 * nothing when the list is empty.
 */
function WordChipsSection({ label, words }: { label: string; words: string[] }) {
  if (words.length === 0) return null;
  return (
    <div className="entry-section">
      <h3 className="eyebrow">{label}</h3>
      <ul className="word-chips" role="list">
        {words.map((word) => (
          <li key={word} className="word-chip" lang="en">
            {word}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The related-phrases row: like WordChipsSection, but each chip pairs the
 * English phrase with its Traditional Chinese gloss. A phrase whose gloss
 * is unavailable degrades to a plain English-only chip. Renders nothing
 * when the list is empty.
 */
function PhraseChipsSection({
  label,
  phrases,
}: {
  label: string;
  phrases: PhraseEntry[];
}) {
  if (phrases.length === 0) return null;
  return (
    <div className="entry-section">
      <h3 className="eyebrow">{label}</h3>
      <ul className="word-chips" role="list">
        {phrases.map((phrase) => (
          <li key={phrase.en} className="word-chip phrase-chip">
            <span className="phrase-en" lang="en">
              {phrase.en}
            </span>
            {phrase.zh && (
              <span className="phrase-zh" lang="zh-Hant">
                {phrase.zh}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
