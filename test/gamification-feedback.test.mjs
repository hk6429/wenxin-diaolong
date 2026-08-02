import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFeedbackViewModel, FEATURE_IDS } from '../js/gamification/feedback.js';

const entry = {
  id: 'rh-j-0001', level: '國中', zone: '修辭', cat: '譬喻', qformat: 'rh-identify',
  answer: '譬喻', explain: '句中用「像」連接本體與喻依，所以是明喻。', citation: '',
};

function build(overrides = {}) {
  return buildFeedbackViewModel({
    entry,
    picked: '轉化',
    correct: false,
    meta: {
      leitner: { [entry.id]: 1 },
      weak: { '修辭·譬喻': { correct: 2, wrong: 4 } },
    },
    beforeBox: 3,
    afterBox: 1,
    recentAttempts: [{ correct: false }, { correct: true }, { correct: false }],
    session: { answered: 4, target: 10 },
    ...overrides,
  });
}

test('整合 view-model 恰有 F01-F10，順序與共通欄位穩定', () => {
  const view = build();
  assert.deepEqual(view.featureOrder, FEATURE_IDS);
  assert.equal(Object.keys(view.features).length, 10);
  for (const id of FEATURE_IDS) {
    assert.deepEqual(Object.keys(view.features[id]).slice(0, 6), ['id', 'surface', 'visible', 'title', 'message', 'action']);
    assert.equal(view.features[id].id, id);
  }
});

test('F01 結果框架不以分數評價學生', () => {
  const feature = build().features.F01;
  assert.equal(feature.state, 'retry');
  assert.doesNotMatch(feature.message, /笨|差生|失敗|得分|扣分/);
});

test('F02 同時保留學生選項與正解供比較', () => {
  const feature = build().features.F02;
  assert.deepEqual(feature.selected, ['轉化']);
  assert.deepEqual(feature.expected, ['譬喻']);
  assert.equal(feature.hasContrast, true);
});

test('F03 提供詳解與出處狀態，不捏造來源', () => {
  const feature = build().features.F03;
  assert.equal(feature.explanation, entry.explain);
  assert.equal(feature.citation, '');
  assert.equal(feature.hasSource, false);
});

test('F04 依學習領域給可執行策略', () => {
  const feature = build().features.F04;
  assert.equal(feature.zone, '修辭');
  assert.match(feature.strategy, /關鍵語詞/);
});

test('F05 答錯後允許無懲罰重試並使用支持語氣', () => {
  const feature = build().features.F05;
  assert.equal(feature.tone, 'supportive');
  assert.equal(feature.retryWithoutPenalty, true);
});

test('F06 清楚呈現 Leitner 前後盒位與提早複習方向', () => {
  const feature = build().features.F06;
  assert.equal(feature.beforeBox, 3);
  assert.equal(feature.afterBox, 1);
  assert.equal(feature.movement, 'review-sooner');
  assert.equal(feature.mastered, false);
});

test('F07 弱點採真實分類統計並標示資料可信度', () => {
  const feature = build().features.F07;
  assert.deepEqual({ key: feature.key, correct: feature.correct, wrong: feature.wrong, total: feature.total }, {
    key: '修辭·譬喻', correct: 2, wrong: 4, total: 6,
  });
  assert.equal(feature.accuracy, 1 / 3);
  assert.equal(feature.confidence, 'usable');
});

test('F08 近期紀錄不足時誠實停在 insufficient', () => {
  const feature = build({ recentAttempts: [{ correct: true }] }).features.F08;
  assert.equal(feature.available, false);
  assert.equal(feature.sampleSize, 1);
  assert.equal(feature.accuracy, null);
  assert.equal(feature.trend, 'insufficient');
});

test('F09 將答錯轉成兩次同概念答對的小目標', () => {
  const feature = build().features.F09;
  assert.equal(feature.kind, 'recovery');
  assert.equal(feature.correctNeeded, 2);
  assert.equal(feature.sessionRemaining, 6);
});

test('F10 產生首頁可接的弱點短練習路由', () => {
  const feature = build().features.F10;
  assert.equal(feature.surface, 'home');
  assert.equal(feature.priority, 'now');
  assert.equal(feature.route, 'weak-practice');
  assert.equal(feature.focusKey, '修辭·譬喻');
  assert.equal(feature.questionId, entry.id);
});

test('答對且到第 5 盒時改為間隔複習與探索，不再追連續得分', () => {
  const view = build({
    picked: '譬喻', correct: true, beforeBox: 4, afterBox: 5,
    recentAttempts: [{ correct: true }, { correct: true }],
  });
  assert.equal(view.features.F01.state, 'correct');
  assert.equal(view.features.F06.mastered, true);
  assert.equal(view.features.F09.kind, 'spaced-review');
  assert.equal(view.features.F10.route, 'practice-new');
});

test('純函式不修改傳入的 meta 與作答紀錄', () => {
  const meta = { leitner: { [entry.id]: 2 }, weak: { '修辭·譬喻': { correct: 1, wrong: 1 } } };
  const recentAttempts = [{ correct: false }, { correct: true }];
  const before = JSON.stringify({ meta, recentAttempts });
  buildFeedbackViewModel({ entry, picked: '轉化', meta, recentAttempts });
  assert.equal(JSON.stringify({ meta, recentAttempts }), before);
});
