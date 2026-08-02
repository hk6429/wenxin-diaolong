# Adventure view-model：敘事沉浸、章回探索與角色關係

`js/gamification/adventure.js` 提供無 DOM、無儲存副作用的 `buildAdventureViewModel()`。它把 57 份 chapter definitions、57 份 `data/adventure/*.json` 與現有 `meta.adventure` 進度整合成一個 UI 合約，供後續章回畫面渲染。

穩定頂層欄位由 `ADVENTURE_VIEW_MODEL_FIELDS` 宣告，恰好為 A01–A10；新增欄位或改名時必須同步調整測試與本文件。

## A01–A10

| ID | 穩定欄位 | 使用者可見效果 | 資料來源 | 驗收條件 |
|---|---|---|---|---|
| A01 | `chapterAtlas` | 一眼看見 57 章的可挑戰、旅途中、尋回、穩固與重遊狀態 | definitions 的順序；`adventure.chapters` | 恰有 57 章；只在前一章 `found/stable` 後解鎖下一章 |
| A02 | `chapterHeader` | 顯示當前人物、時代、章題、稱號、標語與幕次 | definition；chapter `title/storyFrame` | 標題與標語逐字取自既有資料；不產生新人設 |
| A03 | `sceneTrail` | 以章回目錄呈現已走、當前、尚未抵達的幕次 | chapter `scenes`；`sceneIndex/chapterStatus/replayActive` | 幕次數與 JSON 相同；每幕只有一個軌跡狀態 |
| A04 | `vowAnchor` | 旅途中可回顧開卷所選的句子，未選時保留全部選項 | chapter `storyFrame.vows`；progress `vowId` | 引文、心得不改寫；無選擇時 `selected=null` |
| A05 | `choiceJournal` | 以不評分的方式回顧每幕選擇與角色回應 | scene `choices`；progress `sceneChoices` | 只收錄實際選過的 choice；沒有善惡值、親密度或佳解評分 |
| A06 | `evidenceLens` | 當幕同時顯示史實小註、內容分層、來源與風險邊界 | scene `factNote/contentKind/sourceIds`；chapter `sources/riskNotes` | 來源必須能回指 chapter 已宣告的 source；陣列與物件型 `riskNotes` 都輸出統一清單 |
| A07 | `duelBeat` | 顯示對手、章末對戰位置、現有戰鬥 log 與作答結果 | `visual.mode/opponent/log`；`questResults` | 57 章都能定位 duel；缺 `visual.log` 時留空且 `hasNarrative=false`，不自行補劇情 |
| A08 | `relationshipLedger` | 以「已獲得文友信物」和共同行程呈現角色關係 | definition `rewards`；progress/global `rewards`、`vowId`、`sceneChoices` | `earned` 只由 `friend-*` reward 判定；不虛構親密等級或角色態度 |
| A09 | `replayAgency` | 告知重遊保留與重置的內容，並呈現還有多少條其他路徑可自由嘗試 | `startChapterReplay` 的既有語意；scene choices | 尋回/穩固後才 `available`；保留 status/rewards/questResults，重置 sceneIndex/vowId/sceneChoices |
| A10 | `nextStep` | 把繼續本幕、七日回聲、下一章與重遊呈現為可選擇行動 | 當前幕、`echoDueAt`、前後章狀態 | 完章後 echo/next/replay 均為 `optional=true`；不以連續登入或懲罰強迫推進 |

## 整合介面

```js
const view = buildAdventureViewModel({
  definitions: CHAPTERS,
  chapters: chapterMap,
  adventure: meta.adventure,
  activeChapterId: meta.adventure.currentChapterId,
  level: meta.adventure.level,
  now: new Date(),
});
```

`chapters` 可傳 `Map`、以 chapter id/file 為 key 的物件，或 chapter 陣列。函式不呼叫 `ensureAdventure()`、不寫回 `meta`，因此 UI 可安全地重複建立 view-model。
