## Why

原介面完全未設計（僅瀏覽器預設樣式：黑白 Arial、無留白、無視覺層級），不利於長時間查詢與閱讀，也無法呈現這是一個給中文母語學習者使用的英語查詢工具。需要一套深色、閱讀舒適、且呼應「查字典」情境的視覺設計。

## What Changes

- 全站改為深色主題（單一深色主題，不再依賴 `prefers-color-scheme` 切換淺色/深色）。
- 建立字體、色彩、間距的設計系統：Source Serif 4（headword／網站標題）、IBM Plex Sans（一般介面文字，含繁體中文後備字體）、IBM Plex Mono（音標與詞性標籤）三種字體角色分工；深墨綠底搭配黃銅金主色調。
- 查詢結果改為卡片式呈現：字典查詢結果為「詞條卡片」（headword、音標、發音按鈕、編號釋義、引文樣式例句）；整句翻譯結果為對應的「句子卡片」（原句、發音按鈕、中文翻譯）。
- 發音按鈕由 emoji 圖示改為 inline SVG 圖示。
- 新增待查詢（idle）狀態的範例查詢建議，可直接點擊執行查詢。
- 查詢輸入框、模式切換連結、錯誤訊息、載入狀態全面重新設計。

## Capabilities

### New Capabilities
- `dictionary-ui-presentation`：深色主題視覺呈現，以及查詢結果（字典查詢／整句翻譯）的卡片化排版結構

### Modified Capabilities
- `lookup-query`：待查詢（idle）狀態新增可點擊的範例查詢建議，作為查詢輸入的額外入口

## Impact

- 受影響檔案：`src/app/layout.tsx`、`src/app/globals.css`、`src/app/page.tsx`、`src/components/SearchBox.tsx`、`src/components/DictionaryResult.tsx`、`src/components/PronunciationButton.tsx`、`src/components/TranslationResultView.tsx`，及其對應測試檔
- 新增建置期相依：`next/font/google`（Source Serif 4、IBM Plex Sans、IBM Plex Mono，由 Next.js 於建置時自動下載並自我託管）
- 附帶變更：新增 `.claude/launch.json`（開發伺服器預覽設定）；重新產生 `package-lock.json`（修復 Windows 原生模組安裝問題，相依版本無實質變動）
- 不影響任何 API 路由、資料來源或商業邏輯；既有 66 個測試全數通過，測試所依賴的 accessible name 與文字內容未變更（翻譯卡片的「整句翻譯」標題改為「原句／中文翻譯」區塊標籤，無測試依賴該標題）；另為範例查詢建議與空例句省略行為新增 4 個測試，合計 70 個測試（13 個測試檔案）
