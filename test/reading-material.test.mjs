import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildReadingMaterial,
  displayOptionText,
  normalizeTraditionalSourceUrl,
} from '../js/reading-material.js';
import { CHAPTERS } from '../js/adventure.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

test('公版節錄使用動態篇名，國小版同時提供本站白話譯文', () => {
  const entry = { level: '國小', work: '岳陽樓記', options: [], answer: '' };
  const material = buildReadingMaterial(entry, {
    guide: {
      title: '范仲淹〈岳陽樓記〉節錄',
      excerpt: '不以物喜，不以己悲。',
      translation: '不因外在環境美好而過度歡喜，也不因自己的遭遇而過度悲傷。',
      support: '留意兩個「不以」形成的對稱。',
      sourceUrl: 'https://zh.wikisource.org/zh-hant/岳陽樓記',
    },
  });

  assert.equal(material.kind, 'public-domain-excerpt');
  assert.equal(material.title, '范仲淹〈岳陽樓記〉節錄');
  assert.match(material.translation, /不因外在環境/);
  assert.doesNotMatch(material.title, /莊子/);
});

test('莊子四篇公版節錄都有明確篇名與國小白話譯文', () => {
  const chapter = readJson('data/adventure/zhuangzi.json');
  assert.equal(Object.keys(chapter.readingGuides).length, 4);
  for (const [work, guide] of Object.entries(chapter.readingGuides)) {
    assert.match(guide.title, new RegExp(work));
    assert.ok(guide.excerpt.length >= 40, `${work}原文過短`);
    assert.ok(guide.translation.length >= 40, `${work}缺白話譯文`);
    assert.match(guide.sourceUrl, /\/zh-hant\//u);
  }
});

test('國中與高中把四個選項的共同文本線索移到閱讀卡，選項只保留判讀差異', () => {
  const lead = '開篇先提出古代求學者必有老師，再說老師負責傳道、授業與解惑';
  const entry = {
    level: '國中', work: '師說', answer: `${lead}；這項判讀符合段落作用。`,
    options: [
      `${lead}；這項判讀符合段落作用。`,
      `${lead}；因此完全不必看前後文。`,
      `${lead}；所以這是全文唯一主旨。`,
      `${lead}；足以證明作者所有生平。`,
    ],
  };
  const material = buildReadingMaterial(entry, { fallback: { summary: '幕前提示' } });

  assert.equal(material.kind, 'site-study-note');
  assert.equal(material.text, lead);
  assert.equal(displayOptionText(entry.options[0], material), '這項判讀符合段落作用。');
});

test('沒有精確原文時明確標示本站整理，國小提供白話導讀而不冒稱翻譯', () => {
  const material = buildReadingMaterial({ level: '國小', work: '紅樓夢', options: [], answer: '' }, {
    fallback: {
      summary: '黛玉進入賈府後，從她的視線逐步認識家族人物與空間。',
      note: '本段為本站依公版原典整理。',
      sources: [{ kind: 'primary', label: '《紅樓夢》公版原典', url: 'https://zh.wikisource.org/zh-hant/紅樓夢' }],
    },
  });

  assert.equal(material.kind, 'site-study-note');
  assert.equal(material.translationLabel, '白話導讀（本站自編）');
  assert.equal(material.sourceUrl, 'https://zh.wikisource.org/zh-hant/紅樓夢');
});

test('繁體來源網址會鎖定 zh-hant，拒絕中國大陸簡體來源', () => {
  assert.equal(
    normalizeTraditionalSourceUrl('https://zh.wikisource.org/wiki/赤壁賦'),
    'https://zh.wikisource.org/zh-hant/赤壁賦',
  );
  assert.equal(
    normalizeTraditionalSourceUrl('https://zh.wikisource.org/w/index.php?title=燕歌行_(高適)&oldid=2520540'),
    'https://zh.wikisource.org/w/index.php?title=燕歌行_(高適)&oldid=2520540&variant=zh-hant',
  );
  assert.equal(normalizeTraditionalSourceUrl('https://sxss.ntu.edu.cn/example'), '');
  assert.equal(normalizeTraditionalSourceUrl('https://ctext.org/wiki.pl?if=gb&res=1'), '');
});

test('五十七章每個委託都能建立作答閱讀卡，且外部連結沒有簡體來源', () => {
  for (const definition of CHAPTERS) {
    const chapter = readJson(`data/adventure/${definition.file}.json`);
    for (const source of chapter.sources || []) {
      if (!source.url) continue;
      assert.doesNotMatch(source.url, /\.cn(?:\/|$)|[?&]if=gb(?:&|$)|\/zh\/|\/wiki\//u, `${definition.figure}含非繁體來源：${source.url}`);
      if (source.url.includes('zh.wikisource.org/w/index.php')) {
        assert.match(source.url, /[?&]variant=zh-hant(?:&|$)/u, `${definition.figure}舊版連結未鎖繁體`);
      }
    }

    for (const scene of chapter.scenes.filter((item) => item.quest)) {
      const fallback = {
        summary: scene.body?.國中 || scene.body?.國小 || scene.body,
        note: scene.factNote,
        sources: (scene.sourceIds || []).map((id) => chapter.sources.find((source) => source.id === id)).filter(Boolean),
      };
      const sample = { level: '國中', work: scene.quest.works?.[0], options: [], answer: '' };
      const material = buildReadingMaterial(sample, { fallback });
      assert.ok(material?.text || material?.excerpt, `${definition.figure} ${scene.id}沒有可見閱讀卡`);
    }
  }
});

test('五十七位文人的三級題庫都有穩定閱讀鍵與作品名，不再顯示批次模板文字', () => {
  const suffixes = ['elementary', 'junior', 'senior'];
  const bankKeys = [...new Set(CHAPTERS.map((definition) => definition.echoQuest.bankKey))];
  for (const bankKey of bankKeys) {
    const banks = suffixes.map((suffix) => readJson(`data/${bankKey}-${suffix}.json`));
    for (const bank of banks) {
      for (const entry of bank) {
        assert.ok(entry.readingKey, `${entry.id}缺 readingKey`);
        assert.ok(entry.work, `${entry.id}缺 work`);
        assert.doesNotMatch(entry.question, /本篇作品|第\s*\d+\s*組線索/u, `${entry.id}仍有模板文字`);
      }
    }
    assert.deepEqual(
      banks[0].map((entry) => entry.readingKey),
      banks[1].map((entry) => entry.readingKey),
      `${bankKey}國小國中 readingKey 未對齊`,
    );
    assert.deepEqual(
      banks[1].map((entry) => entry.readingKey),
      banks[2].map((entry) => entry.readingKey),
      `${bankKey}國中高中 readingKey 未對齊`,
    );
  }
});
