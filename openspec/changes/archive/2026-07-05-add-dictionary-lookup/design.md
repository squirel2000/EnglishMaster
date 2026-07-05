# 技術設計：查詢功能（add-dictionary-lookup）

## Context

EnglishMaster 是全新的 repo，目前沒有任何程式碼，此變更同時涵蓋專案初始化與第一個功能。技術堆疊已定：TypeScript（strict）、Next.js（App Router）、Vitest + React Testing Library（TDD）。

限制條件：

- 全部使用免費、無需 API key 的外部服務（使用者明確要求）
- 目標使用者為中文母語者，介面與翻譯輸出為繁體中文
- 外部服務皆為社群性質，無 SLA，必須設計備援與友善錯誤

已實測可用的資料來源（2026-07-04）：

| 服務 | 用途 | 備註 |
|---|---|---|
| Free Dictionary API（dictionaryapi.dev） | 單字/片語釋義、音標、例句、美式音檔 | 無需 key；片語如 "give up" 也有收錄 |
| Wiktionary REST API | 慣用語備援釋義與例句 | 無需 key；回傳含 HTML，需清洗 |
| Tatoeba API（api.tatoeba.org/unstable） | 例句補充 | 無需 key；`sort` 為必填參數 |
| MyMemory API | 整句英譯繁中 | 無需 key；匿名額度約 5,000 字元/日 |
| Web Speech API | 瀏覽器端 TTS（en-US） | 瀏覽器內建，離線可用 |

## Goals / Non-Goals

**Goals:**

- 單一輸入框查詢單字、片語或整句，自動判斷類型
- 單字/片語：釋義（含詞性）、音標、2-3 個例句
- 整句：繁體中文翻譯
- 一律提供美式發音（音檔優先、TTS 備援）
- 外部 API 失敗時有明確的備援路徑與繁中錯誤訊息

**Non-Goals:**

- 使用者帳號、查詢歷史、單字本（後續變更）
- 中文→英文方向的查詢
- 離線字典資料庫
- 英式（UK）或其他口音發音
- LLM 相關功能（使用者已決定採純免費方案）

## Decisions

### D1：外部 API 一律經由 Next.js Route Handlers 代理

前端不直接呼叫外部 API，統一走 `/api/lookup`、`/api/translate` 等內部端點。

- **理由**：避免 CORS 問題；集中逾時、備援與錯誤轉換邏輯；未來可加快取或替換資料來源而不動前端
- **替代方案**：前端直呼外部 API — 被否決，CORS 不可控且備援邏輯會散落在元件裡

### D2：輸入類型判斷採簡單啟發式規則

以字數與句子特徵判斷：1-4 個詞且不含句末標點 → 單字/片語查詢；其餘 → 整句翻譯。查詢結果頁提供「改用整句翻譯」/「改查片語」切換，讓誤判可被使用者一鍵修正。

- **理由**：規則簡單可測試；誤判成本低（可手動切換）
- **替代方案**：語言偵測套件或 LLM 分類 — 過度設計，且後者違反免費原則

### D3：單字/片語查詢的備援鏈

`Free Dictionary API → Wiktionary REST API → 查無結果`。例句不足 2 句時，以 Tatoeba 補到 2-3 句。

- **理由**：Free Dictionary API 資料結構最乾淨且含美式音檔；Wiktionary 慣用語覆蓋率高但回傳 HTML 需清洗，只做備援
- **替代方案**：只用 Wiktionary — 無音檔欄位、HTML 清洗成本高

### D4：發音採「音檔優先、TTS 備援」

Dictionary API 回傳的 phonetics 中優先挑選 US 音檔（URL 含 `-us` 或依 locale 欄位）；無音檔或整句情境，使用 Web Speech API 並鎖定 `en-US` 語音。

- **理由**：真人音檔品質最好；TTS 保證任何文字（含整句）都能發音
- **替代方案**：全用 TTS — 犧牲單字發音品質；全用音檔 — 整句無音檔可用

### D5：服務層與 UI 分離，型別集中定義

`src/lib/` 放純函式服務層（api clients、輸入分類、資料正規化），`src/components/` 放 UI 元件，`src/app/` 放頁面與 route handlers。外部 API 的回應在服務層正規化成內部型別（`LookupResult`、`TranslationResult`），UI 不接觸外部 API 的原始格式。

- **理由**：服務層純函式易於 TDD；未來換資料來源只改正規化層

## Risks / Trade-offs

- [外部免費 API 無 SLA，可能停機或改版] → 代理層集中處理：每個外部呼叫設 8 秒逾時、備援鏈、統一繁中錯誤訊息；服務層測試以固定的 fixture 資料執行，不依賴外部服務
- [MyMemory 匿名額度 5,000 字元/日，共用 IP 可能提早用罄] → 回應中的 `quotaFinished` 欄位觸發友善錯誤訊息；額度計算以伺服器出口 IP 為準，正式部署時需留意
- [Wiktionary 回傳 HTML 需清洗] → 正規化層以測試覆蓋常見格式（連結、粗體、usage label）
- [Web Speech API 各瀏覽器 en-US 語音品質不一，且需使用者互動後才能播放] → 播放一律由按鈕點擊觸發；瀏覽器不支援 Web Speech API 且無音檔時隱藏發音按鈕（en-US 語音選用交由瀏覽器處理，`getVoices()` 非同步不做同步偵測）；音檔播放失敗時自動改用 TTS
- [輸入類型啟發式會有誤判] → UI 提供一鍵切換查詢模式（見 D2）

## Migration Plan

全新專案，無遷移需求。部署策略（Vercel 或其他平台）不在此變更範圍內。

## Open Questions

- 無 — 資料來源、備援策略與範圍皆已確認
