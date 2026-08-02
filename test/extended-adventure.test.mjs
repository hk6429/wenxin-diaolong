import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAPTERS, selectQuestEntries } from '../js/adventure.js';
import { resolveQuest } from '../js/story-content.js';
import { validateChapter } from '../js/chapter-schema.js';
import { validateEntry } from '../js/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVEL_FILES = { 國小: 'elementary', 國中: 'junior', 高中: 'senior' };
const EXPECTED = {
  hanyu: ['韓愈', 10], liuzongyuan: ['柳宗元', 10], baijuyi: ['白居易', 15],
  liuyuxi: ['劉禹錫', 10], dumu: ['杜牧', 10], lishangyin: ['李商隱', 10], liyu: ['李煜', 10],
  ouyangxiu: ['歐陽修', 10], wanganshi: ['王安石', 10], suxun: ['蘇洵', 5],
  sushi: ['蘇軾', 20], suzhe: ['蘇轍', 5], zenggong: ['曾鞏', 5], fanzhongyan: ['范仲淹', 10],
  liuyong: ['柳永', 15], huangtingjian: ['黃庭堅', 15], qinguan: ['秦觀', 10], yanshu: ['晏殊', 10],
  yuefei: ['岳飛', 10], liqingzhao: ['李清照', 15], luyou: ['陸游', 15],
  xinqiji: ['辛棄疾', 15], wentianxiang: ['文天祥', 10],
  guanhanqing: ['關漢卿', 10], mazhiyuan: ['馬致遠', 10], baipu: ['白樸', 10],
  zhengguangzu: ['鄭光祖', 10], luoguanzhong: ['羅貫中', 15], shinaian: ['施耐庵', 15],
  wuchengen: ['吳承恩', 15], pusongling: ['蒲松齡', 15], caoxueqin: ['曹雪芹', 20],
};

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

test('第 22 至 53 章連續成冊，每章都以本人作品出題並在章末迎戰本人', () => {
  const extended = CHAPTERS.filter((chapter) => chapter.order >= 22);
  assert.equal(CHAPTERS.length, 53);
  assert.deepEqual(extended.map((chapter) => chapter.order), Array.from({ length: 32 }, (_, index) => index + 22));

  for (const definition of extended) {
    const [author] = EXPECTED[definition.file];
    const chapter = readJson(`data/adventure/${definition.file}.json`);
    assert.deepEqual(validateChapter(chapter).errors, [], `${author}章 schema`);
    assert.equal(chapter.id, definition.id, `${author}章 id`);
    assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds, `${author}章幕次`);
    assert.ok(chapter.scenes.length >= 5, `${author}章至少五幕`);
    assert.ok(chapter.sources.some((source) => source.kind === 'primary'), `${author}章須列公版原典`);

    const quests = chapter.scenes.filter((scene) => scene.quest);
    assert.ok(quests.length >= 2, `${author}章須有作品關卡與對戰`);
    for (const scene of quests) {
      assert.ok(scene.visual?.art, `${author} ${scene.id} 缺配圖`);
      assert.ok(fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art)), `${author} ${scene.visual.art} 不存在`);
      assert.deepEqual(scene.quest.authors, [author], `${author}關卡不可混入別人`);
    }

    const duel = chapter.scenes.find((scene) => scene.visual?.mode === 'duel');
    assert.ok(duel, `${author}缺章末對戰`);
    assert.equal(duel.visual.opponent, author, `${author}必須親自應戰`);
    assert.equal(chapter.scenes.indexOf(duel), chapter.scenes.length - 2, `${author}對戰應在歸卷前`);
  }
});

test('三級題庫數量符合人物權重，且每一道題作者、作品與關卡完全對應', () => {
  for (const definition of CHAPTERS.filter((chapter) => chapter.order >= 22)) {
    const [author, expectedCount] = EXPECTED[definition.file];
    const chapter = readJson(`data/adventure/${definition.file}.json`);
    const declaredWorks = new Set(chapter.scenes.flatMap((scene) => scene.quest?.works || []));

    for (const [level, suffix] of Object.entries(LEVEL_FILES)) {
      const bank = readJson(`data/${definition.file}-${suffix}.json`);
      assert.equal(bank.length, expectedCount, `${author}${level}題數`);
      assert.ok(bank.every((entry) => validateEntry(entry).valid), `${author}${level}題庫 schema`);
      assert.ok(bank.every((entry) => entry.author === author), `${author}${level}混入其他作者`);
      assert.ok(bank.every((entry) => declaredWorks.has(entry.work)), `${author}${level}作品未在關卡宣告`);

      for (const scene of chapter.scenes.filter((item) => item.quest)) {
        const quest = resolveQuest(scene.quest, level);
        const selected = selectQuestEntries(bank, quest);
        assert.equal(selected.length, quest.count, `${author}${level} ${scene.id} 抽題不足`);
        assert.ok(selected.every((entry) => entry.author === author), `${author}${level} ${scene.id} 作者洩漏`);
        if (quest.works?.length) {
          assert.ok(selected.every((entry) => quest.works.includes(entry.work)), `${author}${level} ${scene.id} 作品洩漏`);
        }
      }
    }
  }
});

test('高風險章節明示歸屬、版本與虛構邊界', () => {
  const yuefei = readJson('data/adventure/yuefei.json');
  const redChamber = readJson('data/adventure/caoxueqin.json');
  const novels = ['luoguanzhong', 'shinaian', 'wuchengen', 'pusongling'].map((key) => readJson(`data/adventure/${key}.json`));

  assert.match(JSON.stringify(yuefei), /滿江紅/);
  assert.match(JSON.stringify(yuefei), /歸屬|作者未有定論/);
  assert.match(JSON.stringify(redChamber.riskNotes), /八十|80|四十|40|高鶚|續/);
  for (const suffix of Object.values(LEVEL_FILES)) {
    const yuefeiBank = readJson(`data/yuefei-${suffix}.json`);
    assert.ok(yuefeiBank.filter((entry) => entry.work === '滿江紅・怒髮衝冠').every((entry) => /未有定論/.test(entry.attributionStatus)), `岳飛${suffix}署名狀態缺失`);
    assert.ok(readJson(`data/wuchengen-${suffix}.json`).every((entry) => /通行署吳承恩/.test(entry.attributionStatus)), `吳承恩${suffix}署名狀態缺失`);
  }
  for (const chapter of novels) {
    assert.match(JSON.stringify(chapter.riskNotes) + JSON.stringify(chapter.scenes), /虛構|小說|史實|歷史/);
  }
});

test('新增題庫 ID 全域唯一，公版原典皆有可追溯來源', () => {
  const ids = [];
  for (const definition of CHAPTERS.filter((chapter) => chapter.order >= 22)) {
    const chapter = readJson(`data/adventure/${definition.file}.json`);
    const primarySources = chapter.sources.filter((source) => source.kind === 'primary');
    assert.ok(primarySources.length > 0, `${definition.figure}缺原典來源`);
    assert.ok(primarySources.every((source) => String(source.url).startsWith('https://zh.wikisource.org/')), `${definition.figure}原典來源不可追溯`);
    for (const suffix of Object.values(LEVEL_FILES)) {
      ids.push(...readJson(`data/${definition.file}-${suffix}.json`).map((entry) => entry.id));
    }
  }
  assert.equal(new Set(ids).size, ids.length, '新增題庫 ID 重複');
});
