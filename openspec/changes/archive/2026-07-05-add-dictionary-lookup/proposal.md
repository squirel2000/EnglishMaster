# 新增查詢功能（add-dictionary-lookup）

## Why

EnglishMaster 目前尚無任何查詢功能。中文母語學習者在閱讀或寫作時，最頻繁的需求就是快速查詢陌生的單字、片語或整句的意思與正確發音。此功能是平台的第一個核心功能，將成為後續學習功能（單字本、複習等）的基礎。

## What Changes

- 新增統一查詢入口：使用者輸入單字、片語或整句，系統自動判斷輸入類型並導向對應的查詢流程
- 單字與片語查詢：回傳釋義（含詞性）、音標，以及 2-3 個例句
- 整句查詢：回傳繁體中文翻譯，並提供整句美式發音
- 美式（US）發音播放：優先使用字典 API 提供的真人音檔，無音檔時以瀏覽器 Web Speech API（en-US 語音）合成發音
- 全部採用免費、無需 API key 的資料來源（已實測可用）：
  - Free Dictionary API（dictionaryapi.dev）：單字與常見片語的釋義、例句、美式音檔
  - Wiktionary REST API：慣用語（idiom）備援查詢
  - Tatoeba API：例句不足 2 句時的例句補充來源
  - MyMemory API：整句英譯繁中（匿名額度約 5,000 字元/日）

## Capabilities

### New Capabilities

- `lookup-query`: 統一查詢入口。接收使用者輸入、判斷類型（單字/片語 vs 整句）、導向對應查詢流程，並處理載入與錯誤狀態
- `dictionary-lookup`: 單字與片語查詢。整合 Free Dictionary API 與 Wiktionary 備援，回傳釋義、詞性、音標與 2-3 個例句（不足時以 Tatoeba 補充）
- `sentence-translation`: 整句翻譯。透過 MyMemory API 將英文句子翻譯為繁體中文，含每日額度與失敗處理
- `pronunciation-playback`: 美式發音播放。音檔優先、Web Speech API（en-US）備援，單字/片語/整句皆可發音

### Modified Capabilities

（無 — 此為專案第一個功能，`openspec/specs/` 目前為空）

## Impact

- **程式碼**: 全新 Next.js（App Router）專案初始化，包含查詢頁面、API route handlers（代理外部 API 以避免 CORS 與隱藏請求細節）、React 元件與服務層
- **外部相依**: 四個免費外部 API（見上）；皆無需 API key，但需處理其可用性與速率限制（逾時、備援、友善錯誤訊息）
- **瀏覽器相依**: Web Speech API（主流瀏覽器皆支援；不支援時僅隱藏發音按鈕，不影響查詢）
- **新增套件**: Next.js、React、Vitest、React Testing Library、ESLint、Prettier（皆為專案初始化的一部分）
