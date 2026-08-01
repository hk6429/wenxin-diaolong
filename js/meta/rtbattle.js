// 即時對戰純邏輯：同 seed 不同機出同一組題；傷害權威在攻擊方。
// UI 層在 js/rtbattle-ui.js；本檔零 DOM、零網路，全部可 node --test。
import { BATTLE_EVENTS } from './encounter.js';
import { baseModifiers } from './gear.js';

export const ROUNDS = 20;
export const ROUND_SEC = 15;
export const POLL_MS = 1500;
export const DEAD_MS = 20000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildQuestions(seed, entries, rounds = ROUNDS) {
  const rng = mulberry32(seed);
  // 先依 id 排序：兩機的 entries 載入順序不同也能出同序（同 vocab-duel 手法）
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : 1));
  const pick = [];
  const used = new Set();
  while (pick.length < Math.min(rounds, sorted.length) && used.size < sorted.length) {
    const i = Math.floor(rng() * sorted.length);
    if (used.has(i)) continue;
    used.add(i);
    pick.push(sorted[i]);
  }
  return pick.map((e) => {
    const options = [...e.options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { id: e.id, type: e.type, question: e.question, options, answer: e.answer, explain: e.explain || [] };
  });
}

export const ENCOUNTER_EVERY = 5;
// applyEncounterEffect 只吃這三種效果（pearls/challenge 是 kernel/UI 的事，rt 不用）
// 白帽張力校準：doubleDamage 一律只在「答對」那格才乘倍（battle-adapter 內建規則，答錯本來就不造成
// 傷害），已符合「運氣只放大答對驅動的傷害，不會無中生有」。但即時對戰是 20 題定輸贏的零和賽，
// 原始權重表裡 doubleDamage 佔比過高（30／全部 55 ≈ 55%），單場勝負太容易被「剛好卡在雙倍傷害那格」
// 帶偏。這裡只降低 doubleDamage 在「即時對戰限定」事件池裡的權重，不動 encounter.js 共用表
// （練習模式/其他戰鬥仍用原權重），讓答題表現維持最大決勝因素。
const RT_WEIGHT_OVERRIDE = { doubleDamage: 15 };
const RT_EVENTS = BATTLE_EVENTS
  .filter(e => ['doubleDamage', 'eliminate', 'comboThreshold'].includes(e.effect.type))
  .map(e => (RT_WEIGHT_OVERRIDE[e.effect.type] != null ? { ...e, weight: RT_WEIGHT_OVERRIDE[e.effect.type] } : e));

export function buildEncounterScript(seed, rounds = ROUNDS, every = ENCOUNTER_EVERY) {
  const rng = mulberry32((seed ^ 0x5EEDCAFE) >>> 0); // 與出題 rng 分流，互不干擾
  const script = new Map();
  let lastId = null;
  for (let at = every; at <= rounds; at += every) {
    const pool = RT_EVENTS.filter(e => e.id !== lastId);
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = rng() * total;
    let picked = pool[pool.length - 1];
    for (const e of pool) { roll -= e.weight; if (roll < 0) { picked = e; break; } }
    lastId = picked.id;
    script.set(at, picked);
  }
  return script;
}

export function dealtDamage(prevState, nextState) {
  return Math.max(0, prevState.hpB - nextState.hpB);
}

// ---------- 單人挑戰「今日墨靈刺客」：不需要真人對手也能完整走一場對戰 ----------
// 用日期字串（YYYY-MM-DD）做決定性種子：同一天、任何裝置都算出同一個目標，
// 不可用 Date.now()／Math.random，才能讓題目與刺客防線每天固定、可測試。
export function assassinSeed(dateStr) {
  let h = 2166136261 >>> 0; // FNV-1a 32-bit offset basis
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 刺客防線＝當日輸出目標值。BASE/SPAN 取一個「全對＋部分連對加成」量級內的合理值，
// 讓認真作答的孩子有機會打贏，又不會隨便亂點就過關。
export const ASSASSIN_BASE = 140;
export const ASSASSIN_SPAN = 60;

export function assassinTargetScore(dateStr) {
  const rng = mulberry32(assassinSeed(dateStr));
  return ASSASSIN_BASE + Math.floor(rng() * ASSASSIN_SPAN);
}

// ---------- 對戰內數值歸一化（戰力封頂，Task 1） ----------
// 即時對戰是零和 20 題定輸贏，法寶/寵物「數值型」加成（非一次性 boolean 效果）若無上限，
// 會讓課金/苦練投入直接決定勝負，架空答題本身。這裡只用一支純函式：
// 1) 用權重把 mods 各項數值差（相對 baseModifiers 的基準）換算成一個「戰力分數」；
// 2) 分數若超過 REFERENCE_POWER × band（預設 ±15%）就把所有數值差同比例縮小，
//    讓雙方進場的戰力落在同一基準線附近，勝負回歸答題正確率與速度。
// 一次性效果（松煙墨免斷連對、歙硯單場爆發）不參與縮放：它們本來就每場只觸發一次，
// 縮放成小數沒有意義，且已受限於「每場一次」，戰力膨脹風險本來就低。
export const NORM_BAND = 0.15;
export const REFERENCE_POWER = 100; // 「基準戰力」＝0 加成起點的參考量尺，只用來換算 band

const POWER_WEIGHTS = {
  maxHp: 0.5,
  comboBonusDamage: 1,
  lateBonus: 1.5,
  healOnCorrect: 1.5,
  missReflect: 1.5,
  inkBonus: 2,
  typeBonus: 1,
  comboThreshold: 2, // 門檻越低（越容易連對）視為正向戰力，用「基準-目前」取正值
};

export function battlePowerScore(mods) {
  const base = baseModifiers();
  let score = 0;
  score += (mods.maxHp - base.maxHp) * POWER_WEIGHTS.maxHp;
  score += (mods.comboBonusDamage - base.comboBonusDamage) * POWER_WEIGHTS.comboBonusDamage;
  score += (mods.lateBonus - base.lateBonus) * POWER_WEIGHTS.lateBonus;
  score += (mods.healOnCorrect - base.healOnCorrect) * POWER_WEIGHTS.healOnCorrect;
  score += (mods.missReflect - base.missReflect) * POWER_WEIGHTS.missReflect;
  score += (mods.inkBonus - base.inkBonus) * POWER_WEIGHTS.inkBonus;
  score += (base.comboThreshold - mods.comboThreshold) * POWER_WEIGHTS.comboThreshold;
  const tb = mods.typeBonus || {};
  for (const k of Object.keys(tb)) {
    score += (tb[k] - (base.typeBonus[k] || 0)) * POWER_WEIGHTS.typeBonus;
  }
  return score;
}

// 回傳新的 mods（不改原物件）；數值型欄位依統一係數縮放到分數落在
// [REFERENCE_POWER×(1-band)−REFERENCE_POWER, REFERENCE_POWER×(1+band)−REFERENCE_POWER] 內
// ——因為基準線本身分數=0，band 直接套在 REFERENCE_POWER 這把量尺上，換算成允許的最大分數。
export function normalizeBattleMods(mods, band = NORM_BAND) {
  const base = baseModifiers();
  const score = battlePowerScore(mods);
  const cap = REFERENCE_POWER * band;
  if (score <= cap) return { ...mods, typeBonus: { ...mods.typeBonus } }; // 戰力已在基準線內，原樣（淺拷貝防外部修改)
  const factor = cap / score;
  const scaled = { ...mods, typeBonus: { ...mods.typeBonus } };
  scaled.maxHp = base.maxHp + (mods.maxHp - base.maxHp) * factor;
  scaled.comboBonusDamage = base.comboBonusDamage + (mods.comboBonusDamage - base.comboBonusDamage) * factor;
  scaled.lateBonus = base.lateBonus + (mods.lateBonus - base.lateBonus) * factor;
  scaled.healOnCorrect = base.healOnCorrect + (mods.healOnCorrect - base.healOnCorrect) * factor;
  scaled.missReflect = base.missReflect + (mods.missReflect - base.missReflect) * factor;
  scaled.inkBonus = base.inkBonus + (mods.inkBonus - base.inkBonus) * factor;
  scaled.comboThreshold = base.comboThreshold - (base.comboThreshold - mods.comboThreshold) * factor;
  for (const k of Object.keys(scaled.typeBonus)) {
    scaled.typeBonus[k] = (base.typeBonus[k] || 0) + ((mods.typeBonus[k] || 0) - (base.typeBonus[k] || 0)) * factor;
  }
  return scaled;
}

export function judge({ myHp, oppHp, myDone, oppDone, oppHbAgeMs }) {
  if (oppHbAgeMs > DEAD_MS) return 'win'; // 對手斷線
  if (myHp <= 0 && oppHp <= 0) return 'draw';
  if (myHp <= 0) return 'lose';
  if (oppHp <= 0) return 'win';
  if (myDone && oppDone) return myHp > oppHp ? 'win' : myHp < oppHp ? 'lose' : 'draw';
  return null;
}
