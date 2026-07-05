# sentence-translation：整句翻譯

## Purpose

透過 MyMemory API 將英文句子翻譯為繁體中文，並妥善處理額度耗盡與服務失敗情境。

## Requirements

### Requirement: 英文整句翻譯為繁體中文
系統 SHALL 將使用者輸入的英文句子透過 MyMemory API 翻譯為繁體中文（langpair `en|zh-TW`）並顯示譯文。

#### Scenario: 成功翻譯
- **WHEN** 使用者查詢 "How are you doing today?"
- **THEN** 系統顯示繁體中文譯文（如「您今天好嗎？」）與原句

### Requirement: 翻譯額度耗盡處理
系統 SHALL 偵測 MyMemory 回應中的額度耗盡訊號（`quotaFinished`），並以繁體中文告知使用者今日翻譯額度已用完。

#### Scenario: 額度耗盡
- **WHEN** MyMemory API 回應 `quotaFinished: true`
- **THEN** 系統顯示「今日翻譯額度已用完，請明天再試」，不顯示空白或錯誤的譯文

### Requirement: 翻譯失敗處理
系統 SHALL 在翻譯 API 呼叫失敗（逾時 8 秒、網路錯誤或非 200 回應）時回報錯誤，由查詢入口顯示友善訊息；整句發音功能不受翻譯失敗影響。

#### Scenario: 翻譯服務逾時
- **WHEN** MyMemory API 超過 8 秒未回應
- **THEN** 系統顯示翻譯失敗訊息，但整句的發音按鈕仍可使用
