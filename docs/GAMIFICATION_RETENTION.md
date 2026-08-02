# 動機、留存與健康習慣優化

## 稽核結論

現有資料已足以產生健康的學習回饋：`meta/store` 提供 `daily`、`xp`、`collection`、`weak`、`ach`，`meta/progress` 提供固定境界門檻，首頁原本也會讀取今日作答、總作答、正確率、收藏與分區題庫。缺口主要在呈現層：連續天數與成就容易被單獨放大，但缺少「可安心停止」、休息、回歸不責備、資料不足不貼標籤等保護訊息。

本模組不修改 `meta`，也不發獎、扣分、重設連續天數或寫入 storage。它只把現有資料整理成單一、可測試的 UI view-model。

## 整合介面

```js
import { buildRetentionViewModel } from './js/gamification/retention.js';

const retention = buildRetentionViewModel(meta, {
  now: new Date(),
  bank: fullBank,
  sessionAnswered: quiz.answered,
  sessionCorrect: quiz.correct,
  dailyLimit: getDailyLimit(),
});
```

輸出固定包含 `R01` 到 `R10`，各項都有 `id`、`label`、`state`、可直接顯示的 `message` 與該項所需的穩定數值欄位。缺資料時回傳中性空狀態，不丟出錯誤。

## R01–R10 規格

| 編號 | 優化與使用者可見效果 | 資料來源 | 驗收條件 |
|---|---|---|---|
| R01 | **今日小步驟**：以 5 題為溫和起點；達成後明說「可以安心收卷」，不追加無限任務。 | `meta.daily.todayAnswered` | 未滿 5 題時回傳剩餘題數；達成時 `state=complete`、`remaining=0`，訊息允許停止。 |
| R02 | **今日理解**：顯示今日正確率；低正確率稱為「找出不熟處」，不使用失敗、退步或羞辱語言。 | `meta.daily.todayAnswered`、`todayCorrect` | 5 題答對 2 題時為 `accuracy=40`、`state=explore`，訊息將錯題描述為複習線索。 |
| R03 | **休息提醒**：單次達 10 題建議休息 3 分鐘與遠眺，未達門檻也允許隨時停止。 | `options.sessionAnswered` | 12 題時 `state=due`、門檻為 10、建議 3 分鐘，訊息不含續玩獎勵。 |
| R04 | **學習足跡**：保留目前與歷史最佳；中斷後以歡迎語回歸，明說既有累積仍保留。 | `meta.daily.streak`、`best`、`lastLit`，`options.now` | 離開 4 天且歷史最佳 8 天時，`daysAway=4`、`best=8`，訊息不責備斷線。 |
| R05 | **下一境界**：用固定 XP 門檻顯示確定性進度，不使用隨機寶箱或變動獎率。 | `meta.xp.value`、`rank`，`meta/progress.js` 的 `RANKS` | 40 XP 的蒙童顯示下一境界識字生、門檻 100、進度 40%，並提示依自己的節奏累積。 |
| R06 | **可選里程碑**：只從答對、煉成、對戰勝場挑選最接近的非連續登入目標；不限今日完成。 | `meta.ach.stats`、`ach.unlocked`、`collection` | 煉成 2 顆時選出 `forge-10`，顯示 2／10 與 20%，訊息標明可選且無期限。 |
| R07 | **練習方向**：依首頁題庫與收藏進度提供最低覆蓋分區，但保留改選其他區的自主權。 | `options.bank` 的 `id/zone`、`meta.collection` | 修辭 1／2、文法 0／1 時建議文法，同時完整輸出各分區統計並允許換區。 |
| R08 | **複習線索**：至少累積 3 次作答才提示最低正確率分類，避免太早把學生貼成「弱」。 | `meta.weak` 的分類 `correct/wrong` | 修辭譬喻 1 對 3 錯時輸出 25% 與 3 次錯題線索；資料不足時 `state=collecting`。 |
| R09 | **每日界線**：尊重家長設定的題數上限；達上限就明確收束，不提供代幣或續玩按鈕繞過。 | `meta.daily.todayAnswered`、`options.dailyLimit` | 今日 10 題、上限 10 時 `state=reached`、`remaining=0`，訊息要求收卷休息。 |
| R10 | **收卷摘要**：把單次作答與正確數整理為無評比的完成摘要，讓「結束」本身有正向完成感。 | `options.sessionAnswered`、`sessionCorrect` | 單次 6 題答對 4 題時顯示 67%，訊息確認進度已記下且現在可以收卷。 |

## 設計護欄

- 不使用倒數、限時稀缺、隨機獎勵、斷線懲罰或負向排行榜。
- 不因答錯扣除已獲得的身分、收藏或歷史最佳。
- 所有建議都是資訊與選項；R03、R09、R10 明確提供停止點。
- 國小可直接讀懂訊息，高中生也不會感到幼稚或被操控；UI 可依學段換視覺，但不需改變資料契約。
