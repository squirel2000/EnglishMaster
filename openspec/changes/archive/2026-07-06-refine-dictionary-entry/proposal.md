## Why

上一輪的雙語詞條把例句集中成獨立區塊，與釋義脫鉤——學習者無法知道某個例句對應哪個義項；片語區塊只有英文，需要自己再查一次才懂意思；查到好詞條後也沒有管道存起來複習。這三點都直接影響「幫助應用與記憶」的產品目標。

## What Changes

- 例句改為歸屬各釋義：每筆釋義顯示「繁體中文釋義、英文原文緊接其後、次行為該義項的例句（英＋中）」；來源沒有為該義項提供例句時該筆不顯示例句。為維持每次查詢至少 2 句例句的既有保證，義項例句總數不足時以 Tatoeba 補充，集中於釋義列表後的「更多例句」區塊（無法歸屬特定義項的補充句不假裝歸屬）。
- 常用片語每筆附繁體中文解釋（MyMemory 翻譯，失敗時該筆僅顯示英文），型別由字串改為 `{ en, zh }` 物件。
- 新增「加入 Anki」預備功能：詞條卡片上有匯出按鈕與完整的卡片內容組裝邏輯（正面：字詞＋音標；背面：雙語釋義、例句、同義反義、片語），但本次不連接 AnkiConnect——按鈕呈現「尚未連結」狀態，點擊不發出任何網路請求；實際連線留待後續變更啟用。
- **BREAKING**（僅限內部 API）：`DefinitionEntry` 新增歸屬例句欄位、`LookupResult.examples` 語意改為「補充例句」、`relatedPhrases` 由 `string[]` 改為物件陣列。`/api/lookup` 回應體隨之改變；本專案前端是唯一消費者。

## Capabilities

### New Capabilities
- `anki-export`：Anki 卡片內容組裝與未連結狀態的匯出入口（本次僅預備，不實際連線）

### Modified Capabilities
- `dictionary-lookup`：例句需求改為義項歸屬制（含補充例句語意）；常用片語需求加上繁體中文解釋
- `dictionary-ui-presentation`：詞條卡片需求更新——釋義區塊改為「中文＋英文＋該義項例句」的組合排版、更多例句區塊、片語附中文解釋、新增 Anki 匯出按鈕

## Impact

- 受影響檔案：`src/lib/types.ts`、`src/lib/dictionary-api.ts`、`src/lib/wiktionary-api.ts`、`src/lib/lookup-service.ts`、新增 `src/lib/anki.ts`、`src/components/DictionaryResult.tsx`、`src/app/globals.css`，及各檔對應測試；`src/app/page.test.tsx` 與 `src/app/api/lookup/route.test.ts` 的 fixtures 隨形狀同步更新
- 翻譯額度：批次上限由 8 段升至約 16 段（5 釋義＋至多 5 義項例句或 3 補充句＋6 片語），仍以快取與優雅降級控制；額度共用的既有取捨不變，耗盡時全部退回英文
- 無新增外部相依（AnkiConnect 本次不連線）；不影響整句翻譯、發音、查詢入口
