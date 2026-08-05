// kernel — 養成/收藏機制的唯一整合接縫（精簡版，仿字字珠璣架構）。
// 主控只接固定掛鉤，kernel 扇出至各 meta 模組、彙整 events 陣列、統一 saveMeta。
// 事件統一格式 { type, payload, fx }，由 UI 層（integration/app）決定怎麼渲染。
import { loadMeta, saveMeta } from './store.js';
import { onQuestionResult, loadLeitnerState, persistLeitner } from './collection.js';
import { earnPearls } from './economy.js';
import { addXp } from './progress.js';
import { recordWeakness, weakKeyOf } from './weakness.js';
import { recordAnswer, boostSiblings } from '../leitner.js';
import { petEventsOnAnswer } from './pet.js';

const PEARL_PER_CORRECT = 2;
const PEARL_FORGED_BONUS = 5;
const XP_CORRECT = 10;
const XP_WRONG = 2;

function todayStr(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function rolloverDaily(meta, today) {
  if (meta.daily.date === today) return;
  const yesterdayActive = meta.daily.todayAnswered > 0;
  const prev = meta.daily.date;
  // 連續天數：昨天有練 → +1；斷檔 → 歸 1（今天開始重新累積）
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  const yesterday = todayStr(d);
  if (prev === yesterday && yesterdayActive) meta.daily.streak += 1;
  else meta.daily.streak = 1;
  meta.daily.best = Math.max(meta.daily.best, meta.daily.streak);
  meta.daily.date = today;
  meta.daily.todayCorrect = 0;
  meta.daily.todayAnswered = 0;
  meta.daily.todayBattles = 0;
}

// banks：目前學制載入的全部題目陣列（entry[]）。建索引表供 siblings/弱點用。
export function initSession(banks = []) {
  const meta = loadMeta();
  const today = todayStr();
  rolloverDaily(meta, today);

  const byId = new Map(banks.map((e) => [e.id, e]));
  const siblingsOfId = new Map();
  const byCatKey = new Map();
  for (const e of banks) {
    const key = weakKeyOf(e);
    if (!byCatKey.has(key)) byCatKey.set(key, []);
    byCatKey.get(key).push(e.id);
  }
  for (const e of banks) {
    const key = weakKeyOf(e);
    siblingsOfId.set(e.id, byCatKey.get(key).filter((id) => id !== e.id));
  }

  const leitner = loadLeitnerState(meta, banks.map((e) => e.id));
  saveMeta(meta);
  return { meta, today, byId, siblingsOfId, leitner };
}

export function registerSessionEntries(ctx, entries = []) {
  const incoming = entries.filter((entry) => entry?.id);
  for (const entry of incoming) {
    ctx.byId.set(entry.id, entry);
    if (!ctx.leitner.has(entry.id)) {
      const record = ctx.meta.collection?.[entry.id];
      const recoveredBox = record?.earnedAt ? 5 : record && record.wrong === 0 ? 2 : 1;
      ctx.leitner.set(entry.id, ctx.meta.leitner?.[entry.id] ?? recoveredBox);
    }
  }
  const affected = new Set(incoming.map((entry) => weakKeyOf(entry)).filter(Boolean));
  for (const key of affected) {
    const ids = [...ctx.byId.values()].filter((entry) => weakKeyOf(entry) === key).map((entry) => entry.id);
    for (const id of ids) ctx.siblingsOfId.set(id, ids.filter((siblingId) => siblingId !== id));
  }
  return ctx;
}

function processAnswer(ctx, id, correct, mode) {
  const { meta } = ctx;
  const events = [];
  const entry = ctx.byId.get(id);

  meta.daily.todayAnswered += 1;
  meta.xp.totalAnswered += 1;
  meta.ach.stats.totalAnswered += 1;
  if (correct) {
    meta.daily.todayCorrect += 1;
    meta.xp.totalCorrect += 1;
    meta.ach.stats.totalCorrect += 1;
  }

  // Leitner 盒位 + 同類聚焦複習（答錯時同 cat 其他題輕退一盒）
  recordAnswer(ctx.leitner, id, correct);
  if (!correct) boostSiblings(ctx.leitner, (ctx.siblingsOfId.get(id) || []).slice(0, 8));
  persistLeitner(meta, ctx.leitner);

  // 文心珠圖鑑（煉成/蒙塵/擦亮/升階）
  const newBox = ctx.leitner.get(id) ?? 1;
  const col = onQuestionResult(meta, id, correct, newBox);
  for (const ev of col.events) {
    if (ev.payload?.setBox) ctx.leitner.set(id, ev.payload.setBox);
    events.push(ev);
    if (ev.type === 'pearlForged') {
      earnPearls(meta, PEARL_FORGED_BONUS, 'forge-bonus', ctx.today);
    }
  }
  persistLeitner(meta, ctx.leitner);

  // 弱點統計
  recordWeakness(meta, weakKeyOf(entry), correct);

  // 墨珠與文氣
  if (correct) {
    const { earned, capped } = earnPearls(meta, PEARL_PER_CORRECT, mode, ctx.today);
    if (earned > 0) events.push({ type: 'pearls', payload: { earned, capped }, fx: 'pearl-pop' });
  }
  const xp = addXp(meta, correct ? XP_CORRECT : XP_WRONG);
  if (xp.leveledUp) events.push({ type: 'rankUp', payload: xp.newRank, fx: 'rank-glow' });

  // 文心四靈（解鎖/升級偵測）
  for (const ev of petEventsOnAnswer(meta, entry, correct)) events.push(ev);

  return events;
}

export function onPracticeAnswer(ctx, id, correct) {
  const events = processAnswer(ctx, id, correct, 'practice');
  saveMeta(ctx.meta);
  return { ctx, events };
}

export function onBattleAnswer(ctx, id, correct) {
  const events = processAnswer(ctx, id, correct, 'battle');
  saveMeta(ctx.meta);
  return { ctx, events };
}

export function onBattleEnd(ctx, { won = false, bestCombo = 0, perfect = false } = {}) {
  const { meta } = ctx;
  const events = [];
  meta.daily.todayBattles += 1;
  meta.ach.stats.battles += 1;
  if (won) {
    meta.ach.stats.wins += 1;
    const { earned } = earnPearls(meta, 20, 'battle-win', ctx.today);
    if (earned > 0) events.push({ type: 'pearls', payload: { earned }, fx: 'pearl-pop' });
  }
  meta.ach.stats.bestCombo = Math.max(meta.ach.stats.bestCombo, bestCombo);
  if (perfect) meta.ach.stats.perfectGames += 1;
  saveMeta(meta);
  return { ctx, events };
}
