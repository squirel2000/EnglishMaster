'use client';

import { useRef, useState } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { DictionaryResult } from '@/components/DictionaryResult';
import { TranslationResultView } from '@/components/TranslationResultView';
import { PronunciationButton } from '@/components/PronunciationButton';
import { classifyQuery } from '@/lib/classify-query';
import type { LookupResult, TranslationResult } from '@/lib/types';

type Mode = 'dictionary' | 'sentence';

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
    setState({ status: 'loading' });
    try {
      if (mode === 'dictionary') {
        const res = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);
        if (requestId !== requestIdRef.current) return;
        if (res.ok) {
          const result = (await res.json()) as LookupResult;
          if (requestId !== requestIdRef.current) return;
          setState({ status: 'dictionary', query, result });
        } else {
          const message =
            res.status === 404 ? MESSAGES.notFound : MESSAGES.serviceUnavailable;
          if (requestId !== requestIdRef.current) return;
          setState({ status: 'error', query, mode, message });
        }
      } else {
        const res = await fetch(`/api/translate?q=${encodeURIComponent(query)}`);
        if (requestId !== requestIdRef.current) return;
        if (res.ok) {
          const result = (await res.json()) as TranslationResult;
          if (requestId !== requestIdRef.current) return;
          setState({ status: 'sentence', query, result });
        } else {
          const message =
            res.status === 429 ? MESSAGES.quotaExhausted : MESSAGES.serviceUnavailable;
          if (requestId !== requestIdRef.current) return;
          setState({ status: 'error', query, mode, message });
        }
      }
    } catch {
      if (requestId !== requestIdRef.current) return;
      setState({ status: 'error', query, mode, message: MESSAGES.serviceUnavailable });
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
    <main>
      <h1>EnglishMaster</h1>
      <SearchBox onSearch={(query) => void runSearch(query)} />
      {state.status === 'loading' && <p>查詢中…</p>}
      {state.status === 'dictionary' && (
        <>
          <DictionaryResult result={state.result} />
          {switchButton(state.query, 'dictionary')}
        </>
      )}
      {state.status === 'sentence' && (
        <>
          <TranslationResultView result={state.result} />
          {switchButton(state.query, 'sentence')}
        </>
      )}
      {state.status === 'error' && (
        <>
          <p role="alert">{state.message}</p>
          {state.mode === 'sentence' && (
            /* Spec: translation failure must not disable sentence pronunciation. */
            <PronunciationButton text={state.query} audioUrl={null} />
          )}
          {switchButton(state.query, state.mode)}
        </>
      )}
    </main>
  );
}
