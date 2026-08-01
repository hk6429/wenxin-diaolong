import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CHAPTERS,
  CHAPTER_ID,
  SCENE_IDS,
  ensureAdventure,
  getChapterProgress,
  isChapterUnlocked,
  selectChapter,
  chooseChapterVow,
  chooseScenePath,
  completeScene,
  markChapterFound,
  isEchoDue,
  stabilizeChapter,
  selectQuestEntries,
} from '../js/adventure.js';
import { selectLevelText, resolveQuest } from '../js/story-content.js';
import { renderZhuyin } from '../js/zhuyin.js';
import { validateChapter } from '../js/chapter-schema.js';
import { META_KEY, loadMeta, setStorageBackend } from '../js/meta/store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('莊子章回只能循序推進，七日後驗收才會穩固', () => {
  const meta = {};
  const state = ensureAdventure(meta);
  assert.equal(state.chapterId, CHAPTER_ID);
  assert.equal(state.sceneIndex, 0);

  assert.equal(completeScene(meta, 'butterfly-gate'), false, '不可跳過序章');
  assert.equal(completeScene(meta, 'modern-prologue'), true);
  assert.equal(meta.adventure.sceneIndex, 1);

  const foundAt = new Date('2026-08-01T00:00:00+08:00');
  markChapterFound(meta, foundAt);
  assert.equal(meta.adventure.chapterStatus, 'found');
  assert.deepEqual(meta.adventure.rewards.sort(), ['dream-butterfly-bookmark', 'friend-zhuangzi', 'observation-page']);
  markChapterFound(meta, foundAt);
  assert.equal(meta.adventure.rewards.length, 3, '獎勵不可重複領取');
  assert.equal(isEchoDue(meta, new Date('2026-08-07T23:59:59+08:00')), false);
  assert.equal(isEchoDue(meta, new Date('2026-08-08T00:00:00+08:00')), true);
  assert.equal(stabilizeChapter(meta, new Date('2026-08-07T23:59:59+08:00')), false);
  assert.equal(stabilizeChapter(meta, new Date('2026-08-08T00:00:00+08:00')), true);
  assert.equal(meta.adventure.chapterStatus, 'stable');
});

test('同一章回依學段選擇文字，缺少版本時安全回退國中版', () => {
  const variants = { 國小: '墨蝶飛來了。', 國中: '一隻墨蝶自殘卷中飛出。' };
  assert.equal(selectLevelText(variants, '國小'), '墨蝶飛來了。');
  assert.equal(selectLevelText(variants, '高中'), '一隻墨蝶自殘卷中飛出。');
});

test('智慧注音只標詞庫，關閉或防洩題時回退安全純文字', () => {
  const annotations = [
    { text: '莊周', bopomofo: ['ㄓㄨㄤ', 'ㄓㄡ'] },
    { text: '夢蝶', bopomofo: ['ㄇㄥˋ', 'ㄉㄧㄝˊ'], fullOnly: true },
  ];
  const smart = renderZhuyin('莊周夢蝶', annotations, 'smart');
  const full = renderZhuyin('莊周夢蝶', annotations, 'full');
  assert.match(smart, /<ruby>莊<rt>ㄓㄨㄤ<\/rt><\/ruby>/);
  assert.match(smart, /夢蝶$/);
  assert.ok((full.match(/<ruby>/g) || []).length > (smart.match(/<ruby>/g) || []).length);
  assert.equal(renderZhuyin('<莊周>', annotations, 'off'), '&lt;莊周&gt;');
  assert.equal(renderZhuyin('莊周', annotations, 'full', { suppress: true }), '莊周');
});

test('莊子首章具備七幕、三學段、來源分層與可執行任務', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/zhuangzi.json'), 'utf8'));
  const result = validateChapter(chapter);
  assert.deepEqual(result.errors, []);
  assert.equal(chapter.scenes.length, 7);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), SCENE_IDS);
  assert.ok(chapter.scenes.some((scene) => scene.quest?.count === 5));
  assert.equal(chapter.storyFrame.vows.length, 3);
  assert.ok(chapter.scenes.every((scene) => scene.choices.length === 3 && scene.factNote));
  assert.ok(chapter.sources.every((source) => ['primary', 'reference', 'fiction'].includes(source.kind)));
});

test('開卷立誓與每幕選擇只記錄一次，且兩章互不覆蓋', () => {
  const meta = {};
  ensureAdventure(meta);
  assert.equal(chooseChapterVow(meta, 'life-and-learning', CHAPTER_ID), true);
  assert.equal(chooseChapterVow(meta, 'one-with-things', CHAPTER_ID), false);
  assert.equal(chooseScenePath(meta, 'modern-prologue', 'follow-butterfly', CHAPTER_ID), true);
  assert.equal(chooseScenePath(meta, 'modern-prologue', 'fix-ledger', CHAPTER_ID), false);
  markChapterFound(meta, new Date('2026-08-01T00:00:00+08:00'), CHAPTER_ID);
  assert.equal(selectChapter(meta, 'warring-quyuan'), true);
  assert.equal(getChapterProgress(meta, 'warring-quyuan').vowId, '');
  assert.equal(chooseChapterVow(meta, 'keep-seeking', 'warring-quyuan'), true);
  assert.equal(getChapterProgress(meta, CHAPTER_ID).vowId, 'life-and-learning');
  assert.equal(getChapterProgress(meta, CHAPTER_ID).sceneChoices['modern-prologue'], 'follow-butterfly');
});

test('屈原第二章需完成莊子主線才解鎖，兩章進度互不覆蓋', () => {
  const meta = {};
  ensureAdventure(meta);
  assert.equal(isChapterUnlocked(meta, 'warring-quyuan'), false);
  assert.equal(selectChapter(meta, 'warring-quyuan'), false);
  markChapterFound(meta, new Date('2026-08-01T00:00:00+08:00'), CHAPTER_ID);
  assert.equal(isChapterUnlocked(meta, 'warring-quyuan'), true);
  assert.equal(selectChapter(meta, 'warring-quyuan'), true);
  assert.equal(meta.adventure.currentChapterId, 'warring-quyuan');
  assert.equal(completeScene(meta, 'chu-prologue', 'warring-quyuan'), true);
  assert.equal(getChapterProgress(meta, 'warring-quyuan').sceneIndex, 1);
  assert.equal(getChapterProgress(meta, CHAPTER_ID).chapterStatus, 'found');
});

test('屈原第二章具備七幕、三學段、公版來源與四組可執行委託', () => {
  const definition = CHAPTERS.find((item) => item.id === 'warring-quyuan');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/quyuan.json'), 'utf8'));
  const result = validateChapter(chapter);
  assert.deepEqual(result.errors, []);
  assert.equal(chapter.scenes.length, 7);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest?.count === 5).length, 4);
  assert.equal(chapter.storyFrame.vows.length, 3);
  assert.ok(chapter.scenes.every((scene) => Object.keys(scene.story).length === 3 && scene.choices.length === 3 && scene.factNote));
  assert.ok(chapter.sources.filter((source) => source.kind === 'primary').every((source) => source.url?.startsWith('https://zh.wikisource.org/')));
});

test('每個學段的屈原委託都能從正式題庫選足五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/quyuan.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const banks = {
      rhetoric: JSON.parse(fs.readFileSync(path.join(ROOT, `data/rhetoric-${suffix}.json`), 'utf8')),
      grammar: JSON.parse(fs.readFileSync(path.join(ROOT, `data/grammar-${suffix}.json`), 'utf8')),
      prosody: JSON.parse(fs.readFileSync(path.join(ROOT, `data/prosody-${suffix}.json`), 'utf8')),
    };
    banks.mixed = [...banks.rhetoric, ...banks.grammar, ...banks.prosody];
    for (const scene of chapter.scenes.filter((item) => item.quest)) {
      const quest = resolveQuest(scene.quest, level);
      assert.equal(selectQuestEntries(banks[quest.bankKey], quest).length, 5, `${level} ${scene.id} 題目不足`);
    }
  }
});

test('舊玩家資料遷移時保留文心珠並補上冒險狀態', () => {
  const old = { v: 1, collection: { 'rh-e-0001': { earnedAt: '2026-01-01', grade: 0 } } };
  const map = new Map([[META_KEY, JSON.stringify(old)]]);
  setStorageBackend({
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  });
  const migrated = loadMeta();
  ensureAdventure(migrated);
  assert.equal(migrated.collection['rh-e-0001'].earnedAt, '2026-01-01');
  assert.equal(migrated.adventure.chapterId, CHAPTER_ID);
  assert.equal(migrated.adventure.sceneIndex, 0);
  assert.ok(migrated.adventure.chapters[CHAPTER_ID]);
});

test('冒險任務只從指定修辭類別選出不重複題目', () => {
  const entries = [
    { id: 'a', cat: '譬喻' }, { id: 'b', cat: '轉化' },
    { id: 'c', cat: '文法' }, { id: 'd', cat: '譬喻' },
  ];
  const selected = selectQuestEntries(entries, { cats: ['譬喻', '轉化'], count: 3 });
  assert.deepEqual(selected.map((entry) => entry.id), ['a', 'b', 'd']);
  assert.equal(new Set(selected.map((entry) => entry.id)).size, 3);
});

test('每個學段的莊子委託都能從正式題庫選足五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/zhuangzi.json'), 'utf8'));
  const questScene = chapter.scenes.find((scene) => scene.id === 'butterfly-gate');
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/rhetoric-${suffix}.json`), 'utf8'));
    const quest = resolveQuest(questScene.quest, level);
    assert.equal(selectQuestEntries(entries, quest).length, 5, `${level}題目不足`);
  }
});

test('內容稽核會擋下未知來源與字數不相符的注音', () => {
  const invalid = {
    id: 'x',
    sources: [{ id: 'fiction', kind: 'fiction', label: '創作' }],
    annotations: [{ text: '莊周', bopomofo: ['ㄓㄨㄤ'] }],
    scenes: [{
      id: 's', title: '場景', contentKind: 'fiction', sourceIds: ['missing'],
      body: { 國小: '甲', 國中: '甲', 高中: '甲' },
    }],
  };
  const { errors } = validateChapter(invalid);
  assert.ok(errors.some((error) => error.includes('未知來源')));
  assert.ok(errors.some((error) => error.includes('注音字數')));
});
