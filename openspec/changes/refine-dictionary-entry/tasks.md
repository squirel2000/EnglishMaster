## 1. 例句歸屬釋義

- [x] 1.1 變更型別與來源：`DefinitionEntry` 新增 `example: ExampleEntry | null`；兩個 normalizer 改為將該定義的第一個來源例句掛進 `example`（不再攤平）；`LookupResult.examples` JSDoc 改標「補充例句」；同步修正 fixtures 與測試（TDD）
- [x] 1.2 重做 `lookup-service` 例句保證：計算顯示中前 5 筆釋義的義項例句總數，不足 2 時 Tatoeba 補充進 `examples`（與義項例句去重、合計 2-3）；翻譯批次涵蓋義項例句與補充例句（TDD：充足不補充、不足補充、去重、全部失敗容忍、批次計數）
- [x] 1.3 `DictionaryResult.tsx` 釋義區塊改組合排版（中文釋義＋英文緊接＋次行義項例句），例句區塊改為「更多例句」（僅有補充句時顯示）；`globals.css` 對應樣式；TDD：組合排版、無義項例句、更多例句顯示與省略

## 2. 片語繁中解釋

- [x] 2.1 `relatedPhrases` 改為 `{ en: string; zh: string | null }[]`：片語加入 `withTranslations` 單一批次（單筆失敗該筆 zh 為 null）；同步修正 fixtures 與測試（TDD：片語翻譯、單筆失敗降級、批次計數更新）
- [x] 2.2 片語 chip 改英中並列呈現（zh 為 null 時僅英文）；`globals.css` 補樣式；TDD：雙語顯示與降級

## 3. Anki 匯出預備

- [ ] 3.1 新增 `src/lib/anki.ts`：`buildAnkiNote(result)` 純函式（AnkiConnect v6 `addNote` 相容 payload；正面字詞＋音標、背面各區塊 HTML，缺料省略）與 `isAnkiLinked()`（恆 false 旗標）；TDD：完整組裝、部分資料組裝、不發網路請求
- [ ] 3.2 `DictionaryResult.tsx` head 區新增「加入 Anki」按鈕：未連結時 disabled＋說明文字；TDD：按鈕呈現、disabled 狀態、無網路請求

## 4. 驗證

- [ ] 4.1 `npm run build` 與 `npm run lint` 通過
- [ ] 4.2 `npm run test` 全數通過（既有測試隨形狀變更同步更新後仍綠）
- [ ] 4.3 瀏覽器實測：查 hello 與 give up，確認義項例句排版（中→英→例句）、更多例句區塊行為、片語中文解釋、Anki 按鈕 disabled 狀態與零網路請求，無主控台錯誤
