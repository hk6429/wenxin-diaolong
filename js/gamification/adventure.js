export const ADVENTURE_VIEW_MODEL_FIELDS = Object.freeze({
  A01: 'chapterAtlas',
  A02: 'chapterHeader',
  A03: 'sceneTrail',
  A04: 'vowAnchor',
  A05: 'choiceJournal',
  A06: 'evidenceLens',
  A07: 'duelBeat',
  A08: 'relationshipLedger',
  A09: 'replayAgency',
  A10: 'nextStep',
});

const LEVELS = new Set(['國小', '國中', '高中']);
const COMPLETE_STATUSES = new Set(['found', 'stable']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function chapterDataFor(chapters, definition) {
  if (chapters instanceof Map) return chapters.get(definition.id) || chapters.get(definition.file) || null;
  if (Array.isArray(chapters)) {
    return chapters.find((chapter) => chapter?.id === definition.id)
      || chapters.find((chapter) => chapter?.id === definition.file)
      || null;
  }
  const values = asObject(chapters);
  return values[definition.id] || values[definition.file] || null;
}

function progressFor(adventure, definition) {
  const progress = asObject(asObject(adventure.chapters)[definition.id]);
  const sceneCount = Math.max(1, definition.sceneIds?.length || 1);
  const rawIndex = Number.isInteger(progress.sceneIndex) ? progress.sceneIndex : 0;
  return {
    ...progress,
    sceneIndex: Math.max(0, Math.min(sceneCount - 1, rawIndex)),
    chapterStatus: COMPLETE_STATUSES.has(progress.chapterStatus) ? progress.chapterStatus : 'locked',
    echoDueAt: typeof progress.echoDueAt === 'string' ? progress.echoDueAt : '',
    questResults: asObject(progress.questResults),
    vowId: typeof progress.vowId === 'string' ? progress.vowId : '',
    sceneChoices: asObject(progress.sceneChoices),
    replayActive: progress.replayActive === true,
    rewards: Array.isArray(progress.rewards) ? [...new Set(progress.rewards)] : [],
  };
}

function isUnlocked(definitions, adventure, index) {
  if (index === 0) return true;
  return COMPLETE_STATUSES.has(progressFor(adventure, definitions[index - 1]).chapterStatus);
}

function displayState(progress, unlocked) {
  if (!unlocked) return 'locked';
  if (progress.replayActive) return 'replay';
  if (progress.chapterStatus === 'stable') return 'stable';
  if (progress.chapterStatus === 'found') return 'found';
  return progress.sceneIndex > 0 || progress.vowId ? 'journeying' : 'available';
}

function normalizeRiskNotes(riskNotes) {
  if (Array.isArray(riskNotes)) {
    return riskNotes.filter((text) => typeof text === 'string' && text).map((text, index) => ({
      id: `risk-${index + 1}`,
      text,
    }));
  }
  return Object.entries(asObject(riskNotes))
    .filter(([, text]) => typeof text === 'string' && text)
    .map(([id, text]) => ({ id, text }));
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resultSnapshot(result) {
  const value = asObject(result);
  return {
    correct: Number.isFinite(value.correct) ? value.correct : null,
    total: Number.isFinite(value.total) ? value.total : null,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : '',
  };
}

/**
 * Build the complete adventure UI contract without mutating definitions, chapter JSON or save data.
 */
export function buildAdventureViewModel({
  definitions = [],
  chapters = [],
  adventure = {},
  activeChapterId = null,
  level = null,
  now = new Date(),
} = {}) {
  const ordered = [...definitions].filter((definition) => definition?.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!ordered.length) throw new TypeError('definitions 至少需要一個章回');

  const root = asObject(adventure);
  const requestedId = activeChapterId || root.currentChapterId || root.chapterId;
  const activeIndex = Math.max(0, ordered.findIndex((definition) => definition.id === requestedId));
  const definition = ordered[activeIndex];
  const chapter = chapterDataFor(chapters, definition);
  if (!chapter) throw new TypeError(`找不到章回資料：${definition.id}`);

  const selectedLevel = LEVELS.has(level) ? level : LEVELS.has(root.level) ? root.level : '國小';
  const progress = progressFor(root, definition);
  const unlocked = isUnlocked(ordered, root, activeIndex);
  const currentState = displayState(progress, unlocked);
  const scenes = Array.isArray(chapter.scenes) ? chapter.scenes : [];
  const sceneIndex = Math.max(0, Math.min(Math.max(0, scenes.length - 1), progress.sceneIndex));
  const currentScene = scenes[sceneIndex] || null;
  const completedChapter = COMPLETE_STATUSES.has(progress.chapterStatus) && !progress.replayActive;

  const atlasItems = ordered.map((item, index) => {
    const itemProgress = progressFor(root, item);
    const itemUnlocked = isUnlocked(ordered, root, index);
    return {
      id: item.id,
      order: item.order,
      number: item.number,
      era: item.era,
      figure: item.figure,
      title: item.title,
      state: displayState(itemProgress, itemUnlocked),
      unlocked: itemUnlocked,
      current: item.id === definition.id,
      sceneIndex: itemProgress.sceneIndex,
      sceneCount: item.sceneIds?.length || 0,
    };
  });

  const sourceById = new Map((chapter.sources || []).map((source) => [source.id, source]));
  const currentSources = (currentScene?.sourceIds || []).map((id) => sourceById.get(id)).filter(Boolean)
    .map((source) => ({ id: source.id, kind: source.kind, label: source.label, url: source.url || '' }));

  const trailItems = scenes.map((scene, index) => ({
    id: scene.id,
    title: scene.title,
    position: index + 1,
    contentKind: scene.contentKind,
    mode: scene.visual?.mode || 'story',
    hasQuest: Boolean(scene.quest),
    state: completedChapter || index < sceneIndex ? 'completed' : index === sceneIndex ? 'current' : 'upcoming',
  }));

  const vows = Array.isArray(chapter.storyFrame?.vows) ? chapter.storyFrame.vows : [];
  const selectedVow = vows.find((vow) => vow.id === progress.vowId) || null;
  const choiceEntries = scenes.flatMap((scene) => {
    const choiceId = progress.sceneChoices[scene.id];
    const choice = scene.choices?.find((item) => item.id === choiceId);
    return choice ? [{ sceneId: scene.id, sceneTitle: scene.title, choiceId, label: choice.label, response: choice.response }] : [];
  });

  const duelIndex = scenes.findIndex((scene) => scene.visual?.mode === 'duel');
  const duelScene = duelIndex >= 0 ? scenes[duelIndex] : null;
  const duelResult = duelScene ? progress.questResults[duelScene.id] : null;
  const duelState = !duelScene ? 'unavailable'
    : duelResult || completedChapter || duelIndex < sceneIndex ? 'completed'
      : duelIndex === sceneIndex ? 'current' : 'upcoming';

  const allRewards = new Set([
    ...(Array.isArray(root.rewards) ? root.rewards : []),
    ...progress.rewards,
  ]);
  const relationItems = ordered.map((item) => {
    const itemProgress = progressFor(root, item);
    const friendRewardId = (item.rewards || []).find((reward) => String(reward).startsWith('friend-')) || '';
    return {
      chapterId: item.id,
      figure: item.figure,
      friendRewardId,
      earned: Boolean(friendRewardId && (allRewards.has(friendRewardId) || itemProgress.rewards.includes(friendRewardId))),
      chapterStatus: itemProgress.chapterStatus,
      vowId: itemProgress.vowId,
      recordedChoices: Object.keys(itemProgress.sceneChoices).length,
    };
  });

  const dueAt = validDate(progress.echoDueAt);
  const clock = validDate(now) || new Date(0);
  const echoDue = progress.chapterStatus === 'found' && Boolean(dueAt && clock >= dueAt);
  const nextDefinition = ordered[activeIndex + 1] || null;
  const currentChoiceId = currentScene ? progress.sceneChoices[currentScene.id] : '';
  const nextOptions = [];
  if (progress.replayActive) {
    nextOptions.push({ id: 'continue-replay', type: 'scene', chapterId: definition.id, sceneId: currentScene?.id || '', optional: false });
  } else if (!COMPLETE_STATUSES.has(progress.chapterStatus)) {
    nextOptions.push({
      id: progress.vowId ? currentChoiceId ? 'continue-scene' : 'choose-path' : 'choose-vow',
      type: progress.vowId ? 'scene' : 'vow',
      chapterId: definition.id,
      sceneId: currentScene?.id || '',
      optional: false,
    });
  } else {
    if (echoDue) nextOptions.push({ id: 'echo', type: 'echo', chapterId: definition.id, dueAt: progress.echoDueAt, optional: true });
    if (nextDefinition && isUnlocked(ordered, root, activeIndex + 1)) {
      nextOptions.push({ id: 'next-chapter', type: 'chapter', chapterId: nextDefinition.id, optional: true });
    }
    nextOptions.push({ id: 'replay', type: 'replay', chapterId: definition.id, optional: true });
  }

  return {
    chapterAtlas: {
      items: atlasItems,
      totals: {
        chapters: atlasItems.length,
        unlocked: atlasItems.filter((item) => item.unlocked).length,
        journeying: atlasItems.filter((item) => item.state === 'journeying' || item.state === 'replay').length,
        found: atlasItems.filter((item) => item.state === 'found').length,
        stable: atlasItems.filter((item) => item.state === 'stable').length,
      },
    },
    chapterHeader: {
      id: definition.id,
      title: chapter.title || definition.title,
      heroTitle: definition.heroTitle,
      figure: definition.figure,
      era: definition.era,
      pageName: definition.pageName,
      echoTitle: definition.echoTitle,
      level: selectedLevel,
      status: currentState,
      scenePosition: scenes.length ? sceneIndex + 1 : 0,
      sceneCount: scenes.length,
      tagline: chapter.storyFrame?.tagline || '',
      epithet: chapter.storyFrame?.epithet || '',
    },
    sceneTrail: { currentSceneId: currentScene?.id || '', items: trailItems },
    vowAnchor: {
      selected: selectedVow ? { id: selectedVow.id, quote: selectedVow.quote, insight: selectedVow.insight } : null,
      options: vows.map((vow) => ({ id: vow.id, quote: vow.quote, insight: vow.insight })),
    },
    choiceJournal: {
      entries: choiceEntries,
      selectedCount: choiceEntries.length,
      totalScenesWithChoices: scenes.filter((scene) => scene.choices?.length).length,
      currentSceneChoiceId: currentChoiceId || '',
      unresolvedCurrentChoice: Boolean(currentScene?.choices?.length && !currentChoiceId),
    },
    evidenceLens: {
      sceneId: currentScene?.id || '',
      contentKind: currentScene?.contentKind || '',
      factNote: currentScene?.factNote || '',
      sources: currentSources,
      riskNotes: normalizeRiskNotes(chapter.riskNotes),
    },
    duelBeat: {
      sceneId: duelScene?.id || '',
      title: duelScene?.title || '',
      opponent: duelScene?.visual?.opponent || '',
      narrative: duelScene?.visual?.log || '',
      hasNarrative: Boolean(duelScene?.visual?.log),
      questCount: Number.isInteger(duelScene?.quest?.count) ? duelScene.quest.count : 0,
      state: duelState,
      result: duelResult ? resultSnapshot(duelResult) : null,
    },
    relationshipLedger: {
      items: relationItems,
      earnedCount: relationItems.filter((item) => item.earned).length,
      current: relationItems.find((item) => item.chapterId === definition.id) || null,
    },
    replayAgency: {
      available: COMPLETE_STATUSES.has(progress.chapterStatus) && !progress.replayActive,
      active: progress.replayActive,
      preserves: ['chapterStatus', 'rewards', 'questResults'],
      resets: ['sceneIndex', 'vowId', 'sceneChoices'],
      alternatePathsAvailable: scenes.reduce((total, scene) => {
        if (!progress.sceneChoices[scene.id]) return total;
        return total + Math.max(0, (scene.choices?.length || 0) - 1);
      }, 0),
    },
    nextStep: {
      echoDue,
      echoDueAt: progress.echoDueAt,
      options: nextOptions,
    },
  };
}
