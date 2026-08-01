# UI 任務書（第二輪）：對戰系統（Phase 3）

前置：v1 學習閉環 UI（docs/UI-BRIEF.md）已完成並驗收。本輪在既有 index.html/css/style.css/js/app.js
上增量開發，同樣的視覺語言（國風、三色分區）。

## 只准新增/修改
- `index.html`（增 section）、`css/style.css`（增樣式）
- `js/app.js`（只准加掛入口導航，核心對戰邏輯放新檔）
- `js/battle-ui.js`（新，PvE）
- `js/rtbattle-ui.js`（新，PvP）

**絕對不准動**：`js/battle.js`、`js/meta/*`（含 battle-adapter/kernel/masters/rtbattle/api）、
`js/schema.js`、`js/bank.js`、`data/*`、`functions/*`、`scripts/*`、`test/*`。

## A. PvE「文心試煉」（js/battle-ui.js）

資料：`data/masters.json`（10 位大師：id/name/icon/bankKey/specialty/unlockZone/unlockAt/atk/hp/intro/taunt/winLine/loseLine）。

邏輯模組（import，勿重造）：
- `js/meta/masters.js`：`masterUnlocked(meta, master)` / `masterProgress(meta, master)` /
  `masterStrike(master, playerHp)` / `recordMasterWin(meta, masterId)` / `beatenCount(meta)`
- `js/battle.js`：`createBattleState()`（hpA/hpB=100）——但實際請走 adapter：
- `js/meta/battle-adapter.js`：`createBattleContext(meta, opts)` → ctx、`createBattleStateEx(ctx)`、
  `applyAnswerEx(state, side, correct, ctx)` → `{state, ctx, events}`、`isOverEx(state, ctx)`。
  opts 注入：`js/meta/pet.js` 的 `battleMods(meta)` 回傳 `{damageBonus, freeEliminate}` 直接當 opts。
- `js/meta/kernel.js`：每題作答呼叫 `onBattleAnswer(ctx, id, correct)`（kernel 的 ctx 是學習
  session ctx，跟 battle-adapter 的 ctx 是兩個東西，變數命名要分清楚）；戰鬥結束呼叫
  `onBattleEnd(kernelCtx, {won, bestCombo, perfect})` 並渲染 events。

流程：大師名單畫面（卡片牆：已解鎖=彩色可挑戰＋顯示勝場；未解鎖=剪影＋進度「精通 N/M」）
→ 點大師出 intro/taunt 對話框 → 開戰。戰鬥畫面：雙方血條＋大師 icon＋combo 計數；
題目從 `loadBank(master.bankKey)` 出（沿用練習的出題渲染函式，同一套選項/解析 UI，
但答題後自動 2.5 秒進下一題、答錯即大師出招 `masterStrike` 扣玩家血）；玩家答對
= `applyAnswerEx(state,'A',true,battleCtx)` 打大師。大師 hp 用 master.hp 換算（battle-adapter
的 maxHp 機制若只支援 100，用比例縮放顯示即可，內部仍 100 制——自己讀 adapter 決定，
不准改它）。勝負畫面：winLine/loseLine、戰利品（kernel onBattleEnd 的 events）、再戰/回名單。
玩家血量歸零＝敗，顯示 loseLine。首勝標記「已破關」徽章。

## B. PvP「文友過招」（js/rtbattle-ui.js）

邏輯模組：`js/meta/rtbattle.js`（`mulberry32/buildQuestions(seed, entries, rounds)/judge/POLL_MS/ROUNDS/ROUND_SEC/DEAD_MS`——先讀整個檔）；
後端 wrapper：`js/meta/api.js` 的 `WXAPI.call('/api/rt-room', {body:{op, ...}})`，
op 支援 create/join/push/poll（房號 4 位數字）。**WXAPI.call 失敗回 null＝後端未部署，
UI 要顯示「線上對戰建置中，請先挑戰文心試煉」優雅降級，絕不能炸 console error。**

流程：輸入暱稱 → 開房（顯示 4 位房號）或加入 → 兩邊用同一 seed（房號轉數字）各自
buildQuestions 出同一組 20 題 → 各自作答、push 累積傷害、poll 對方傷害（POLL_MS 輪詢）→
對方血量 = 100 − 對方回報傷害；20 題完或一方歸零 → judge 判定勝負。斷線（oppHbAgeMs >
DEAD_MS）判勝。作答一樣走 kernel.onBattleAnswer 記學習數據。

## 驗收自測（完成後必做並如實回報）
python3 -m http.server 起站：
1. PvE：解鎖判定正確（新玩家只見阿誦可戰）、完整打一場（含勝負兩種結局都測——可暫時在
   console 手動放水，但不准改遊戲碼放後門）、零 console error。
2. PvP：無後端環境下優雅降級訊息正確顯示、不噴錯。
3. 390px 寬不橫向捲動。
回報：改了哪些檔／實測了什麼／已知未完成項。沒測過的不可寫已測。
