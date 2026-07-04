# 查詢功能（add-dictionary-lookup）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 EnglishMaster 第一個功能 — 查詢英文單字/片語/整句，回傳釋義、繁中翻譯、2-3 個例句與美式發音，全部使用免費無 key 的外部 API。

**Architecture:** Next.js（App Router）前端 + Route Handlers 代理層。外部 API（Free Dictionary、Wiktionary、Tatoeba、MyMemory）只在伺服器端服務層呼叫，正規化成內部型別後回傳前端；發音在瀏覽器端以音檔優先、Web Speech API（en-US）備援。

**Tech Stack:** TypeScript（strict）、Next.js（App Router）、React、Vitest + React Testing Library、ESLint + Prettier。

## Global Constraints

- 只用免費、無需 API key 的外部服務：`api.dictionaryapi.dev`、`en.wiktionary.org/api/rest_v1`、`api.tatoeba.org/unstable`、`api.mymemory.translated.net`
- 每個外部 API 呼叫逾時 **8000ms**（`AbortSignal.timeout(8000)`）
- TypeScript strict mode；import alias `@/*` 指向 `src/`
- 程式碼、註解、識別字、commit message 一律英文；UI 文案與文件一律繁體中文
- Conventional Commits（feat:/fix:/test:/chore:/docs:）
- TDD：每個任務先寫失敗測試，再實作；測試檔與原始碼同目錄（`*.test.ts` / `*.test.tsx`）
- 元件檔 PascalCase.tsx，其他檔案 kebab-case
- UI 錯誤文案（一字不差）：
  - 服務失敗：「查詢服務暫時無法使用，請稍後再試」
  - 查無結果：「找不到這個字詞，建議改用整句翻譯」
  - 翻譯額度：「今日翻譯額度已用完，請明天再試」
  - 空白輸入：「請輸入要查詢的內容」
- 聲音一律由使用者點擊觸發，不自動播放

## File Structure

```
src/
  app/
    page.tsx                       — 查詢頁（client component 狀態機）
    api/lookup/route.ts            — GET /api/lookup?q=  字典查詢代理
    api/translate/route.ts         — GET /api/translate?q=  翻譯代理
  components/
    SearchBox.tsx                  — 查詢輸入框（空白輸入提示）
    DictionaryResult.tsx           — 釋義、音標、例句呈現
    TranslationResultView.tsx      — 原句 + 繁中譯文呈現
    PronunciationButton.tsx        — 發音按鈕（音檔優先、TTS 備援、不支援隱藏）
  lib/
    types.ts                       — 內部共用型別
    classify-query.ts              — 輸入類型判斷
    dictionary-api.ts              — Free Dictionary API client + 正規化
    wiktionary-api.ts              — Wiktionary client + HTML 清洗
    tatoeba-api.ts                 — Tatoeba 例句補充 client
    lookup-service.ts              — 備援鏈 + 例句數量保證
    translation-api.ts             — MyMemory client
    __fixtures__/                  — 外部 API 回應 fixture（JSON）
```

測試檔與上述原始碼同目錄（如 `src/lib/classify-query.test.ts`）。

---

### Task 1: 專案初始化與測試管線

**Files:**
- Create: 整個 Next.js 骨架（`create-next-app`）、`vitest.config.ts`、`vitest.setup.ts`、`.prettierrc`
- Modify: `package.json`（scripts）、`.gitignore`（репo 現有的是空檔，直接以 Next.js 版本取代）
- Test: `src/smoke.test.tsx`

**Interfaces:**
- Consumes: 無
- Produces: 可運作的 `npm run dev` / `npm run test` / `npm run lint` / `npm run build` 管線；後續所有任務都依賴此管線

- [ ] **Step 1: 建立 feature branch**

```bash
cd /home/asus-4070/Gits/miscellaneous_repo/EnglishMaster
git checkout -b feature/add-dictionary-lookup
```

- [ ] **Step 2: 在暫存目錄 scaffold 再搬回（repo 已有 openspec/ 等目錄，create-next-app 不接受非空目錄）**

```bash
cd /tmp
npx create-next-app@latest englishmaster-scaffold \
  --typescript --eslint --app --src-dir --no-tailwind \
  --import-alias "@/*" --use-npm --yes
cd /home/asus-4070/Gits/miscellaneous_repo/EnglishMaster
rm .gitignore   # 現有為 0 byte 空檔，以 scaffold 版本取代
cp -rn /tmp/englishmaster-scaffold/. .
rm -rf /tmp/englishmaster-scaffold
npm install
```

- [ ] **Step 3: 確認 dev server 可啟動**

```bash
npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
kill %1
```
Expected: `200`

- [ ] **Step 4: 安裝測試相依並建立 Vitest 設定**

```bash
npm i -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  prettier eslint-config-prettier
```

建立 `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

建立 `vitest.setup.ts`：

```ts
import '@testing-library/jest-dom/vitest';
```

建立 `.prettierrc`：

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all"
}
```

在 `package.json` 的 `scripts` 加入：

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "format": "prettier --write ."
}
```

- [ ] **Step 5: 寫冒煙測試確認 RTL + jsdom 管線可跑**

建立 `src/smoke.test.tsx`：

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('test pipeline smoke test', () => {
  it('renders a component in jsdom', () => {
    render(<p>pipeline works</p>);
    expect(screen.getByText('pipeline works')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 執行測試與 lint 確認通過**

```bash
npm run test
npm run lint
```
Expected: 測試 `1 passed`，lint 無 error

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Vitest test pipeline"
```

---

### Task 2: 內部型別與輸入分類 classifyQuery

**Files:**
- Create: `src/lib/types.ts`、`src/lib/classify-query.ts`
- Test: `src/lib/classify-query.test.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  - `types.ts`：`Pronunciation { audioUrl: string | null; phonetic: string | null }`、`DefinitionEntry { partOfSpeech: string; definition: string }`、`LookupResult { term: string; pronunciation: Pronunciation; definitions: DefinitionEntry[]; examples: string[]; source: 'free-dictionary' | 'wiktionary' }`、`TranslationResult { original: string; translated: string }`、`QueryKind = 'dictionary' | 'sentence' | 'empty'`、`LookupErrorCode = 'not-found' | 'service-unavailable'`、`TranslateErrorCode = 'quota-exhausted' | 'service-unavailable'`
  - `classifyQuery(input: string): QueryKind`

- [ ] **Step 1: 建立型別檔（純型別，無需測試）**

建立 `src/lib/types.ts`：

```ts
export interface Pronunciation {
  /** URL of a US audio recording, if the dictionary provides one */
  audioUrl: string | null;
  /** IPA transcription, e.g. /həˈloʊ/ */
  phonetic: string | null;
}

export interface DefinitionEntry {
  partOfSpeech: string;
  definition: string;
}

export interface LookupResult {
  term: string;
  pronunciation: Pronunciation;
  definitions: DefinitionEntry[];
  examples: string[];
  source: 'free-dictionary' | 'wiktionary';
}

export interface TranslationResult {
  original: string;
  translated: string;
}

export type QueryKind = 'dictionary' | 'sentence' | 'empty';

export type LookupErrorCode = 'not-found' | 'service-unavailable';
export type TranslateErrorCode = 'quota-exhausted' | 'service-unavailable';
```

- [ ] **Step 2: 寫 classifyQuery 的失敗測試**

建立 `src/lib/classify-query.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { classifyQuery } from './classify-query';

describe('classifyQuery', () => {
  it('classifies a single word as dictionary', () => {
    expect(classifyQuery('hello')).toBe('dictionary');
  });

  it('classifies a short phrase as dictionary', () => {
    expect(classifyQuery('give up')).toBe('dictionary');
  });

  it('classifies four words without end punctuation as dictionary', () => {
    expect(classifyQuery('kick the bucket hard')).toBe('dictionary');
  });

  it('classifies five or more words as sentence', () => {
    expect(classifyQuery('How are you doing today')).toBe('sentence');
  });

  it('classifies text ending with sentence punctuation as sentence', () => {
    expect(classifyQuery('Give up!')).toBe('sentence');
  });

  it('ignores surrounding whitespace', () => {
    expect(classifyQuery('  hello  ')).toBe('dictionary');
  });

  it('classifies blank input as empty', () => {
    expect(classifyQuery('   ')).toBe('empty');
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

```bash
npx vitest run src/lib/classify-query.test.ts
```
Expected: FAIL — `Cannot find module './classify-query'`（或同義錯誤）

- [ ] **Step 4: 實作 classifyQuery**

建立 `src/lib/classify-query.ts`：

```ts
import type { QueryKind } from './types';

const MAX_PHRASE_WORDS = 4;
const SENTENCE_END = /[.!?]$/;

export function classifyQuery(input: string): QueryKind {
  const trimmed = input.trim();
  if (trimmed === '') return 'empty';
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= MAX_PHRASE_WORDS && !SENTENCE_END.test(trimmed)) {
    return 'dictionary';
  }
  return 'sentence';
}
```

- [ ] **Step 5: 執行測試確認通過**

```bash
npx vitest run src/lib/classify-query.test.ts
```
Expected: PASS — 7 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/classify-query.ts src/lib/classify-query.test.ts
git commit -m "feat: add shared types and query classification"
```

---

### Task 3: Free Dictionary API client

**Files:**
- Create: `src/lib/dictionary-api.ts`、`src/lib/__fixtures__/free-dictionary-hello.json`
- Test: `src/lib/dictionary-api.test.ts`

**Interfaces:**
- Consumes: `LookupResult`（Task 2）
- Produces: `lookupFreeDictionary(term: string, signal?: AbortSignal): Promise<LookupResult | null>` — 404/空陣列回 `null`，其他非 2xx 或網路錯誤 throw

- [ ] **Step 1: 建立 fixture（取自實際 API 回應，裁剪並加入一筆 US 音檔供挑選邏輯測試）**

建立 `src/lib/__fixtures__/free-dictionary-hello.json`：

```json
[
  {
    "word": "hello",
    "phonetics": [
      { "audio": "https://api.dictionaryapi.dev/media/pronunciations/en/hello-au.mp3" },
      { "text": "/həˈləʊ/", "audio": "https://api.dictionaryapi.dev/media/pronunciations/en/hello-uk.mp3" },
      { "text": "/həˈloʊ/", "audio": "https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3" }
    ],
    "meanings": [
      {
        "partOfSpeech": "noun",
        "definitions": [
          { "definition": "\"Hello!\" or an equivalent greeting." }
        ]
      },
      {
        "partOfSpeech": "interjection",
        "definitions": [
          {
            "definition": "A greeting said when meeting someone.",
            "example": "Hello, everyone."
          },
          {
            "definition": "A greeting used when answering the telephone.",
            "example": "Hello? How may I help you?"
          }
        ]
      }
    ]
  }
]
```

- [ ] **Step 2: 寫失敗測試**

建立 `src/lib/dictionary-api.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupFreeDictionary } from './dictionary-api';
import helloFixture from './__fixtures__/free-dictionary-hello.json';

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lookupFreeDictionary', () => {
  it('normalizes definitions, phonetic, examples, and picks the US audio', async () => {
    stubFetch(200, helloFixture);
    const result = await lookupFreeDictionary('hello');
    expect(result).not.toBeNull();
    expect(result!.term).toBe('hello');
    expect(result!.source).toBe('free-dictionary');
    expect(result!.pronunciation.audioUrl).toContain('-us.mp3');
    expect(result!.pronunciation.phonetic).toBe('/həˈləʊ/');
    expect(result!.definitions).toContainEqual({
      partOfSpeech: 'interjection',
      definition: 'A greeting said when meeting someone.',
    });
    expect(result!.examples).toEqual([
      'Hello, everyone.',
      'Hello? How may I help you?',
    ]);
  });

  it('returns null audio when no US recording exists', async () => {
    const noUs = structuredClone(helloFixture);
    noUs[0].phonetics = noUs[0].phonetics.filter(
      (p) => !p.audio?.includes('-us.'),
    );
    stubFetch(200, noUs);
    const result = await lookupFreeDictionary('hello');
    expect(result!.pronunciation.audioUrl).toBeNull();
  });

  it('URL-encodes the term', async () => {
    const mock = stubFetch(200, helloFixture);
    await lookupFreeDictionary('give up');
    expect(mock).toHaveBeenCalledWith(
      'https://api.dictionaryapi.dev/api/v2/entries/en/give%20up',
      expect.anything(),
    );
  });

  it('returns null on 404 (word not found)', async () => {
    stubFetch(404, { title: 'No Definitions Found' });
    await expect(lookupFreeDictionary('zzzzzz')).resolves.toBeNull();
  });

  it('throws on server error', async () => {
    stubFetch(500, {});
    await expect(lookupFreeDictionary('hello')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

```bash
npx vitest run src/lib/dictionary-api.test.ts
```
Expected: FAIL — `Cannot find module './dictionary-api'`

- [ ] **Step 4: 實作 client 與正規化**

建立 `src/lib/dictionary-api.ts`：

```ts
import type { DefinitionEntry, LookupResult } from './types';

const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

interface ApiPhonetic {
  text?: string;
  audio?: string;
}

interface ApiDefinition {
  definition: string;
  example?: string;
}

interface ApiMeaning {
  partOfSpeech: string;
  definitions: ApiDefinition[];
}

interface ApiEntry {
  word: string;
  phonetics: ApiPhonetic[];
  meanings: ApiMeaning[];
}

export async function lookupFreeDictionary(
  term: string,
  signal?: AbortSignal,
): Promise<LookupResult | null> {
  const res = await fetch(BASE_URL + encodeURIComponent(term), { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`free dictionary responded ${res.status}`);
  const entries = (await res.json()) as ApiEntry[];
  if (!Array.isArray(entries) || entries.length === 0) return null;
  return normalize(term, entries);
}

function normalize(term: string, entries: ApiEntry[]): LookupResult {
  const definitions: DefinitionEntry[] = [];
  const examples: string[] = [];
  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      for (const def of meaning.definitions) {
        definitions.push({
          partOfSpeech: meaning.partOfSpeech,
          definition: def.definition,
        });
        if (def.example) examples.push(def.example);
      }
    }
  }
  return {
    term,
    pronunciation: {
      audioUrl: pickUsAudio(entries),
      phonetic: pickPhonetic(entries),
    },
    definitions,
    examples,
    source: 'free-dictionary',
  };
}

function pickUsAudio(entries: ApiEntry[]): string | null {
  for (const entry of entries) {
    for (const phonetic of entry.phonetics) {
      if (phonetic.audio && phonetic.audio.includes('-us.')) {
        return phonetic.audio;
      }
    }
  }
  return null;
}

function pickPhonetic(entries: ApiEntry[]): string | null {
  for (const entry of entries) {
    for (const phonetic of entry.phonetics) {
      if (phonetic.text) return phonetic.text;
    }
  }
  return null;
}
```

- [ ] **Step 5: 執行測試確認通過**

```bash
npx vitest run src/lib/dictionary-api.test.ts
```
Expected: PASS — 5 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/dictionary-api.ts src/lib/dictionary-api.test.ts src/lib/__fixtures__/free-dictionary-hello.json
git commit -m "feat: add Free Dictionary API client with US audio selection"
```

---

### Task 4: Wiktionary 備援 client 與 HTML 清洗

**Files:**
- Create: `src/lib/wiktionary-api.ts`、`src/lib/__fixtures__/wiktionary-kick-the-bucket.json`
- Test: `src/lib/wiktionary-api.test.ts`

**Interfaces:**
- Consumes: `LookupResult`、`DefinitionEntry`（Task 2）
- Produces: `lookupWiktionary(term: string, signal?: AbortSignal): Promise<LookupResult | null>`（`pronunciation` 一律 `{ audioUrl: null, phonetic: null }`）、`stripHtml(html: string): string`

- [ ] **Step 1: 建立 fixture（取自實際 API 回應裁剪）**

建立 `src/lib/__fixtures__/wiktionary-kick-the-bucket.json`：

```json
{
  "en": [
    {
      "partOfSpeech": "Verb",
      "language": "English",
      "definitions": [
        {
          "definition": "<span class=\"usage-label-sense\"></span> To <a rel=\"mw:WikiLink\" href=\"/wiki/die\" title=\"die\">die</a>.",
          "examples": ["The old horse finally <b>kicked the bucket</b>."]
        },
        {
          "definition": "To break down such that it cannot be repaired.",
          "examples": ["I think my sewing machine has <b>kicked the bucket</b>."]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: 寫失敗測試**

建立 `src/lib/wiktionary-api.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupWiktionary, stripHtml } from './wiktionary-api';
import bucketFixture from './__fixtures__/wiktionary-kick-the-bucket.json';

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('stripHtml', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripHtml('To <a href="/wiki/die">die</a>.')).toBe('To die.');
    expect(stripHtml('<span></span>  hello   <b>world</b>')).toBe('hello world');
  });
});

describe('lookupWiktionary', () => {
  it('normalizes idiom definitions and strips HTML from examples', async () => {
    stubFetch(200, bucketFixture);
    const result = await lookupWiktionary('kick the bucket');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('wiktionary');
    expect(result!.pronunciation).toEqual({ audioUrl: null, phonetic: null });
    expect(result!.definitions[0]).toEqual({
      partOfSpeech: 'verb',
      definition: 'To die.',
    });
    expect(result!.examples).toEqual([
      'The old horse finally kicked the bucket.',
      'I think my sewing machine has kicked the bucket.',
    ]);
    expect(JSON.stringify(result)).not.toContain('<');
  });

  it('converts spaces to underscores in the page URL', async () => {
    const mock = stubFetch(200, bucketFixture);
    await lookupWiktionary('kick the bucket');
    expect(mock).toHaveBeenCalledWith(
      'https://en.wiktionary.org/api/rest_v1/page/definition/kick_the_bucket',
      expect.anything(),
    );
  });

  it('returns null on 404', async () => {
    stubFetch(404, {});
    await expect(lookupWiktionary('zzzzzz')).resolves.toBeNull();
  });

  it('returns null when there is no English section', async () => {
    stubFetch(200, { de: [] });
    await expect(lookupWiktionary('hallo')).resolves.toBeNull();
  });

  it('throws on server error', async () => {
    stubFetch(500, {});
    await expect(lookupWiktionary('hello')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: 執行測試確認失敗**

```bash
npx vitest run src/lib/wiktionary-api.test.ts
```
Expected: FAIL — `Cannot find module './wiktionary-api'`

- [ ] **Step 4: 實作**

建立 `src/lib/wiktionary-api.ts`：

```ts
import type { DefinitionEntry, LookupResult } from './types';

const BASE_URL = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

interface WiktionaryDefinition {
  definition: string;
  examples?: string[];
}

interface WiktionaryUsage {
  partOfSpeech: string;
  definitions: WiktionaryDefinition[];
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function lookupWiktionary(
  term: string,
  signal?: AbortSignal,
): Promise<LookupResult | null> {
  const page = term.trim().replace(/\s+/g, '_');
  const res = await fetch(BASE_URL + encodeURIComponent(page), { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`wiktionary responded ${res.status}`);
  const body = (await res.json()) as Record<string, WiktionaryUsage[]>;
  const usages = body.en;
  if (!usages || usages.length === 0) return null;

  const definitions: DefinitionEntry[] = [];
  const examples: string[] = [];
  for (const usage of usages) {
    for (const def of usage.definitions) {
      const text = stripHtml(def.definition);
      if (text !== '') {
        definitions.push({
          partOfSpeech: usage.partOfSpeech.toLowerCase(),
          definition: text,
        });
      }
      for (const example of def.examples ?? []) {
        const stripped = stripHtml(example);
        if (stripped !== '') examples.push(stripped);
      }
    }
  }
  if (definitions.length === 0) return null;

  return {
    term,
    pronunciation: { audioUrl: null, phonetic: null },
    definitions,
    examples,
    source: 'wiktionary',
  };
}
```

注意：`encodeURIComponent` 會把底線保留原樣，URL 結果如測試所示。

- [ ] **Step 5: 執行測試確認通過**

```bash
npx vitest run src/lib/wiktionary-api.test.ts
```
Expected: PASS — 6 passed

- [ ] **Step 6: Commit**

```bash
git add src/lib/wiktionary-api.ts src/lib/wiktionary-api.test.ts src/lib/__fixtures__/wiktionary-kick-the-bucket.json
git commit -m "feat: add Wiktionary fallback client with HTML stripping"
```

---

### Task 5: Tatoeba 例句補充 client

**Files:**
- Create: `src/lib/tatoeba-api.ts`
- Test: `src/lib/tatoeba-api.test.ts`

**Interfaces:**
- Consumes: 無
- Produces: `fetchTatoebaExamples(term: string, limit: number, signal?: AbortSignal): Promise<string[]>` — 失敗 throw（由呼叫端決定是否吞掉）

- [ ] **Step 1: 寫失敗測試**

建立 `src/lib/tatoeba-api.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTatoebaExamples } from './tatoeba-api';

const tatoebaBody = {
  data: [
    { id: 1, text: 'Give up.', lang: 'eng' },
    { id: 2, text: 'He gives up.', lang: 'eng' },
    { id: 3, text: 'Never give up hope.', lang: 'eng' },
  ],
};

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTatoebaExamples', () => {
  it('returns sentence texts', async () => {
    stubFetch(200, tatoebaBody);
    await expect(fetchTatoebaExamples('give up', 3)).resolves.toEqual([
      'Give up.',
      'He gives up.',
      'Never give up hope.',
    ]);
  });

  it('sends required query parameters including sort', async () => {
    const mock = stubFetch(200, tatoebaBody);
    await fetchTatoebaExamples('give up', 3);
    const calledUrl = new URL(mock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.tatoeba.org/unstable/sentences',
    );
    expect(calledUrl.searchParams.get('lang')).toBe('eng');
    expect(calledUrl.searchParams.get('q')).toBe('"give up"');
    expect(calledUrl.searchParams.get('sort')).toBe('relevance');
    expect(calledUrl.searchParams.get('limit')).toBe('3');
  });

  it('throws on non-ok response', async () => {
    stubFetch(400, { message: 'Required parameter "sort" missing' });
    await expect(fetchTatoebaExamples('give up', 3)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/lib/tatoeba-api.test.ts
```
Expected: FAIL — `Cannot find module './tatoeba-api'`

- [ ] **Step 3: 實作**

建立 `src/lib/tatoeba-api.ts`：

```ts
const BASE_URL = 'https://api.tatoeba.org/unstable/sentences';

interface TatoebaSentence {
  id: number;
  text: string;
  lang: string;
}

interface TatoebaResponse {
  data: TatoebaSentence[];
}

export async function fetchTatoebaExamples(
  term: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set('lang', 'eng');
  // Quote the term so multi-word phrases match as a unit.
  url.searchParams.set('q', `"${term}"`);
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`tatoeba responded ${res.status}`);
  const body = (await res.json()) as TatoebaResponse;
  return body.data.map((sentence) => sentence.text);
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/lib/tatoeba-api.test.ts
```
Expected: PASS — 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/tatoeba-api.ts src/lib/tatoeba-api.test.ts
git commit -m "feat: add Tatoeba example sentence client"
```

---

### Task 6: lookup-service — 備援鏈與例句數量保證

**Files:**
- Create: `src/lib/lookup-service.ts`
- Test: `src/lib/lookup-service.test.ts`

**Interfaces:**
- Consumes: `lookupFreeDictionary`（Task 3）、`lookupWiktionary`（Task 4）、`fetchTatoebaExamples`（Task 5）、`LookupResult`、`LookupErrorCode`（Task 2）
- Produces: `lookupTerm(term: string): Promise<LookupOutcome>`，其中 `type LookupOutcome = { ok: true; result: LookupResult } | { ok: false; error: LookupErrorCode }`

- [ ] **Step 1: 寫失敗測試**

建立 `src/lib/lookup-service.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupTerm } from './lookup-service';
import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import type { LookupResult } from './types';

vi.mock('./dictionary-api');
vi.mock('./wiktionary-api');
vi.mock('./tatoeba-api');

function makeResult(examples: string[]): LookupResult {
  return {
    term: 'give up',
    pronunciation: { audioUrl: null, phonetic: null },
    definitions: [{ partOfSpeech: 'verb', definition: 'To surrender.' }],
    examples,
    source: 'free-dictionary',
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('lookupTerm', () => {
  it('returns primary result without supplementation when it has 2+ examples', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(
      makeResult(['a', 'b', 'c', 'd']),
    );
    const outcome = await lookupTerm('give up');
    expect(outcome).toEqual({
      ok: true,
      result: expect.objectContaining({ examples: ['a', 'b', 'c'] }),
    });
    expect(fetchTatoebaExamples).not.toHaveBeenCalled();
    expect(lookupWiktionary).not.toHaveBeenCalled();
  });

  it('supplements examples from Tatoeba when fewer than 2, dedupes, caps at 3', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a']));
    vi.mocked(fetchTatoebaExamples).mockResolvedValue(['a', 'b', 'c']);
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(['a', 'b', 'c']);
    }
  });

  it('keeps the result when Tatoeba supplementation fails', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(makeResult(['a']));
    vi.mocked(fetchTatoebaExamples).mockRejectedValue(new Error('down'));
    const outcome = await lookupTerm('give up');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.examples).toEqual(['a']);
    }
  });

  it('falls back to Wiktionary when the primary source has no entry', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(null);
    vi.mocked(lookupWiktionary).mockResolvedValue(
      { ...makeResult(['x', 'y']), source: 'wiktionary' },
    );
    const outcome = await lookupTerm('kick the bucket');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe('wiktionary');
    }
  });

  it('falls back to Wiktionary when the primary source errors', async () => {
    vi.mocked(lookupFreeDictionary).mockRejectedValue(new Error('timeout'));
    vi.mocked(lookupWiktionary).mockResolvedValue(makeResult(['x', 'y']));
    const outcome = await lookupTerm('hello');
    expect(outcome.ok).toBe(true);
  });

  it('returns not-found when all sources have no entry', async () => {
    vi.mocked(lookupFreeDictionary).mockResolvedValue(null);
    vi.mocked(lookupWiktionary).mockResolvedValue(null);
    await expect(lookupTerm('zzzzzz')).resolves.toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  it('returns service-unavailable when all sources error', async () => {
    vi.mocked(lookupFreeDictionary).mockRejectedValue(new Error('down'));
    vi.mocked(lookupWiktionary).mockRejectedValue(new Error('down'));
    await expect(lookupTerm('hello')).resolves.toEqual({
      ok: false,
      error: 'service-unavailable',
    });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/lib/lookup-service.test.ts
```
Expected: FAIL — `Cannot find module './lookup-service'`

- [ ] **Step 3: 實作**

建立 `src/lib/lookup-service.ts`：

```ts
import { lookupFreeDictionary } from './dictionary-api';
import { lookupWiktionary } from './wiktionary-api';
import { fetchTatoebaExamples } from './tatoeba-api';
import type { LookupErrorCode, LookupResult } from './types';

const TIMEOUT_MS = 8000;
const MIN_EXAMPLES = 2;
const MAX_EXAMPLES = 3;

export type LookupOutcome =
  | { ok: true; result: LookupResult }
  | { ok: false; error: LookupErrorCode };

export async function lookupTerm(term: string): Promise<LookupOutcome> {
  let result: LookupResult | null = null;
  let sawServiceError = false;

  try {
    result = await lookupFreeDictionary(term, AbortSignal.timeout(TIMEOUT_MS));
  } catch {
    sawServiceError = true;
  }

  if (!result) {
    try {
      result = await lookupWiktionary(term, AbortSignal.timeout(TIMEOUT_MS));
    } catch {
      sawServiceError = true;
    }
  }

  if (!result) {
    return { ok: false, error: sawServiceError ? 'service-unavailable' : 'not-found' };
  }

  return { ok: true, result: await withGuaranteedExamples(term, result) };
}

async function withGuaranteedExamples(
  term: string,
  result: LookupResult,
): Promise<LookupResult> {
  if (result.examples.length >= MIN_EXAMPLES) {
    return { ...result, examples: result.examples.slice(0, MAX_EXAMPLES) };
  }
  try {
    const extra = await fetchTatoebaExamples(
      term,
      MAX_EXAMPLES,
      AbortSignal.timeout(TIMEOUT_MS),
    );
    const merged = [...new Set([...result.examples, ...extra])];
    return { ...result, examples: merged.slice(0, MAX_EXAMPLES) };
  } catch {
    // Supplementation must never break an otherwise successful lookup.
    return result;
  }
}
```

- [ ] **Step 4: 執行測試確認通過（跑全部測試確認無回歸）**

```bash
npm run test
```
Expected: PASS — 全部通過（含前面任務的測試）

- [ ] **Step 5: Commit**

```bash
git add src/lib/lookup-service.ts src/lib/lookup-service.test.ts
git commit -m "feat: add lookup service with fallback chain and example guarantee"
```

---

### Task 7: MyMemory 翻譯 client

**Files:**
- Create: `src/lib/translation-api.ts`
- Test: `src/lib/translation-api.test.ts`

**Interfaces:**
- Consumes: `TranslationResult`、`TranslateErrorCode`（Task 2）
- Produces: `translateSentence(sentence: string): Promise<TranslateOutcome>`，其中 `type TranslateOutcome = { ok: true; result: TranslationResult } | { ok: false; error: TranslateErrorCode }`（不 throw，一律回 outcome）

- [ ] **Step 1: 寫失敗測試**

建立 `src/lib/translation-api.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translateSentence } from './translation-api';

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

function myMemoryBody(overrides: Record<string, unknown> = {}) {
  return {
    responseData: { translatedText: '您今天好嗎？', match: 0.99 },
    quotaFinished: false,
    responseStatus: 200,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('translateSentence', () => {
  it('translates an English sentence to Traditional Chinese', async () => {
    stubFetch(200, myMemoryBody());
    await expect(
      translateSentence('How are you doing today?'),
    ).resolves.toEqual({
      ok: true,
      result: {
        original: 'How are you doing today?',
        translated: '您今天好嗎？',
      },
    });
  });

  it('requests the en|zh-TW language pair', async () => {
    const mock = stubFetch(200, myMemoryBody());
    await translateSentence('Hello there.');
    const calledUrl = new URL(mock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.mymemory.translated.net/get',
    );
    expect(calledUrl.searchParams.get('q')).toBe('Hello there.');
    expect(calledUrl.searchParams.get('langpair')).toBe('en|zh-TW');
  });

  it('reports quota exhaustion', async () => {
    stubFetch(200, myMemoryBody({ quotaFinished: true }));
    await expect(translateSentence('Hello.')).resolves.toEqual({
      ok: false,
      error: 'quota-exhausted',
    });
  });

  it('reports service-unavailable on API-level error status', async () => {
    stubFetch(200, myMemoryBody({ responseStatus: 403 }));
    await expect(translateSentence('Hello.')).resolves.toEqual({
      ok: false,
      error: 'service-unavailable',
    });
  });

  it('reports service-unavailable on HTTP or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(translateSentence('Hello.')).resolves.toEqual({
      ok: false,
      error: 'service-unavailable',
    });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/lib/translation-api.test.ts
```
Expected: FAIL — `Cannot find module './translation-api'`

- [ ] **Step 3: 實作**

建立 `src/lib/translation-api.ts`：

```ts
import type { TranslateErrorCode, TranslationResult } from './types';

const BASE_URL = 'https://api.mymemory.translated.net/get';
const TIMEOUT_MS = 8000;

export type TranslateOutcome =
  | { ok: true; result: TranslationResult }
  | { ok: false; error: TranslateErrorCode };

interface MyMemoryResponse {
  responseData: { translatedText: string };
  quotaFinished: boolean;
  responseStatus: number;
}

export async function translateSentence(
  sentence: string,
): Promise<TranslateOutcome> {
  const url = new URL(BASE_URL);
  url.searchParams.set('q', sentence);
  url.searchParams.set('langpair', 'en|zh-TW');
  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: 'service-unavailable' };
    const body = (await res.json()) as MyMemoryResponse;
    if (body.quotaFinished) return { ok: false, error: 'quota-exhausted' };
    if (body.responseStatus !== 200) {
      return { ok: false, error: 'service-unavailable' };
    }
    return {
      ok: true,
      result: { original: sentence, translated: body.responseData.translatedText },
    };
  } catch {
    return { ok: false, error: 'service-unavailable' };
  }
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/lib/translation-api.test.ts
```
Expected: PASS — 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/translation-api.ts src/lib/translation-api.test.ts
git commit -m "feat: add MyMemory translation client with quota handling"
```

---

### Task 8: GET /api/lookup route handler

**Files:**
- Create: `src/app/api/lookup/route.ts`
- Test: `src/app/api/lookup/route.test.ts`

**Interfaces:**
- Consumes: `lookupTerm`、`LookupOutcome`（Task 6）
- Produces: `GET /api/lookup?q=<term>` — 200 回 `LookupResult` JSON；400 `{ error: 'empty-query' }`；404 `{ error: 'not-found' }`；502 `{ error: 'service-unavailable' }`

- [ ] **Step 1: 寫失敗測試**

建立 `src/app/api/lookup/route.test.ts`：

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { lookupTerm } from '@/lib/lookup-service';
import type { LookupResult } from '@/lib/types';

vi.mock('@/lib/lookup-service');

const sample: LookupResult = {
  term: 'hello',
  pronunciation: { audioUrl: null, phonetic: '/həˈloʊ/' },
  definitions: [{ partOfSpeech: 'noun', definition: 'A greeting.' }],
  examples: ['Hello, everyone.', 'Hello? Is anyone there?'],
  source: 'free-dictionary',
};

function makeRequest(query: string) {
  return new Request(`http://localhost/api/lookup?q=${encodeURIComponent(query)}`);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/lookup', () => {
  it('returns the lookup result as JSON', async () => {
    vi.mocked(lookupTerm).mockResolvedValue({ ok: true, result: sample });
    const res = await GET(makeRequest('hello'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(sample);
    expect(lookupTerm).toHaveBeenCalledWith('hello');
  });

  it('returns 400 for a blank query', async () => {
    const res = await GET(makeRequest('   '));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'empty-query' });
    expect(lookupTerm).not.toHaveBeenCalled();
  });

  it('returns 404 when the term is not found', async () => {
    vi.mocked(lookupTerm).mockResolvedValue({ ok: false, error: 'not-found' });
    const res = await GET(makeRequest('zzzzzz'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not-found' });
  });

  it('returns 502 when all sources are unavailable', async () => {
    vi.mocked(lookupTerm).mockResolvedValue({
      ok: false,
      error: 'service-unavailable',
    });
    const res = await GET(makeRequest('hello'));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'service-unavailable' });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/app/api/lookup/route.test.ts
```
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: 實作**

建立 `src/app/api/lookup/route.ts`：

```ts
import { NextResponse } from 'next/server';
import { lookupTerm } from '@/lib/lookup-service';

export async function GET(request: Request): Promise<NextResponse> {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q === '') {
    return NextResponse.json({ error: 'empty-query' }, { status: 400 });
  }
  const outcome = await lookupTerm(q);
  if (!outcome.ok) {
    const status = outcome.error === 'not-found' ? 404 : 502;
    return NextResponse.json({ error: outcome.error }, { status });
  }
  return NextResponse.json(outcome.result);
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/app/api/lookup/route.test.ts
```
Expected: PASS — 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/api/lookup/
git commit -m "feat: add lookup API route handler"
```

---

### Task 9: GET /api/translate route handler

**Files:**
- Create: `src/app/api/translate/route.ts`
- Test: `src/app/api/translate/route.test.ts`

**Interfaces:**
- Consumes: `translateSentence`、`TranslateOutcome`（Task 7）
- Produces: `GET /api/translate?q=<sentence>` — 200 回 `TranslationResult` JSON；400 `{ error: 'empty-query' }`；429 `{ error: 'quota-exhausted' }`；502 `{ error: 'service-unavailable' }`

- [ ] **Step 1: 寫失敗測試**

建立 `src/app/api/translate/route.test.ts`：

```ts
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
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/app/api/translate/route.test.ts
```
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: 實作**

建立 `src/app/api/translate/route.ts`：

```ts
import { NextResponse } from 'next/server';
import { translateSentence } from '@/lib/translation-api';

export async function GET(request: Request): Promise<NextResponse> {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q === '') {
    return NextResponse.json({ error: 'empty-query' }, { status: 400 });
  }
  const outcome = await translateSentence(q);
  if (!outcome.ok) {
    const status = outcome.error === 'quota-exhausted' ? 429 : 502;
    return NextResponse.json({ error: outcome.error }, { status });
  }
  return NextResponse.json(outcome.result);
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/app/api/translate/route.test.ts
```
Expected: PASS — 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/api/translate/
git commit -m "feat: add translate API route handler"
```

---

### Task 10: SearchBox 元件

**Files:**
- Create: `src/components/SearchBox.tsx`
- Test: `src/components/SearchBox.test.tsx`

**Interfaces:**
- Consumes: 無
- Produces: `SearchBox({ onSearch }: { onSearch: (query: string) => void })` — 送出時 trim 後回傳；空白輸入顯示「請輸入要查詢的內容」且不呼叫 `onSearch`

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/SearchBox.test.tsx`：

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from './SearchBox';

describe('SearchBox', () => {
  it('submits the trimmed query on Enter', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), '  give up  {enter}');
    expect(onSearch).toHaveBeenCalledWith('give up');
  });

  it('submits via the search button', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: '查詢' }));
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('shows a hint and does not submit blank input', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), '   {enter}');
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByText('請輸入要查詢的內容')).toBeInTheDocument();
  });

  it('clears the hint after a valid submission', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), '   {enter}');
    await userEvent.type(screen.getByRole('textbox'), 'hello{enter}');
    expect(screen.queryByText('請輸入要查詢的內容')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/components/SearchBox.test.tsx
```
Expected: FAIL — `Cannot find module './SearchBox'`

- [ ] **Step 3: 實作**

建立 `src/components/SearchBox.tsx`：

```tsx
'use client';

import { useState, type FormEvent } from 'react';

interface SearchBoxProps {
  onSearch: (query: string) => void;
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (query === '') {
      setHint('請輸入要查詢的內容');
      return;
    }
    setHint(null);
    onSearch(query);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="輸入英文單字、片語或整句"
        aria-label="查詢內容"
      />
      <button type="submit">查詢</button>
      {hint && <p role="alert">{hint}</p>}
    </form>
  );
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/components/SearchBox.test.tsx
```
Expected: PASS — 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBox.tsx src/components/SearchBox.test.tsx
git commit -m "feat: add SearchBox component with blank-input hint"
```

---

### Task 11: PronunciationButton 元件

**Files:**
- Create: `src/components/PronunciationButton.tsx`
- Test: `src/components/PronunciationButton.test.tsx`

**Interfaces:**
- Consumes: 無
- Produces: `PronunciationButton({ text, audioUrl }: { text: string; audioUrl?: string | null })` — 有 `audioUrl` 播音檔；否則若瀏覽器支援 `speechSynthesis` 用 en-US TTS；兩者皆無則 render `null`。只由點擊觸發

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/PronunciationButton.test.tsx`：

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PronunciationButton } from './PronunciationButton';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubSpeechSynthesis() {
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      lang = '';
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  return speak;
}

describe('PronunciationButton', () => {
  it('plays the audio file when audioUrl is provided', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'Audio').mockImplementation(
      () => ({ play }) as unknown as HTMLAudioElement,
    );
    render(
      <PronunciationButton text="hello" audioUrl="https://example.com/hello-us.mp3" />,
    );
    await userEvent.click(screen.getByRole('button', { name: /發音/ }));
    expect(window.Audio).toHaveBeenCalledWith('https://example.com/hello-us.mp3');
    expect(play).toHaveBeenCalled();
  });

  it('falls back to en-US speech synthesis when there is no audio file', async () => {
    const speak = stubSpeechSynthesis();
    render(<PronunciationButton text="give up" audioUrl={null} />);
    await userEvent.click(screen.getByRole('button', { name: /發音/ }));
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as { text: string; lang: string };
    expect(utterance.text).toBe('give up');
    expect(utterance.lang).toBe('en-US');
  });

  it('renders nothing when no audio and no speech synthesis support', () => {
    // jsdom has no speechSynthesis by default.
    const { container } = render(
      <PronunciationButton text="hello" audioUrl={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not play anything before the user clicks', () => {
    const speak = stubSpeechSynthesis();
    render(<PronunciationButton text="hello" audioUrl={null} />);
    expect(speak).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/components/PronunciationButton.test.tsx
```
Expected: FAIL — `Cannot find module './PronunciationButton'`

- [ ] **Step 3: 實作**

建立 `src/components/PronunciationButton.tsx`：

```tsx
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
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/components/PronunciationButton.test.tsx
```
Expected: PASS — 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/PronunciationButton.tsx src/components/PronunciationButton.test.tsx
git commit -m "feat: add PronunciationButton with audio-first TTS fallback"
```

---

### Task 12: DictionaryResult 元件

**Files:**
- Create: `src/components/DictionaryResult.tsx`
- Test: `src/components/DictionaryResult.test.tsx`

**Interfaces:**
- Consumes: `LookupResult`（Task 2）、`PronunciationButton`（Task 11）
- Produces: `DictionaryResult({ result }: { result: LookupResult })` — 顯示查詢字、音標、釋義（含詞性）、例句清單、發音按鈕

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/DictionaryResult.test.tsx`：

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DictionaryResult } from './DictionaryResult';
import type { LookupResult } from '@/lib/types';

const sample: LookupResult = {
  term: 'give up',
  pronunciation: { audioUrl: 'https://example.com/a-us.mp3', phonetic: '/ɡɪv ʌp/' },
  definitions: [
    { partOfSpeech: 'verb', definition: 'To surrender.' },
    { partOfSpeech: 'verb', definition: 'To stop or quit.' },
  ],
  examples: ['They gave up the search.', 'Never give up hope.'],
  source: 'free-dictionary',
};

describe('DictionaryResult', () => {
  it('renders term, phonetic, definitions with part of speech, and examples', () => {
    render(<DictionaryResult result={sample} />);
    expect(screen.getByRole('heading', { name: 'give up' })).toBeInTheDocument();
    expect(screen.getByText('/ɡɪv ʌp/')).toBeInTheDocument();
    expect(screen.getByText('To surrender.')).toBeInTheDocument();
    expect(screen.getAllByText('verb').length).toBeGreaterThan(0);
    expect(screen.getByText('They gave up the search.')).toBeInTheDocument();
    expect(screen.getByText('Never give up hope.')).toBeInTheDocument();
  });

  it('renders a pronunciation button wired to the audio URL', () => {
    render(<DictionaryResult result={sample} />);
    expect(
      screen.getByRole('button', { name: /播放 give up 的美式發音/ }),
    ).toBeInTheDocument();
  });

  it('omits the phonetic line when absent', () => {
    render(
      <DictionaryResult
        result={{ ...sample, pronunciation: { audioUrl: null, phonetic: null } }}
      />,
    );
    expect(screen.queryByText(/^\//)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/components/DictionaryResult.test.tsx
```
Expected: FAIL — `Cannot find module './DictionaryResult'`

- [ ] **Step 3: 實作**

建立 `src/components/DictionaryResult.tsx`：

```tsx
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
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/components/DictionaryResult.test.tsx
```
Expected: PASS — 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/DictionaryResult.tsx src/components/DictionaryResult.test.tsx
git commit -m "feat: add DictionaryResult component"
```

---

### Task 13: TranslationResultView 元件

**Files:**
- Create: `src/components/TranslationResultView.tsx`
- Test: `src/components/TranslationResultView.test.tsx`

**Interfaces:**
- Consumes: `TranslationResult`（Task 2）、`PronunciationButton`（Task 11）
- Produces: `TranslationResultView({ result }: { result: TranslationResult })` — 顯示英文原句、繁中譯文，發音按鈕朗讀「原句」（無音檔，走 TTS）

- [ ] **Step 1: 寫失敗測試**

建立 `src/components/TranslationResultView.test.tsx`：

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranslationResultView } from './TranslationResultView';
import type { TranslationResult } from '@/lib/types';

const sample: TranslationResult = {
  original: 'How are you doing today?',
  translated: '您今天好嗎？',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TranslationResultView', () => {
  it('renders the original sentence and its translation', () => {
    render(<TranslationResultView result={sample} />);
    expect(screen.getByText('How are you doing today?')).toBeInTheDocument();
    expect(screen.getByText('您今天好嗎？')).toBeInTheDocument();
  });

  it('offers TTS pronunciation of the original sentence when supported', () => {
    vi.stubGlobal('speechSynthesis', { speak: vi.fn() });
    render(<TranslationResultView result={sample} />);
    expect(
      screen.getByRole('button', {
        name: /播放 How are you doing today\? 的美式發音/,
      }),
    ).toBeInTheDocument();
  });

  it('still shows the translation when TTS is unsupported', () => {
    // jsdom has no speechSynthesis: the button hides, content remains.
    render(<TranslationResultView result={sample} />);
    expect(screen.getByText('您今天好嗎？')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/components/TranslationResultView.test.tsx
```
Expected: FAIL — `Cannot find module './TranslationResultView'`

- [ ] **Step 3: 實作**

建立 `src/components/TranslationResultView.tsx`：

```tsx
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
```

- [ ] **Step 4: 執行測試確認通過**

```bash
npx vitest run src/components/TranslationResultView.test.tsx
```
Expected: PASS — 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/TranslationResultView.tsx src/components/TranslationResultView.test.tsx
git commit -m "feat: add TranslationResultView component"
```

---

### Task 14: 查詢頁組裝 — 狀態機、模式切換、錯誤文案

**Files:**
- Modify: `src/app/page.tsx`（取代 create-next-app 的預設首頁）
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `SearchBox`（Task 10）、`DictionaryResult`（Task 12）、`TranslationResultView`（Task 13）、`classifyQuery`（Task 2）、`/api/lookup`（Task 8）、`/api/translate`（Task 9）
- Produces: 完整查詢頁：自動分流 → fetch 對應 API → 顯示結果/載入/錯誤 → 模式切換按鈕（「改用整句翻譯」/「改查字典」）

- [ ] **Step 1: 寫失敗測試**

建立 `src/app/page.test.tsx`：

```tsx
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
});
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
npx vitest run src/app/page.test.tsx
```
Expected: FAIL — 預設首頁沒有 textbox / 查詢邏輯

- [ ] **Step 3: 實作查詢頁（整檔取代 create-next-app 預設 page.tsx）**

改寫 `src/app/page.tsx`：

```tsx
'use client';

import { useState } from 'react';
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

  async function runSearch(query: string, forcedMode?: Mode) {
    const mode: Mode =
      forcedMode ?? (classifyQuery(query) === 'sentence' ? 'sentence' : 'dictionary');
    setState({ status: 'loading' });
    try {
      if (mode === 'dictionary') {
        const res = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const result = (await res.json()) as LookupResult;
          setState({ status: 'dictionary', query, result });
        } else {
          const message =
            res.status === 404 ? MESSAGES.notFound : MESSAGES.serviceUnavailable;
          setState({ status: 'error', query, mode, message });
        }
      } else {
        const res = await fetch(`/api/translate?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const result = (await res.json()) as TranslationResult;
          setState({ status: 'sentence', query, result });
        } else {
          const message =
            res.status === 429 ? MESSAGES.quotaExhausted : MESSAGES.serviceUnavailable;
          setState({ status: 'error', query, mode, message });
        }
      }
    } catch {
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
```

- [ ] **Step 4: 執行全部測試確認通過**

```bash
npm run test
```
Expected: PASS — 全部通過

- [ ] **Step 5: 刪除冒煙測試（已被真實測試取代）並確認 build**

```bash
rm src/smoke.test.tsx
npm run lint
npm run build
```
Expected: lint 無 error、`next build` 成功

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: assemble lookup page with mode switching and error states"
```

---

### Task 15: 手動驗證與 README

**Files:**
- Modify: `README.md`（取代 create-next-app 預設內容，改為繁中）

**Interfaces:**
- Consumes: 全部前述任務
- Produces: 通過手動驗證的完整功能 + 繁中 README

- [ ] **Step 1: 啟動 dev server 並以 curl 驗證 API 代理**

```bash
npm run dev &
sleep 5
curl -s "http://localhost:3000/api/lookup?q=hello" | head -c 300; echo
curl -s "http://localhost:3000/api/lookup?q=give%20up" | head -c 300; echo
curl -s "http://localhost:3000/api/lookup?q=kick%20the%20bucket" | head -c 300; echo
curl -s "http://localhost:3000/api/translate?q=How%20are%20you%20doing%20today%3F"; echo
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/lookup?q=zzzzzzzz"
```
Expected：前三個回傳含 `definitions` 與 `examples`（≥2 句）的 JSON；translate 回傳含繁中 `translated`；最後一個回 `404`

- [ ] **Step 2: 瀏覽器手動驗證（或用 browse/playwright 工具）**

打開 `http://localhost:3000`，逐項確認：
1. 查 `hello` → 顯示釋義、音標、2-3 例句，點發音有聲音
2. 查 `give up` → 片語釋義與例句
3. 查 `How are you doing today?` → 繁中譯文 + 整句發音按鈕
4. 空白送出 → 顯示「請輸入要查詢的內容」
5. 查詢結果按「改用整句翻譯」/「改查字典」→ 模式切換生效

完成後停掉 dev server：`kill %1`

- [ ] **Step 3: 改寫 README.md（繁體中文）**

```markdown
# EnglishMaster

網頁版英語學習平台。查詢英文單字、片語或整句，取得繁中釋義輔助：

- 單字/片語：釋義（含詞性）、音標、2-3 個例句
- 整句：繁體中文翻譯
- 美式（US）發音：真人音檔優先，無音檔時使用瀏覽器語音合成

## 資料來源（皆為免費、無需 API key）

| 用途 | 服務 |
|---|---|
| 單字/片語釋義 | Free Dictionary API（dictionaryapi.dev） |
| 慣用語備援 | Wiktionary REST API |
| 例句補充 | Tatoeba API |
| 整句翻譯 | MyMemory API（匿名額度約 5,000 字元/日） |

## 開發

```bash
npm install
npm run dev        # http://localhost:3000
npm run test       # Vitest 單元測試
npm run lint       # ESLint
npm run build      # production build
```

開發約定見 `openspec/config.yaml`；功能規格見 `openspec/changes/add-dictionary-lookup/`。
```

- [ ] **Step 4: 最終全套驗證**

```bash
npm run test && npm run lint && npm run build
```
Expected: 全部通過

- [ ] **Step 5: Commit 並更新 OpenSpec tasks.md 勾選狀態**

```bash
git add README.md openspec/changes/add-dictionary-lookup/tasks.md
git commit -m "docs: rewrite README for dictionary lookup feature"
```

（將 `openspec/changes/add-dictionary-lookup/tasks.md` 內對應項目改為 `- [x]`）

---

## 對照表：OpenSpec tasks.md ↔ 本計畫

| tasks.md | 本計畫 |
|---|---|
| 1.1-1.4 專案初始化 | Task 1 |
| 2.1-2.2 型別與輸入分類 | Task 2 |
| 3.1-3.2 Free Dictionary | Task 3 |
| 3.3 Wiktionary | Task 4 |
| 3.4 Tatoeba | Task 5 |
| 3.5 備援鏈 | Task 6 |
| 4.1 MyMemory | Task 7 |
| 5.1-5.2 Route handlers | Task 8、9 |
| 6.1 SearchBox | Task 10 |
| 6.4 PronunciationButton | Task 11 |
| 6.2 DictionaryResult | Task 12 |
| 6.3 TranslationResult | Task 13 |
| 6.5-6.6、7.1-7.2 切換/錯誤/組裝 | Task 14 |
| 7.3-7.4 手動驗證與 README | Task 15 |
