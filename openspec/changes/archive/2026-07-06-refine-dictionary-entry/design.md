## Context

現行詞條：釋義（雙語，截前 5）與例句（雙語，2-3 句保證＋Tatoeba 補充）是兩個互不關聯的區塊；片語是英文-only 字串 chip；查詢結果無法保存。兩個字典來源（Free Dictionary 的 `definitions[].example`、Wiktionary 的 `definitions[].examples[]`）其實都提供「義項層級」的例句，是現行 normalizer 自己攤平的——資料面支援義項歸屬，不需要新來源。

## Goals / Non-Goals

**Goals:**
- 例句與義項的對應關係可見（學哪個意思、用哪個例句）。
- 片語看得懂（繁中解釋），不用二次查詢。
- Anki 匯出的內容組裝與 UI 入口先就緒，之後開啟連線時只需接上傳輸層。

**Non-Goals:**
- 不實際連接 AnkiConnect、不對 Anki 做整合測試（使用者明確指示：先做、不連結、不測試連線）。
- 不做 Anki 設定 UI（deck／model 選擇）——先用固定預設值。
- 不改整句翻譯模式。
- 不為補充例句偽造義項歸屬（Tatoeba 是詞層級資料，誠實呈現為「更多例句」）。

## Decisions

### 例句歸屬：義項例句掛在 DefinitionEntry 上，補充例句獨立呈現
```ts
DefinitionEntry { partOfSpeech; definition; definitionZh; example: ExampleEntry | null }
LookupResult    { ...; examples: ExampleEntry[] /* 語意改為：補充例句（更多例句區塊）*/ }
```
- 兩個 normalizer 都改為：該定義的第一個來源例句掛進 `example`（每義項至多 1 句，控制版面與額度），不再攤平。
- 既有「2-3 句保證」的新語意：顯示中的前 5 筆釋義所帶例句總數 ≥ 2 時不補充；不足時呼叫 Tatoeba，補充句進 `examples`（更多例句），使「義項例句＋補充例句」總數落在 2-3。補充句與義項例句以英文句去重。
- 替代方案：把 Tatoeba 句塞給沒例句的義項——資料上是詞層級句子，掛到特定義項是錯誤標註，否決。

### 排版：釋義區塊內完成「中→英→例句」
每筆編號釋義：第一行中文釋義（主）＋英文原文緊接其後（同行、較淡樣式）；次行起為該義項例句（英文原句＋中文翻譯）。無中文翻譯時整行僅英文（既有降級規則）；無義項例句時該筆不顯示例句行。「更多例句」區塊僅在有補充句時出現，樣式沿用現行例句引文樣式。

### 片語繁中解釋：進同一個翻譯批次
`relatedPhrases: { en: string; zh: string | null }[]`。片語（至多 6）加入既有 `withTranslations` 單一 `allSettled` 批次；單筆失敗該筆 zh 為 null，chip 僅顯示英文。
- 批次上限：5 釋義＋（至多 5 義項例句 或 3 補充句）＋6 片語 ≈ 最壞 16 段。快取（同字重查零消耗）與優雅降級不變；額度風險已在前次變更記錄，本次僅上修最壞值。
- 替代方案：片語用字典 API 再查一次取定義——每片語一次外部呼叫、延遲與失敗面翻倍，且 MyMemory 對短片語的翻譯品質可接受，否決。

### Anki：payload 組裝與傳輸層分離，本次只做前者
新模組 `src/lib/anki.ts`：
- `buildAnkiNote(result: LookupResult): AnkiNote` — 純函式，組出 AnkiConnect `addNote` 相容的 payload（deck `EnglishMaster`、model `Basic`、Front：字詞＋音標、Back：HTML 組裝的雙語釋義／例句／同義反義／片語），單元測試完整覆蓋。
- `isAnkiLinked(): boolean` — 本次恆為 `false`（常數旗標），UI 據此顯示「尚未連結」狀態。
- 傳輸函式（POST `http://127.0.0.1:8765`）本次「不實作」，只留介面註解——避免倉庫裡出現寫了但沒測過的網路程式碼。
- UI：詞條卡片 head 區新增「加入 Anki」按鈕；未連結狀態下按鈕可見但 disabled，並以 `title`/輔助文字說明「Anki 連結尚未啟用」；點擊不觸發任何網路請求（disabled 天然保證）。
- 替代方案：按鈕可點、點了顯示「已準備卡片」toast——會讓使用者誤以為已存進 Anki，未連結階段以 disabled 呈現最誠實。

### 型別遷移策略
`LookupResult.examples` 保留欄位名（補充例句語意）以縮小 diff；`DefinitionEntry.example` 為新增必填欄位（`ExampleEntry | null`）。每個任務的 commit 自含（型別＋來源＋測試同步），suite 全綠。

## Risks / Trade-offs

- [風險] 最壞 16 段翻譯使額度消耗上升 → [緩解] 快取、每義項至多 1 句、片語僅 6 筆；耗盡時全面退回英文，查詢不失敗。
- [風險] 義項例句品質參差（來源給的第一句未必最典型）→ [緩解] 取來源順序第一句是免費資料下的最佳訊號；更多例句區塊提供 Tatoeba 備援。
- [風險] Anki payload 格式與未來實連時的 AnkiConnect 版本不合 → [緩解] payload 依 AnkiConnect v6 `addNote` 公開格式組裝並以單元測試鎖定；實連時若需調整只動傳輸層。
- [風險] `examples` 欄位語意改變可能誤導未來讀者 → [緩解] types.ts JSDoc 明確標注「supplemental examples（更多例句）」。

## Migration Plan

純內部形狀變更；部署即生效，回滾＝回退 commit。Anki 功能無資料持久化。

## Open Questions

- Anki 實連時機與設定（AnkiConnect 位址／deck 名稱是否可設定）——留待啟用連線的後續變更。
- 片語繁中解釋若品質不佳，是否改用字典 API 對片語做二次查詢（延遲換品質）。
