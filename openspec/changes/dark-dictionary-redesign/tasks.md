## 1. 字體與設計系統基礎

- [x] 1.1 於 `src/app/layout.tsx` 透過 `next/font/google` 載入 Source Serif 4、IBM Plex Sans、IBM Plex Mono，並以 CSS 變數掛載於 `<html>`
- [x] 1.2 於 `src/app/globals.css` 建立色彩（深墨綠底＋黃銅金強調色＋獨立警示色）、字體角色、間距與版面的設計系統 token
- [x] 1.3 加入 `prefers-reduced-motion` 保護與 `:focus-visible` 樣式

## 2. 查詢輸入與版面重構

- [x] 2.1 重新設計 `src/components/SearchBox.tsx`：查詢圖示、輸入框、送出按鈕，保留既有 accessible name 與文字內容
- [x] 2.2 重構 `src/app/page.tsx`：新增站頭（wordmark／tagline）、待查詢狀態的範例查詢建議、載入狀態、卡片化的結果／錯誤呈現

## 3. 查詢結果卡片

- [x] 3.1 重新設計 `src/components/DictionaryResult.tsx`：詞條卡片（headword、音標、發音按鈕、編號釋義、例句引文樣式）
- [x] 3.2 重新設計 `src/components/TranslationResultView.tsx`：句子卡片（原句、發音按鈕、中文翻譯）
- [x] 3.3 重新設計 `src/components/PronunciationButton.tsx`：以 inline SVG 圖示取代 emoji

## 4. 驗證

- [x] 4.1 執行 `npm run build`，確認 TypeScript 與建置成功
- [x] 4.2 執行 `npm run lint`，確認無錯誤
- [x] 4.3 執行 `npm run test`，確認既有 66 個測試全數通過且測試所依賴的 accessible name／文字內容未變動；為範例查詢建議與空例句省略行為補上 4 個新測試，合計 70 個測試（13 個測試檔案）全數通過
- [x] 4.4 於瀏覽器實際操作：字典查詢、整句翻譯、查無結果錯誤、範例建議點擊、窄螢幕版面堆疊，確認色彩／字體／版面符合設計，且無主控台錯誤
