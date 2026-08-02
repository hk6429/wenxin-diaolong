// 題庫載入與快取的單一出入口（比照字字珠璣 bank.js）。
import { loadQuizBank } from './quiz-loader.js';

const L = (name) => ({ path: `data/${name}.json` });

export const BANK_SOURCES = {
  國小: {
    rhetoric: [L('rhetoric-elementary')],
    grammar: [L('grammar-elementary')],
    prosody: [L('prosody-elementary')],
    mixed: [L('rhetoric-elementary'), L('grammar-elementary'), L('prosody-elementary')],
    lunyu: [L('lunyu-elementary')],
    shiji: [L('shiji-elementary')],
    duange: [L('duange-elementary')],
  },
  國中: {
    rhetoric: [L('rhetoric-junior')],
    grammar: [L('grammar-junior')],
    prosody: [L('prosody-junior')],
    mixed: [L('rhetoric-junior'), L('grammar-junior'), L('prosody-junior')],
    lunyu: [L('lunyu-junior')],
    shiji: [L('shiji-junior')],
    duange: [L('duange-junior')],
  },
  高中: {
    rhetoric: [L('rhetoric-senior')],
    grammar: [L('grammar-senior')],
    prosody: [L('prosody-senior')],
    mixed: [L('rhetoric-senior'), L('grammar-senior'), L('prosody-senior')],
    lunyu: [L('lunyu-senior')],
    shiji: [L('shiji-senior')],
    duange: [L('duange-senior')],
  },
  實戰: {
    rhetoric: [L('exam-rhetoric')],
    grammar: [L('exam-grammar')],
    prosody: [L('exam-prosody')],
    mixed: [L('exam-rhetoric'), L('exam-grammar'), L('exam-prosody')],
  },
};

// 學制是裝置層級設定，不進 meta 存檔 schema。
const LEVEL_KEY = 'wxdl:level';
let storedLevel = null;
try { storedLevel = localStorage.getItem(LEVEL_KEY); } catch {}
let currentLevel = BANK_SOURCES[storedLevel] ? storedLevel : '國小';

export function getLevel() { return currentLevel; }

export function setLevel(level) {
  if (!BANK_SOURCES[level] || level === currentLevel) return false;
  currentLevel = level;
  try { localStorage.setItem(LEVEL_KEY, level); } catch {}
  return true;
}

const cache = new Map(); // path → usable[]

export async function fetchBank(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
  const raw = await res.json();
  const { usable, rejected } = loadQuizBank(raw);
  if (rejected.length) {
    console.warn(`[文心雕龍] ${path} 有 ${rejected.length} 筆題目未通過驗證，已排除`, rejected);
  }
  cache.set(path, usable);
  return usable;
}

export async function loadBank(bankKey) {
  const parts = await Promise.all(
    BANK_SOURCES[currentLevel][bankKey].map((src) => fetchBank(src.path)),
  );
  return parts.flat();
}
