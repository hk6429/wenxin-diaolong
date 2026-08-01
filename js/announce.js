// 更新公告：版本制（大改 x.0、小改 x.1/x.2…），每個使用者對同一版本只看一次。
// localStorage 記的是「已看過的最新版本號」，之後新增 CHANGELOG[0] 版本號更高才會再彈一次。
// 全新玩家（從未存過 zzj_meta）沒有「以前的版本」可比較，不彈——只給回訪的舊玩家看。

import { openOverlay, closeOverlay } from './overlay-a11y.js';
import { META_KEY } from './meta/store.js';

const ANNOUNCE_SEEN_KEY = 'zizhu:announceSeenVersion';
const $ = (id) => document.getElementById(id);

// 模組載入當下（app.js 開始執行、initMetaLayer 尚未建立存檔前）就先拍照，
// 避免「全新玩家的第一次存檔」被誤判成「本來就有進度的舊玩家」。
let hadExistingSaveOnLoad = false;
try { hadExistingSaveOnLoad = localStorage.getItem(META_KEY) != null; } catch {}

// 由新到舊排列；每次更新只需要在最前面加一筆
export const CHANGELOG = [
  {
    version: '2.0',
    title: '實戰模式大改版：答完見真章',
    items: [
      '實戰單選題答完立刻揭曉全部選項對錯＋完整解析，不用再一格一格猜。',
      '30 題官方原題本來就是多選的真題，改成可複選作答，勾好再按「送出答案」核對，不再硬塞成單選失真。',
      '每題新增「📜 出自：XX年OO國文第X題」出處標註，這真的是官方考古題。',
      '鍵盤更順手：數字鍵 1–5 選選項，空白鍵或 Enter 都能送出／進下一題。',
      '修好「點化」技能在多選題可能誤劃掉正解選項的 bug。',
    ],
  },
];

function currentVersion() {
  return CHANGELOG[0]?.version ?? '0';
}

function renderChangelog(entry) {
  $('announce-version').textContent = `v${entry.version}`;
  $('announce-title').textContent = entry.title;
  const list = $('announce-list');
  list.innerHTML = '';
  entry.items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
}

const closeAnnounce = () => closeOverlay($('announce-overlay'));

export function initAnnounce() {
  $('announce-close').addEventListener('click', closeAnnounce, { once: true });
}

export function maybeShowAnnounce() {
  const latest = CHANGELOG[0];
  if (!latest) return false;
  if (!hadExistingSaveOnLoad) {
    // 全新玩家：直接記為已看過最新版，之後正常照版本比較
    try { localStorage.setItem(ANNOUNCE_SEEN_KEY, latest.version); } catch {}
    return false;
  }
  let seen = '0';
  try { seen = localStorage.getItem(ANNOUNCE_SEEN_KEY) || '0'; } catch {}
  if (parseFloat(seen) >= parseFloat(latest.version)) return false;
  renderChangelog(latest);
  try { localStorage.setItem(ANNOUNCE_SEEN_KEY, currentVersion()); } catch {}
  openOverlay($('announce-overlay'), closeAnnounce);
  return true;
}
