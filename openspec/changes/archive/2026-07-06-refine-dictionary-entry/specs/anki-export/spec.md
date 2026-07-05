# anki-export：Anki 匯出（預備階段）

## ADDED Requirements

### Requirement: Anki 卡片內容組裝
系統 SHALL 提供純函式將字典查詢結果組裝為 AnkiConnect `addNote` 相容的卡片內容：正面含字詞與音標（若有），背面含雙語釋義、例句、同義反義字詞與常用片語（各區塊若無資料則省略）。組裝 SHALL 為純資料轉換，不發出任何網路請求。

#### Scenario: 組裝完整詞條
- **WHEN** 以含雙語釋義、例句、同義反義與片語的查詢結果呼叫組裝函式
- **THEN** 回傳的卡片內容正面含字詞與音標，背面含上述各區塊

#### Scenario: 組裝部分資料的詞條
- **WHEN** 查詢結果缺少音標、例句或聯想資料
- **THEN** 回傳的卡片內容省略對應部分，其餘照常組裝

### Requirement: 未連結狀態的匯出入口
系統 SHALL 在詞條卡片提供「加入 Anki」按鈕；Anki 連線尚未啟用時，按鈕 SHALL 呈現不可用（disabled）狀態並說明連結尚未啟用，且無論如何 SHALL NOT 對 Anki 發出任何網路請求。

#### Scenario: 未連結狀態顯示
- **WHEN** 使用者查得字典結果且 Anki 連線未啟用
- **THEN** 詞條卡片顯示不可點擊的「加入 Anki」按鈕，並帶有連結尚未啟用的說明

#### Scenario: 未連結狀態不發出請求
- **WHEN** Anki 連線未啟用
- **THEN** 系統不對 AnkiConnect 端點發出任何網路請求
