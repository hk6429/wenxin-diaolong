export const DEFAULT_PLAYER_NAME = '無名文士';

export function normalizePlayerName(value, maxLength = 12) {
  const cleaned = String(value ?? '')
    .replace(/[<>"'`&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...cleaned].slice(0, maxLength).join('');
}

export function playerName(meta) {
  return normalizePlayerName(meta?.profile?.name) || DEFAULT_PLAYER_NAME;
}

export function setPlayerName(meta, value, now = new Date()) {
  const name = normalizePlayerName(value);
  if (!name) return false;
  if (!meta.profile || typeof meta.profile !== 'object') meta.profile = {};
  meta.profile.name = name;
  if (!meta.profile.createdAt) meta.profile.createdAt = now.toISOString();
  meta.profile.updatedAt = now.toISOString();
  if (!meta.pvp || typeof meta.pvp !== 'object') meta.pvp = {};
  meta.pvp.nick = name;
  return true;
}

export function learningSummary(meta, chapters = []) {
  const answered = Math.max(0, Number(meta?.xp?.totalAnswered) || 0);
  const correct = Math.max(0, Number(meta?.xp?.totalCorrect) || 0);
  const mastered = Object.values(meta?.collection || {}).filter((item) => item?.earnedAt).length;
  let completedScenes = 0;
  let totalScenes = 0;
  for (const chapter of chapters) {
    const total = chapter.sceneIds?.length || 0;
    const progress = meta?.adventure?.chapters?.[chapter.id];
    totalScenes += total;
    completedScenes += progress?.chapterStatus === 'found' || progress?.chapterStatus === 'stable'
      ? total
      : Math.min(total, Math.max(0, Number(progress?.sceneIndex) || 0));
  }
  return {
    answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
    todayAnswered: Math.max(0, Number(meta?.daily?.todayAnswered) || 0),
    todayCorrect: Math.max(0, Number(meta?.daily?.todayCorrect) || 0),
    streak: Math.max(0, Number(meta?.daily?.streak) || 0),
    mastered,
    completedScenes,
    totalScenes,
    adventurePercent: totalScenes ? Math.round((completedScenes / totalScenes) * 100) : 0,
  };
}
