// 把 data/shards/*.json 合併成正式的 9 個題庫檔：去重＋重新編號＋schema 驗證。
// 冪等：每次都從 shards 重新產生整個檔，不疊加舊輸出。真題檔（exam-*）不歸這裡管。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry } from '../js/schema.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHARD_DIR = path.join(ROOT, 'data', 'shards');

// shard 檔名（去掉單一大寫英文字尾碼）→ 正式檔名
function targetOf(name) {
  return name.replace(/\.json$/, '').replace(/-[A-Z]$/, '');
}
const LEVEL_CODE = { 國小: 'e', 國中: 'j', 高中: 's', 實戰: 'x' };
const PREFIX_OF_ZONE = { 修辭: 'rh', 文法: 'gr', 格律: 'yl' };

const groups = new Map();
for (const f of fs.readdirSync(SHARD_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const target = targetOf(f);
  if (!groups.has(target)) groups.set(target, []);
  const raw = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, f), 'utf8'));
  if (!Array.isArray(raw)) throw new Error(`${f} 頂層不是陣列`);
  groups.get(target).push(...raw.map((e) => ({ ...e, _shard: f })));
}

const normalize = (s) => String(s || '').replace(/\s+/g, '');
let totalKept = 0;
const report = {};

for (const [target, entries] of [...groups.entries()].sort()) {
  // 去重：題幹＋選項組合相同視為重複，保留先到的
  const seen = new Set();
  const kept = [];
  let dup = 0;
  for (const e of entries) {
    const key = normalize(e.question) + '|' + (e.options || []).map(normalize).sort().join('|');
    if (seen.has(key)) { dup++; continue; }
    seen.add(key);
    kept.push(e);
  }
  // 重新編號（依 shard 檔名+原 id 排序保持穩定）
  kept.sort((a, b) => (a._shard + a.id).localeCompare(b._shard + b.id, 'zh-Hant'));
  kept.forEach((e, i) => {
    const prefix = PREFIX_OF_ZONE[e.zone];
    const code = LEVEL_CODE[e.level];
    e.id = `${prefix}-${code}-${String(i + 1).padStart(4, '0')}`;
    delete e._shard;
  });
  // 驗證
  const bad = [];
  for (const e of kept) {
    const r = validateEntry(e);
    if (!r.valid) bad.push({ id: e.id, q: String(e.question).slice(0, 30), errors: r.errors });
  }
  if (bad.length) {
    console.error(`❌ ${target}：${bad.length} 筆未過 schema`);
    for (const b of bad.slice(0, 10)) console.error(' ', b.id, b.q, b.errors);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(path.join(ROOT, 'data', `${target}.json`), `${JSON.stringify(kept, null, 1)}\n`);
  report[target] = { kept: kept.length, dupRemoved: dup };
  totalKept += kept.length;
}

console.log(JSON.stringify(report, null, 2));
console.log('合計', totalKept, '題', process.exitCode ? '（有檔案未通過，未全部寫出）' : '');
