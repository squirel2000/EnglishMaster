## 1. 繁體中文釋義（2-5 筆常用釋義）

- [x] 1.1 從 `translation-api.ts` 抽出可重用的單段翻譯函式（含 quotaFinished 偵測），加上模組層級記憶體快取（容量上限，先進先出淘汰）；TDD：先寫翻譯成功／失敗／額度耗盡／快取命中測試
- [x] 1.2 變更型別：`DefinitionEntry` 新增 `definitionZh: string | null`；`lookup-service` 於基礎結果確定後將釋義截為前 5 筆並平行翻譯（`allSettled`，失敗該筆為 null）；同步修正受影響的 fixtures 與測試
- [x] 1.3 `DictionaryResult.tsx` 釋義改雙語呈現（中文為主、英文對照；`definitionZh` 為 null 時僅英文）；`globals.css` 補對應樣式；TDD：雙語顯示與降級顯示測試

## 2. 雙語例句（英＋中）

- [x] 2.1 變更型別：`examples` 由 `string[]` 改為 `{ en: string; zh: string | null }[]`；`lookup-service` 例句保證邏輯與 Tatoeba 合併去重改用 `en` 欄位；例句翻譯併入釋義翻譯批次；同步修正 fixtures 與測試
- [x] 2.2 `DictionaryResult.tsx` 例句改英中對照呈現（單句 zh 為 null 時僅英文）；`globals.css` 補樣式；TDD：對照顯示與單句降級測試

## 3. 同義字詞／反義字詞

- [ ] 3.1 擴充 `dictionary-api.ts` normalizer：擷取 meaning 層與 definition 層的 synonyms/antonyms，去重、各截 8 筆；`LookupResult` 新增 `synonyms: string[]`、`antonyms: string[]`（Wiktionary 路徑回傳空陣列）；TDD：以含 synonyms 的 fixture 驗證彙整與去重
- [ ] 3.2 `DictionaryResult.tsx` 卡片尾端新增同義／反義區塊（空清單省略整塊）；`globals.css` 補樣式；TDD：有資料顯示、空清單省略測試

## 4. 常用片語／相關片語

- [ ] 4.1 新增 `src/lib/datamuse-api.ts`：`sp=<term> *`、`max=6`、8 秒逾時，回傳片語字串陣列，失敗回空陣列；`LookupResult` 新增 `relatedPhrases: string[]`，`lookup-service` 與翻譯批次平行呼叫；TDD：成功、逾時、空結果測試
- [ ] 4.2 `DictionaryResult.tsx` 卡片尾端新增常用片語區塊（空清單省略）；`globals.css` 補樣式；TDD：顯示與省略測試

## 5. 驗證

- [ ] 5.1 `npm run build` 與 `npm run lint` 通過
- [ ] 5.2 `npm run test` 全數通過（既有測試因型別變更同步更新後仍綠）
- [ ] 5.3 瀏覽器實測：查單字（hello／happy）與片語（give up），確認雙語釋義、雙語例句、同義反義、常用片語各區塊與降級行為符合規格，無主控台錯誤
