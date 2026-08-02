# 文心雕龍四十項遊戲化優化

四位專家各負責一個互不重複的面向，每項都有純函式資料模型、網站介面或兩者，並由自動測試鎖定。設計目標不是讓學生被迫停不下來，而是讓他願意再回來、每次都知道自己為何前進。

## 專家一：冒險敘事與角色關係（A01–A10）

1. 章回圖譜
2. 當前章回標頭
3. 幕次探索軌跡
4. 開卷立誓錨點
5. 不評分的選擇手記
6. 史實與原創證據鏡片
7. 文人對戰節拍
8. 文友關係簿
9. 保留獎勵的重遊自主權
10. 回聲、下一章與重遊並列的下一步

## 專家二：作答回饋與精熟感（F01–F10）

11. 中性結果重述
12. 自選答案與正解對照
13. 詳解、證據與出處
14. 修辭／文法／格律／閱讀專屬策略
15. 答錯後無懲罰修復
16. Leitner 記憶盒位翻譯
17. 有樣本數的弱點可信度
18. 資料足夠才顯示近期趨勢
19. 同概念兩次答對的精熟小目標
20. 回首頁後的下一條練習路線

## 專家三：動機、留存與健康習慣（R01–R10）

21. 每日五題小步驟
22. 不貼標籤的今日理解
23. 十題後休息三分鐘
24. 中斷後歡迎回來並保留最佳紀錄
25. 固定門檻的下一境界
26. 不限期、非登入型里程碑
27. 依精熟覆蓋推薦練習方向
28. 至少三次作答才提示複習線索
29. 可由家庭設定的每日題數界線
30. 不帶排名的收卷摘要

## 專家四：操作介面、節奏與自主權（U01–U10）

31. 今日任務卡
32. 從書籤一鍵續玩
33. 弱點複習捷徑
34. 五／十／十五題短回合
35. 推薦練功分區與理由
36. 開始前透明說明獎勵
37. 修辭、文法、格律精熟羅盤
38. 25／50／75／100% 旅程碑
39. 停用動畫的靜心模式
40. 離開、換區不扣分的自主權宣告

## 實作與驗收對照

| 組別 | 資料模型 | 網站呈現 | 自動測試 | 詳細規格 |
|---|---|---|---|---|
| A01–A10 | `js/gamification/adventure.js` | `js/adventure-ui.js` | `test/gamification-adventure.test.mjs`、UI smoke | `GAMIFICATION_ADVENTURE.md` |
| F01–F10 | `js/gamification/feedback.js` | `js/app.js` 題後精熟教練 | `test/gamification-feedback.test.mjs`、UI smoke | `GAMIFICATION_FEEDBACK.md` |
| R01–R10 | `js/gamification/retention.js` | 首頁健康練習、題後收卷摘要 | `test/gamification-retention.test.mjs`、UI smoke | `GAMIFICATION_RETENTION.md` |
| U01–U10 | `js/gamification/interface.js` | `js/gamification-ui.js` 今日任務臺 | `test/gamification-interface.test.mjs`、UI smoke | `GAMIFICATION_INTERFACE.md` |

驗收標準：四組介面各有恰好十個穩定識別碼；單元測試檢查資料語意與無副作用，Playwright 從手機尺寸實際走完首頁、章回、題目、對戰與回饋。所有機制禁止隨機寶箱、斷線懲罰、答錯扣既有收藏或以壓力逼迫續玩。
