// 從 cap-guowen（會考+基測）與 gsat-guowen（學測+指考）撈修辭/文法/格律類真題，
// 轉成文心雕龍 schema 寫入 data/exam-{rhetoric,grammar,prosody}.json。
// 誠信規則：題幹/選項/答案原封照抄，只做欄位映射與 HTML 剝除，不改內容。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { validateEntry } from '../js/schema.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CAP = '/Users/naichengchen/projects/cap-guowen';
const GSAT = '/Users/naichengchen/projects/gsat-guowen';

// tag 正規化 → { zone, cat }（cap tag 未收斂，同義變體都要列）
const TAG_MAP = {
  修辭辨識: { zone: '修辭', cat: '綜合' },
  修辭手法: { zone: '修辭', cat: '綜合' },
  詞性語法: { zone: '文法', cat: '詞性' },
  句型結構: { zone: '文法', cat: '句型' },
  文法句式: { zone: '文法', cat: '句型' },
  文言語法: { zone: '文法', cat: '文言句式' },
  主語判斷: { zone: '文法', cat: '句型' },
  語病判斷: { zone: '文法', cat: '語病' },
  語法句式: { zone: '文法', cat: '句型' },
  對聯: { zone: '格律', cat: '對聯' },
};
const ZONE_PREFIX = { 修辭: 'rh', 文法: 'gr', 格律: 'yl' };

function loadBank(files) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  }
  return sandbox.window.BANK || [];
}

const stripHtml = (s) => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();

const stats = { taken: { 修辭: 0, 文法: 0, 格律: 0 }, skippedImage: 0, skippedLongPassage: 0, skippedBadAnswer: 0 };
const out = { 修辭: [], 文法: [], 格律: [] };
const counters = { rh: 0, gr: 0, yl: 0 };

function convert(yearObj, q, site) {
  const tags = Array.isArray(q.tags) ? q.tags : [];
  const hit = tags.map((t) => TAG_MAP[t]).find(Boolean);
  if (!hit) return;
  if (q.image) { stats.skippedImage++; return; }

  let stem = stripHtml(q.stem);
  const group = q.group && yearObj.groups ? yearObj.groups[q.group] : null;
  if (group && group.passage) {
    const passage = stripHtml(group.passage);
    if (passage.length > 600) { stats.skippedLongPassage++; return; }
    stem = `${passage}\n\n${stem}`;
  }

  const letters = Object.keys(q.options || {}).sort();
  const options = letters.map((k) => stripHtml(q.options[k]));
  if (options.length < 4 || options.some((o) => !o)) { stats.skippedBadAnswer++; return; }

  const multi = q.multi === true || (typeof q.answer === 'string' && q.answer.length > 1);
  let answer;
  if (multi) {
    const ans = String(q.answer).split('').filter((c) => letters.includes(c));
    answer = ans.map((c) => options[letters.indexOf(c)]);
    if (answer.length < 2) { stats.skippedBadAnswer++; return; }
  } else {
    const idx = letters.indexOf(q.answer);
    if (idx < 0) { stats.skippedBadAnswer++; return; }
    answer = options[idx];
  }

  const prefix = ZONE_PREFIX[hit.zone];
  counters[prefix] += 1;
  const era = yearObj.era; // 會考/基測/學測/指考
  let pass = typeof q.pass === 'number' ? q.pass : undefined;
  let disc = typeof q.disc === 'number' ? q.disc : undefined;
  if (disc !== undefined && disc > 1) disc = disc / 100; // gsat 存整數百分比
  const entry = {
    id: `${prefix}-x-${String(counters[prefix]).padStart(4, '0')}`,
    level: '實戰',
    zone: hit.zone,
    cat: hit.cat,
    subcat: tags[0] || '',
    qformat: multi ? 'exam-mc-multi' : 'exam-mc',
    question: stem,
    options,
    answer,
    explain: stripHtml(q.explain || ''),
    origin: '真題',
    year: yearObj.year,
    exam: era,
    citation: `${yearObj.year}年${era}第${q.no}題`,
    site,
    sourceNo: q.no,
  };
  if (pass !== undefined) entry.pass = pass;
  if (disc !== undefined) entry.disc = disc;
  stats.taken[hit.zone]++;
  out[hit.zone].push(entry);
}

// ---- cap-guowen：data/q090.js ~ q115.js ----
const capFiles = fs.readdirSync(path.join(CAP, 'data'))
  .filter((f) => /^q\d{3}\.js$/.test(f)).sort()
  .map((f) => path.join(CAP, 'data', f));
for (const y of loadBank(capFiles)) {
  for (const q of y.questions || []) convert(y, q, 'cap');
}

// ---- gsat-guowen：data/bank.js（合併檔）----
for (const y of loadBank([path.join(GSAT, 'data', 'bank.js')])) {
  for (const q of y.questions || []) convert(y, q, 'gsat');
}

// 驗證 + 寫檔
let bad = 0;
for (const zone of Object.keys(out)) {
  for (const e of out[zone]) {
    const r = validateEntry(e);
    if (!r.valid) { bad++; console.error(e.id, e.citation, r.errors); }
  }
}
if (bad > 0) {
  console.error(`❌ ${bad} 筆未通過 schema，不寫檔`);
  process.exit(1);
}
const FILE = { 修辭: 'exam-rhetoric.json', 文法: 'exam-grammar.json', 格律: 'exam-prosody.json' };
for (const zone of Object.keys(out)) {
  fs.writeFileSync(path.join(ROOT, 'data', FILE[zone]), `${JSON.stringify(out[zone], null, 1)}\n`);
}
console.log('抽取統計：', JSON.stringify(stats));
console.log('分區筆數：', Object.fromEntries(Object.entries(out).map(([z, a]) => [z, a.length])));
