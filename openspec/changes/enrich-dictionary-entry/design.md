## Context

現行查詢管線：Free Dictionary（主）→ Wiktionary（備援）→ Tatoeba（例句補充），回傳 `LookupResult`（英文釋義字串、英文例句字串陣列）。前端 `DictionaryResult` 以詞條卡片呈現。整句翻譯已有 `translation-api.ts`（MyMemory，`en|zh-TW`，含 quotaFinished 偵測）。Free Dictionary 的 meaning 與 definition 兩層都帶 `synonyms`/`antonyms` 陣列（已以真實 API 驗證），但現行 normalizer 未擷取。Datamuse `words?sp=<term>%20*` 已實測：回傳以該字開頭、按頻率評分的常用片語（如 give → give in / give up / give away）。

## Goals / Non-Goals

**Goals:**
- 釋義與例句對中文母語學習者「開箱即懂」：中文為主、英文對照。
- 字詞聯想（同義／反義／片語）幫助應用與記憶。
- 所有增益（enrichment）失敗都不得讓原本會成功的查詢失敗——延續 Tatoeba 補充的既有原則。

**Non-Goals:**
- 不做人工詞庫或離線詞典（維持免費、無金鑰的線上來源）。
- 不為 Wiktionary 備援路徑補同義／反義（該來源無此資料，區塊省略即可）。
- 不做使用者帳號或個人化額度管理。
- 不改整句翻譯模式的行為。

## Decisions

### 中文釋義／例句翻譯：重用 MyMemory，而非引入新翻譯來源
逐句呼叫既有 MyMemory 端點（`en|zh-TW`），以 `Promise.allSettled` 平行處理至多 8 段短文字（5 釋義＋3 例句）。
- 替代方案：非官方 Google 翻譯端點（違反服務條款，不能寫進規格）；Lingva／LibreTranslate 公共實例（第三方維運不穩或需金鑰）。MyMemory 已在專案內、行為已知、額度訊號（`quotaFinished`）已有處理慣例。
- 從 `translation-api.ts` 抽出可重用的單段翻譯函式供釋義／例句共用，維持一處管理端點與錯誤語意。

### 額度控制：伺服器端記憶體快取＋優雅降級
- 模組層級 `Map` 快取（key＝原文，容量上限約 500，超出時淘汰最舊），同字重查零額度消耗。dev/單機部署下的生命週期＝伺服器行程，足夠。
- 任一段翻譯失敗或額度耗盡：該段 `zh` 為 `null`，UI 僅顯示英文；查詢照常成功。不因翻譯把字典查詢變成錯誤畫面。
- 已知取捨：匿名額度約 5,000 字元/日、與整句翻譯共用。未來可加 MyMemory `de=<email>` 參數把額度提高到 50,000 字元/日，本次不實作（不在 repo 內放個人資料）。

### 「常用釋義 2-5 筆」的語意：取來源排序前 5 筆
Free Dictionary 的義項排序大致反映常用度，且是免費來源中唯一可用的訊號。規格寫為「依資料來源排序取前列 2-5 筆」；來源不足 2 筆時照實顯示，不硬湊。原本「全部義項」改為截斷至 5，避免翻譯額度浪費在罕用義項上。

### 同義／反義：擴充 Free Dictionary normalizer
彙整 meaning 層與 definition 層的 `synonyms`/`antonyms`，去重、各截 8 筆。Wiktionary 路徑回傳空陣列。空陣列時 UI 整塊省略（規格「若有」）。

### 常用片語：Datamuse 萬用字元查詢
`GET https://api.datamuse.com/words?sp=<term>%20*&max=6`（新模組 `datamuse-api.ts`，8 秒逾時與其他外部呼叫一致）。多字詞條（片語查片語）同樣適用（`give up *` → give up the ghost）。失敗或空結果 → 區塊省略。
- 替代方案：Datamuse `rel_bga`（實測只回 the/a/you 等功能詞，不可用）；Wiktionary derived terms（需解析 HTML 章節，工程量大且不穩）。

### 增益編排：全部掛在 lookup-service 的後處理階段
基礎結果（含例句保證）確定後，平行執行「翻譯批次」與「Datamuse 片語」，`allSettled` 收攏；任何增益失敗只影響該區塊。翻譯在 lookup-service 層做（而非各 normalizer 內），Wiktionary 備援路徑因此同樣獲得中文釋義。

### 型別變更（BREAKING，內部）
```ts
DefinitionEntry { partOfSpeech; definition; definitionZh: string | null }
ExampleEntry    { en: string; zh: string | null }
LookupResult    { ...; examples: ExampleEntry[]; synonyms: string[]; antonyms: string[]; relatedPhrases: string[] }
```
`/api/lookup` 回應體隨型別改變；前端同步更新。既有測試與 fixtures 於各任務內同步修正，每個 commit 測試全綠。

## Risks / Trade-offs

- [風險] MyMemory 額度耗盡後釋義只剩英文 → [緩解] 快取＋只翻顯示內容；UI 降級仍完整可用；額度狀態不阻斷查詢。
- [風險] 機器翻譯品質（尤其片語義項的直譯）→ [緩解] 保留英文原文對照，中文定位為輔助；此為免費來源的已知品質天花板。
- [風險] Datamuse 片語含粗俗詞（實測 give 的結果含一筆）→ [緩解] 取前 6 筆高頻結果為主，不做內容過濾（非本次範圍）；如日後需要可加黑名單。
- [風險] 每次查詢外部呼叫數上升（最多 1 字典＋1 Tatoeba＋8 翻譯＋1 Datamuse）→ [緩解] 平行執行、逐段 8 秒逾時、快取；最壞情況延遲仍受單段逾時上限約束。
- [風險] 型別 BREAKING 造成中途 commit 紅燈 → [緩解] 任務排序讓每個 commit 自含（型別＋來源＋測試一起改）。

## Migration Plan

純內部形狀變更，無資料庫、無外部消費者。部署即生效；回滾＝回退 commit。無需資料遷移。

## Open Questions

- 未來是否要以 `de=<email>` 提高 MyMemory 額度（需決定放哪個信箱、是否進版控）。
- 同義／反義是否需要中文翻譯（本次僅列英文字詞，點擊可再查；若要翻譯會再吃額度）。
