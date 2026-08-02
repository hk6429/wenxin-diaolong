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
