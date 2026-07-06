## Why

上一輪把例句改為歸屬釋義後，畫面體驗其實不一致：字典來源有沒有替某個字的義項提供例句，決定了畫面長怎樣——「give up」每筆釋義下面都接自己的例句，但「master」「serendipity」因為來源沒給義項例句，變成兩個義項完全沒有例句、所有例句集中在下面獨立的「更多例句」區塊。使用者確認：不管來源有沒有義項例句，畫面體驗都要一致。

## What Changes

- 取消「補充例句」作為獨立於釋義之外的概念：當某筆釋義本身沒有來源提供的例句時，系統依序把 Tatoeba 補充例句指派給尚無例句的釋義（依釋義顯示順序），呈現方式與義項自帶例句完全相同——次行例句（英＋中），不再有獨立的「更多例句」區塊。
- `LookupResult.examples`（補充例句清單）欄位移除；`DictionaryResult.tsx` 移除「更多例句」區塊與其標籤；`anki.ts` 的卡片背面移除對應的獨立區塊（例句已經隨每筆釋義呈現在釋義區塊裡）。
- 翻譯批次相應簡化：不再需要區分「義項例句」與「補充例句」兩組分段，指派完成後兩者已統一為 `definitions[].example`，合併為同一組分段。
- **BREAKING**（僅限內部 API）：`LookupResult` 移除 `examples` 欄位。`/api/lookup` 回應體隨之改變；本專案前端是唯一消費者。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `dictionary-lookup`：例句數量保證需求改為——義項本身無例句時，依序指派補充例句給尚無例句的釋義，不再保留獨立於釋義之外的例句清單
- `dictionary-ui-presentation`：字典查詢結果卡片呈現需求移除「更多例句」區塊
- `anki-export`：Anki 卡片內容組裝需求移除獨立的補充例句段落（例句已隨釋義呈現）

## Impact

- 受影響檔案：`src/lib/types.ts`、`src/lib/lookup-service.ts`、`src/lib/dictionary-api.ts`、`src/lib/wiktionary-api.ts`、`src/lib/anki.ts`、`src/components/DictionaryResult.tsx`、`src/app/globals.css`，及各檔對應測試
- 不影響 Tatoeba／MyMemory／Datamuse 的呼叫方式或翻譯額度控制策略；只改變「補充例句要指派到哪裡」，總量保證（2-3 句）不變
- 不影響同義反義、片語、Anki 未連結按鈕等既有行為
