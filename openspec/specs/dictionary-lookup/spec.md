# dictionary-lookup：單字與片語查詢

## Purpose

透過多個外部 API 查詢英文單字或片語的釋義、音標與例句，提供繁體中文翻譯、同義反義與常用片語等學習輔助，並具備備援鏈、例句數量保證與逾時保護機制。

## Requirements

### Requirement: 單字與片語釋義
系統 SHALL 查詢單字或片語，依資料來源排序取前列釋義 2-5 筆（來源不足 2 筆時照實顯示），每筆釋義包含詞性、英文原文與繁體中文翻譯；有音標時 SHALL 一併回傳。任一筆釋義的中文翻譯失敗或翻譯額度耗盡時，該筆 SHALL 退回僅含英文原文，查詢本身不得因此失敗。

#### Scenario: 查詢單字
- **WHEN** 使用者查詢 "hello"
- **THEN** 系統顯示至多 5 筆釋義，每筆含詞性、英文原文與繁體中文翻譯，並顯示音標

#### Scenario: 查詢片語
- **WHEN** 使用者查詢 "give up"
- **THEN** 系統顯示該片語的釋義（如 to surrender 放棄、to stop or quit 停止），含繁體中文翻譯

#### Scenario: 翻譯額度耗盡時的釋義降級
- **WHEN** 字典查詢成功但 MyMemory 翻譯額度已耗盡
- **THEN** 系統顯示英文釋義（無中文翻譯），查詢結果照常呈現，不顯示錯誤畫面

### Requirement: 例句數量保證
系統 SHALL 為每次成功的字典查詢提供 2-3 個例句；主要資料來源例句不足 2 句時，系統 SHALL 以 Tatoeba API 補充至 2 句以上，最多顯示 3 句。每個例句 SHALL 附繁體中文翻譯；單句翻譯失敗時該句 SHALL 退回僅顯示英文，不影響其他例句與查詢結果。

#### Scenario: 主要來源例句充足
- **WHEN** 字典 API 回傳 3 個以上例句
- **THEN** 系統顯示其中 3 個例句（英文原句＋繁體中文翻譯），不呼叫補充來源

#### Scenario: 例句不足時補充
- **WHEN** 字典 API 僅回傳 0-1 個例句
- **THEN** 系統向 Tatoeba API 查詢補充例句，合併後顯示 2-3 句（英文原句＋繁體中文翻譯）

#### Scenario: 補充來源亦失敗
- **WHEN** 例句不足且 Tatoeba API 查詢失敗
- **THEN** 系統顯示既有的釋義與例句（可能少於 2 句），不因補充失敗而中斷查詢

#### Scenario: 單句翻譯失敗
- **WHEN** 某個例句的翻譯呼叫失敗，其餘例句翻譯成功
- **THEN** 失敗的例句僅顯示英文，其餘例句顯示英中對照

### Requirement: 同義與反義字詞
系統 SHALL 在字典查詢結果中彙整資料來源提供的同義字詞與反義字詞（去除重複、各至多 8 筆）；資料來源未提供時 SHALL 回傳空清單，由呈現層省略該區塊，不得影響查詢結果其餘內容。

#### Scenario: 來源提供同義字詞
- **WHEN** Free Dictionary API 對查詢字詞回傳非空的 synonyms/antonyms 資料
- **THEN** 系統回傳去重後的同義與反義字詞清單（各至多 8 筆）

#### Scenario: 來源無同義反義資料
- **WHEN** 資料來源（如 Wiktionary 備援）未提供 synonyms/antonyms
- **THEN** 系統回傳空清單，釋義與例句照常呈現

### Requirement: 常用相關片語
系統 SHALL 以 Datamuse API 查詢以該字詞開頭的常用片語（依頻率排序，至多 6 筆）；查詢失敗、逾時或無結果時 SHALL 回傳空清單，由呈現層省略該區塊，不得影響查詢結果其餘內容。

#### Scenario: 取得常用片語
- **WHEN** 使用者查詢 "give" 且 Datamuse 回傳片語結果
- **THEN** 系統回傳如 give in、give up、give away 等常用片語（至多 6 筆）

#### Scenario: 片語來源失敗
- **WHEN** Datamuse API 逾時或回應錯誤
- **THEN** 系統回傳空清單，字典查詢結果照常呈現

### Requirement: 資料來源備援鏈
系統 SHALL 依序嘗試資料來源：Free Dictionary API 優先，失敗或查無結果時改用 Wiktionary REST API；Wiktionary 回傳的 HTML 標記 SHALL 清洗為純文字後才呈現。

#### Scenario: 主要來源查無、備援命中
- **WHEN** Free Dictionary API 查無 "kick the bucket"，而 Wiktionary 有收錄
- **THEN** 系統顯示 Wiktionary 的釋義與例句，且內容不含 HTML 標籤

#### Scenario: 全部來源查無結果
- **WHEN** 兩個資料來源皆查無輸入的字詞
- **THEN** 系統回報查無結果，由查詢入口顯示對應訊息

### Requirement: 外部呼叫逾時保護
系統 SHALL 對每個外部 API 呼叫設定 8 秒逾時；逾時視同該來源失敗，依備援鏈繼續。

#### Scenario: 主要來源逾時
- **WHEN** Free Dictionary API 超過 8 秒未回應
- **THEN** 系統中止該請求並改用 Wiktionary 查詢
