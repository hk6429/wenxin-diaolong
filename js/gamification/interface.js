// 首頁任務介面 view-model：只計算資料，不直接讀寫 DOM 或 localStorage。

const ZONES = Object.freeze(['修辭', '文法', '格律']);
const SESSION_SIZES = Object.freeze([5, 10, 15]);

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function zoneStats(meta, bank) {
  return ZONES.map((zone) => {
    const entries = bank.filter((entry) => entry.zone === zone);
    const mastered = entries.filter((entry) => meta?.collection?.[entry.id]?.earnedAt).length;
    const pct = entries.length ? Math.round((mastered / entries.length) * 100) : 0;
    return { zone, mastered, total: entries.length, pct };
  });
}

function nextMilestone(percent) {
  return [25, 50, 75, 100].find((mark) => percent < mark) || 100;
}

export function buildInterfaceView({ meta = {}, bank = [], adventure = {}, chapter = {}, level = '國小' } = {}) {
  const zones = zoneStats(meta, bank);
  const recommended = [...zones].sort((a, b) => a.pct - b.pct || b.total - a.total)[0] || { zone: '修辭', pct: 0, total: 0, mastered: 0 };
  const today = Math.max(0, Number(meta?.daily?.todayAnswered) || 0);
  const sceneIndex = Math.max(0, Number(adventure?.sceneIndex) || 0);
  const sceneTotal = Math.max(1, Number(chapter?.sceneIds?.length) || 1);
  const journeyPercent = clamp((sceneIndex / sceneTotal) * 100);
  const milestone = nextMilestone(journeyPercent);

  return Object.freeze({
    mission: { title: today ? `今日已出招 ${today} 次` : '今日第一筆，從小步開始', detail: today >= 15 ? '今天已完成一段扎實練習，可以安心收卷。' : '完成一個短回合，就算今日有前進。' },
    continueAdventure: { label: sceneIndex ? `從第 ${sceneIndex + 1} 幕繼續` : `開啟${chapter.figure || '文人'}篇`, chapterId: chapter.id || '' },
    weaknessShortcut: { label: '複習最需要的一小步', safe: true },
    sessionChoices: SESSION_SIZES.map((count) => ({ count, label: `${count} 題`, minutes: Math.max(2, Math.round(count * .6)) })),
    recommendedZone: { ...recommended, reason: recommended.total ? `目前精熟 ${recommended.pct}%，最適合優先補強` : '先從生活語句開始' },
    rewardPreview: { five: '完成 5 題可累積題目熟練度與墨珠', noLootBox: true },
    masteryCompass: zones,
    nextMilestone: { current: Math.round(journeyPercent), target: milestone, remaining: Math.max(0, milestone - Math.round(journeyPercent)) },
    calmMode: { available: true, label: '靜心模式', effect: '減少動畫與慶祝效果，不影響任何進度或獎勵' },
    autonomy: { level, message: '隨時離開、換區或改題數都不會扣分，也不會失去既有進度。' },
  });
}

export { SESSION_SIZES };
