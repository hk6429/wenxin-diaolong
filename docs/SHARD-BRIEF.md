# Shard 派工共用簡報（每個產題 subagent 都要先讀完本檔＋SPEC.md）

## 你的任務
依 `docs/SPEC.md` 的 schema 與誠信鐵律，產出指派給你的那一個 shard JSON 檔
（頂層純陣列）。你只准寫自己被指派的那個檔案，不得動任何其他檔案。

## 工作流程（必須照做）
1. 先完整讀 `/Users/naichengchen/projects/wenxin-diaolong/docs/SPEC.md`。
2. 分批把題目寫進你的目標檔（建議每批 20~30 題，用 Write 首批、之後讀回再整檔重寫，
   或先在心中組好最後一次寫入——總之最終檔案必須是一個合法 JSON 陣列）。
3. **自我驗證（硬性關卡）**：寫完後執行
   ```
   cd /Users/naichengchen/projects/wenxin-diaolong && node --input-type=module -e "
   import('./js/schema.js').then(async (m) => {
     const fs = await import('node:fs');
     const arr = JSON.parse(fs.readFileSync(process.env.SHARD, 'utf8'));
     let bad = 0;
     const pos = [0,0,0,0,0];
     for (const e of arr) {
       const r = m.validateEntry(e);
       if (!r.valid) { bad++; console.log(e.id, r.errors); }
       if (!Array.isArray(e.answer)) pos[e.options.indexOf(e.answer)]++;
     }
     console.log('total', arr.length, 'bad', bad, 'answerPos', pos);
   })" 
   ```
   （SHARD 環境變數設成你的檔案路徑）。bad 必須為 0；answerPos 任一位置不得超過總數 40%。
   不通過就修到通過，最多修三輪；仍不過就在回報中列出未解決項。
4. 回報格式（純文字）：總題數／各 cat 題數／韻文 vs 非韻文題數／引用真實作品的題數／
   配額缺口與原因（若有）／驗證輸出最後一行。

## 品質要求重點（SPEC 的濃縮，衝突時以 SPEC 為準）
- explain 逐選項辨析，是本站的教學靈魂，不可只寫「因為是譬喻」。
- 引用古典詩詞文言必須是課本級、你百分之百確定原文的名句，citation 寫「作者〈篇名〉」；
  沒把握就改用自編白話例句（origin 自編、citation 空字串）。**寧可全自編，不可錯引。**
- 同一 shard 內題幹不可重複、不可換湯不換藥（同一例句改個問法算重複）。
- 誘答選項＝同學段學過的其他 cat；句子型選項四句字數落差 ≤16 字。
- 題幹不可洩題（正解術語不可出現在題幹）。
- 全形標點、臺灣用語、零簡體字。
- id 用你被指派的前綴與起始編號遞增，不足 4 位補零。
- 難度分布大約 易 40%／中 40%／難 20%，difficulty 欄位必填。
