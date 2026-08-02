import { RANKS } from '../meta/progress.js';

const DAILY_STEP_TARGET = 5;

function nonNegative(value) {
  return Math.max(0, Number(value) || 0);
}

function localDateKey(date) {
  const value = date instanceof Date && !Number.isNaN(date.valueOf()) ? date : new Date();
  const pad = (number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function daysBetween(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '')) return 0;
  const [year, month, day] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(year, month - 1, day)) / 86400000));
}

function nearestMilestone(meta) {
  const forged = Object.values(meta.collection || {}).filter((item) => item?.earnedAt).length;
  const totalCorrect = nonNegative(meta.ach?.stats?.totalCorrect ?? meta.xp?.totalCorrect);
  const wins = nonNegative(meta.ach?.stats?.wins);
  const unlocked = meta.ach?.unlocked || {};
  const candidates = [
    { achievementId: 'forge-10', name: '初綴', current: forged, target: 10, unit: '顆字珠', verb: '已煉成' },
    { achievementId: 'answered-100', name: '百題書生', current: totalCorrect, target: 100, unit: '題', verb: '累計答對' },
    { achievementId: 'moling-bane', name: '墨靈剋星', current: wins, target: 10, unit: '場', verb: '已完成' },
  ].filter((item) => !unlocked[item.achievementId] && item.current < item.target);
  return candidates.sort((a, b) => (b.current / b.target) - (a.current / a.target))[0] || null;
}

function zoneSummaries(meta, bank) {
  const zones = new Map();
  for (const entry of Array.isArray(bank) ? bank : []) {
    if (!entry?.id || !entry?.zone) continue;
    if (!zones.has(entry.zone)) zones.set(entry.zone, { zone: entry.zone, known: 0, total: 0, percent: 0 });
    const summary = zones.get(entry.zone);
    summary.total += 1;
    if (meta.collection?.[entry.id]?.earnedAt) summary.known += 1;
  }
  return [...zones.values()].map((summary) => ({
    ...summary,
    percent: summary.total ? Math.round((summary.known / summary.total) * 100) : 0,
  }));
}

function weakestSignal(meta) {
  return Object.entries(meta.weak || {}).map(([key, value]) => {
    const correct = nonNegative(value?.correct);
    const wrong = nonNegative(value?.wrong);
    const total = correct + wrong;
    const [zone = '', cat = ''] = key.split('·');
    return { key, zone, cat, correct, wrong, total, accuracy: total ? Math.round((correct / total) * 100) : 0 };
  }).filter((item) => item.total >= 3 && item.wrong > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)[0] || null;
}

export function buildRetentionViewModel(meta = {}, options = {}) {
  const todayAnswered = nonNegative(meta.daily?.todayAnswered);
  const todayCorrect = Math.min(todayAnswered, nonNegative(meta.daily?.todayCorrect));
  const remaining = Math.max(0, DAILY_STEP_TARGET - todayAnswered);
  const complete = remaining === 0;
  const accuracy = todayAnswered ? Math.round((todayCorrect / todayAnswered) * 100) : 0;
  const sessionAnswered = nonNegative(options.sessionAnswered);
  const restDue = sessionAnswered >= 10;
  const currentStreak = nonNegative(meta.daily?.streak);
  const bestStreak = Math.max(currentStreak, nonNegative(meta.daily?.best));
  const lastActive = meta.daily?.lastLit || (todayAnswered > 0 ? meta.daily?.date : '');
  const daysAway = daysBetween(lastActive, localDateKey(options.now));
  const welcomeBack = daysAway >= 2;
  const xp = nonNegative(meta.xp?.value);
  const rankIndex = Math.max(0, Math.min(RANKS.length - 1, Math.floor(nonNegative(meta.xp?.rank))));
  const rank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1] || null;
  const rankPercent = nextRank
    ? Math.max(0, Math.min(100, Math.round(((xp - rank.threshold) / (nextRank.threshold - rank.threshold)) * 100)))
    : 100;
  const milestone = nearestMilestone(meta);
  const zones = zoneSummaries(meta, options.bank);
  const focusZone = [...zones].sort((a, b) => a.percent - b.percent || a.zone.localeCompare(b.zone, 'zh-Hant'))[0]?.zone || null;
  const weak = weakestSignal(meta);
  const dailyLimit = Math.floor(nonNegative(options.dailyLimit));
  const limitRemaining = dailyLimit ? Math.max(0, dailyLimit - todayAnswered) : null;
  const limitReached = dailyLimit > 0 && limitRemaining === 0;
  const sessionCorrect = Math.min(sessionAnswered, nonNegative(options.sessionCorrect));
  const sessionAccuracy = sessionAnswered ? Math.round((sessionCorrect / sessionAnswered) * 100) : 0;

  return {
    R01: {
      id: 'R01',
      label: '今日小步驟',
      state: complete ? 'complete' : 'start',
      target: DAILY_STEP_TARGET,
      completed: Math.min(todayAnswered, DAILY_STEP_TARGET),
      remaining,
      message: complete
        ? `今天已完成 ${todayAnswered} 題，可以安心收卷。`
        : `先做 ${remaining} 題暖暖筆鋒，完成就可以安心收卷。`,
    },
    R02: {
      id: 'R02',
      label: '今日理解',
      state: todayAnswered === 0 ? 'empty' : accuracy >= 70 ? 'steady' : 'explore',
      answered: todayAnswered,
      correct: todayCorrect,
      accuracy,
      message: todayAnswered === 0
        ? '開始後，這裡會整理今天的理解狀況。'
        : accuracy >= 70
          ? '今天的理解很穩；保留力氣，改天再回來複習。'
          : '今天正在找出不熟的地方；錯題是下一次複習的線索。',
    },
    R03: {
      id: 'R03',
      label: '休息提醒',
      state: restDue ? 'due' : 'later',
      sessionAnswered,
      threshold: 10,
      recommendedMinutes: 3,
      message: restDue
        ? `這一回合已練 ${sessionAnswered} 題，先休息 3 分鐘、看看遠方。`
        : `再練 ${10 - sessionAnswered} 題就休息一下；也可以隨時收卷。`,
    },
    R04: {
      id: 'R04',
      label: '學習足跡',
      state: welcomeBack ? 'welcome-back' : currentStreak > 0 ? 'continuing' : 'new',
      current: currentStreak,
      best: bestStreak,
      daysAway,
      message: welcomeBack
        ? `歡迎回來。休息了 ${daysAway} 天也沒關係，過去最佳 ${bestStreak} 天仍完整保留。`
        : currentStreak > 0
          ? `已留下 ${currentStreak} 天學習足跡；不必為了數字勉強練習。`
          : '今天可以留下第一筆學習足跡，也可以準備好再開始。',
    },
    R05: {
      id: 'R05',
      label: '下一境界',
      state: nextRank ? 'progress' : 'complete',
      rankName: rank.name,
      xp,
      nextRankName: nextRank?.name || null,
      nextThreshold: nextRank?.threshold || null,
      percent: rankPercent,
      message: nextRank
        ? `距離「${nextRank.name}」還有 ${Math.max(0, nextRank.threshold - xp)} 點文氣；依自己的節奏累積。`
        : '所有境界都已走過；可以把心力放回理解與探索。',
    },
    R06: milestone ? {
      id: 'R06',
      label: '可選里程碑',
      state: 'progress',
      achievementId: milestone.achievementId,
      name: milestone.name,
      current: milestone.current,
      target: milestone.target,
      percent: Math.round((milestone.current / milestone.target) * 100),
      message: `${milestone.verb} ${milestone.current}／${milestone.target} ${milestone.unit}；這是可選目標，不限今天完成。`,
    } : {
      id: 'R06', label: '可選里程碑', state: 'complete', achievementId: null,
      name: null, current: 0, target: 0, percent: 100,
      message: '目前的里程碑都已完成，不需要再追趕任何數字。',
    },
    R07: {
      id: 'R07',
      label: '練習方向',
      state: focusZone ? 'suggested' : 'empty',
      focusZone,
      zones,
      message: focusZone
        ? `可以從「${focusZone}」挑一小組練習；想換口味，也可以選其他區。`
        : '載入題庫後，這裡會整理不同學習區的進度。',
    },
    R08: weak ? {
      id: 'R08',
      label: '複習線索',
      state: 'ready',
      ...weak,
      message: `「${weak.zone}・${weak.cat}」目前有 ${weak.wrong} 次錯題線索；下次可選它複習，不必立刻補完。`,
    } : {
      id: 'R08', label: '複習線索', state: 'collecting', key: null, zone: null, cat: null,
      correct: 0, wrong: 0, total: 0, accuracy: 0,
      message: '再累積一些作答後，這裡才會提供複習線索，避免太早貼標籤。',
    },
    R09: {
      id: 'R09',
      label: '每日界線',
      state: dailyLimit === 0 ? 'unlimited' : limitReached ? 'reached' : 'available',
      limit: dailyLimit,
      completed: todayAnswered,
      remaining: limitRemaining,
      message: dailyLimit === 0
        ? '目前未設定每日題數界線；仍建議完成小步驟後休息。'
        : limitReached
          ? `今天已到 ${dailyLimit} 題的學習界線，現在收卷、休息。`
          : `今天還可練 ${limitRemaining} 題；不必把額度全部用完。`,
    },
    R10: {
      id: 'R10',
      label: '收卷摘要',
      state: sessionAnswered > 0 ? 'ready' : 'empty',
      answered: sessionAnswered,
      correct: sessionCorrect,
      accuracy: sessionAccuracy,
      message: sessionAnswered > 0
        ? `這一回合完成 ${sessionAnswered} 題、答對 ${sessionCorrect} 題；進度已記下，現在可以收卷。`
        : '完成一回合後，這裡會留下不帶評比的收卷摘要。',
    },
  };
}
