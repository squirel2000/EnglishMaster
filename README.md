# EnglishMaster

網頁版英語學習平台。查詢英文單字、片語或整句，取得繁中釋義輔助：

- 單字/片語：釋義（含詞性）、音標、2-3 個例句
- 整句：繁體中文翻譯
- 美式（US）發音：真人音檔優先，無音檔時使用瀏覽器語音合成

## 資料來源（皆為免費、無需 API key）

| 用途 | 服務 |
|---|---|
| 單字/片語釋義 | Free Dictionary API（dictionaryapi.dev） |
| 慣用語備援 | Wiktionary REST API |
| 例句補充 | Tatoeba API |
| 整句翻譯 | MyMemory API（匿名額度約 5,000 字元/日） |

## 開發

```bash
npm install
npm run dev        # http://localhost:3000
npm run test       # Vitest 單元測試
npm run lint       # ESLint
npm run build      # production build
```

開發約定見 `openspec/config.yaml`；功能規格見 `openspec/changes/add-dictionary-lookup/`。
