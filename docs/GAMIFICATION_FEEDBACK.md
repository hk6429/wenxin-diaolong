# 精熟回饋整合規格

## 稽核摘要

現有題庫已提供 `answer`、`explain`、`citation`、`zone`、`cat`、`difficulty` 等教學欄位；`meta.leitner` 保存逐題盒位，`meta.weak` 保存分類正誤次數，`meta.collection[id].wrong` 保存煉成前累積錯誤。作答結算會更新這些資料，但目前 quiz feedback 主要呈現答對／答錯、正解、詳解與官方通過率，尚未把資料轉成學生可執行的下一步。

目前持久化資料沒有逐次作答時間序列，因此最近趨勢必須由接入端傳入 `recentAttempts`。沒有足夠紀錄時 F08 固定回傳 `trend: "insufficient"`，不可由累積正確率假造進步趨勢。

## 接入介面

`buildFeedbackViewModel({ entry, picked, correct, meta, beforeBox, afterBox, recentAttempts, session })`

- 無 DOM、storage、亂數與目前時間依賴，可在作答結算後直接呼叫。
- 回傳 `featureOrder`、`features.F01` 至 `features.F10`，以及 `surfaces.quiz`、`surfaces.home`。
- 每項共通穩定欄位為 `id`、`surface`、`visible`、`title`、`message`、`action`；個別資料欄位如下。
- `recentAttempts` 格式為 `[{ correct: boolean }]`，由接入端明確決定是同題或同分類窗口，建議只傳最近六次。

## F01–F10

| ID | 優化 | 使用者可見效果 | 資料來源 | 穩定欄位與驗收條件 |
|---|---|---|---|---|
| F01 | 結果重述 | 不用分數或人格標籤，先說這一步是否正確，答錯時指出錯誤可變成練習線索。 | `correct`，未傳時比對 `picked` 與 `entry.answer` | `state`, `correct`；答錯為 `retry`，文案不得含羞辱或扣分語言。 |
| F02 | 選項對照 | 同時看到自己選了什麼、正解是什麼，知道要比較哪兩項。 | `picked`, `entry.answer` | `selected`, `expected`, `hasContrast`；單選、複選皆轉為陣列。 |
| F03 | 證據解釋 | 詳解後要求指出題幹證據；有正式出處才顯示，沒有就不捏造。 | `entry.explain`, `entry.citation` | `explanation`, `citation`, `hasSource`；缺出處時 `hasSource=false`。 |
| F04 | 領域策略 | 修辭、文法、格律、閱讀各得到一個下次能照做的解題步驟。 | `entry.zone`, `entry.qformat` | `strategy`, `zone`, `qformat`；四領域均產生非空策略。 |
| F05 | 挫折修復 | 答錯後先讀懂再重試，不用一次錯誤定義能力；答對也要求說理由。 | `correct` | `tone`, `retryWithoutPenalty`；固定支持語氣且允許無懲罰重試。 |
| F06 | 記憶盒意義 | 顯示盒位前後變化，將退盒翻譯為「提早複習」，滿盒則提醒間隔驗收。 | `beforeBox`, `afterBox`；缺後者時讀 `meta.leitner[id]` | `beforeBox`, `afterBox`, `movement`, `mastered`；盒位永遠限制在 1–5。 |
| F07 | 弱點可信度 | 弱點只用來安排順序，不排名；樣本少時明說仍在累積。 | `meta.weak[zone·cat]` | `key`, `correct`, `wrong`, `total`, `accuracy`, `confidence`；少於 5 次為 `developing`。 |
| F08 | 近期趨勢 | 只在至少兩筆近期紀錄時顯示進步、穩定或需支援；不足就請繼續累積。 | `recentAttempts` | `available`, `sampleSize`, `accuracy`, `trend`, `consecutiveCorrect`；不足兩筆必為 `insufficient`。 |
| F09 | 精熟小目標 | 不追總分，答錯後先設定「同概念答對兩次」；完成後改做間隔複習。 | `correct`, F08 近期連對、`session.answered/target` | `kind`, `consecutiveCorrect`, `correctNeeded`, `sessionRemaining`；答錯固定為 `recovery` 且需 2 次。 |
| F10 | 首頁下一步 | 回首頁後直接得到弱點短練習、稍後複習或探索新概念的路由。 | `correct`, F06 盒位、`entry.id`, `zone·cat` | `priority`, `route`, `focusKey`, `questionId`；答錯路由為 `weak-practice`。 |

## 主代理接入建議

1. 呼叫既有 `onPracticeAnswer` 前先讀取 `beforeBox`，結算後讀取 `afterBox`。
2. 將本次題目、選項與 `ctx.meta` 傳給 `buildFeedbackViewModel`。
3. 題後區依 `surfaces.quiz` 顯示；小學可預設展開 F01、F04、F05、F09，其餘摺疊，高中可展開 F02–F04 的證據鏈。
4. 首頁只消費 `surfaces.home`，以 F10 `route` 綁定既有弱點練習或一般練習入口。
5. 若未來新增作答歷程，只把明確同題或同分類的最近六次傳入 F08；不得把 XP、文心珠或官方通過率當成個人精熟證據。

## 驗收

```sh
node --test test/gamification-feedback.test.mjs
node --check js/gamification/feedback.js
```

測試須涵蓋 F01–F10 全部穩定欄位、答對滿盒、紀錄不足、輸入不變性，且 `features` 恰有十項。
