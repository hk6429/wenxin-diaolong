export const CHAPTER_ID = 'preqin-zhuangzi';
export const SCENE_IDS = [
  'modern-prologue',
  'butterfly-gate',
  'north-sea',
  'cook-maze',
  'hao-river',
  'zhuangzi-trial',
  'archive-return',
];

const ECHO_DELAY_MS = 7 * 24 * 60 * 60 * 1000;
const CHAPTER_REWARDS = ['observation-page', 'dream-butterfly-bookmark', 'friend-zhuangzi'];

export function ensureAdventure(meta) {
  if (!meta.adventure || typeof meta.adventure !== 'object') {
    meta.adventure = {};
  }
  const state = meta.adventure;
  state.chapterId = state.chapterId || CHAPTER_ID;
  state.sceneIndex = Number.isInteger(state.sceneIndex)
    ? Math.max(0, Math.min(SCENE_IDS.length - 1, state.sceneIndex))
    : 0;
  state.chapterStatus = ['locked', 'found', 'stable'].includes(state.chapterStatus)
    ? state.chapterStatus
    : 'locked';
  state.echoDueAt = typeof state.echoDueAt === 'string' ? state.echoDueAt : '';
  state.level = ['國小', '國中', '高中'].includes(state.level) ? state.level : '國小';
  state.zhuyinMode = ['smart', 'full', 'off'].includes(state.zhuyinMode) ? state.zhuyinMode : 'smart';
  state.questResults = state.questResults && typeof state.questResults === 'object'
    ? state.questResults
    : {};
  state.rewards = Array.isArray(state.rewards) ? [...new Set(state.rewards)] : [];
  return state;
}

export function completeScene(meta, sceneId) {
  const state = ensureAdventure(meta);
  if (SCENE_IDS[state.sceneIndex] !== sceneId) return false;
  if (state.sceneIndex < SCENE_IDS.length - 1) state.sceneIndex += 1;
  return true;
}

export function markChapterFound(meta, now = new Date()) {
  const state = ensureAdventure(meta);
  state.chapterStatus = 'found';
  state.echoDueAt = new Date(now.getTime() + ECHO_DELAY_MS).toISOString();
  state.rewards = [...new Set([...state.rewards, ...CHAPTER_REWARDS])];
  return state;
}

export function isEchoDue(meta, now = new Date()) {
  const state = ensureAdventure(meta);
  if (state.chapterStatus !== 'found' || !state.echoDueAt) return false;
  return now.getTime() >= new Date(state.echoDueAt).getTime();
}

export function stabilizeChapter(meta, now = new Date()) {
  if (!isEchoDue(meta, now)) return false;
  ensureAdventure(meta).chapterStatus = 'stable';
  return true;
}

export function selectQuestEntries(entries, quest) {
  const allowed = new Set(quest?.cats || []);
  const count = Math.max(1, Number(quest?.count) || 1);
  const seen = new Set();
  return (entries || []).filter((entry) => {
    if (!entry?.id || seen.has(entry.id) || !allowed.has(entry.cat)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, count);
}
