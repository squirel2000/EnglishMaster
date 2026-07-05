# pronunciation-playback：美式發音播放

## ADDED Requirements

### Requirement: 美式發音播放
系統 SHALL 為查詢結果（單字、片語或整句）提供發音按鈕，點擊後播放美式（US）發音。

#### Scenario: 播放單字發音
- **WHEN** 使用者在 "hello" 的查詢結果點擊發音按鈕
- **THEN** 系統播放該字的美式發音

#### Scenario: 播放整句發音
- **WHEN** 使用者在整句翻譯結果點擊發音按鈕
- **THEN** 系統以美式語音朗讀整句英文原文

### Requirement: 音檔優先、TTS 備援
系統 SHALL 優先播放字典 API 提供的美式真人音檔；無美式音檔可用時，SHALL 改用 Web Speech API 以 `en-US` 語音合成發音。

#### Scenario: 有美式音檔
- **WHEN** 字典查詢結果的 phonetics 含美式音檔 URL
- **THEN** 發音按鈕播放該音檔

#### Scenario: 無音檔時使用 TTS
- **WHEN** 查詢結果無任何美式音檔（含片語與整句情境）
- **THEN** 發音按鈕改以 Web Speech API 的 en-US 語音朗讀查詢文字

#### Scenario: 音檔播放失敗時改用 TTS
- **WHEN** 音檔 URL 播放失敗（如連結失效），且瀏覽器支援 Web Speech API
- **THEN** 系統改以 en-US 語音朗讀查詢文字，不得無聲無息

### Requirement: 不支援語音時的優雅降級
系統 SHALL 在瀏覽器不支援 Web Speech API 且無音檔可播放時，隱藏發音按鈕；查詢結果的其餘內容 SHALL 正常顯示。（en-US 語音的選用交由瀏覽器語音機制處理，不做同步偵測 — `getVoices()` 為非同步且各瀏覽器行為不一）

#### Scenario: 瀏覽器不支援 TTS 且無音檔
- **WHEN** 瀏覽器無 Web Speech API 支援且查詢結果無音檔
- **THEN** 系統隱藏發音按鈕，釋義、例句或譯文照常顯示

### Requirement: 播放由使用者互動觸發
系統 SHALL 僅在使用者點擊後播放聲音，不得自動播放。

#### Scenario: 結果載入完成
- **WHEN** 查詢結果顯示完成
- **THEN** 系統不自動播放任何聲音，直到使用者點擊發音按鈕
