// 精熟回饋 view-model：只做資料轉換，不讀寫 DOM、storage 或時間。
// 呼叫端在作答結算後傳入 entry / meta / 盒位與近期紀錄，即可同時供題後回饋與首頁使用。

const MIN_BOX = 1;
const MAX_BOX = 5;
const FEATURE_IDS = Object.freeze(Array.from({ length: 10 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`));

const clampBox = (value, fallback = MIN_BOX) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(MAX_BOX, Math.max(MIN_BOX, Math.round(number))) : fallback;
};

const asAnswers = (value) => {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
};

const sameAnswers = (left, right) => {
  const a = [...new Set(asAnswers(left))].sort();
  const b = [...new Set(asAnswers(right))].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

const weakKeyOf = (entry) => entry?.zone && entry?.cat ? `${entry.zone}·${entry.cat}` : '';

function feature(id, surface, title, message, action, extra = {}) {
  return { id, surface, visible: true, title, message, action, ...extra };
}

function strategyFor(entry) {
  if (entry?.zone === '閱讀') return '回到題幹，圈出能直接支持答案的句子。';
  if (entry?.zone === '文法') return '先找句中位置與功能，再判斷詞性或句型。';
  if (entry?.zone === '格律') return '先標出聲韻、平仄或上下句對應，再選答案。';
  if (entry?.zone === '修辭') return '先找關鍵語詞，再說明它造成的表達效果。';
  return '先找題幹關鍵詞，再用自己的話說出判斷理由。';
}

function recentPattern(recentAttempts) {
  const attempts = Array.isArray(recentAttempts)
    ? recentAttempts.filter((attempt) => attempt && typeof attempt.correct === 'boolean').slice(-6)
    : [];
  if (attempts.length < 2) {
    return { available: false, sampleSize: attempts.length, accuracy: null, trend: 'insufficient', consecutiveCorrect: attempts.at(-1)?.correct ? 1 : 0 };
  }
  const accuracy = attempts.filter((attempt) => attempt.correct).length / attempts.length;
  const midpoint = Math.ceil(attempts.length / 2);
  const rate = (rows) => rows.filter((row) => row.correct).length / rows.length;
  const delta = rate(attempts.slice(midpoint)) - rate(attempts.slice(0, midpoint));
  let consecutiveCorrect = 0;
  for (let index = attempts.length - 1; index >= 0 && attempts[index].correct; index -= 1) consecutiveCorrect += 1;
  return {
    available: true,
    sampleSize: attempts.length,
    accuracy,
    trend: delta >= 0.25 ? 'improving' : delta <= -0.25 ? 'needs-support' : 'steady',
    consecutiveCorrect,
  };
}

/**
 * 建立整合型精熟回饋。
 * recentAttempts 格式為 [{ correct: boolean }]，由呼叫端決定傳入同題或同分類的近期紀錄。
 */
export function buildFeedbackViewModel({
  entry = {},
  picked = [],
  correct,
  meta = {},
  beforeBox,
  afterBox,
  recentAttempts = [],
  session = {},
} = {}) {
  const expected = asAnswers(entry.answer);
  const selected = asAnswers(picked);
  const isCorrect = typeof correct === 'boolean' ? correct : sameAnswers(selected, expected);
  const resolvedAfterBox = clampBox(afterBox ?? meta?.leitner?.[entry.id], MIN_BOX);
  const inferredBefore = isCorrect ? resolvedAfterBox - 1 : resolvedAfterBox + 2;
  const resolvedBeforeBox = clampBox(beforeBox, clampBox(inferredBefore));
  const weakKey = weakKeyOf(entry);
  const weak = meta?.weak?.[weakKey] || {};
  const weakCorrect = Math.max(0, Number(weak.correct) || 0);
  const weakWrong = Math.max(0, Number(weak.wrong) || 0);
  const weakTotal = weakCorrect + weakWrong;
  const weakAccuracy = weakTotal ? weakCorrect / weakTotal : null;
  const pattern = recentPattern(recentAttempts);
  const nextCorrectNeeded = isCorrect
    ? Math.max(0, 2 - Math.max(1, pattern.consecutiveCorrect))
    : 2;
  const answered = Math.max(0, Number(session.answered) || 0);
  const target = Math.max(0, Number(session.target) || 0);
  const remaining = target ? Math.max(0, target - answered) : null;

  const features = {
    F01: feature('F01', 'quiz', '先看這一步', isCorrect
      ? '判斷正確；接著確認你不是只靠猜測。'
      : '這次還沒對，但錯誤指出了下一個可練的小地方。',
    '查看理由', { state: isCorrect ? 'correct' : 'retry', correct: isCorrect }),

    F02: feature('F02', 'quiz', '答案差在哪裡', isCorrect
      ? `你的答案「${selected.join('、') || expected.join('、')}」與正解一致。`
      : `你選「${selected.join('、') || '未作答'}」；正解是「${expected.join('、') || '題目未提供'}」。`,
    '比較兩個選項', { selected, expected, hasContrast: !isCorrect && selected.length > 0 && expected.length > 0 }),

    F03: feature('F03', 'quiz', '用證據說明', entry.explain || '請回到題幹，找出最能支持正解的關鍵詞或句子。',
    '指出一個證據', { explanation: entry.explain || '', citation: entry.citation || '', hasSource: Boolean(entry.citation) }),

    F04: feature('F04', 'quiz', '下次解題策略', strategyFor(entry),
    '照策略再想一次', { strategy: strategyFor(entry), zone: entry.zone || '', qformat: entry.qformat || '' }),

    F05: feature('F05', 'quiz', '把挫折變線索', isCorrect
      ? '答對後再說一次理由，會比只記答案更牢。'
      : '先停一下、讀懂解析，再做同類題；不用用一次答錯定義自己。',
    isCorrect ? '用一句話解釋' : '準備好再挑戰', { tone: 'supportive', retryWithoutPenalty: true }),

    F06: feature('F06', 'quiz', '記憶盒進度', resolvedAfterBox >= MAX_BOX
      ? '這題已到第 5 盒；之後仍要隔一段時間再確認。'
      : isCorrect
        ? `這題從第 ${resolvedBeforeBox} 盒前進到第 ${resolvedAfterBox} 盒。`
        : `這題目前在第 ${resolvedAfterBox} 盒，代表要提早再複習。`,
    resolvedAfterBox >= MAX_BOX ? '安排間隔複習' : '稍後再練', {
      beforeBox: resolvedBeforeBox,
      afterBox: resolvedAfterBox,
      movement: resolvedAfterBox > resolvedBeforeBox ? 'forward' : resolvedAfterBox < resolvedBeforeBox ? 'review-sooner' : 'unchanged',
      mastered: resolvedAfterBox >= MAX_BOX,
    }),

    F07: feature('F07', 'quiz+home', '弱點不是標籤', weakTotal < 3
      ? `${entry.cat || '這個分類'}的資料還在累積，先不要急著下結論。`
      : `${entry.cat || '這個分類'}目前練過 ${weakTotal} 次，答對 ${weakCorrect} 次；用它決定複習順序，不排名。`,
    weakAccuracy !== null && weakAccuracy < 0.7 ? '練兩題同類題' : '繼續累積證據', {
      key: weakKey,
      correct: weakCorrect,
      wrong: weakWrong,
      total: weakTotal,
      accuracy: weakAccuracy,
      confidence: weakTotal >= 5 ? 'usable' : 'developing',
    }),

    F08: feature('F08', 'quiz+home', '看最近的變化', !pattern.available
      ? '近期紀錄還不夠；再完成幾題後，才判斷是否進步。'
      : pattern.trend === 'improving'
        ? `最近 ${pattern.sampleSize} 次正在進步，繼續用同一個策略。`
        : pattern.trend === 'needs-support'
          ? `最近 ${pattern.sampleSize} 次需要多一點支援，先放慢並找證據。`
          : `最近 ${pattern.sampleSize} 次表現穩定，可以繼續鞏固。`,
    pattern.available ? '查看近期作答' : '再累積兩次作答', pattern),

    F09: feature('F09', 'quiz', '下一個小目標', nextCorrectNeeded === 0
      ? '你已連續答對兩次；下一步改成隔一段時間再答。'
      : `不用追總分：先把同一概念再答對 ${nextCorrectNeeded} 次。`,
    nextCorrectNeeded === 0 ? '稍後再複習' : '挑戰同類題', {
      kind: nextCorrectNeeded === 0 ? 'spaced-review' : 'recovery',
      consecutiveCorrect: pattern.consecutiveCorrect,
      correctNeeded: nextCorrectNeeded,
      sessionRemaining: remaining,
    }),

    F10: feature('F10', 'home', '回到首頁後做什麼', !isCorrect
      ? `優先回到「${entry.cat || '本題概念'}」做短練習，理解後再前進。`
      : resolvedAfterBox < MAX_BOX
        ? `把「${entry.cat || '本題概念'}」排進下一次間隔複習。`
        : '這題已精熟，下一步探索新的概念，同時保留日後複習。',
    !isCorrect ? '開始弱點短練習' : resolvedAfterBox < MAX_BOX ? '加入下次複習' : '探索新概念', {
      priority: !isCorrect ? 'now' : resolvedAfterBox < MAX_BOX ? 'later' : 'explore',
      route: !isCorrect ? 'weak-practice' : resolvedAfterBox < MAX_BOX ? 'spaced-review' : 'practice-new',
      focusKey: weakKey,
      questionId: entry.id || '',
    }),
  };

  return {
    version: 1,
    questionId: entry.id || '',
    level: entry.level || '',
    correct: isCorrect,
    featureOrder: [...FEATURE_IDS],
    features,
    surfaces: {
      quiz: FEATURE_IDS.filter((id) => features[id].surface.includes('quiz')),
      home: FEATURE_IDS.filter((id) => features[id].surface.includes('home')),
    },
  };
}

export { FEATURE_IDS };
