// PvE 歷代文心大師：解鎖判定與對手行為（純邏輯，資料在 data/masters.json）。
// 解鎖條件＝該區「真實精通量」門檻（categoryMastery，與寵物同一把尺）；
// 對戰名單因此就是一張可視化的學習進度地圖。
import { categoryMastery } from './pet.js';

export function masterUnlocked(meta, master) {
  return categoryMastery(meta, master.unlockZone) >= master.unlockAt;
}

export function masterProgress(meta, master) {
  const have = categoryMastery(meta, master.unlockZone);
  return { have, need: master.unlockAt, unlocked: have >= master.unlockAt };
}

// 對手攻擊：玩家答錯或逾時 → 大師出招。傷害固定（非線性難度曲線寫死在資料的 atk），
// 玩家血量低於 30 時大師「留手」削減 20% 傷害（緊張但保留翻盤空間）。
export function masterStrike(master, playerHp) {
  const softened = playerHp <= 30 ? Math.round(master.atk * 0.8) : master.atk;
  return Math.max(1, softened);
}

// 勝場記錄：meta.pvpMasters = { [id]: { wins, firstWinAt } }（存在 meta 由呼叫端 saveMeta）
export function recordMasterWin(meta, masterId) {
  if (!meta.pvpMasters) meta.pvpMasters = {};
  const rec = meta.pvpMasters[masterId] || (meta.pvpMasters[masterId] = { wins: 0, firstWinAt: '' });
  rec.wins += 1;
  if (!rec.firstWinAt) rec.firstWinAt = new Date().toISOString();
  return rec.wins === 1; // 首勝
}

export function beatenCount(meta) {
  return Object.values(meta.pvpMasters || {}).filter((r) => r.wins > 0).length;
}
