# dictionary-lookup：單字與片語查詢

## ADDED Requirements

### Requirement: 單字與片語釋義
系統 SHALL 查詢單字或片語，回傳至少一筆釋義，每筆釋義包含詞性與繁體中文介面標示；有音標時 SHALL 一併回傳。

#### Scenario: 查詢單字
- **WHEN** 使用者查詢 "hello"
- **THEN** 系統顯示各詞性（noun、verb、interjection 等）的釋義與音標

#### Scenario: 查詢片語
- **WHEN** 使用者查詢 "give up"
- **THEN** 系統顯示該片語的釋義（如 to surrender、to stop or quit）

### Requirement: 例句數量保證
系統 SHALL 為每次成功的字典查詢提供 2-3 個例句；主要資料來源例句不足 2 句時，系統 SHALL 以 Tatoeba API 補充至 2 句以上，最多顯示 3 句。

#### Scenario: 主要來源例句充足
- **WHEN** 字典 API 回傳 3 個以上例句
- **THEN** 系統顯示其中 3 個例句，不呼叫補充來源

#### Scenario: 例句不足時補充
- **WHEN** 字典 API 僅回傳 0-1 個例句
- **THEN** 系統向 Tatoeba API 查詢補充例句，合併後顯示 2-3 句

#### Scenario: 補充來源亦失敗
- **WHEN** 例句不足且 Tatoeba API 查詢失敗
- **THEN** 系統顯示既有的釋義與例句（可能少於 2 句），不因補充失敗而中斷查詢

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
