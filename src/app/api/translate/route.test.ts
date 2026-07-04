// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { translateSentence } from '@/lib/translation-api';

vi.mock('@/lib/translation-api');

function makeRequest(query: string) {
  return new Request(
    `http://localhost/api/translate?q=${encodeURIComponent(query)}`,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/translate', () => {
  it('returns the translation as JSON', async () => {
    vi.mocked(translateSentence).mockResolvedValue({
      ok: true,
      result: { original: 'How are you?', translated: '你好嗎？' },
    });
    const res = await GET(makeRequest('How are you?'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      original: 'How are you?',
      translated: '你好嗎？',
    });
  });

  it('returns 400 for a blank query', async () => {
    const res = await GET(makeRequest('  '));
    expect(res.status).toBe(400);
    expect(translateSentence).not.toHaveBeenCalled();
  });

  it('returns 429 when the daily quota is exhausted', async () => {
    vi.mocked(translateSentence).mockResolvedValue({
      ok: false,
      error: 'quota-exhausted',
    });
    const res = await GET(makeRequest('Hello.'));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: 'quota-exhausted' });
  });

  it('returns 502 when the service fails', async () => {
    vi.mocked(translateSentence).mockResolvedValue({
      ok: false,
      error: 'service-unavailable',
    });
    const res = await GET(makeRequest('Hello.'));
    expect(res.status).toBe(502);
  });
});
