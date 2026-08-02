import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAPTERS } from '../js/adventure.js';
import {
  ADVENTURE_VIEW_MODEL_FIELDS,
  buildAdventureViewModel,
} from '../js/gamification/adventure.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHAPTER_DATA = new Map(CHAPTERS.map((definition) => [
  definition.id,
  JSON.parse(fs.readFileSync(path.join(ROOT, 'data/adventure', `${definition.file}.json`), 'utf8')),
]));

function progress(overrides = {}) {
  return {
    sceneIndex: 0,
    chapterStatus: 'locked',
    echoDueAt: '',
    questResults: {},
    vowId: '',
    sceneChoices: {},
    replayActive: false,
    rewards: [],
    ...overrides,
  };
}

function build(adventure = {}, options = {}) {
  return buildAdventureViewModel({
    definitions: CHAPTERS,
    chapters: CHAPTER_DATA,
    adventure,
    now: new Date('2026-08-10T00:00:00+08:00'),
    ...options,
  });
}

test('A01-A10 是恰好十個穩定欄位，並完整覆蓋 57 章', () => {
  const view = build();
  assert.deepEqual(Object.keys(ADVENTURE_VIEW_MODEL_FIELDS), Array.from({ length: 10 }, (_, index) => `A${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(Object.keys(view), Object.values(ADVENTURE_VIEW_MODEL_FIELDS));
  assert.equal(view.chapterAtlas.totals.chapters, 57);
  assert.equal(view.chapterAtlas.items[0].id, 'preqin-zhuangzi');
  assert.equal(view.chapterAtlas.items.at(-1).id, 'qing-caoxueqin');
});

test('A01 章回總覽只依前章完成狀態解鎖，不跳關', () => {
  const adventure = { chapters: { 'preqin-zhuangzi': progress({ chapterStatus: 'found' }) } };
  const atlas = build(adventure).chapterAtlas;
  assert.equal(atlas.items[0].state, 'found');
  assert.equal(atlas.items[1].state, 'available');
  assert.equal(atlas.items[2].state, 'locked');
  assert.equal(atlas.totals.unlocked, 2);
});

test('A02 當前章標頭完全沿用定義與 JSON 的章回文字', () => {
  const view = build({}, { level: '高中' });
  const definition = CHAPTERS[0];
  const chapter = CHAPTER_DATA.get(definition.id);
  assert.equal(view.chapterHeader.title, chapter.title);
  assert.equal(view.chapterHeader.heroTitle, definition.heroTitle);
  assert.equal(view.chapterHeader.tagline, chapter.storyFrame.tagline);
  assert.equal(view.chapterHeader.level, '高中');
});

test('A03 幕次軌跡區分已走、當前與尚未抵達', () => {
  const adventure = { chapters: { 'preqin-zhuangzi': progress({ sceneIndex: 2, vowId: 'life-and-learning' }) } };
  const trail = build(adventure).sceneTrail;
  assert.deepEqual(trail.items.slice(0, 4).map((scene) => scene.state), ['completed', 'completed', 'current', 'upcoming']);
  assert.equal(trail.currentSceneId, CHAPTER_DATA.get('preqin-zhuangzi').scenes[2].id);
});

test('A04 立誓錨點保留原始引文與學習心得', () => {
  const adventure = { chapters: { 'preqin-zhuangzi': progress({ vowId: 'life-and-learning' }) } };
  const anchor = build(adventure).vowAnchor;
  const source = CHAPTER_DATA.get('preqin-zhuangzi').storyFrame.vows.find((vow) => vow.id === 'life-and-learning');
  assert.deepEqual(anchor.selected, source);
  assert.equal(anchor.options.length, 3);
});

test('A05 選擇紀錄保留學生所選回應，不為路線評分', () => {
  const chapter = CHAPTER_DATA.get('preqin-zhuangzi');
  const scene = chapter.scenes[0];
  const choice = scene.choices[1];
  const adventure = { chapters: { 'preqin-zhuangzi': progress({ vowId: 'life-and-learning', sceneChoices: { [scene.id]: choice.id } }) } };
  const journal = build(adventure).choiceJournal;
  assert.deepEqual(journal.entries[0], { sceneId: scene.id, sceneTitle: scene.title, choiceId: choice.id, label: choice.label, response: choice.response });
  assert.equal('score' in journal.entries[0], false);
});

test('A06 證據鏡頭只接合本幕已宣告的史實小註、內容分層與來源', () => {
  const chapter = CHAPTER_DATA.get('preqin-zhuangzi');
  const scene = chapter.scenes[0];
  const lens = build().evidenceLens;
  assert.equal(lens.factNote, scene.factNote);
  assert.equal(lens.contentKind, scene.contentKind);
  assert.deepEqual(lens.sources.map((source) => source.id), scene.sourceIds);
  assert.ok(lens.sources.every((source) => chapter.sources.some((item) => item.id === source.id)));
});

test('A06 可將陣列與物件型 riskNotes 統一為可渲染清單', () => {
  const arrayNotes = build({}, { activeChapterId: 'qing-caoxueqin' }).evidenceLens.riskNotes;
  const objectNotes = build({}, { activeChapterId: 'northern-song-sushi' }).evidenceLens.riskNotes;
  assert.ok(arrayNotes.length > 0 && arrayNotes.every((note) => note.id && note.text));
  assert.ok(objectNotes.some((note) => note.id === 'history'));
});

test('A07 對戰節拍使用既有 opponent、log 與作答結果', () => {
  const chapter = CHAPTER_DATA.get('preqin-zhuangzi');
  const duel = chapter.scenes.find((scene) => scene.visual?.mode === 'duel');
  const adventure = { chapters: { 'preqin-zhuangzi': progress({ sceneIndex: chapter.scenes.indexOf(duel), questResults: {
    [duel.id]: { correct: 4, total: 5, completedAt: '2026-08-02T00:00:00.000Z' },
  } }) } };
  const beat = build(adventure).duelBeat;
  assert.equal(beat.opponent, duel.visual.opponent);
  assert.equal(beat.narrative, duel.visual.log);
  assert.equal(beat.state, 'completed');
  assert.deepEqual(beat.result, { correct: 4, total: 5, completedAt: '2026-08-02T00:00:00.000Z' });
});

test('A07 既有對戰未寫 log 時留空，不自行補歷史敘事', () => {
  const beat = build({}, { activeChapterId: 'high-tang-wangwei' }).duelBeat;
  assert.equal(beat.opponent, '王維');
  assert.equal(beat.narrative, '');
  assert.equal(beat.hasNarrative, false);
});

test('A08 文友關係只依 friend reward 與現有行程紀錄', () => {
  const definition = CHAPTERS[0];
  const friendRewardId = definition.rewards.find((reward) => reward.startsWith('friend-'));
  const adventure = { rewards: [friendRewardId], chapters: { [definition.id]: progress({
    chapterStatus: 'found', vowId: 'life-and-learning', sceneChoices: { 'modern-prologue': 'follow-butterfly' }, rewards: [friendRewardId],
  }) } };
  const ledger = build(adventure).relationshipLedger;
  assert.equal(ledger.current.friendRewardId, friendRewardId);
  assert.equal(ledger.current.earned, true);
  assert.equal(ledger.current.recordedChoices, 1);
  assert.equal('affection' in ledger.current, false);
});

test('A09 重遊明示保留與重置邊界，並不鎖住原選擇', () => {
  const chapter = CHAPTER_DATA.get('preqin-zhuangzi');
  const selected = Object.fromEntries(chapter.scenes.slice(0, 2).map((scene) => [scene.id, scene.choices[0].id]));
  const adventure = { chapters: { 'preqin-zhuangzi': progress({ chapterStatus: 'found', sceneChoices: selected }) } };
  const replay = build(adventure).replayAgency;
  assert.equal(replay.available, true);
  assert.deepEqual(replay.preserves, ['chapterStatus', 'rewards', 'questResults']);
  assert.deepEqual(replay.resets, ['sceneIndex', 'vowId', 'sceneChoices']);
  assert.equal(replay.alternatePathsAvailable, 4);
});

test('A10 完章後將回聲、下一章與重遊作為並列可選項', () => {
  const adventure = { chapters: { 'preqin-zhuangzi': progress({
    chapterStatus: 'found', echoDueAt: '2026-08-09T00:00:00+08:00', rewards: CHAPTERS[0].rewards,
  }) } };
  const next = build(adventure).nextStep;
  assert.equal(next.echoDue, true);
  assert.deepEqual(next.options.map((option) => option.id), ['echo', 'next-chapter', 'replay']);
  assert.ok(next.options.every((option) => option.optional));
});

test('建立 view-model 不會修改存檔或章回 JSON', () => {
  const adventure = { chapters: { 'preqin-zhuangzi': progress({ sceneIndex: 999 }) } };
  const beforeAdventure = structuredClone(adventure);
  const beforeChapter = structuredClone(CHAPTER_DATA.get('preqin-zhuangzi'));
  build(adventure);
  assert.deepEqual(adventure, beforeAdventure);
  assert.deepEqual(CHAPTER_DATA.get('preqin-zhuangzi'), beforeChapter);
});
