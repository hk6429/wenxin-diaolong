// store — 單一 namespace `wxdl_meta` 的載入/儲存/版本遷移。
// 所有機制模組唯一的持久化出入口；全包 try/catch，隱私模式不炸。
// 測試可用 setStorageBackend() 注入 mock storage。
import { CHAPTER_ID } from '../adventure.js';

export const META_KEY = 'wxdl_meta';
export const SCHEMA_VERSION = 2;

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

let injectedBackend = null;
const memoryFallback = createMemoryStorage();

export function setStorageBackend(backend) {
  injectedBackend = backend;
}

function backend() {
  if (injectedBackend) return injectedBackend;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch { /* 隱私模式存取 localStorage 本身就可能 throw */ }
  return memoryFallback;
}

export function defaultMeta() {
  return {
    v: SCHEMA_VERSION,
    profile: { name: '', createdAt: '' },
    // Leitner 盒位 {id: box}；collection 見 js/meta/collection.js（文心珠圖鑑）
    leitner: {},
    collection: {},
    pearls: { balance: 0, earnedToday: 0, earnedDate: '' },
    xp: { value: 0, rank: 0, totalAnswered: 0, totalCorrect: 0 },
    daily: {
      date: '', todayCorrect: 0, todayAnswered: 0, todayBattles: 0,
      streak: 0, best: 0, charms: 0,
    },
    // 文房法寶／煉字文訣（對戰加成，battle-adapter 讀取）
    gear: { owned: [], loadout: [] },
    arts: { unlocked: [], equipped: null, battlesWon: 0 },
    // 弱點分類統計：{ [`${zone}·${cat}`]: { correct, wrong } }
    weak: {},
    ach: {
      unlocked: {},
      stats: { wins: 0, battles: 0, bestCombo: 0, perfectGames: 0, totalAnswered: 0, totalCorrect: 0 },
    },
    // 文心四靈（Phase 4）：等級不存檔、由 collection 推算，這裡只存陪伴狀態
    pet: { seen: {}, active: null, ownedEquip: [], equipped: {}, unlockedAt: {} },
    pvp: { nick: '', wins: 0, losses: 0 },
    adventure: {
      chapterId: CHAPTER_ID,
      sceneIndex: 0,
      chapterStatus: 'locked',
      echoDueAt: '',
      level: '國小',
      zhuyinMode: 'smart',
      questResults: {},
      rewards: [],
    },
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// 以 defaults 為底、stored 覆蓋；缺欄位自動補齊（版本遷移的最低保證）。
function mergeInto(def, stored) {
  const out = { ...def };
  for (const key of Object.keys(stored)) {
    if (isPlainObject(def[key]) && isPlainObject(stored[key])) {
      out[key] = mergeInto(def[key], stored[key]);
    } else {
      out[key] = stored[key];
    }
  }
  return out;
}

export function loadMeta() {
  const def = defaultMeta();
  try {
    const raw = backend().getItem(META_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return def;
    const merged = mergeInto(def, parsed);
    merged.v = SCHEMA_VERSION;
    return merged;
  } catch {
    return def;
  }
}

export function saveMeta(meta) {
  try {
    backend().setItem(META_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function resetAll() {
  try {
    backend().removeItem(META_KEY);
  } catch { /* ignore */ }
}
