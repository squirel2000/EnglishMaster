## Context

現行（refine-dictionary-entry 之後）行為：`DefinitionEntry.example` 帶義項自帶的例句；當顯示中釋義的義項例句總數 < 2 時，`lookup-service` 呼叫 Tatoeba 補充，補充句進 `LookupResult.examples`（獨立清單），UI 另開「更多例句」區塊呈現。使用者實測 give up（5 個義項都有自帶例句）vs. master／serendipity（義項完全無例句，補充句全部落在獨立區塊）後，確認畫面體驗依字而異，要求一致。

## Goals / Non-Goals

**Goals:**
- 不管來源有沒有替義項提供例句，卡片的視覺結構永遠一致：例句永遠是某筆釋義的次行內容，不再有第二種呈現位置。
- 保留既有的「2-3 句例句」總量保證與翻譯降級行為，只改變補充句的**指派位置**。

**Non-Goals:**
- 不改變 Tatoeba／MyMemory 的呼叫方式、逾時或額度控制策略。
- 不改變同義反義、片語、Anki 未連結按鈕等其他既有行為。
- 不追求「補充句在語意上真的屬於該義項」——沿用「依序指派」的務實做法，只是不再用不同的視覺呈現暴露這個事實。

## Decisions

### 補充句依序指派給尚無例句的釋義，而非獨立列出
```
withGuaranteedExamples(term, definitions):
  senseCount = count(definitions[i].example != null for shown definitions)
  if senseCount >= MIN_TOTAL_EXAMPLES: return definitions unchanged
  needed = MAX_TOTAL_EXAMPLES - senseCount
  supplements = dedupe(fetchTatoeba(term, needed) against existing sense example texts)
  依釋義顯示順序，把 supplements 依序指派給 definitions[i].example === null 的釋義，
  直到 supplements 用完或所有釋義都有例句為止
  剩餘沒被指派到例句的釋義維持 null（沿用既有的「無例句時省略該行」呈現）
```
- 替代方案：找不到義項例句時完全不顯示例句（拿掉 2-3 句保證）——否決，使用者只要求「一致」，沒有要求拿掉例句保證；此設計同時滿足兩者。
- 替代方案：補充句位置一致但用小標籤區分來源（如「通用例句」）——使用者已在澄清問題中選擇「完全一致、不分區」而非「位置一致但視覺區分」，故不採用。

### `LookupResult.examples` 整欄位移除，而非清空後保留
補充句一旦被指派進 `definitions[].example`，就沒有第二個地方需要讀取它們。保留一個恆為空陣列的欄位只會讓型別暗示一個實際上不存在的呈現位置，之後的人可能誤以為要用它——直接移除欄位，讓型別誠實反映「例句只活在釋義裡」這個唯一事實來源。

### 翻譯批次簡併：義項例句與補充例句合併為同一組分段
指派步驟完成後，`definitions[].example` 已經是唯一的例句來源（不論來源是義項自帶還是補充指派），翻譯批次不再需要「義項例句」與「補充例句」兩個獨立分段與各自的偏移量——原本的稀疏游標邏輯（`senseIndex` 累加）套用在合併後的單一分段組即可，分段數從 4 組簡化為 3 組（釋義、合併後的例句、片語）。

### Anki 卡片背面移除獨立的補充例句段落
`buildAnkiNote` 目前的「更多例句」段落資料來源正是 `result.examples`；此欄位移除後，該段落自然消失，例句已經隨每筆釋義呈現在背面的雙語釋義列表裡，不需要額外處理。

## Risks / Trade-offs

- [風險] 移除 `LookupResult.examples` 是第三次改動這個欄位的形狀——重複的型別churn → [緩解] 這次是真正定案（拿掉概念本身，不是換形狀），且移除後翻譯批次與 UI 都變簡單，不會再有下一輪同一欄位的變動。
- [風險] 依序指派可能讓補充句「掛」在跟語意不完全吻合的釋義下面 → [緩解] 使用者已明確選擇一致性優先於語意精確；且補充句本來就是詞層級資料，掛在哪個義項下面都不會更準確或更不準確。
- [風險] 當義項數量少於需要補充的例句數（例如只顯示 1 筆釋義但需要 2 句補充）→ [緩解] 剩餘補充句直接捨棄（不強行擠進同一筆釋義顯示多句），總量保證退化為「盡力而為」，與現行「Tatoeba 失敗時可能少於 2 句」的容忍原則一致。

## Migration Plan

純內部形狀變更；部署即生效，回滾＝回退 commit。無需資料遷移。

## Open Questions

（無新增；沿用 refine-dictionary-entry 遺留的片語翻譯品質、Anki 連線時機等既有 Open Questions）
