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
      // 制式問法（pick/odd/語病等）題幹相同、內容在選項——唯一鍵＝題幹＋選項組合
      const qk = String(e.question).replace(/\s+/g, '') + '|' + [...e.options].sort().join('§');
      assert.ok(!qkeys.has(qk), `${e.id} 題幹＋選項重複`);
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

test('文法與格律核心講義不得再縮成短卡', () => {
  const arr = read('concepts.json');
  const byCat = new Map(arr.map((c) => [c.cat, c]));
  const required = {
    詞性: ['實詞六類', '虛詞四類', '數量詞', '前綴', '中綴', '後綴', '結構助詞', '時貌助詞', '語氣助詞'],
    句型: ['並列句', '承接句', '轉折句', '因果句', '條件句', '選擇句', '假設句', '遞進句', '目的句', '敘事句', '有無句', '表態句', '判斷句', '述語核心'],
    對聯: ['字數', '詞性', '句式', '合掌', '上聯末字仄'],
    平仄: ['平起不入韻', '平起入韻', '仄起不入韻', '仄起入韻', '一三不論', '一三五不論', '孤平', '三仄尾', '拗救'],
  };
  for (const [cat, terms] of Object.entries(required)) {
    const card = byCat.get(cat);
    assert.ok(card, `缺 ${cat} 概念卡`);
    assert.ok(Array.isArray(card.sections) && card.sections.length >= 5, `${cat} 深入講義不足 5 節`);
    const text = JSON.stringify(card);
    for (const term of terms) assert.ok(text.includes(term), `${cat} 講義缺「${term}」`);
    assert.ok(Array.isArray(card.sources) && card.sources.length, `${cat} 講義缺資料來源`);
  }
});

test('國中平仄須顯示五言七言八種基準格式，高中保留進階避忌', () => {
  const card = read('concepts.json').find((item) => item.cat === '平仄');
  assert.equal(card.level, '國中', '平仄基礎不應等到高中才顯示');
  assert.equal(card.metricalTables?.length, 2, '須有五言、七言兩組可見格式表');
  const expected = {
    五言絕句四式: {
      平起不入韻: ['平平平仄仄', '仄仄仄平平', '仄仄平平仄', '平平仄仄平'],
      平起入韻: ['平平仄仄平', '仄仄仄平平', '仄仄平平仄', '平平仄仄平'],
      仄起不入韻: ['仄仄平平仄', '平平仄仄平', '平平平仄仄', '仄仄仄平平'],
      仄起入韻: ['仄仄仄平平', '平平仄仄平', '平平平仄仄', '仄仄仄平平'],
    },
    七言絕句四式: {
      平起不入韻: ['平平仄仄平平仄', '仄仄平平仄仄平', '仄仄平平平仄仄', '平平仄仄仄平平'],
      平起入韻: ['平平仄仄仄平平', '仄仄平平仄仄平', '仄仄平平平仄仄', '平平仄仄仄平平'],
      仄起不入韻: ['仄仄平平平仄仄', '平平仄仄仄平平', '平平仄仄平平仄', '仄仄平平仄仄平'],
      仄起入韻: ['仄仄平平仄仄平', '平平仄仄仄平平', '平平仄仄平平仄', '仄仄平平仄仄平'],
    },
  };
  for (const table of card.metricalTables) {
    assert.equal(table.level, '國中', `${table.title} 應在國中基礎顯示`);
    assert.equal(table.rows.length, 4, `${table.title} 不足四式`);
    for (const row of table.rows) {
      assert.deepEqual(row.lines, expected[table.title][row.name], `${table.title}/${row.name} 格式錯誤`);
      assert.deepEqual(row.rhymeLines, row.name.includes('不入韻') ? [2, 4] : [1, 2, 4], `${table.title}/${row.name} 韻腳標示錯誤`);
    }
  }
  assert.ok(card.sections.filter((section) => section.level === '國中').length >= 6, '國中平仄解構步驟不足');
  assert.ok(card.sections.some((section) => section.level === '高中' && section.title.includes('三仄尾')), '高中缺三仄尾與例外說明');

  const questions = read('prosody-junior.json').filter((question) => question.cat === '平仄');
  for (const subcat of ['五言格式', '七言格式', '起式判斷', '首句入韻', '格律口訣', '格律避忌']) {
    assert.ok(questions.some((question) => question.subcat === subcat), `國中平仄缺 ${subcat} 練習`);
  }
});

test('長篇講義每個解構步驟都必須標示學段', () => {
  const arr = read('concepts.json');
  const allowed = new Set(['國小', '國中', '高中']);
  for (const card of arr.filter((item) => Array.isArray(item.sections))) {
    for (const [index, section] of card.sections.entries()) {
      assert.ok(allowed.has(section.level), `${card.cat} 步驟 ${index + 1} 缺有效學段`);
    }
  }
  const partsOfSpeech = arr.find((item) => item.cat === '詞性');
  for (const level of allowed) {
    assert.ok(partsOfSpeech.sections.some((section) => section.level === level), `詞性講義缺 ${level} 內容`);
  }
});

test('國中詞性重點題型皆有足量練習', () => {
  const questions = read('grammar-junior.json');
  const minimums = { 數量詞: 6, 助詞分類: 6, 前綴: 2, 中綴: 2, 後綴: 2, 一詞多性: 6 };
  for (const [subcat, minimum] of Object.entries(minimums)) {
    const count = questions.filter((question) => question.subcat === subcat).length;
    assert.ok(count >= minimum, `${subcat} 題數 ${count}，至少須有 ${minimum} 題`);
  }
});

test('國小關聯複句必須完整覆蓋九類並與國中四句型分層', () => {
  const cards = read('concepts.json');
  const card = cards.find((item) => item.cat === '句型');
  const relations = ['並列句', '承接句', '轉折句', '因果句', '條件句', '選擇句', '假設句', '遞進句', '目的句'];
  assert.equal(card.level, '國小', '句型卡不應等到國中才出現');
  assert.deepEqual(card.subtypes.map((item) => item.name), relations, '國小關聯複句分類不完整');
  assert.ok(card.subtypes.every((item) => item.level === '國小'), '關聯複句不應被錯放到國中才顯示');
  assert.ok(card.sections.filter((section) => section.level === '國小').length >= 12, '國小複句解構步驟不足');
  assert.ok(card.sections.some((section) => section.level === '國中' && section.title.includes('敘事句')), '國中四大句型未保留分層');

  const questions = read('grammar-elementary.json').filter((question) => question.cat === '句型');
  for (const relation of relations) {
    assert.ok(questions.filter((question) => question.subcat === relation).length >= 3, `國小 ${relation} 題目不足 3 題`);
  }
});

test('國中譬喻必須完整覆蓋四種類型與分級講義', () => {
  const concepts = read('concepts.json');
  const card = concepts.find((item) => item.cat === '譬喻');
  assert.ok(card.sections.length >= 12, `譬喻講義只有 ${card.sections.length} 步`);
  const lecture = JSON.stringify(card);
  for (const term of ['喻體', '喻詞', '喻依', '明喻', '暗喻', '略喻', '借喻']) {
    assert.ok(lecture.includes(term), `譬喻講義缺「${term}」`);
  }
  for (const level of ['國小', '國中', '高中']) {
    assert.ok(card.sections.some((section) => section.level === level), `譬喻講義缺 ${level} 步驟`);
  }

  const questions = read('rhetoric-junior.json').filter((question) => question.cat === '譬喻');
  for (const subcat of ['明喻', '暗喻', '略喻', '借喻']) {
    assert.ok(questions.filter((question) => question.subcat === subcat).length >= 4, `${subcat} 國中題目不足 4 題`);
  }
  assert.ok(questions.some((question) => question.genre === '韻文'), '國中譬喻缺韻文題');
  assert.ok(questions.some((question) => question.genre === '非韻文'), '國中譬喻缺非韻文題');
});

test('修辭細分類必須依學段深化，不得混成同一層', () => {
  const concepts = read('concepts.json');
  const byCat = new Map(concepts.map((item) => [item.cat, item]));
  const expected = {
    轉化: ['擬人法', '擬物法', '形象化'],
    雙關: ['字音雙關', '詞義雙關', '語意雙關'],
    鑲嵌: ['鑲字', '嵌字', '增字', '配字'],
  };
  for (const [cat, names] of Object.entries(expected)) {
    const card = byCat.get(cat);
    assert.ok(card, `缺 ${cat} 概念卡`);
    assert.deepEqual(card.subtypes.map((item) => item.name), names, `${cat} 細分類不完整`);
    assert.ok(card.subtypes.every((item) => ['國小', '國中', '高中'].includes(item.level)), `${cat} 細分類學段錯誤`);
  }
  assert.ok(byCat.get('轉化').subtypes.every((item) => item.level === '國中'), '轉化三類不應提前混入國小');
  assert.ok(byCat.get('雙關').subtypes.every((item) => item.level === '國中'), '雙關三類應屬國中深化');
  assert.ok(byCat.get('鑲嵌').subtypes.every((item) => item.level === '高中'), '鑲嵌四類應屬高中深化');
  assert.ok(!byCat.get('鑲嵌').subtypes.some((item) => item.name.includes('雙關')), '雙關不是鑲嵌子類');

  const junior = read('rhetoric-junior.json');
  for (const subcat of ['擬人', '擬物', '形象化']) {
    assert.ok(junior.filter((question) => question.cat === '轉化' && question.subcat === subcat).length >= 4, `國中轉化缺 ${subcat} 題`);
  }
  assert.ok(junior.filter((question) => question.cat === '雙關' && question.subcat === '語意雙關').length >= 4, '國中缺語意雙關題');

  const senior = read('rhetoric-senior.json');
  for (const subcat of ['鑲字', '嵌字']) {
    assert.ok(senior.filter((question) => question.cat === '鑲嵌' && question.subcat === subcat).length >= 4, `高中鑲嵌缺 ${subcat} 題`);
  }
});

test('圖鑑示例必須全部自編，不得混入外部引文', () => {
  const cards = read('concepts.json');
  const examples = cards.flatMap((card) => (card.examples || []).map((example) => ({ card: card.cat, ...example })));
  assert.ok(examples.length > 0, '圖鑑至少要有一組示例');
  for (const example of examples) {
    assert.equal(example.citation, '', `${example.card} 的圖鑑示例不得填入外部引文：${example.text}`);
    assert.ok(example.text?.trim(), `${example.card} 的自編示例不可為空`);
  }
});
