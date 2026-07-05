import type { LookupResult } from '@/lib/types';
import { PronunciationButton } from './PronunciationButton';

interface DictionaryResultProps {
  result: LookupResult;
}

export function DictionaryResult({ result }: DictionaryResultProps) {
  return (
    <section>
      <h2>{result.term}</h2>
      {result.pronunciation.phonetic && <p>{result.pronunciation.phonetic}</p>}
      <PronunciationButton
        text={result.term}
        audioUrl={result.pronunciation.audioUrl}
      />
      <h3>釋義</h3>
      <ol>
        {result.definitions.map((entry, index) => (
          <li key={index}>
            <em>{entry.partOfSpeech}</em> {entry.definition}
          </li>
        ))}
      </ol>
      {result.examples.length > 0 && (
        <>
          <h3>例句</h3>
          <ul>
            {result.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
