export const CHAPTERS = Object.freeze([
  {
    id: 'preqin-zhuangzi', order: 1, number: '一', era: '先秦', figure: '莊子', file: 'zhuangzi',
    title: '先秦・莊子〈蝶夢逍遙〉', heroTitle: '穿越蝶夢，遇見莊子',
    pageName: '觀物之頁', echoTitle: '蝶夢回聲', art: 'zhuangzi',
    sceneIds: ['modern-prologue', 'butterfly-gate', 'north-sea', 'cook-maze', 'hao-river', 'zhuangzi-trial', 'archive-return'],
    rewards: ['observation-page', 'dream-butterfly-bookmark', 'friend-zhuangzi'],
    echoQuest: { bankKey: 'rhetoric', cats: ['譬喻', '轉化', '誇飾', '設問'], count: 3 },
  },
  {
    id: 'warring-quyuan', order: 2, number: '二', era: '戰國楚地', figure: '屈原', file: 'quyuan',
    title: '戰國楚地・屈原〈香草求索〉', heroTitle: '踏入楚澤，遇見屈原',
    pageName: '求索之頁', echoTitle: '楚聲回音', art: 'quyuan',
    sceneIds: ['chu-prologue', 'fragrant-path', 'river-dialogue', 'nine-song-wind', 'loyalty-gate', 'quyuan-trial', 'archive-return-quyuan'],
    rewards: ['seeking-page', 'fragrant-herb-tassel', 'friend-quyuan'],
    echoQuest: {
      bankKey: 'mixed', count: 3,
      catsByLevel: {
        '國小': ['譬喻', '轉化', '詞性', '押韻'],
        '國中': ['引用', '映襯', '句型', '詩體判別'],
        '高中': ['引用', '映襯', '文言句式', '詩體判別'],
      },
    },
  },
]);

// 保留第一章常數，讓既有資料與外部測試不必一次改名。
export const CHAPTER_ID = CHAPTERS[0].id;
export const SCENE_IDS = CHAPTERS[0].sceneIds;
export const ECHO_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export function chapterDefinition(chapterId) {
  return CHAPTERS.find((item) => item.id === chapterId) || CHAPTERS[0];
}

function normalizeProgress(progress, definition) {
  const value = progress && typeof progress === 'object' ? progress : {};
  value.sceneIndex = Number.isInteger(value.sceneIndex)
    ? Math.max(0, Math.min(definition.sceneIds.length - 1, value.sceneIndex))
    : 0;
  value.chapterStatus = ['locked', 'found', 'stable'].includes(value.chapterStatus)
    ? value.chapterStatus : 'locked';
  value.echoDueAt = typeof value.echoDueAt === 'string' ? value.echoDueAt : '';
  value.questResults = value.questResults && typeof value.questResults === 'object' ? value.questResults : {};
  value.vowId = typeof value.vowId === 'string' ? value.vowId : '';
  value.sceneChoices = value.sceneChoices && typeof value.sceneChoices === 'object' ? value.sceneChoices : {};
  value.rewards = Array.isArray(value.rewards) ? [...new Set(value.rewards)] : [];
  return value;
}

function syncLegacyAliases(state) {
  const active = state.chapters[state.currentChapterId];
  state.chapterId = state.currentChapterId;
  state.sceneIndex = active.sceneIndex;
  state.chapterStatus = active.chapterStatus;
  state.echoDueAt = active.echoDueAt;
  state.questResults = active.questResults;
  return state;
}

export function ensureAdventure(meta) {
  if (!meta.adventure || typeof meta.adventure !== 'object') meta.adventure = {};
  const state = meta.adventure;
  state.level = ['國小', '國中', '高中'].includes(state.level) ? state.level : '國小';
  state.zhuyinMode = ['smart', 'full', 'off'].includes(state.zhuyinMode) ? state.zhuyinMode : 'smart';
  state.rewards = Array.isArray(state.rewards) ? [...new Set(state.rewards)] : [];

  const hasKnownChapter = state.chapters && typeof state.chapters === 'object' && !Array.isArray(state.chapters)
    && CHAPTERS.some((definition) => state.chapters[definition.id]);
  if (!hasKnownChapter) {
    const legacy = {
      sceneIndex: state.sceneIndex,
      chapterStatus: state.chapterStatus,
      echoDueAt: state.echoDueAt,
      questResults: state.questResults,
      rewards: state.rewards,
    };
    state.chapters = { [CHAPTER_ID]: normalizeProgress(legacy, CHAPTERS[0]) };
  }
  for (const definition of CHAPTERS) {
    state.chapters[definition.id] = normalizeProgress(state.chapters[definition.id], definition);
  }
  const requested = state.currentChapterId || state.chapterId;
  state.currentChapterId = CHAPTERS.some((item) => item.id === requested) ? requested : CHAPTER_ID;
  return syncLegacyAliases(state);
}

export function getChapterProgress(meta, chapterId = null) {
  const state = ensureAdventure(meta);
  return state.chapters[chapterId || state.currentChapterId];
}

export function isChapterUnlocked(meta, chapterId) {
  const state = ensureAdventure(meta);
  const index = CHAPTERS.findIndex((item) => item.id === chapterId);
  if (index <= 0) return index === 0;
  return state.chapters[CHAPTERS[index - 1].id].chapterStatus !== 'locked';
}

export function selectChapter(meta, chapterId) {
  const state = ensureAdventure(meta);
  if (!isChapterUnlocked(meta, chapterId)) return false;
  state.currentChapterId = chapterId;
  syncLegacyAliases(state);
  return true;
}

export function chooseChapterVow(meta, vowId, chapterId = null) {
  const state = ensureAdventure(meta);
  const progress = state.chapters[chapterId || state.currentChapterId];
  if (!vowId || progress.vowId) return false;
  progress.vowId = vowId;
  syncLegacyAliases(state);
  return true;
}

export function chooseScenePath(meta, sceneId, choiceId, chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  const progress = state.chapters[id];
  if (!sceneId || !choiceId || progress.sceneChoices[sceneId]) return false;
  progress.sceneChoices[sceneId] = choiceId;
  syncLegacyAliases(state);
  return true;
}

export function completeScene(meta, sceneId, chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  const definition = chapterDefinition(id);
  const progress = state.chapters[id];
  if (definition.sceneIds[progress.sceneIndex] !== sceneId) return false;
  if (progress.sceneIndex < definition.sceneIds.length - 1) progress.sceneIndex += 1;
  syncLegacyAliases(state);
  return true;
}

export function markChapterFound(meta, now = new Date(), chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  const definition = chapterDefinition(id);
  const progress = state.chapters[id];
  progress.chapterStatus = 'found';
  progress.echoDueAt = new Date(now.getTime() + ECHO_DELAY_MS).toISOString();
  progress.rewards = [...new Set([...progress.rewards, ...definition.rewards])];
  state.rewards = [...new Set([...state.rewards, ...definition.rewards])];
  syncLegacyAliases(state);
  return progress;
}

export function isEchoDue(meta, now = new Date(), chapterId = null) {
  const state = ensureAdventure(meta);
  const progress = state.chapters[chapterId || state.currentChapterId];
  if (progress.chapterStatus !== 'found' || !progress.echoDueAt) return false;
  return now.getTime() >= new Date(progress.echoDueAt).getTime();
}

export function stabilizeChapter(meta, now = new Date(), chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  if (!isEchoDue(meta, now, id)) return false;
  state.chapters[id].chapterStatus = 'stable';
  syncLegacyAliases(state);
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
