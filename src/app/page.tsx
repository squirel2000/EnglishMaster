'use client';

import { useRef, useState } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { DictionaryResult } from '@/components/DictionaryResult';
import { TranslationResultView } from '@/components/TranslationResultView';
import { PronunciationButton } from '@/components/PronunciationButton';
import { classifyQuery } from '@/lib/classify-query';
import type { LookupResult, TranslationResult } from '@/lib/types';

type Mode = 'dictionary' | 'sentence';

const EXAMPLES = ['give up', 'break the ice', 'How are you doing today?'];

type ViewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'dictionary'; query: string; result: LookupResult }
  | { status: 'sentence'; query: string; result: TranslationResult }
  | { status: 'error'; query: string; mode: Mode; message: string };

const MESSAGES = {
  serviceUnavailable: '查詢服務暫時無法使用，請稍後再試',
  notFound: '找不到這個字詞，建議改用整句翻譯',
  quotaExhausted: '今日翻譯額度已用完，請明天再試',
} as const;

export default function Home() {
  const [state, setState] = useState<ViewState>({ status: 'idle' });
  const requestIdRef = useRef(0);

  async function runSearch(query: string, forcedMode?: Mode) {
    const mode: Mode =
      forcedMode ?? (classifyQuery(query) === 'sentence' ? 'sentence' : 'dictionary');
    const requestId = ++requestIdRef.current;
    // Drop any response that finishes after a newer search has started.
    const setIfCurrent = (next: ViewState) => {
      if (requestId === requestIdRef.current) setState(next);
    };
    setState({ status: 'loading' });
    try {
      if (mode === 'dictionary') {
        const res = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const result = (await res.json()) as LookupResult;
          setIfCurrent({ status: 'dictionary', query, result });
        } else {
          const message =
            res.status === 404 ? MESSAGES.notFound : MESSAGES.serviceUnavailable;
          setIfCurrent({ status: 'error', query, mode, message });
        }
      } else {
        const res = await fetch(`/api/translate?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const result = (await res.json()) as TranslationResult;
          setIfCurrent({ status: 'sentence', query, result });
        } else {
          const message =
            res.status === 429 ? MESSAGES.quotaExhausted : MESSAGES.serviceUnavailable;
          setIfCurrent({ status: 'error', query, mode, message });
        }
      }
    } catch {
      setIfCurrent({ status: 'error', query, mode, message: MESSAGES.serviceUnavailable });
    }
  }

  function switchButton(query: string, currentMode: Mode) {
    return currentMode === 'dictionary' ? (
      <button type="button" onClick={() => runSearch(query, 'sentence')}>
        改用整句翻譯
      </button>
    ) : (
      <button type="button" onClick={() => runSearch(query, 'dictionary')}>
        改查字典
      </button>
    );
  }

  return (
    <div className="page">
      <header className="site-header">
        <h1 className="wordmark">EnglishMaster</h1>
        <p className="tagline">查字，也查懂它怎麼用。</p>
      </header>
      <main className="content">
        <SearchBox onSearch={(query) => void runSearch(query)} />
        <div className="results" aria-live="polite">
          {state.status === 'idle' && (
            <div className="state-idle">
              <p>還沒查過任何東西，試試看：</p>
              <div className="example-row">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="example-chip"
                    onClick={() => runSearch(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
          {state.status === 'loading' && (
            <p className="state-loading">
              <span className="spinner" aria-hidden="true" />
              查詢中…
            </p>
          )}
          {state.status === 'dictionary' && (
            <div className="result-block">
              <DictionaryResult result={state.result} />
              <div className="switch-row">{switchButton(state.query, 'dictionary')}</div>
            </div>
          )}
          {state.status === 'sentence' && (
            <div className="result-block">
              <TranslationResultView result={state.result} />
              <div className="switch-row">{switchButton(state.query, 'sentence')}</div>
            </div>
          )}
          {state.status === 'error' && (
            <div className="result-block">
              <p role="alert" className="error-banner">
                {state.message}
              </p>
              {state.mode === 'sentence' && (
                /* Spec: translation failure must not disable sentence pronunciation. */
                <PronunciationButton text={state.query} audioUrl={null} />
              )}
              <div className="switch-row">{switchButton(state.query, state.mode)}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
