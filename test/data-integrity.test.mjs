// 資料完整性硬閘門：正式 data/*.json 全檢。merge 後、部署前必跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry, RH_CAT_LEVEL } from '../js/schema.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

const SELF_FILES = {
  'rhetoric-elementary.json': { level: '國小', zone: '修辭', min: 120, max: 320 },
  'rhetoric-junior.json': { level: '國中', zone: '修辭', min: 150, max: 380 },
  'rhetoric-senior.json': { level: '高中', zone: '修辭', min: 150, max: 380 },
  'grammar-elementary.json': { level: '國小', zone: '文法', min: 120, max: 320 },
  'grammar-junior.json': { level: '國中', zone: '文法', min: 150, max: 380 },
  'grammar-senior.json': { level: '高中', zone: '文法', min: 100, max: 260 },
  'prosody-elementary.json': { level: '國小', zone: '格律', min: 60, max: 160 },
  'prosody-junior.json': { level: '國中', zone: '格律', min: 60, max: 160 },
  'prosody-senior.json': { level: '高中', zone: '格律', min: 60, max: 160 },
};
const EXAM_FILES = {
  'exam-rhetoric.json': { zone: '修辭', min: 40 },
  'exam-grammar.json': { zone: '文法', min: 70 },
  'exam-prosody.json': { zone: '格律', min: 1 },
};

// 常見簡體字黑名單（刻意排除與正體同形或古籍常見字：云/后/干/里/几/无 等不列）
const SIMPLIFIED = /[们这说话语见爱学写让谁问虽国园图书长门马鸟鱼龙凤飞习旧应变边动众为乐条来东两严丽义乌乡买乱亚产亲亿仅从仓仪们价众优传伤级红约练细组终经绝给绘统继绩]/;

function entryText(e) {
  return [e.question, ...(e.options || []), e.explain, e.citation].join('');
}

for (const [file, spec] of Object.entries(SELF_FILES)) {
  test(`${file} 全檢`, () => {
    const arr = read(file);
    assert.ok(arr.length >= spec.min && arr.length <= spec.max,
      `${file} 題數 ${arr.length} 不在 [${spec.min}, ${spec.max}]`);
    const ids = new Set();
    const qkeys = new Set();
    const posCount = [0, 0, 0, 0, 0];
    let answerable = 0;
    for (const e of arr) {
      const r = validateEntry(e);
      assert.ok(r.valid, `${e.id}: ${r.errors.join('; ')}`);
      assert.equal(e.level, spec.level, `${e.id} level 混檔`);
      assert.equal(e.zone, spec.zone, `${e.id} zone 混檔`);
      assert.ok(!ids.has(e.id), `${e.id} id 重複`);
      ids.add(e.id);
      const qk = String(e.question).replace(/\s+/g, '');
      assert.ok(!qkeys.has(qk), `${e.id} 題幹重複`);
      qkeys.add(qk);
      assert.ok(!SIMPLIFIED.test(entryText(e)), `${e.id} 含簡體字`);
      // 題幹不洩題（正解術語不得出現在題幹）——僅對「選出術語名」類題型檢查
      if (['rh-identify', 'gr-pos', 'gr-structure'].includes(e.qformat)) {
        assert.ok(!String(e.question).includes(e.answer), `${e.id} 題幹洩題（含正解「${e.answer}」）`);
      }
      if (!Array.isArray(e.answer)) {
        posCount[e.options.indexOf(e.answer)] += 1;
        answerable += 1;
      }
    }
    // 答案位置分布：任一位置 ≤ 40%
    for (let i = 0; i < 4; i++) {
      assert.ok(posCount[i] <= answerable * 0.4,
        `${file} 答案過度集中在第 ${i + 1} 個選項（${posCount[i]}/${answerable}）`);
    }
  });
}

test('修辭區每個 cat 韻文/非韻文雙覆蓋（每學段 ≥1）', () => {
  const order = ['國小', '國中', '高中'];
  const files = { 國小: 'rhetoric-elementary.json', 國中: 'rhetoric-junior.json', 高中: 'rhetoric-senior.json' };
  const missing = [];
  for (const level of order) {
    const arr = read(files[level]);
    // 該學段「首次出現」的格必須雙覆蓋；復習格不強制
    for (const cat of RH_CAT_LEVEL[level]) {
      const ofCat = arr.filter((e) => e.cat === cat);
      if (ofCat.length === 0) { missing.push(`${level}/${cat}: 0 題`); continue; }
      if (!ofCat.some((e) => e.genre === '韻文')) missing.push(`${level}/${cat}: 無韻文例`);
      if (!ofCat.some((e) => e.genre === '非韻文')) missing.push(`${level}/${cat}: 無非韻文例`);
    }
  }
  assert.deepEqual(missing, [], `雙覆蓋缺口：${missing.join('、')}`);
});

for (const [file, spec] of Object.entries(EXAM_FILES)) {
  test(`${file} 真題檢`, () => {
    const arr = read(file);
    assert.ok(arr.length >= spec.min, `${file} 題數 ${arr.length} < ${spec.min}`);
    const ids = new Set();
    for (const e of arr) {
      const r = validateEntry(e);
      assert.ok(r.valid, `${e.id}: ${r.errors.join('; ')}`);
      assert.equal(e.origin, '真題');
      assert.equal(e.level, '實戰');
      assert.equal(e.zone, spec.zone);
      assert.ok(e.year && e.citation, `${e.id} 缺 year/citation`);
      assert.ok(!ids.has(e.id), `${e.id} id 重複`);
      ids.add(e.id);
      if (e.pass !== undefined) assert.ok(e.pass > 0 && e.pass <= 1, `${e.id} pass 超界`);
      if (e.disc !== undefined) assert.ok(e.disc > -1 && e.disc <= 1, `${e.id} disc 超界`);
    }
  });
}

test('concepts.json 圖鑑', () => {
  const arr = read('concepts.json');
  assert.ok(arr.length >= 36, `concepts 筆數 ${arr.length} < 36`);
  const seen = new Set();
  for (const c of arr) {
    for (const k of ['zone', 'cat', 'level', 'definition', 'tips']) {
      assert.ok(c[k], `concepts ${c.cat || '?'} 缺 ${k}`);
    }
    assert.ok(Array.isArray(c.examples) && c.examples.length >= 2, `${c.cat} examples < 2`);
    assert.ok(!seen.has(c.zone + c.cat), `${c.cat} 重複`);
    seen.add(c.zone + c.cat);
    if (c.zone !== '格律') {
      assert.ok(c.examples.some((x) => x.genre === '韻文'), `${c.cat} 圖鑑無韻文例`);
      assert.ok(c.examples.some((x) => x.genre === '非韻文'), `${c.cat} 圖鑑無非韻文例`);
    }
    assert.ok(!SIMPLIFIED.test(JSON.stringify(c)), `${c.cat} 含簡體字`);
  }
});
