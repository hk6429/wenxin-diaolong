# UI 任務書：文心雕龍 v1 學習閉環（Phase 2）

## 目標
在 `/Users/naichengchen/projects/wenxin-diaolong` 完成純前端無框架、無建置步驟的單頁站
（比照字字珠璣 `~/projects/zizizhuji/index.html` 的 `<section id="screen-*">` 切換模式，
可去讀它的版面手法但不要照抄字音字形的內容邏輯）。

## 只准新增/修改這些檔案
- `index.html`（全新寫）
- `css/style.css`（全新寫）
- `js/app.js`（全新寫，主控）
- `js/ui-helpers.js`（可選）

**絕對不准動**：`js/schema.js`、`js/bank.js`、`js/quiz-loader.js`、`js/meta/*`、
`js/leitner.js`、`js/practice-round.js`、`js/battle*.js`、`data/*`（只能讀）、
`scripts/*`、`test/*`、`docs/*`。

## 既有模組 API（一律 ES module import，勿重造）
- `js/bank.js`：`getLevel()` / `setLevel(level)`（國小/國中/高中/實戰）、`loadBank(bankKey)`
  （bankKey：`rhetoric`/`grammar`/`prosody`/`mixed`，回傳通過 schema 的 entry 陣列）。
- entry 欄位：`id/level/zone/cat/subcat/qformat/genre/textForm/question/options/answer/explain/origin/citation/difficulty`；
  實戰真題另有 `year/exam/pass/disc`，且可能是複選（`qformat==='exam-mc-multi'`，answer 是陣列）。
- `js/meta/kernel.js`：
  - `initSession(banks)` → ctx `{meta, today, byId, siblingsOfId, leitner}`（進站載完題庫後呼叫一次；切學制重呼叫）
  - `onPracticeAnswer(ctx, id, correct)` → `{ctx, events}`
  - `onBattleAnswer` / `onBattleEnd`（本輪先不用，battle 畫面下一階段才做）
  - events 統一 `{type, payload, fx}`：type ∈ pearls / rankUp / pearlForged / pearlDusted / pearlPolished / gradeUp / petUnlocked / petLevelUp。UI 用一個 switch-case 渲染（toast＋對應動畫 class）。
- `js/leitner.js`：`nextQuestionId(ctx.leitner, candidateIds, ctx.byId)`（挑最低盒位）。
- `js/practice-round.js`：`createRoundState(ids)/nextInRound(rs,pickFn)/recordRound/advanceRound`（一輪不重複、錯題複習輪）。
- `js/answer-flow.js`：`shouldWaitForNext(correct, manualMode)`（練習一律手動下一題）。
- `js/meta/collection.js`：`getMasteryStats(meta, bank)`、`getCollection(meta)`、`getMostWrong(meta, bank, n)`、`GRADES`（白珠/青珠/金珠/墨玉）。
- `js/meta/progress.js`：`getProgress(meta)`（境界名）、`RANKS`。
- `js/meta/economy.js`：`getBalance(meta)`。
- `js/meta/weakness.js`：`getWeaknessSummary(meta)`。
- `js/meta/pet.js`：`PETS/petLevel/isUnlocked/bondStage/categoryMastery`。
- `js/shuffle.js`、`js/session-checkpoint.js`、`js/overlay-a11y.js`、`js/announce.js`、`js/sound.js`（自行看檔頭註解使用）。

## 畫面（section 切換，單頁）
1. **screen-home 首頁**：站名「文心雕龍」＋副標「文法修辭練功站」；學制切換（國小/國中/高中/實戰 四顆按鈕，呼叫 setLevel 後重載題庫與 ctx）；狀態列（墨珠餘額/文氣境界/連續天數/今日已練題數）；六個入口卡：練功、文心圖鑑、弱點複習、文心四靈、文心試煉、文友過招。
2. **screen-practice 練功**：先選分區（修辭/文法/格律/綜合＝mixed），再進答題。出題順序：practice-round 一輪不重複＋pickFn 用 leitner.nextQuestionId。每題渲染題幹（\n 要轉換行）、選項按鈕（1-4 數字鍵可作答）、作答後立即標對錯並顯示 explain 與 citation（有引文出處要顯示）、手動「下一題」；每題作答呼叫 onPracticeAnswer 並渲染 events。頂部顯示本輪進度與 combo。每 15 題（session-checkpoint）彈「今日已練 N 題，要休息還是繼續？」。實戰學制答題後額外顯示官方 `pass`（通過率）當難度參考（有才顯示）。複選真題要支援多選＋送出鈕，全對才算對。
3. **screen-codex 文心圖鑑**：讀 `data/concepts.json`（fetch 失敗或檔案不存在時顯示「圖鑑建置中」，不可炸）。依 zone 分三欄/三頁籤列出概念卡：cat 名＋definition＋tips＋examples（例句附 citation 與 note；韻文例標「韻」徽章）。每張卡顯示該 cat 的精通進度（用該 cat 題目的 getMasteryStats 算：分母＝目前學制該 cat 題數）。精通 ≥5 題卡片「點亮」（彩色 vs 灰階）。另一個頁籤「文心珠」：getCollection 的白珠/青珠/金珠/墨玉 數量與蒙塵清單。
4. **首頁功能入口配圖**：練功、文心圖鑑、弱點複習、文心四靈、文心試煉、文友過招六張卡片都使用 `assets/img/home-*.webp` 原創配圖，不回退成 emoji icon。文字由 HTML 疊放，圖檔不得內嵌標題文字。
5. **文友過招戰場**：大廳與對戰共用 `home-duel.webp` 世界觀；對戰進行時採左右對峙構圖，畫面必須同時顯示回合、雙方文氣、境界、連擊與招式規則，題目卡置於戰場下方。
6. **screen-weak 弱點複習**：getWeaknessSummary 列正確率低到高的 zone·cat 清單（附進度條）；「開始弱點特訓」＝抽 getMostWrong 前 15 題進練習流程（同 screen-practice 的答題 UI，複用同一套渲染函式）。
7. **screen-pets 文心四靈**：四張靈獸卡（icon/名/intro/等級/精通進度條/羈絆台詞依 bondStage 顯示第幾句）；未解鎖顯示剪影＋解鎖條件（「精通 N 題」）；點卡可設 active（寫 meta.pet.active 後用 kernel 的 saveMeta——meta 物件直接改、再 import { saveMeta } from './js/meta/store.js' 存）。

## 視覺
國風文人宇宙：宣紙米白底（#f5efe2 系）＋墨黑主文字＋朱砂紅（#b3402a 系）點綴＋金色強調；
標題可用「衿書/楷體感」系統字型堆疊（"Noto Serif TC", "PMingLiU", serif）；水墨暈染感用 CSS 漸層/陰影做，不外連任何資源（零 CDN、零外部字型，CSP 會擋）。
深淺自動（prefers-color-scheme dark 給一套暗墨配色）。行動優先：390px 寬零橫向捲動、按鈕 ≥44px 觸控目標。修辭=朱紅、文法=黛青、格律=金褐 三色系貫穿分區識別。

## 硬性要求
- 零 console error（含 data/concepts.json 404 的情況——要 catch）。
- 無任何外部網路資源；`<script type="module" src="js/app.js">` 唯一入口。
- 鍵盤可完整操作（數字鍵作答、Enter 下一題）；aria-live 播報對錯（announce.js）。
- data/*.json 目前是 6 題佔位資料（question 開頭標「〔佔位測試題〕」），正式資料稍後 merge 覆蓋——UI 不可寫死題數假設。
- 完成後用 `python3 -m http.server` 起本機伺服器自測一輪（載入零錯誤、練習流程可跑通、切學制正常）並回報你實際測過什麼。

## 回報格式
改了哪些檔／每個畫面的實測結果／已知未完成項。不可謊報：沒測過的不要寫「已測」。
