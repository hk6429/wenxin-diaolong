// M11 成就冊：成就定義（含隱藏成就）、純函式判定、解鎖記錄與累計統計。
// checkAchievements(stats) 為純函式，回傳「條件已達成」的成就 id 清單；unlock 負責過濾已解鎖。

import { listPets } from './pet.js';

export const ACHIEVEMENTS = [
  { id: 'first-win', name: '初戰告捷', desc: '贏得第一場對戰', pearls: 10, hidden: false },
  { id: 'combo-3', name: '三連珠', desc: '單場連對 3 題', pearls: 5, hidden: false },
  { id: 'combo-5', name: '五連珠', desc: '單場連對 5 題', pearls: 10, hidden: false },
  { id: 'combo-10', name: '十連珠', desc: '單場連對 10 題', pearls: 30, hidden: true, title: '文曲星降臨' },
  { id: 'perfect', name: '零失手', desc: '一場對戰全對獲勝', pearls: 15, hidden: false },
  { id: 'answered-100', name: '百題書生', desc: '累計答對 100 題', pearls: 15, hidden: false },
  { id: 'answered-1000', name: '千錘百煉', desc: '累計答對 1000 題', pearls: 50, hidden: false },
  { id: 'moling-bane', name: '墨靈剋星', desc: '對戰勝利 10 場', pearls: 20, hidden: false },
  { id: 'lantern-3', name: '守燈三日', desc: '連續守燈 3 天', pearls: 5, hidden: false },
  { id: 'lantern-7', name: '守燈七日', desc: '連續守燈 7 天', pearls: 10, hidden: false },
  { id: 'lantern-30', name: '守燈三十日', desc: '連續守燈 30 天', pearls: 30, hidden: false },
  // M3 累計收藏里程碑：保留既有 id 與門檻，避免舊存檔失效。
  { id: 'forge-10', name: '初綴', desc: '煉成 10 顆字珠', pearls: 5, hidden: false },
  { id: 'forge-50', name: '串珠', desc: '煉成 50 顆字珠', pearls: 10, hidden: false },
  { id: 'forge-100', name: '珠簾', desc: '煉成 100 顆字珠', pearls: 20, hidden: false },
  { id: 'forge-ziyin-250', name: '字音里程碑', desc: '累計煉成 250 顆字音字形字珠', pearls: 40, hidden: false },
  { id: 'forge-chengyu-435', name: '成語里程碑', desc: '累計煉成 435 顆成語字珠', pearls: 60, hidden: false },
  { id: 'forge-685', name: '珠璣里程碑', desc: '累計煉成 685 顆字珠', pearls: 100, hidden: false },
  { id: 'pets-12', name: '山海神獸・大成', desc: '集齊 12 隻山海神獸', pearls: 50, hidden: false },
  { id: 'workshop-first', name: '初試拆字', desc: '完成 1 組拆字工坊', pearls: 5, hidden: false },
  { id: 'workshop-10', name: '結構師', desc: '完成 10 組拆字工坊', pearls: 15, hidden: false },
  { id: 'workshop-no-hint', name: '明察秋毫', desc: '零失誤且不使用提示完成 1 組拆字工坊', pearls: 8, hidden: false },
  { id: 'family-5', name: '字族學者', desc: '點亮 5 張疊字探源字卡', pearls: 12, hidden: false },
  { id: 'family-branch', name: '探源成枝', desc: '完成 1 條字族分支', pearls: 15, hidden: false },
  { id: 'selfstudy-first', name: '墨池初探', desc: '完成 1 次墨池修習', pearls: 5, hidden: false },
  { id: 'selfstudy-10', name: '墨池勤修', desc: '完成 10 次墨池修習', pearls: 15, hidden: false },
];

const CONDITIONS = {
  'first-win': s => s.wins >= 1,
  'combo-3': s => s.bestCombo >= 3,
  'combo-5': s => s.bestCombo >= 5,
  'combo-10': s => s.bestCombo >= 10,
  'perfect': s => s.perfectGames >= 1,
  'answered-100': s => s.totalCorrect >= 100,
  'answered-1000': s => s.totalCorrect >= 1000,
  'moling-bane': s => s.wins >= 10,
  'lantern-3': s => s.lanternBest >= 3,
  'lantern-7': s => s.lanternBest >= 7,
  'lantern-30': s => s.lanternBest >= 30,
  'forge-10': s => s.forgedCount >= 10,
  'forge-50': s => s.forgedCount >= 50,
  'forge-100': s => s.forgedCount >= 100,
  'forge-ziyin-250': s => s.forgedZiyin >= 250,
  'forge-chengyu-435': s => s.forgedChengyu >= 435,
  'forge-685': s => s.forgedCount >= 685,
  'pets-12': s => s.petsUnlocked >= 12,
  'workshop-first': s => s.workshopSets >= 1,
  'workshop-10': s => s.workshopSets >= 10,
  'workshop-no-hint': s => s.workshopNoHint >= 1,
  'family-5': s => s.familyCards >= 5,
  'family-branch': s => s.familyBranches >= 1,
  'selfstudy-first': s => s.selfStudySessions >= 1,
  'selfstudy-10': s => s.selfStudySessions >= 10,
};

// 累計統計：計數欄位相加，bestCombo / lanternBest 取最大值。
const ADDITIVE = new Set([
  'wins', 'battles', 'perfectGames', 'totalAnswered', 'totalCorrect',
  'forgedCount', 'forgedZiyin', 'forgedChengyu',
  'workshopSets', 'workshopNoHint', 'familyCards', 'familyBranches',
  'selfStudySessions', 'selfStudyCards',
]);
const MAXIMAL = new Set(['bestCombo', 'lanternBest']);

export function recordStats(meta, patch) {
  const stats = meta.ach.stats;
  for (const [key, value] of Object.entries(patch)) {
    if (!Number.isFinite(value)) continue;
    if (ADDITIVE.has(key)) stats[key] = (stats[key] || 0) + value;
    else if (MAXIMAL.has(key)) stats[key] = Math.max(stats[key] || 0, value);
    else stats[key] = value;
  }
  return meta;
}

export function checkAchievements(stats) {
  return ACHIEVEMENTS.filter(a => CONDITIONS[a.id](stats)).map(a => a.id);
}

export function unlock(meta, ids) {
  const newlyUnlocked = [];
  for (const id of ids) {
    if (meta.ach.unlocked[id]) continue;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) continue;
    meta.ach.unlocked[id] = new Date().toISOString();
    newlyUnlocked.push(def);
  }
  return { meta, newlyUnlocked };
}

// 每個成就對應的「目前值／目標值」，供成就總覽頁畫進度條；隱藏成就不外洩數字，見 getAchievementsOverview。
const PROGRESS_FIELD = {
  'first-win': ['wins', 1],
  'combo-3': ['bestCombo', 3],
  'combo-5': ['bestCombo', 5],
  'perfect': ['perfectGames', 1],
  'answered-100': ['totalCorrect', 100],
  'answered-1000': ['totalCorrect', 1000],
  'moling-bane': ['wins', 10],
  'lantern-3': ['lanternBest', 3],
  'lantern-7': ['lanternBest', 7],
  'lantern-30': ['lanternBest', 30],
  'forge-10': ['forgedCount', 10],
  'forge-50': ['forgedCount', 50],
  'forge-100': ['forgedCount', 100],
  'forge-ziyin-250': ['forgedZiyin', 250],
  'forge-chengyu-435': ['forgedChengyu', 435],
  'forge-685': ['forgedCount', 685],
  'pets-12': ['petsUnlocked', 12],
  'workshop-first': ['workshopSets', 1],
  'workshop-10': ['workshopSets', 10],
  'workshop-no-hint': ['workshopNoHint', 1],
  'family-5': ['familyCards', 5],
  'family-branch': ['familyBranches', 1],
  'selfstudy-first': ['selfStudySessions', 1],
  'selfstudy-10': ['selfStudySessions', 10],
};

function progressFor(id, stats) {
  const field = PROGRESS_FIELD[id];
  if (!field) return null;
  const [key, target] = field;
  return { current: Math.min(stats[key] || 0, target), target };
}

// 讀取端總覽：不動任何既有解鎖邏輯，純粹整理 18 個成就的顯示資訊供 UI 渲染。
export function getAchievementsOverview(meta) {
  const stats = { ...meta.ach.stats, petsUnlocked: listPets(meta).filter((p) => p.unlocked).length };
  return ACHIEVEMENTS.map((a) => {
    const unlockedAt = meta.ach.unlocked[a.id] || null;
    const isHiddenLocked = a.hidden && !unlockedAt;
    return {
      id: a.id,
      name: isHiddenLocked ? '未知成就' : a.name,
      desc: isHiddenLocked ? '完成隱藏條件即可解鎖' : a.desc,
      pearls: a.pearls,
      hidden: a.hidden,
      unlocked: !!unlockedAt,
      unlockedAt,
      progress: isHiddenLocked ? null : progressFor(a.id, stats),
    };
  });
}
