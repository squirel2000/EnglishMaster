# 實作任務：查詢功能（add-dictionary-lookup）

## 1. 專案初始化

- [ ] 1.1 初始化 Next.js（App Router）+ TypeScript strict 專案（`create-next-app`），確認 dev server 可啟動
- [ ] 1.2 設定 Vitest + React Testing Library（jsdom 環境），建立一個冒煙測試確認測試管線可跑
- [ ] 1.3 設定 ESLint + Prettier，加入 `lint`、`format`、`test` npm scripts
- [ ] 1.4 補齊 `.gitignore`（node_modules、.next、coverage 等）

## 2. 服務層：型別與輸入分類（TDD）

- [ ] 2.1 定義內部型別 `LookupResult`、`TranslationResult`、`Pronunciation`（`src/lib/types.ts`）
- [ ] 2.2 先寫 `classifyQuery` 測試（單字/片語/整句/空白判斷，含 "give up"、"How are you doing today?" 案例），再實作 `src/lib/classify-query.ts`

## 3. 服務層：字典查詢（TDD）

- [ ] 3.1 建立 Free Dictionary API 與 Wiktionary 的回應 fixture（含 "hello"、"give up"、"kick the bucket" 實際回應）
- [ ] 3.2 先寫測試再實作 Free Dictionary API client 與正規化（`src/lib/dictionary-api.ts`）：釋義、詞性、音標、例句、美式音檔挑選
- [ ] 3.3 先寫測試再實作 Wiktionary client 與 HTML 清洗（`src/lib/wiktionary-api.ts`）
- [ ] 3.4 先寫測試再實作 Tatoeba 例句補充 client（`src/lib/tatoeba-api.ts`，注意 `sort` 為必填參數）
- [ ] 3.5 先寫測試再實作備援鏈與例句數量保證邏輯（`src/lib/lookup-service.ts`）：主來源→備援→查無；例句不足 2 句補充至 2-3 句；8 秒逾時

## 4. 服務層：整句翻譯（TDD）

- [ ] 4.1 先寫測試再實作 MyMemory client（`src/lib/translation-api.ts`）：en|zh-TW、`quotaFinished` 偵測、逾時與錯誤處理

## 5. API Route Handlers

- [ ] 5.1 先寫測試再實作 `GET /api/lookup?q=`（`src/app/api/lookup/route.ts`）：呼叫 lookup-service，錯誤轉為結構化 JSON
- [ ] 5.2 先寫測試再實作 `GET /api/translate?q=`（`src/app/api/translate/route.ts`）：含額度耗盡與失敗的錯誤碼

## 6. UI 元件（TDD）

- [ ] 6.1 先寫測試再實作 `SearchBox` 元件：輸入、送出、空白輸入提示
- [ ] 6.2 先寫測試再實作 `DictionaryResult` 元件：詞性分組釋義、音標、2-3 例句
- [ ] 6.3 先寫測試再實作 `TranslationResult` 元件：原句與繁中譯文
- [ ] 6.4 先寫測試再實作 `PronunciationButton` 元件：音檔優先、Web Speech API（en-US）備援、不支援時隱藏、僅點擊觸發
- [ ] 6.5 先寫測試再實作查詢模式切換（「改查字典」/「改用整句翻譯」）
- [ ] 6.6 先寫測試再實作載入與錯誤狀態（服務失敗、查無結果、翻譯額度耗盡的繁中訊息）

## 7. 頁面組裝與驗證

- [ ] 7.1 組裝查詢頁（`src/app/page.tsx`）：串接 SearchBox、結果元件與 API routes
- [ ] 7.2 執行完整測試、lint、`next build` 確認全數通過
- [ ] 7.3 啟動 dev server 手動驗證主要情境：hello（單字）、give up（片語）、kick the bucket（慣用語備援）、整句翻譯與發音
- [ ] 7.4 更新 README（繁體中文）：功能說明、資料來源、開發指令
