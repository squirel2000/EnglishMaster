## 1. 服務層：依序指派補充例句、移除獨立清單

- [x] 1.1 重做 `lookup-service` 的例句保證邏輯：義項例句總數 < 2 時，向 Tatoeba 取得補充例句（與義項例句去重），依釋義顯示順序指派給尚無例句的釋義；`LookupResult.examples` 欄位移除；`types.ts` 同步移除該欄位；同步修正兩個 normalizer（不再需要輸出空的 `examples: []`）與所有受影響的 fixtures／測試（TDD：義項例句充足、依序指派、補充數量不足、補充來源失敗、翻譯降級）
- [x] 1.2 簡併 `withTranslations` 的分段結構：原本「義項例句」與「補充例句」兩組分段合併為一組（指派已在 1.1 完成，此時 `definitions[].example` 已是唯一來源）；保留稀疏索引游標邏輯套用在合併後的單一組；更新批次計數相關測試

## 2. 呈現層：移除獨立區塊

- [x] 2.1 `DictionaryResult.tsx` 移除「更多例句」區塊與其 JSX／CSS；確認例句一律隨釋義次行呈現，無論來源是義項自帶或依序指派；TDD：來源有義項例句、來源無義項例句（改用 serendipity 風格的 fixture）兩種情境畫面一致
- [x] 2.2 `anki.ts` 的 `buildAnkiNote` 移除獨立的補充例句背面段落；確認例句已隨每筆釋義呈現在背面釋義列表；TDD：完整組裝、部分資料組裝

## 3. 驗證

- [x] 3.1 `npm run build` 與 `npm run lint` 通過
- [x] 3.2 `npm run test` 全數通過
- [x] 3.3 瀏覽器實測：查 "give up"（義項自帶例句）與 "serendipity" 或 "master"（義項無例句，須補充），確認兩者釋義區塊的視覺結構一致、無獨立例句區塊、無主控台錯誤
