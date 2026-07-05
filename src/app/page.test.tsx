import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './page';
import type { LookupResult } from '@/lib/types';

const lookupBody: LookupResult = {
  term: 'hello',
  pronunciation: { audioUrl: null, phonetic: '/həˈloʊ/' },
  definitions: [{ partOfSpeech: 'noun', definition: 'A greeting.' }],
  examples: ['Hello, everyone.', 'Hello? Is anyone there?'],
  source: 'free-dictionary',
};

function stubFetchRoutes(routes: Record<string, { status: number; body: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const match = Object.entries(routes).find(([prefix]) =>
        url.startsWith(prefix),
      );
      if (!match) throw new Error(`unexpected fetch: ${url}`);
      const { status, body } = match[1];
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Home page', () => {
  it('routes a word to dictionary lookup and shows the result', async () => {
    stubFetchRoutes({ '/api/lookup': { status: 200, body: lookupBody } });
    render(<Home />);
    await userEvent.type(screen.getByRole('textbox'), 'hello{enter}');
    expect(await screen.findByRole('heading', { name: 'hello' })).toBeInTheDocument();
    expect(screen.getByText('A greeting.')).toBeInTheDocument();
  });

  it('routes a sentence to translation and shows the result', async () => {
    stubFetchRoutes({
      '/api/translate': {
        status: 200,
        body: { original: 'How are you doing today?', translated: '您今天好嗎？' },
      },
    });
    render(<Home />);
    await userEvent.type(
      screen.getByRole('textbox'),
      'How are you doing today?{enter}',
    );
    expect(await screen.findByText('您今天好嗎？')).toBeInTheDocument();
  });

  it('shows the not-found message with a switch suggestion', async () => {
    stubFetchRoutes({
      '/api/lookup': { status: 404, body: { error: 'not-found' } },
    });
    render(<Home />);
    await userEvent.type(screen.getByRole('textbox'), 'zzzzzz{enter}');
    expect(
      await screen.findByText('找不到這個字詞，建議改用整句翻譯'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '改用整句翻譯' }),
    ).toBeInTheDocument();
  });

  it('switches a dictionary result to sentence translation on demand', async () => {
    stubFetchRoutes({
      '/api/lookup': { status: 200, body: lookupBody },
      '/api/translate': {
        status: 200,
        body: { original: 'hello', translated: '你好' },
      },
    });
    render(<Home />);
    await userEvent.type(screen.getByRole('textbox'), 'hello{enter}');
    await screen.findByRole('heading', { name: 'hello' });
    await userEvent.click(screen.getByRole('button', { name: '改用整句翻譯' }));
    expect(await screen.findByText('你好')).toBeInTheDocument();
  });

  it('shows the quota message when translation quota is exhausted', async () => {
    stubFetchRoutes({
      '/api/translate': { status: 429, body: { error: 'quota-exhausted' } },
    });
    render(<Home />);
    await userEvent.type(
      screen.getByRole('textbox'),
      'This is a long sentence for translation.{enter}',
    );
    expect(
      await screen.findByText('今日翻譯額度已用完，請明天再試'),
    ).toBeInTheDocument();
  });

  it('shows the service-unavailable message on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<Home />);
    await userEvent.type(screen.getByRole('textbox'), 'hello{enter}');
    expect(
      await screen.findByText('查詢服務暫時無法使用，請稍後再試'),
    ).toBeInTheDocument();
  });

  it('keeps sentence pronunciation available when translation fails', async () => {
    vi.stubGlobal('speechSynthesis', { speak: vi.fn() });
    stubFetchRoutes({
      '/api/translate': { status: 502, body: { error: 'service-unavailable' } },
    });
    render(<Home />);
    await userEvent.type(
      screen.getByRole('textbox'),
      'This sentence will fail to translate.{enter}',
    );
    await screen.findByText('查詢服務暫時無法使用，請稍後再試');
    expect(screen.getByRole('button', { name: /的美式發音/ })).toBeInTheDocument();
  });

  it('ignores stale responses when a newer search supersedes the first', async () => {
    // Deferred promises: first query resolves AFTER the second.
    let resolveFirst!: (v: Response) => void;
    let resolveSecond!: (v: Response) => void;
    const firstPromise = new Promise<Response>((res) => { resolveFirst = res; });
    const secondPromise = new Promise<Response>((res) => { resolveSecond = res; });

    const firstBody: LookupResult = {
      term: 'first',
      pronunciation: { audioUrl: null, phonetic: '/fɜːst/' },
      definitions: [{ partOfSpeech: 'noun', definition: 'First result.' }],
      examples: [],
      source: 'free-dictionary',
    };
    const secondBody: LookupResult = {
      term: 'second',
      pronunciation: { audioUrl: null, phonetic: '/ˈsɛkənd/' },
      definitions: [{ partOfSpeech: 'noun', definition: 'Second result.' }],
      examples: [],
      source: 'free-dictionary',
    };

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('first')) {
        return firstPromise;
      }
      if (url.includes('second')) {
        return secondPromise;
      }
      throw new Error(`unexpected fetch: ${url}`);
    }));

    render(<Home />);
    const textbox = screen.getByRole('textbox');

    // Fire first search for "first" (word).
    await userEvent.type(textbox, 'first{enter}');
    // Clear and fire second search for "second" (word) before first resolves.
    await userEvent.clear(textbox);
    await userEvent.type(textbox, 'second{enter}');

    // Resolve the SECOND search first so the UI shows "second".
    resolveSecond(new Response(JSON.stringify(secondBody), { status: 200 }));
    expect(await screen.findByRole('heading', { name: 'second' })).toBeInTheDocument();

    // Now resolve the FIRST (stale) search. The stale guard must discard it.
    resolveFirst(new Response(JSON.stringify(firstBody), { status: 200 }));

    // Give React a tick to process any state update that should NOT happen.
    await new Promise((r) => setTimeout(r, 50));

    // The UI must still show "second", not "first".
    expect(screen.getByRole('heading', { name: 'second' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'first' })).not.toBeInTheDocument();
  });
});
