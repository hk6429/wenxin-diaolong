// 題庫載入與快取的單一出入口（比照字字珠璣 bank.js）。
import { loadQuizBank } from './quiz-loader.js';

const L = (name) => ({ path: `data/${name}.json` });

const NEW_ADVENTURE_KEYS = [
  'zhuangzi', 'quyuan',
  'wangwei', 'menghaoran', 'gaoshi', 'wangchangling', 'censhen', 'wangzhihuan', 'cuihao',
  'hanyu', 'liuzongyuan', 'baijuyi', 'liuyuxi', 'dumu', 'lishangyin', 'liyu',
  'ouyangxiu', 'wanganshi', 'suxun', 'sushi', 'suzhe', 'zenggong', 'fanzhongyan',
  'liuyong', 'huangtingjian', 'qinguan', 'yanshu',
  'yuefei', 'liqingzhao', 'luyou', 'xinqiji', 'wentianxiang',
  'guanhanqing', 'mazhiyuan', 'baipu', 'zhengguangzu',
  'luoguanzhong', 'shinaian', 'wuchengen', 'pusongling', 'caoxueqin',
];

const adventureBanks = (suffix) => Object.fromEntries(
  NEW_ADVENTURE_KEYS.map((key) => [key, [L(`${key}-${suffix}`)]]),
);

export const BANK_SOURCES = {
  國小: {
    rhetoric: [L('rhetoric-elementary')],
    grammar: [L('grammar-elementary')],
    prosody: [L('prosody-elementary')],
    mixed: [L('rhetoric-elementary'), L('grammar-elementary'), L('prosody-elementary')],
    lunyu: [L('lunyu-elementary')],
    shiji: [L('shiji-elementary')],
    duange: [L('duange-elementary')],
    dianlun: [L('dianlun-elementary')],
    caozhi: [L('caozhi-elementary')],
    chushibiao: [L('chushibiao-elementary')],
    jikang: [L('jikang-elementary')],
    shishuo: [L('shishuo-elementary')],
    taoyuanming: [L('taoyuanming-elementary')],
    xielingyun: [L('xielingyun-elementary')],
    wangxizhi: [L('wangxizhi-elementary')],
    wangbo: [L('wangbo-elementary')],
    luobinwang: [L('luobinwang-elementary')],
    dushenyan: [L('dushenyan-elementary')],
    libai: [L('libai-elementary')],
    dufu: [L('dufu-elementary')],
    ...adventureBanks('elementary'),
  },
  國中: {
    rhetoric: [L('rhetoric-junior')],
    grammar: [L('grammar-junior')],
    prosody: [L('prosody-junior')],
    mixed: [L('rhetoric-junior'), L('grammar-junior'), L('prosody-junior')],
    lunyu: [L('lunyu-junior')],
    shiji: [L('shiji-junior')],
    duange: [L('duange-junior')],
    dianlun: [L('dianlun-junior')],
    caozhi: [L('caozhi-junior')],
    chushibiao: [L('chushibiao-junior')],
    jikang: [L('jikang-junior')],
    shishuo: [L('shishuo-junior')],
    taoyuanming: [L('taoyuanming-junior')],
    xielingyun: [L('xielingyun-junior')],
    wangxizhi: [L('wangxizhi-junior')],
    wangbo: [L('wangbo-junior')],
    luobinwang: [L('luobinwang-junior')],
    dushenyan: [L('dushenyan-junior')],
    libai: [L('libai-junior')],
    dufu: [L('dufu-junior')],
    ...adventureBanks('junior'),
  },
  高中: {
    rhetoric: [L('rhetoric-senior')],
    grammar: [L('grammar-senior')],
    prosody: [L('prosody-senior')],
    mixed: [L('rhetoric-senior'), L('grammar-senior'), L('prosody-senior')],
    lunyu: [L('lunyu-senior')],
    shiji: [L('shiji-senior')],
    duange: [L('duange-senior')],
    dianlun: [L('dianlun-senior')],
    caozhi: [L('caozhi-senior')],
    chushibiao: [L('chushibiao-senior')],
    jikang: [L('jikang-senior')],
    shishuo: [L('shishuo-senior')],
    taoyuanming: [L('taoyuanming-senior')],
    xielingyun: [L('xielingyun-senior')],
    wangxizhi: [L('wangxizhi-senior')],
    wangbo: [L('wangbo-senior')],
    luobinwang: [L('luobinwang-senior')],
    dushenyan: [L('dushenyan-senior')],
    libai: [L('libai-senior')],
    dufu: [L('dufu-senior')],
    ...adventureBanks('senior'),
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
