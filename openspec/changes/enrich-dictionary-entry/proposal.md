## Why

目前字典查詢結果與產品初衷（給中文母語學習者的「繁中釋義輔助」）不符：釋義只有英文原文、例句只有英文，也沒有任何幫助應用與記憶的字詞聯想資訊。對照 README 與使用者確認的期待，查一個英文單字應該直接得到繁體中文的解釋、中英對照的例句，以及同義／反義與常用片語的延伸。

## What Changes

- 釋義改為「常用釋義 2-5 筆」，每筆附繁體中文翻譯（保留英文原文對照）；翻譯不可用時退回僅顯示英文，查詢本身不失敗。
- 例句維持既有 2-3 句保證，每句附繁體中文翻譯（英＋中對照）；單句翻譯失敗時該句退回僅顯示英文。
- 新增「同義字詞／反義字詞」區塊：取自 Free Dictionary API 既有但目前被 normalizer 丟棄的 synonyms/antonyms 欄位（若無則整塊省略）。
- 新增「常用片語／相關片語」區塊：以 Datamuse API（免費、無需金鑰，已實測可用）的萬用字元查詢取得以該字開頭的高頻片語（若無則整塊省略）。
- 詞條卡片 UI 對應新增上述區塊與雙語排版。
- **BREAKING**（僅限內部 API）：`LookupResult` 資料形狀變更——釋義項目新增中文欄位、例句由字串陣列改為物件陣列、新增同義／反義／片語欄位。`/api/lookup` 回應體隨之改變；本專案前端是唯一消費者，無外部相容性負擔。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `dictionary-lookup`：釋義需求改為 2-5 筆常用釋義附繁中翻譯；例句需求改為中英對照；新增同義／反義字詞與常用片語兩項需求（含來源失敗時的優雅省略）
- `dictionary-ui-presentation`：詞條卡片需求更新——釋義雙語呈現、例句雙語呈現、卡片尾端新增字詞聯想區塊（若有資料）

## Impact

- 受影響檔案：`src/lib/types.ts`、`src/lib/dictionary-api.ts`、`src/lib/wiktionary-api.ts`、`src/lib/lookup-service.ts`、`src/lib/translation-api.ts`（抽出可重用的逐句翻譯）、新增 `src/lib/datamuse-api.ts`、`src/components/DictionaryResult.tsx`、`src/app/globals.css`（新區塊樣式），及上述各檔對應測試
- 新增執行期外部相依：Datamuse API（免費、無需 API key）
- 翻譯額度：釋義與例句翻譯共用 MyMemory 匿名額度（約 5,000 字元/日，與整句翻譯同一額度池）。以「只翻譯會顯示的內容（至多 5 釋義＋3 例句）＋伺服器端記憶體快取＋額度耗盡時優雅退回英文」控制消耗；此為免費無金鑰限制下的已知取捨
- 不影響整句翻譯、發音播放、查詢入口等既有功能
