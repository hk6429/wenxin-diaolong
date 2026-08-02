import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAPTERS, selectQuestEntries } from '../js/adventure.js';
import { resolveQuest } from '../js/story-content.js';
import { validateEntry } from '../js/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = {
  國小: { suffix: 'elementary', difficulty: '易', focus: '明示理解', cats: ['明示訊息', '事件順序', '字詞理解', '簡單推論', '文體辨識'] },
  國中: { suffix: 'junior', difficulty: '中', focus: '統整解釋', cats: ['句意詮釋', '段落結構', '修辭作用', '推論統整', '觀點辨析'] },
  高中: { suffix: 'senior', difficulty: '難', focus: '省思評鑑', cats: ['證據評鑑', '章法分析', '多元詮釋', '思想辨析', '版本文體'] },
};
const GENERIC_BANKS = new Set(['rhetoric', 'grammar', 'prosody', 'mixed']);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

test('五十三章全部使用人物專屬題庫，不再以通用題庫假裝分級', () => {
  assert.equal(CHAPTERS.length, 53);
  for (const definition of CHAPTERS) {
    assert.ok(!GENERIC_BANKS.has(definition.echoQuest.bankKey), `${definition.figure} 回聲仍使用通用題庫`);
    const chapter = readJson(`data/adventure/${definition.file}.json`);
    for (const scene of chapter.scenes.filter((item) => item.quest)) {
      assert.ok(!GENERIC_BANKS.has(scene.quest.bankKey), `${definition.figure} ${scene.id} 仍使用通用題庫`);
    }
  }
});

test('每一位文人的三級題庫皆符合學段能力、難度與閱讀分類', () => {
  const bankKeys = [...new Set(CHAPTERS.map((chapter) => chapter.echoQuest.bankKey))];
  assert.equal(bankKeys.length, 53);
  for (const bankKey of bankKeys) {
    for (const [level, design] of Object.entries(LEVELS)) {
      const entries = readJson(`data/${bankKey}-${design.suffix}.json`);
      assert.ok(entries.length >= 5, `${bankKey} ${level} 題數不足`);
      for (const entry of entries) {
        assert.ok(validateEntry(entry).valid, `${bankKey} ${entry.id} 未通過 schema`);
        assert.equal(entry.level, level);
        assert.equal(entry.difficulty, design.difficulty);
        assert.equal(entry.learningFocus, design.focus);
        assert.equal(entry.zone, '閱讀');
        assert.equal(entry.qformat, 'rd-pick');
        assert.ok(design.cats.includes(entry.cat), `${bankKey} ${entry.id} 分類錯置`);
        assert.equal(new Set(entry.options).size, 4, `${bankKey} ${entry.id} 選項重複`);
        assert.ok(!/教學上|出題時|頁面標示|本章未採用|本站視覺版權/.test(entry.question));
      }
    }
  }
});

test('國小、國中、高中不是換標籤：同序題的題幹、答案與選項都不同', () => {
  const bankKeys = [...new Set(CHAPTERS.map((chapter) => chapter.echoQuest.bankKey))];
  for (const bankKey of bankKeys) {
    const elementary = readJson(`data/${bankKey}-elementary.json`);
    const junior = readJson(`data/${bankKey}-junior.json`);
    const senior = readJson(`data/${bankKey}-senior.json`);
    assert.equal(elementary.length, junior.length, `${bankKey} 國小國中題數未對齊`);
    assert.equal(junior.length, senior.length, `${bankKey} 國中高中題數未對齊`);
    for (let index = 0; index < elementary.length; index += 1) {
      const rows = [elementary[index], junior[index], senior[index]];
      assert.equal(new Set(rows.map((entry) => entry.question)).size, 3, `${bankKey} 第 ${index + 1} 題題幹未分級`);
      assert.equal(new Set(rows.map((entry) => entry.answer)).size, 3, `${bankKey} 第 ${index + 1} 題答案未分級`);
      assert.equal(new Set(rows.map((entry) => JSON.stringify(entry.options))).size, 3, `${bankKey} 第 ${index + 1} 題選項未分級`);
    }
  }
});

test('五十三章各幕與七日回聲在三個學段都能選足題目', () => {
  for (const definition of CHAPTERS) {
    const chapter = readJson(`data/adventure/${definition.file}.json`);
    const quests = [...chapter.scenes.filter((item) => item.quest).map((item) => item.quest), definition.echoQuest];
    for (const [level, design] of Object.entries(LEVELS)) {
      for (const questSource of quests) {
        const quest = resolveQuest(questSource, level);
        const entries = readJson(`data/${quest.bankKey}-${design.suffix}.json`);
        const selected = selectQuestEntries(entries, quest);
        assert.equal(selected.length, quest.count, `${definition.figure} ${level} 無法選足 ${quest.count} 題`);
      }
    }
  }
});
