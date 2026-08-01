import test from 'node:test';
import assert from 'node:assert/strict';

import { learningSummary, normalizePlayerName, playerName, setPlayerName } from '../js/profile.js';

test('冒險者姓名會清理危險字元、限制十二字並同步對戰名稱', () => {
  const meta = { profile: {}, pvp: {} };
  assert.equal(normalizePlayerName('  <小 文>&  '), '小 文');
  assert.equal(normalizePlayerName('一二三四五六七八九十一二三四'), '一二三四五六七八九十一二');
  assert.equal(setPlayerName(meta, '墨客小晴', new Date('2026-08-02T00:00:00Z')), true);
  assert.equal(playerName(meta), '墨客小晴');
  assert.equal(meta.pvp.nick, '墨客小晴');
  assert.equal(meta.profile.createdAt, '2026-08-02T00:00:00.000Z');
});

test('學習摘要使用真實作答、文心珠與章回進度計算', () => {
  const chapters = [
    { id: 'a', sceneIds: ['1', '2', '3', '4'] },
    { id: 'b', sceneIds: ['1', '2', '3', '4'] },
  ];
  const summary = learningSummary({
    xp: { totalAnswered: 20, totalCorrect: 15 },
    daily: { todayAnswered: 5, todayCorrect: 4, streak: 3 },
    collection: { x: { earnedAt: '2026-08-01' }, y: {} },
    adventure: { chapters: {
      a: { chapterStatus: 'found', sceneIndex: 3 },
      b: { chapterStatus: 'locked', sceneIndex: 2 },
    } },
  }, chapters);
  assert.deepEqual(summary, {
    answered: 20, correct: 15, accuracy: 75,
    todayAnswered: 5, todayCorrect: 4, streak: 3,
    mastered: 1, completedScenes: 6, totalScenes: 8, adventurePercent: 75,
  });
});
