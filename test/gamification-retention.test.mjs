import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRetentionViewModel } from '../js/gamification/retention.js';

function meta(overrides = {}) {
  return {
    xp: { value: 40, rank: 0, totalAnswered: 20, totalCorrect: 15 },
    daily: { date: '2026-08-02', todayAnswered: 0, todayCorrect: 0, streak: 2, best: 5 },
    collection: {},
    weak: {},
    ach: { unlocked: {}, stats: { totalCorrect: 15, wins: 0, bestCombo: 0 } },
    ...overrides,
  };
}

test('R01 用小步驟邀請開始，完成後明確允許收工', () => {
  const input = meta();
  const before = JSON.stringify(input);
  const fresh = buildRetentionViewModel(input);
  assert.equal(JSON.stringify(input), before, 'view-model 建構不得改寫 meta');
  assert.deepEqual(fresh.R01, {
    id: 'R01',
    label: '今日小步驟',
    state: 'start',
    target: 5,
    completed: 0,
    remaining: 5,
    message: '先做 5 題暖暖筆鋒，完成就可以安心收卷。',
  });

  const done = buildRetentionViewModel(meta({
    daily: { date: '2026-08-02', todayAnswered: 7, todayCorrect: 5, streak: 2, best: 5 },
  }));
  assert.equal(done.R01.state, 'complete');
  assert.equal(done.R01.remaining, 0);
  assert.match(done.R01.message, /可以安心收卷/);
});

test('R02 以中性語言回饋今日正確率，不把失誤當懲罰', () => {
  const view = buildRetentionViewModel(meta({
    daily: { date: '2026-08-02', todayAnswered: 5, todayCorrect: 2, streak: 2, best: 5 },
  }));
  assert.deepEqual(view.R02, {
    id: 'R02', label: '今日理解', state: 'explore', answered: 5, correct: 2, accuracy: 40,
    message: '今天正在找出不熟的地方；錯題是下一次複習的線索。',
  });
});

test('R03 單次練習達十題時建議休息，不誘導無限續玩', () => {
  const view = buildRetentionViewModel(meta(), { sessionAnswered: 12 });
  assert.deepEqual(view.R03, {
    id: 'R03', label: '休息提醒', state: 'due', sessionAnswered: 12,
    threshold: 10, recommendedMinutes: 3,
    message: '這一回合已練 12 題，先休息 3 分鐘、看看遠方。',
  });
});

test('R04 中斷數日後保留歷史最佳，不用斷線懲罰召回', () => {
  const view = buildRetentionViewModel(meta({
    daily: { date: '2026-08-02', lastLit: '2026-07-29', todayAnswered: 0, todayCorrect: 0, streak: 0, best: 8 },
  }), { now: new Date('2026-08-02T12:00:00+08:00') });
  assert.deepEqual(view.R04, {
    id: 'R04', label: '學習足跡', state: 'welcome-back', current: 0, best: 8, daysAway: 4,
    message: '歡迎回來。休息了 4 天也沒關係，過去最佳 8 天仍完整保留。',
  });
});

test('R05 顯示可預期的境界進度，不使用隨機獎勵', () => {
  const view = buildRetentionViewModel(meta());
  assert.deepEqual(view.R05, {
    id: 'R05', label: '下一境界', state: 'progress', rankName: '蒙童', xp: 40,
    nextRankName: '識字生', nextThreshold: 100, percent: 40,
    message: '距離「識字生」還有 60 點文氣；依自己的節奏累積。',
  });
});

test('R06 推薦最接近的非連續登入成就，避免製造失去恐懼', () => {
  const view = buildRetentionViewModel(meta({
    collection: {
      q1: { earnedAt: '2026-08-01T00:00:00Z' },
      q2: { earnedAt: '2026-08-01T00:00:00Z' },
    },
  }));
  assert.deepEqual(view.R06, {
    id: 'R06', label: '可選里程碑', state: 'progress', achievementId: 'forge-10',
    name: '初綴', current: 2, target: 10, percent: 20,
    message: '已煉成 2／10 顆字珠；這是可選目標，不限今天完成。',
  });
});

test('R07 從首頁題庫與收藏找出可自由選擇的練習方向', () => {
  const bank = [
    { id: 'r1', zone: '修辭' }, { id: 'r2', zone: '修辭' }, { id: 'g1', zone: '文法' },
  ];
  const view = buildRetentionViewModel(meta({
    collection: { r1: { earnedAt: '2026-08-01T00:00:00Z' } },
  }), { bank });
  assert.equal(view.R07.focusZone, '文法');
  assert.deepEqual(view.R07.zones, [
    { zone: '修辭', known: 1, total: 2, percent: 50 },
    { zone: '文法', known: 0, total: 1, percent: 0 },
  ]);
  assert.match(view.R07.message, /想換口味，也可以選其他區/);
});

test('R08 累積足夠作答後才提示弱點，並把錯題稱為複習線索', () => {
  const view = buildRetentionViewModel(meta({
    weak: {
      '修辭·譬喻': { correct: 1, wrong: 3 },
      '文法·詞性': { correct: 8, wrong: 2 },
    },
  }));
  assert.deepEqual(view.R08, {
    id: 'R08', label: '複習線索', state: 'ready', key: '修辭·譬喻', zone: '修辭', cat: '譬喻',
    correct: 1, wrong: 3, total: 4, accuracy: 25,
    message: '「修辭・譬喻」目前有 3 次錯題線索；下次可選它複習，不必立刻補完。',
  });
});

test('R09 達到家長每日上限時明確收束，不用獎勵繞過限制', () => {
  const view = buildRetentionViewModel(meta({
    daily: { date: '2026-08-02', todayAnswered: 10, todayCorrect: 8, streak: 2, best: 5 },
  }), { dailyLimit: 10 });
  assert.deepEqual(view.R09, {
    id: 'R09', label: '每日界線', state: 'reached', limit: 10, completed: 10, remaining: 0,
    message: '今天已到 10 題的學習界線，現在收卷、休息。',
  });
});

test('R10 提供單次收卷摘要，讓結束本身成為正向完成感', () => {
  const view = buildRetentionViewModel(meta(), { sessionAnswered: 6, sessionCorrect: 4 });
  assert.deepEqual(Object.keys(view), ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10']);
  assert.deepEqual(view.R10, {
    id: 'R10', label: '收卷摘要', state: 'ready', answered: 6, correct: 4, accuracy: 67,
    message: '這一回合完成 6 題、答對 4 題；進度已記下，現在可以收卷。',
  });
});
