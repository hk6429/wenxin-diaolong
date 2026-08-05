// kernel 掛鉤流程：Node 內 stub storage 測完整答題結算鏈。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setStorageBackend, loadMeta } from '../js/meta/store.js';
import { initSession, onPracticeAnswer, onBattleEnd, registerSessionEntries } from '../js/meta/kernel.js';
import { DAILY_EARN_CAP } from '../js/meta/economy.js';

function freshStorage() {
  const map = new Map();
  setStorageBackend({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  });
  return map;
}

const bank = [
  { id: 'rh-e-0001', zone: '修辭', cat: '譬喻', difficulty: '易' },
  { id: 'rh-e-0002', zone: '修辭', cat: '譬喻', difficulty: '中' },
  { id: 'gr-e-0001', zone: '文法', cat: '詞性', difficulty: '易' },
];

test('答對：日計數/XP/Leitner/珠全都動，且持久化', () => {
  freshStorage();
  const ctx = initSession(bank);
  const { events } = onPracticeAnswer(ctx, 'rh-e-0001', true);
  assert.equal(ctx.meta.daily.todayAnswered, 1);
  assert.equal(ctx.meta.daily.todayCorrect, 1);
  assert.ok(ctx.meta.xp.value > 0);
  assert.equal(ctx.leitner.get('rh-e-0001'), 2);
  assert.ok(events.some((e) => e.type === 'pearls'));
  const reloaded = loadMeta();
  assert.equal(reloaded.daily.todayAnswered, 1, 'saveMeta 必須在掛鉤內完成');
  assert.equal(reloaded.leitner['rh-e-0001'], 2);
});

test('答錯：同 cat 兄弟題輕退一盒（聚焦複習）', () => {
  freshStorage();
  const ctx = initSession(bank);
  // 先把兄弟題推上去
  for (let i = 0; i < 3; i++) onPracticeAnswer(ctx, 'rh-e-0002', true);
  const before = ctx.leitner.get('rh-e-0002');
  onPracticeAnswer(ctx, 'rh-e-0001', false);
  assert.equal(ctx.leitner.get('rh-e-0002'), before - 1, '同 cat 題應退一盒');
  assert.equal(ctx.leitner.get('gr-e-0001'), 1, '不同 cat 不受影響');
});

test('煉成鏈：連續答對到第 5 盒觸發 pearlForged', () => {
  freshStorage();
  const ctx = initSession(bank);
  let forged = false;
  for (let i = 0; i < 5; i++) {
    const { events } = onPracticeAnswer(ctx, 'gr-e-0001', true);
    if (events.some((e) => e.type === 'pearlForged')) forged = true;
  }
  assert.ok(forged, '滿盒必須煉成');
  assert.ok(ctx.meta.collection['gr-e-0001'].earnedAt);
});

test('墨珠每日上限守恆', () => {
  freshStorage();
  const ctx = initSession(bank);
  for (let i = 0; i < 400; i++) onPracticeAnswer(ctx, 'rh-e-0001', true);
  assert.ok(ctx.meta.pearls.earnedToday <= DAILY_EARN_CAP + 20, '一般練習收入不得突破每日上限（煉成獎勵豁免少量）');
});

test('onBattleEnd 勝場計數與獎勵', () => {
  freshStorage();
  const ctx = initSession(bank);
  onBattleEnd(ctx, { won: true, bestCombo: 5 });
  assert.equal(ctx.meta.ach.stats.wins, 1);
  assert.equal(ctx.meta.ach.stats.bestCombo, 5);
});

test('一般練功存檔不會清除先前章回題的 Leitner 進度', () => {
  const storage = freshStorage();
  storage.set('wxdl_meta', JSON.stringify({ leitner: { 'rd-e-18001': 2 } }));
  const ctx = initSession(bank);
  onPracticeAnswer(ctx, 'rh-e-0001', true);
  assert.equal(loadMeta().leitner['rd-e-18001'], 2);
});

test('章回題會註冊到同一套學習核心並累積閱讀弱點', () => {
  freshStorage();
  const ctx = initSession(bank);
  registerSessionEntries(ctx, [{ id: 'rd-e-18001', zone: '閱讀', cat: '明示訊息', difficulty: '易' }]);
  onPracticeAnswer(ctx, 'rd-e-18001', true);
  assert.equal(ctx.meta.leitner['rd-e-18001'], 2);
  assert.deepEqual(ctx.meta.weak['閱讀·明示訊息'], { correct: 1, wrong: 0 });
});

test('舊版遺失盒位但保留零錯誤紀錄時，恢復第一次答對的進度', () => {
  const storage = freshStorage();
  storage.set('wxdl_meta', JSON.stringify({
    leitner: {},
    collection: { 'rd-e-18001': { earnedAt: '', wrong: 0 } },
  }));
  const ctx = initSession(bank);
  registerSessionEntries(ctx, [{ id: 'rd-e-18001', zone: '閱讀', cat: '明示訊息', difficulty: '易' }]);
  assert.equal(ctx.leitner.get('rd-e-18001'), 2);
});
