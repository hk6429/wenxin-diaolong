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
  startChapterReplay,
  finishChapterReplay,
  completeScene,
  markChapterFound,
  isEchoDue,
  stabilizeChapter,
  selectQuestEntries,
} from '../js/adventure.js';
import { selectLevelText, resolveQuest } from '../js/story-content.js';
import { renderZhuyin } from '../js/zhuyin.js';
import { validateChapter } from '../js/chapter-schema.js';
import { validateEntry } from '../js/schema.js';
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
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
  assert.equal(chapter.scenes.find((scene) => scene.id === 'zhuangzi-trial').visual.mode, 'duel');
  assert.equal(chapter.scenes.find((scene) => scene.id === 'zhuangzi-trial').visual.opponent, '莊子');
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

test('重遊莊子會清空本輪故事選擇，但保留獎勵、穩固狀態與屈原解鎖', () => {
  const meta = {};
  ensureAdventure(meta);
  chooseChapterVow(meta, 'life-and-learning', CHAPTER_ID);
  chooseScenePath(meta, 'modern-prologue', 'follow-butterfly', CHAPTER_ID);
  markChapterFound(meta, new Date('2026-08-01T00:00:00+08:00'), CHAPTER_ID);
  const beforeRewards = [...getChapterProgress(meta, CHAPTER_ID).rewards];
  assert.equal(startChapterReplay(meta, CHAPTER_ID), true);
  const replay = getChapterProgress(meta, CHAPTER_ID);
  assert.equal(replay.replayActive, true);
  assert.equal(replay.sceneIndex, 0);
  assert.equal(replay.vowId, '');
  assert.deepEqual(replay.sceneChoices, {});
  assert.equal(replay.chapterStatus, 'found');
  assert.deepEqual(replay.rewards, beforeRewards);
  assert.equal(isChapterUnlocked(meta, 'warring-quyuan'), true);
  assert.equal(startChapterReplay(meta, CHAPTER_ID), false, '重遊中不可重複開始');
  assert.equal(finishChapterReplay(meta, CHAPTER_ID), true);
  assert.equal(getChapterProgress(meta, CHAPTER_ID).replayActive, false);
  assert.equal(getChapterProgress(meta, CHAPTER_ID).chapterStatus, 'found');
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

test('孔子外篇需完成屈原主線才解鎖，各章進度互不覆蓋', () => {
  const meta = {};
  ensureAdventure(meta);
  markChapterFound(meta, new Date('2026-08-01T00:00:00+08:00'), CHAPTER_ID);
  assert.equal(isChapterUnlocked(meta, 'dream-confucius'), false);
  assert.equal(selectChapter(meta, 'warring-quyuan'), true);
  markChapterFound(meta, new Date('2026-08-02T00:00:00+08:00'), 'warring-quyuan');
  assert.equal(isChapterUnlocked(meta, 'dream-confucius'), true);
  assert.equal(selectChapter(meta, 'dream-confucius'), true);
  assert.equal(completeScene(meta, 'dream-prologue', 'dream-confucius'), true);
  assert.equal(getChapterProgress(meta, 'dream-confucius').sceneIndex, 1);
  assert.equal(getChapterProgress(meta, CHAPTER_ID).chapterStatus, 'found');
  assert.equal(getChapterProgress(meta, 'warring-quyuan').chapterStatus, 'found');
});

test('司馬遷第四章需完成孔子外篇才解鎖，四章進度互不覆蓋', () => {
  const meta = {};
  ensureAdventure(meta);
  markChapterFound(meta, new Date('2026-08-01T00:00:00+08:00'), CHAPTER_ID);
  markChapterFound(meta, new Date('2026-08-02T00:00:00+08:00'), 'warring-quyuan');
  assert.equal(isChapterUnlocked(meta, 'han-simaqian'), false);
  assert.equal(selectChapter(meta, 'dream-confucius'), true);
  markChapterFound(meta, new Date('2026-08-03T00:00:00+08:00'), 'dream-confucius');
  assert.equal(isChapterUnlocked(meta, 'han-simaqian'), true);
  assert.equal(selectChapter(meta, 'han-simaqian'), true);
  assert.equal(completeScene(meta, 'han-prologue', 'han-simaqian'), true);
  assert.equal(getChapterProgress(meta, 'han-simaqian').sceneIndex, 1);
  for (const chapterId of [CHAPTER_ID, 'warring-quyuan', 'dream-confucius']) {
    assert.equal(getChapterProgress(meta, chapterId).chapterStatus, 'found');
  }
});

test('屈原第二章具備七幕、三學段、公版來源與四組可執行委託', () => {
  const definition = CHAPTERS.find((item) => item.id === 'warring-quyuan');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/quyuan.json'), 'utf8'));
  const result = validateChapter(chapter);
  assert.deepEqual(result.errors, []);
  assert.equal(chapter.scenes.length, 7);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest?.count === 5).length, 4);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
  assert.equal(chapter.scenes.find((scene) => scene.id === 'quyuan-trial').visual.mode, 'duel');
  assert.equal(chapter.scenes.find((scene) => scene.id === 'quyuan-trial').visual.opponent, '屈原');
  assert.equal(chapter.storyFrame.vows.length, 3);
  assert.ok(chapter.scenes.every((scene) => Object.keys(scene.story).length === 3 && scene.choices.length === 3 && scene.factNote));
  assert.ok(chapter.sources.filter((source) => source.kind === 'primary').every((source) => source.url?.startsWith('https://zh.wikisource.org/')));
});

test('每個學段的屈原委託都能從正式題庫選足五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/quyuan.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/quyuan-${suffix}.json`), 'utf8'));
    for (const scene of chapter.scenes.filter((item) => item.quest)) {
      const quest = resolveQuest(scene.quest, level);
      const selected = selectQuestEntries(entries, quest);
      assert.equal(selected.length, 5, `${level} ${scene.id} 題目不足`);
      assert.ok(selected.every((entry) => entry.author === '屈原'));
    }
  }
});

test('孔子外篇具備七幕、三學段、論語專屬題庫與孔子對戰', () => {
  const definition = CHAPTERS.find((item) => item.id === 'dream-confucius');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/confucius.json'), 'utf8'));
  const result = validateChapter(chapter);
  assert.deepEqual(result.errors, []);
  assert.equal(chapter.scenes.length, 7);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest?.count === 5).length, 4);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.bankKey === 'lunyu'));
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
  assert.equal(chapter.scenes.find((scene) => scene.id === 'confucius-trial').visual.mode, 'duel');
  assert.equal(chapter.scenes.find((scene) => scene.id === 'confucius-trial').visual.opponent, '孔子');
  assert.ok(chapter.sources.filter((source) => source.kind === 'primary').every((source) => source.url?.startsWith('https://zh.wikisource.org/')));
});

test('論語專屬題庫三學段各十五題，全部通過驗證並標示公版篇名', () => {
  for (const suffix of ['elementary', 'junior', 'senior']) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/lunyu-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 15);
    assert.ok(entries.every((entry) => validateEntry(entry).valid));
    assert.ok(entries.every((entry) => entry.origin === '自編' && entry.citation.startsWith('《論語・')));
    assert.equal(new Set(entries.map((entry) => entry.question)).size, entries.length);
  }
});

test('孔子外篇每個學段、每一項委託都只從論語題庫選足五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/confucius.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/lunyu-${suffix}.json`), 'utf8'));
    for (const scene of chapter.scenes.filter((item) => item.quest)) {
      const quest = resolveQuest(scene.quest, level);
      assert.equal(quest.bankKey, 'lunyu');
      assert.equal(selectQuestEntries(entries, quest).length, 5, `${level} ${scene.id} 論語題目不足`);
    }
  }
});

test('司馬遷篇具備七幕、三學段、史記專屬題庫與司馬遷對戰', () => {
  const definition = CHAPTERS.find((item) => item.id === 'han-simaqian');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/simaqian.json'), 'utf8'));
  const result = validateChapter(chapter);
  assert.deepEqual(result.errors, []);
  assert.equal(chapter.scenes.length, 7);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest?.count === 5).length, 4);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.bankKey === 'shiji'));
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
  assert.equal(chapter.scenes.find((scene) => scene.id === 'simaqian-trial').visual.mode, 'duel');
  assert.equal(chapter.scenes.find((scene) => scene.id === 'simaqian-trial').visual.opponent, '司馬遷');
  assert.equal(chapter.storyFrame.vows.length, 3);
  assert.equal(new Set(chapter.storyFrame.vows.map((vow) => vow.quote)).size, 3);
  assert.ok(chapter.sources.filter((source) => source.kind === 'primary').every((source) => source.url?.startsWith('https://zh.wikisource.org/')));
});

test('史記專屬題庫三學段各十五題，全部通過驗證並標示公版篇名', () => {
  for (const suffix of ['elementary', 'junior', 'senior']) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/shiji-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 15);
    assert.ok(entries.every((entry) => validateEntry(entry).valid));
    assert.ok(entries.every((entry) => entry.origin === '自編' && entry.citation.startsWith('《史記・')));
    assert.equal(new Set(entries.map((entry) => entry.question)).size, entries.length);
  }
});

test('司馬遷篇每個學段、每一項委託都只從史記題庫選足五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/simaqian.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/shiji-${suffix}.json`), 'utf8'));
    for (const scene of chapter.scenes.filter((item) => item.quest)) {
      const quest = resolveQuest(scene.quest, level);
      assert.equal(quest.bankKey, 'shiji');
      assert.equal(selectQuestEntries(entries, quest).length, 5, `${level} ${scene.id} 史記題目不足`);
    }
  }
});

test('曹操第五章在司馬遷後解鎖，具七幕、短歌行題庫與曹操對戰', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const id of [CHAPTER_ID, 'warring-quyuan', 'dream-confucius']) markChapterFound(meta, new Date(), id);
  assert.equal(isChapterUnlocked(meta, 'jianan-caocao'), false);
  markChapterFound(meta, new Date(), 'han-simaqian');
  assert.equal(isChapterUnlocked(meta, 'jianan-caocao'), true);
  const definition = CHAPTERS.find((item) => item.id === 'jianan-caocao');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/caocao.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest).length, 5);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.bankKey === 'duange'));
  assert.equal(chapter.scenes.find((scene) => scene.id === 'caocao-trial').visual.opponent, '曹操');
});

test('短歌行專屬題庫三學段各五題，五項委託皆可選足五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/caocao.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/duange-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 5);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    for (const scene of chapter.scenes.filter((item) => item.quest)) {
      const quest = resolveQuest(scene.quest, level);
      assert.equal(selectQuestEntries(entries, quest).length, 5, `${level} ${scene.id} 短歌行題目不足`);
    }
  }
});

test('曹丕、曹植、諸葛亮依序解鎖，三章皆具七幕、專屬題庫與人物對戰', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const id of [CHAPTER_ID, 'warring-quyuan', 'dream-confucius', 'han-simaqian']) markChapterFound(meta, new Date(), id);
  const cases = [
    { previous: 'jianan-caocao', id: 'wei-caopi', file: 'caopi', bank: 'dianlun', opponent: '曹丕' },
    { previous: 'wei-caopi', id: 'wei-caozhi', file: 'caozhi', bank: 'caozhi', opponent: '曹植' },
    { previous: 'wei-caozhi', id: 'shuhan-zhugeliang', file: 'zhugeliang', bank: 'chushibiao', opponent: '諸葛亮' },
  ];
  for (const item of cases) {
    assert.equal(isChapterUnlocked(meta, item.id), false, `${item.id} 不應提前解鎖`);
    markChapterFound(meta, new Date(), item.previous);
    assert.equal(isChapterUnlocked(meta, item.id), true, `${item.id} 應在前章完成後解鎖`);
    const definition = CHAPTERS.find((chapter) => chapter.id === item.id);
    const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, `data/adventure/${item.file}.json`), 'utf8'));
    assert.deepEqual(validateChapter(chapter).errors, []);
    assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
    assert.equal(chapter.scenes.filter((scene) => scene.quest).length, 4);
    assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.bankKey === item.bank));
    assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, item.opponent);
    assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
  }
});

test('典論、曹植、出師表三級專屬題庫皆可支援每項五題委託', () => {
  const cases = [
    { file: 'caopi', bank: 'dianlun' },
    { file: 'caozhi', bank: 'caozhi' },
    { file: 'zhugeliang', bank: 'chushibiao' },
  ];
  for (const item of cases) {
    const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, `data/adventure/${item.file}.json`), 'utf8'));
    for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
      const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/${item.bank}-${suffix}.json`), 'utf8'));
      assert.equal(entries.length, 5);
      assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
      assert.equal(new Set(entries.map((entry) => entry.question)).size, 5);
      for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
        const quest = resolveQuest(scene.quest, level);
        assert.equal(quest.bankKey, item.bank);
        assert.equal(selectQuestEntries(entries, quest).length, 5, `${item.file} ${level} ${scene.id} 題目不足`);
      }
    }
  }
});

test('嵇康第九章需完成諸葛亮篇才解鎖，並以絕交書專題對戰', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 7)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'weijin-jikang'), false);
  markChapterFound(meta, new Date(), 'shuhan-zhugeliang');
  assert.equal(isChapterUnlocked(meta, 'weijin-jikang'), true);
  const definition = CHAPTERS.find((item) => item.id === 'weijin-jikang');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/jikang.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest).length, 5);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.bankKey === 'jikang'));
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.authors.includes('嵇康')));
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '嵇康');
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('嵇康三級作品題庫各十題，每項委託只會抽到嵇康作品', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/jikang.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/jikang-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 10);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '嵇康' && entry.work === '與山巨源絕交書'));
    assert.equal(new Set(entries.map((entry) => entry.question)).size, 10);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const quest = resolveQuest(scene.quest, level);
      const selected = selectQuestEntries(entries, quest);
      assert.equal(selected.length, 5, `${level} ${scene.id} 嵇康題目不足`);
      assert.ok(selected.every((entry) => entry.author === '嵇康'));
    }
  }
});

test('世說新語第十章需完成嵇康篇才解鎖，並以劉義慶品藻對戰', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 8)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'weijin-shishuo'), false);
  markChapterFound(meta, new Date(), 'weijin-jikang');
  assert.equal(isChapterUnlocked(meta, 'weijin-shishuo'), true);
  const definition = CHAPTERS.find((item) => item.id === 'weijin-shishuo');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/shishuo.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest).length, 5);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.bankKey === 'shishuo'));
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '劉義慶');
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('世說新語三級作品題庫各十題，涵蓋四門故事且不混入別人作品', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/shishuo.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/shishuo-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 10);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '劉義慶' && entry.work === '世說新語'));
    assert.equal(new Set(entries.map((entry) => entry.question)).size, 10);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, 5, `${level} ${scene.id} 世說題目不足`);
      assert.ok(selected.every((entry) => entry.author === '劉義慶'));
    }
  }
});

test('陶淵明第十一章為核心加長章，需完成世說篇才解鎖並以三篇作品對戰', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 9)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'weijin-taoyuanming'), false);
  markChapterFound(meta, new Date(), 'weijin-shishuo');
  assert.equal(isChapterUnlocked(meta, 'weijin-taoyuanming'), true);
  const definition = CHAPTERS.find((item) => item.id === 'weijin-taoyuanming');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/taoyuanming.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.length, 9, '核心人物必須比一般七幕章更長');
  assert.equal(chapter.scenes.filter((scene) => scene.quest).length, 7);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => scene.quest.bankKey === 'taoyuanming'));
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '陶淵明');
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('陶淵明三級題庫各十五題，三篇作品各五題且作品關卡不混題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/taoyuanming.json'), 'utf8'));
  const expectedWorks = new Set(['桃花源記', '歸去來辭', '飲酒其五']);
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/taoyuanming-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 15);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '陶淵明' && expectedWorks.has(entry.work)));
    assert.equal(new Set(entries.map((entry) => entry.question)).size, 15);
    for (const work of expectedWorks) assert.equal(entries.filter((entry) => entry.work === work).length, 5);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, 5, `${level} ${scene.id} 陶淵明題目不足`);
      assert.ok(selected.every((entry) => entry.author === '陶淵明'));
      if (scene.quest.works) assert.ok(selected.every((entry) => scene.quest.works.includes(entry.work)));
    }
  }
});

test('謝靈運與王羲之依序解鎖，章末皆迎戰本人', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 10)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'liusong-xielingyun'), false);
  markChapterFound(meta, new Date(), 'weijin-taoyuanming');
  assert.equal(isChapterUnlocked(meta, 'liusong-xielingyun'), true);
  assert.equal(isChapterUnlocked(meta, 'weijin-wangxizhi'), false);
  markChapterFound(meta, new Date(), 'liusong-xielingyun');
  assert.equal(isChapterUnlocked(meta, 'weijin-wangxizhi'), true);
  for (const [id, file, opponent] of [
    ['liusong-xielingyun', 'xielingyun', '謝靈運'],
    ['weijin-wangxizhi', 'wangxizhi', '王羲之'],
  ]) {
    const definition = CHAPTERS.find((item) => item.id === id);
    const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, `data/adventure/${file}.json`), 'utf8'));
    assert.deepEqual(validateChapter(chapter).errors, []);
    assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
    assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, opponent);
    assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
  }
});

test('謝靈運與王羲之三級題庫各十題，每個作品任務只抽本人作品', () => {
  for (const config of [
    { file: 'xielingyun', author: '謝靈運', works: new Set(['登池上樓', '石壁精舍還湖中作']) },
    { file: 'wangxizhi', author: '王羲之', works: new Set(['蘭亭集序']) },
  ]) {
    const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, `data/adventure/${config.file}.json`), 'utf8'));
    for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
      const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/${config.file}-${suffix}.json`), 'utf8'));
      assert.equal(entries.length, 10);
      assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
      assert.ok(entries.every((entry) => entry.author === config.author && config.works.has(entry.work)));
      assert.equal(new Set(entries.map((entry) => entry.question)).size, 10);
      for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
        const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
        assert.equal(selected.length, 5, `${level} ${scene.id} ${config.author}題目不足`);
        assert.ok(selected.every((entry) => entry.author === config.author));
        if (scene.quest.works) assert.ok(selected.every((entry) => scene.quest.works.includes(entry.work)));
      }
    }
  }
});

test('王勃第十四章需完成蘭亭篇，並以滕王閣序專題迎戰王勃', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 12)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'early-tang-wangbo'), false);
  markChapterFound(meta, new Date(), 'weijin-wangxizhi');
  assert.equal(isChapterUnlocked(meta, 'early-tang-wangbo'), true);
  const definition = CHAPTERS.find((item) => item.id === 'early-tang-wangbo');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/wangbo.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.filter((scene) => scene.quest).length, 5);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '王勃');
  assert.match(JSON.stringify(chapter), /年齡.*異說|年齡有異說|傳說/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('王勃三級題庫各十題，只用滕王閣序且所有任務可抽滿五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/wangbo.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/wangbo-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 10);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '王勃' && entry.work === '滕王閣序'));
    assert.equal(new Set(entries.map((entry) => entry.question)).size, 10);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, 5, `${level} ${scene.id} 王勃題目不足`);
      assert.ok(selected.every((entry) => entry.author === '王勃' && entry.work === '滕王閣序'));
    }
  }
});

test('駱賓王第十五章以檄文媒體識讀迎戰本人，題目不把政治指控當史實', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 13)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'early-tang-luobinwang'), false);
  markChapterFound(meta, new Date(), 'early-tang-wangbo');
  assert.equal(isChapterUnlocked(meta, 'early-tang-luobinwang'), true);
  const definition = CHAPTERS.find((item) => item.id === 'early-tang-luobinwang');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/luobinwang.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '駱賓王');
  assert.match(JSON.stringify(chapter), /政治指控/);
  assert.match(JSON.stringify(chapter), /史實|查證/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('駱賓王三級題庫各十題，只抽本人檄文且每項任務可抽滿五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/luobinwang.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/luobinwang-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 10);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '駱賓王' && entry.work === '徐敬業討武曌檄'));
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, 5, `${level} ${scene.id} 駱賓王題目不足`);
      assert.ok(selected.every((entry) => entry.author === '駱賓王'));
    }
  }
});

test('杜審言第十六章明示作者歸屬異說，並以早春五律迎戰本人', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 14)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'early-tang-dushenyan'), false);
  markChapterFound(meta, new Date(), 'early-tang-luobinwang');
  assert.equal(isChapterUnlocked(meta, 'early-tang-dushenyan'), true);
  const definition = CHAPTERS.find((item) => item.id === 'early-tang-dushenyan');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/dushenyan.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '杜審言');
  assert.match(JSON.stringify(chapter), /歸屬.*異說|作者歸屬有異說/);
  assert.match(JSON.stringify(chapter), /現代國語.*平仄|不以現代國語/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('杜審言三級題庫各十題，只抽早春遊望且任務可抽滿五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/dushenyan.json'), 'utf8'));
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/dushenyan-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 10);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '杜審言' && entry.work === '和晉陵陸丞早春遊望'));
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, 5, `${level} ${scene.id} 杜審言題目不足`);
      assert.ok(selected.every((entry) => entry.author === '杜審言'));
    }
  }
});

test('李白第十七章為九幕核心章，以三篇歌行迎戰本人', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 15)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'high-tang-libai'), false);
  markChapterFound(meta, new Date(), 'early-tang-dushenyan');
  assert.equal(isChapterUnlocked(meta, 'high-tang-libai'), true);
  const definition = CHAPTERS.find((item) => item.id === 'high-tang-libai');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/libai.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.length, 9);
  assert.equal(chapter.scenes.filter((scene) => scene.quest).length, 7);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '李白');
  assert.match(JSON.stringify(chapter), /實遊/);
  assert.match(JSON.stringify(chapter), /飲酒.*獎勵|不.*飲酒量/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('李白三級題庫各十五題，三篇作品各五題且單篇關卡不混題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/libai.json'), 'utf8'));
  const expectedWorks = new Set(['蜀道難', '夢遊天姥吟留別', '將進酒']);
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/libai-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 15);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '李白' && expectedWorks.has(entry.work)));
    for (const work of expectedWorks) assert.equal(entries.filter((entry) => entry.work === work).length, 5);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, 5, `${level} ${scene.id} 李白題目不足`);
      assert.ok(selected.every((entry) => entry.author === '李白'));
      if (scene.quest.works) assert.ok(selected.every((entry) => scene.quest.works.includes(entry.work)));
    }
  }
});

test('杜甫第十八章為九幕核心章，以證據校讀而非苦難征服迎戰本人', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 16)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'high-tang-dufu'), false);
  markChapterFound(meta, new Date(), 'high-tang-libai');
  assert.equal(isChapterUnlocked(meta, 'high-tang-dufu'), true);
  const definition = CHAPTERS.find((item) => item.id === 'high-tang-dufu');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/dufu.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.length, 9);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '杜甫');
  assert.match(JSON.stringify(chapter), /合理推論/);
  assert.match(JSON.stringify(chapter), /外部史料|史實查證/);
  assert.match(JSON.stringify(chapter), /苦難.*不是|不把.*苦難|不是.*征服/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('杜甫三級題庫各十五題，春望、石壕吏、登高各五題且不混題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/dufu.json'), 'utf8'));
  const expectedWorks = new Set(['春望', '石壕吏', '登高']);
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/dufu-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 15);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => entry.author === '杜甫' && expectedWorks.has(entry.work)));
    for (const work of expectedWorks) assert.equal(entries.filter((entry) => entry.work === work).length, 5);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, 5, `${level} ${scene.id} 杜甫題目不足`);
      assert.ok(selected.every((entry) => entry.author === '杜甫'));
      if (scene.quest.works) assert.ok(selected.every((entry) => scene.quest.works.includes(entry.work)));
    }
  }
});

test('王孟第十九章為八幕雙人章，兩位詩人以本人作品共同對戰', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 17)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'high-tang-wangmeng'), false);
  markChapterFound(meta, new Date(), 'high-tang-dufu');
  assert.equal(isChapterUnlocked(meta, 'high-tang-wangmeng'), true);
  const definition = CHAPTERS.find((item) => item.id === 'high-tang-wangmeng');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/wangmeng.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.length, 8);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '王維・孟浩然');
  assert.match(JSON.stringify(chapter), /開筵.*開軒|開軒.*開筵/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('王孟三級各十題，作者作品配對固定且雙人對戰各抽三題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/wangmeng.json'), 'utf8'));
  const allowedPairs = new Set(['王維|山居秋暝', '孟浩然|過故人莊']);
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/wangmeng-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 10);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => allowedPairs.has(`${entry.author}|${entry.work}`)));
    assert.equal(entries.filter((entry) => entry.author === '王維').length, 5);
    assert.equal(entries.filter((entry) => entry.author === '孟浩然').length, 5);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, scene.quest.count, `${level} ${scene.id} 王孟題目不足`);
      if (scene.visual?.mode === 'duel') {
        assert.equal(selected.filter((entry) => entry.author === '王維').length, 3);
        assert.equal(selected.filter((entry) => entry.author === '孟浩然').length, 3);
      } else if (scene.quest.authors?.length === 1) {
        assert.ok(selected.every((entry) => entry.author === scene.quest.authors[0]));
      }
    }
  }
});

test('邊塞三家第二十章為九幕，三位詩人只以本人作品共同對戰', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 18)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'high-tang-frontier'), false);
  markChapterFound(meta, new Date(), 'high-tang-wangmeng');
  assert.equal(isChapterUnlocked(meta, 'high-tang-frontier'), true);
  const definition = CHAPTERS.find((item) => item.id === 'high-tang-frontier');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/frontier.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.length, 9);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '高適・王昌齡・岑參');
  assert.match(JSON.stringify(chapter), /不把詩句直接當戰史|不把詩當逐日戰報/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('邊塞三級各十五題，每位詩人五題且三人對戰各抽兩題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/frontier.json'), 'utf8'));
  const allowedPairs = new Set(['高適|燕歌行並序', '王昌齡|出塞其一', '岑參|白雪歌送武判官歸京']);
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/frontier-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 15);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => allowedPairs.has(`${entry.author}|${entry.work}`)));
    for (const author of ['高適', '王昌齡', '岑參']) assert.equal(entries.filter((entry) => entry.author === author).length, 5);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, scene.quest.count, `${level} ${scene.id} 邊塞題目不足`);
      if (scene.visual?.mode === 'duel') {
        for (const author of ['高適', '王昌齡', '岑參']) assert.equal(selected.filter((entry) => entry.author === author).length, 2);
      } else if (scene.quest.authors?.length === 1) {
        assert.ok(selected.every((entry) => entry.author === scene.quest.authors[0] && entry.work === scene.quest.works[0]));
      }
    }
  }
});

test('雙樓第二十一章為八幕，正名王之渙並保留作品歸屬與詩筆邊界', () => {
  const meta = {};
  ensureAdventure(meta);
  for (const definition of CHAPTERS.slice(0, 19)) markChapterFound(meta, new Date(), definition.id);
  assert.equal(isChapterUnlocked(meta, 'high-tang-twin-towers'), false);
  markChapterFound(meta, new Date(), 'high-tang-frontier');
  assert.equal(isChapterUnlocked(meta, 'high-tang-twin-towers'), true);
  const definition = CHAPTERS.find((item) => item.id === 'high-tang-twin-towers');
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/twintowers.json'), 'utf8'));
  assert.deepEqual(validateChapter(chapter).errors, []);
  assert.deepEqual(chapter.scenes.map((scene) => scene.id), definition.sceneIds);
  assert.equal(chapter.scenes.length, 8);
  assert.equal(chapter.scenes.find((scene) => scene.visual?.mode === 'duel').visual.opponent, '王之渙・崔顥');
  assert.match(JSON.stringify(chapter), /王之渙，不是.*楊之渙/);
  assert.match(JSON.stringify(chapter), /一作朱斌|通行.*王之渙/);
  assert.match(JSON.stringify(chapter), /詩筆.*延展|不能.*直接看見.*入海/);
  assert.ok(chapter.scenes.filter((scene) => scene.quest).every((scene) => fs.existsSync(path.join(ROOT, 'assets/img', scene.visual.art))));
});

test('雙樓三級各十題，作者作品固定且雙人對戰確實涵蓋兩人', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/twintowers.json'), 'utf8'));
  const allowedPairs = new Set(['王之渙|登鸛雀樓', '崔顥|黃鶴樓']);
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/twintowers-${suffix}.json`), 'utf8'));
    assert.equal(entries.length, 10);
    assert.ok(entries.every((entry) => validateEntry(entry).valid && entry.origin === '自編'));
    assert.ok(entries.every((entry) => allowedPairs.has(`${entry.author}|${entry.work}`)));
    assert.equal(entries.filter((entry) => entry.author === '王之渙').length, 5);
    assert.equal(entries.filter((entry) => entry.author === '崔顥').length, 5);
    for (const scene of chapter.scenes.filter((entry) => entry.quest)) {
      const selected = selectQuestEntries(entries, resolveQuest(scene.quest, level));
      assert.equal(selected.length, scene.quest.count, `${level} ${scene.id} 雙樓題目不足`);
      if (scene.visual?.mode === 'duel') {
        assert.ok(selected.some((entry) => entry.author === '王之渙'));
        assert.ok(selected.some((entry) => entry.author === '崔顥'));
      } else {
        assert.ok(selected.every((entry) => entry.author === scene.quest.authors[0] && entry.work === scene.quest.works[0]));
      }
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

test('文人群像任務可同時依作者與作品篩選，不混入別人的題目', () => {
  const entries = [
    { id: 'a', cat: '譬喻', author: '李白', work: '將進酒' },
    { id: 'b', cat: '譬喻', author: '杜甫', work: '春望' },
    { id: 'c', cat: '引用', author: '李白', work: '行路難' },
    { id: 'd', cat: '句型', author: '李白', work: '將進酒' },
  ];
  const selected = selectQuestEntries(entries, {
    authors: ['李白'], works: ['將進酒'], cats: ['譬喻', '句型'], count: 2,
  });
  assert.deepEqual(selected.map((entry) => entry.id), ['a', 'd']);
});

test('每個學段的莊子委託都能從正式題庫選足五題', () => {
  const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure/zhuangzi.json'), 'utf8'));
  const questScene = chapter.scenes.find((scene) => scene.id === 'butterfly-gate');
  for (const [level, suffix] of [['國小', 'elementary'], ['國中', 'junior'], ['高中', 'senior']]) {
    const entries = JSON.parse(fs.readFileSync(path.join(ROOT, `data/zhuangzi-${suffix}.json`), 'utf8'));
    const quest = resolveQuest(questScene.quest, level);
    const selected = selectQuestEntries(entries, quest);
    assert.equal(selected.length, 5, `${level}題目不足`);
    assert.ok(selected.every((entry) => entry.author === '莊子'));
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
