import {
  CHAPTERS,
  chapterDefinition,
  ensureAdventure,
  getChapterProgress,
  isChapterUnlocked,
  selectChapter,
  chooseChapterVow,
  chooseScenePath,
  startChapterReplay,
  finishChapterReplay,
  completeScene,
  markChapterFound,
  isEchoDue,
  stabilizeChapter,
  selectQuestEntries,
} from './adventure.js';
import { selectLevelText, resolveQuest } from './story-content.js';
import { renderZhuyin } from './zhuyin.js';
import { saveMeta } from './meta/store.js';
import { loadBank } from './bank.js';
import { shuffle } from './shuffle.js';
import { buildAdventureViewModel } from './gamification/adventure.js';
import { questActionLabel, questCompleteLabel } from './quest-copy.js';

const $ = (id) => document.getElementById(id);
const LEVELS = ['國小', '國中', '高中'];
const LEVEL_NOTES = {
  國小: '文字較短、提供注音，委託只抽國小專屬題庫。',
  國中: '增加概念辨析與四大句型，委託只抽國中專屬題庫。',
  高中: '加入文言語法與深入格律，委託只抽高中專屬題庫。',
};
const CHAPTER_COVER_ART = {
  'preqin-zhuangzi': 'adventure-zhuangzi-butterfly.webp',
  'warring-quyuan': 'adventure-quyuan-fragrant.webp',
  'dream-confucius': 'adventure-confucius-dream.webp',
  'han-simaqian': 'adventure-simaqian-archive.webp',
  'jianan-caocao': 'adventure-caocao-camp.webp',
  'wei-caopi': 'adventure-caopi-hall.webp',
  'wei-caozhi': 'adventure-caozhi-river.webp',
  'shuhan-zhugeliang': 'adventure-zhugeliang-tent.webp',
  'weijin-jikang': 'adventure-jikang-bamboo.webp',
  'weijin-shishuo': 'adventure-shishuo-gathering.webp',
  'weijin-taoyuanming': 'adventure-taoyuanming-field.webp',
  'liusong-xielingyun': 'xielingyun-cover.webp',
  'weijin-wangxizhi': 'adventure-wangxizhi-cover.webp',
  'early-tang-wangbo': 'adventure-wangbo-pavilion.webp',
  'early-tang-luobinwang': 'adventure-luobinwang-camp.webp',
  'early-tang-dushenyan': 'adventure-dushenyan-spring.webp',
  'high-tang-libai': 'adventure-libai-moon.webp',
  'high-tang-dufu': 'adventure-dufu-cottage.webp',
  'high-tang-wangwei': 'adventure-wangmeng-cover.webp',
  'high-tang-menghaoran': 'adventure-wangmeng-cover.webp',
  'high-tang-gaoshi': 'adventure-frontier-cover.webp',
  'high-tang-wangchangling': 'adventure-frontier-cover.webp',
  'high-tang-censhen': 'adventure-frontier-cover.webp',
  'high-tang-wangzhihuan': 'adventure-twintowers-cover.webp',
  'high-tang-cuihao': 'adventure-twintowers-cover.webp',
};
const CHAPTER_FRIEND_LINES = {
  'preqin-zhuangzi': '莊周已成為你的第一位文友，夢蝶書籤也收入守卷閣。',
  'warring-quyuan': '屈原已成為你的第二位文友，香草流蘇也收入守卷閣。',
  'dream-confucius': '孔子已成為你的第三位文友，竹簡書籤也從夢中落入守卷閣。',
  'han-simaqian': '司馬遷已成為你的第四位文友，紀傳竹簡也收入守卷閣。',
  'jianan-caocao': '曹操已成為你的第五位文友，晨露之杯也收入守卷閣。',
  'wei-caopi': '曹丕已成為你的第六位文友，文體印也收入守卷閣。',
  'wei-caozhi': '曹植已成為你的第七位文友，洛水玉佩也收入守卷閣。',
  'shuhan-zhugeliang': '諸葛亮已成為你的第八位文友，羽扇信物也收入守卷閣。',
  'weijin-jikang': '嵇康已成為你的第九位文友，琴弦信物也收入守卷閣。',
  'weijin-shishuo': '劉義慶已成為你的第十位文友，詠絮信物也收入守卷閣。',
  'weijin-taoyuanming': '陶淵明已成為你的第十一位文友，菊花信物也收入守卷閣。',
  'liusong-xielingyun': '謝靈運已成為你的第十二位文友，清暉信物也收入守卷閣。',
  'weijin-wangxizhi': '王羲之已成為你的第十三位文友，流觴信物也收入守卷閣。',
  'early-tang-wangbo': '王勃已成為你的第十四位文友，孤鶩信物也收入守卷閣。',
  'early-tang-luobinwang': '駱賓王已成為你的第十五位文友，辨檄信物也收入守卷閣。',
  'early-tang-dushenyan': '杜審言已成為你的第十六位文友，黃鳥信物也收入守卷閣。',
  'high-tang-libai': '李白已成為你的第十七位文友，青蓮信物也收入守卷閣。',
  'high-tang-dufu': '杜甫已成為你的第十八位文友，家書信物也收入守卷閣。',
  'high-tang-wangwei': '王維已成為你的第十九位文友，松泉信物也收入守卷閣。',
  'high-tang-menghaoran': '孟浩然已成為你的第二十位文友，菊約信物也收入守卷閣。',
  'high-tang-gaoshi': '高適已成為你的第二十一位文友，燕歌信物也收入守卷閣。',
  'high-tang-wangchangling': '王昌齡已成為你的第二十二位文友，秦月信物也收入守卷閣。',
  'high-tang-censhen': '岑參已成為你的第二十三位文友，雪歌信物也收入守卷閣。',
  'high-tang-wangzhihuan': '王之渙已成為你的第二十四位文友，鸛樓信物也收入守卷閣。',
  'high-tang-cuihao': '崔顥已成為你的第二十五位文友，黃鶴信物也收入守卷閣。',
};
let deps;
let chapterMap = null;

function setAdventureStage(content, cinematic = false) {
  const stage = $('adventure-stage');
  stage.className = `adventure-stage${cinematic ? ' adventure-stage-cinematic' : ''}`;
  stage.innerHTML = content;
}

function cinematicHeader(definition, kicker, title, extra = '') {
  const art = CHAPTER_COVER_ART[definition.id] || `${definition.art}.webp`;
  return `<div class="adventure-cover adventure-cover-${definition.id}">
    <img src="assets/img/${art}" alt="${definition.figure}章回情境插畫">
    <div class="adventure-cover-copy">
      <p class="scene-kicker">${kicker}</p>
      <h2>${title}</h2>
      ${extra}
    </div>
  </div>`;
}

function goHome() {
  deps.renderHome();
  deps.showScreen('screen-home');
}

async function loadChapters() {
  if (chapterMap) return chapterMap;
  const loaded = await Promise.all(CHAPTERS.map(async (definition) => {
    const response = await fetch(`data/adventure/${definition.file}.json`);
    if (!response.ok) throw new Error(`chapter ${definition.id} ${response.status}`);
    return [definition.id, await response.json()];
  }));
  chapterMap = new Map(loaded);
  return chapterMap;
}

function currentContext() {
  const meta = deps.getCtx().meta;
  const root = ensureAdventure(meta);
  const definition = chapterDefinition(root.currentChapterId);
  return { meta, root, definition, progress: getChapterProgress(meta, definition.id), chapter: chapterMap.get(definition.id) };
}

function sourceLine(chapter, scene) {
  const labels = (scene.sourceIds || []).map((id) => chapter.sources.find((s) => s.id === id)?.label).filter(Boolean);
  return labels.length ? `<p class="adventure-source">內容依據：${labels.join('；')}</p>` : '';
}

function questReadingFallback(chapter, scene, level) {
  const sceneSources = (scene.sourceIds || [])
    .map((id) => chapter.sources.find((source) => source.id === id))
    .filter(Boolean);
  return {
    title: scene.title,
    summary: selectLevelText(scene.body, level),
    note: scene.factNote,
    sources: sceneSources.length ? sceneSources : chapter.sources.filter((source) => source.kind === 'primary'),
  };
}

function progressLabel(definition, progress) {
  if (progress.replayActive) return `第${definition.number}章・重遊 ${progress.sceneIndex + 1}／${definition.sceneIds.length}`;
  if (progress.chapterStatus === 'stable') return `${definition.pageName}・已穩固`;
  if (progress.chapterStatus === 'found') return `${definition.pageName}・已尋回`;
  return `第${definition.number}章・${progress.sceneIndex + 1}／${definition.sceneIds.length}`;
}

function renderControls(root) {
  document.querySelectorAll('[data-story-level]').forEach((button) => {
    const active = button.dataset.storyLevel === root.level;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-zhuyin]').forEach((button) => {
    const active = button.dataset.zhuyin === root.zhuyinMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('adventure-level-note').innerHTML = `<strong>目前冒險：${root.level}版</strong>｜${LEVEL_NOTES[root.level]}切換後，故事文字與關卡挑戰會一起更換，不只是按鈕外觀。`;
}

function renderChapterNav(meta, root) {
  const chapterNav = $('adventure-chapters');
  chapterNav.innerHTML = CHAPTERS.map((definition) => {
    const unlocked = isChapterUnlocked(meta, definition.id);
    const active = definition.id === root.currentChapterId;
    const progress = getChapterProgress(meta, definition.id);
    const stateLabel = !unlocked ? '尚未解鎖' : progress.replayActive ? '重遊中' : progress.chapterStatus === 'stable' ? '已穩固' : progress.chapterStatus === 'found' ? '已尋回' : progress.sceneIndex ? '旅途中' : '可挑戰';
    return `<button class="adventure-chapter-tab${active ? ' active' : ''}" data-adventure-chapter="${definition.id}" ${unlocked ? '' : 'disabled'} aria-pressed="${active}">
      <small>第${definition.number}章・${definition.era}</small><b>${definition.figure}</b><span>${stateLabel}</span>
    </button>`;
  }).join('');
  const activeButton = chapterNav.querySelector('.adventure-chapter-tab.active');
  if (activeButton) chapterNav.scrollTop = Math.max(0, activeButton.offsetTop - chapterNav.offsetTop - 8);
  document.querySelectorAll('[data-adventure-chapter]').forEach((button) => button.addEventListener('click', () => {
    if (!selectChapter(deps.getCtx().meta, button.dataset.adventureChapter)) return;
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  }));
}

function renderAdventureGamePanel(meta, root, definition, chapter) {
  const view = buildAdventureViewModel({
    definitions: CHAPTERS,
    chapters: chapterMap,
    adventure: root,
    activeChapterId: definition.id,
    level: root.level,
    now: new Date(),
  });
  const trail = view.sceneTrail.items.map((item) => `<i class="${item.state}" title="第 ${item.position} 幕・${item.title}"></i>`).join('');
  const vow = view.vowAnchor.selected?.quote || '尚未立誓';
  const nextLabels = view.nextStep.options.map((item) => ({ echo: '七日回聲', chapter: '下一章', replay: '重遊', scene: '繼續本幕', vow: '選擇立誓' }[item.type] || item.type)).join('・') || '自由閱讀';
  $('adventure-game-panel').innerHTML = `<div class="adventure-game-summary">
      <span data-adventure-feature="A01"><small>章回圖譜</small><b>${view.chapterAtlas.totals.unlocked}／${view.chapterAtlas.totals.chapters} 已開放</b></span>
      <span data-adventure-feature="A08"><small>文友錄</small><b>${view.relationshipLedger.earnedCount} 位同行</b></span>
      <span data-adventure-feature="A02"><small>本章進度</small><b>${view.chapterHeader.scenePosition}／${view.chapterHeader.sceneCount} 幕</b></span>
      <span data-adventure-feature="A10"><small>下一步</small><b>${nextLabels}</b></span>
    </div>
    <div class="adventure-scene-trail" data-adventure-feature="A03" aria-label="章回幕次軌跡">${trail}</div>
    <details><summary>打開本章行囊</summary><div class="adventure-journal-grid">
      <p data-adventure-feature="A04"><b>開卷立誓</b><span>「${vow}」</span></p>
      <p data-adventure-feature="A05"><b>路徑手記</b><span>已留下 ${view.choiceJournal.selectedCount} 次選擇，不評分、不比較。</span></p>
      <p data-adventure-feature="A06"><b>史實鏡片</b><span>${view.evidenceLens.sources.length} 項來源・${view.evidenceLens.riskNotes.length} 項版本或史實提醒</span></p>
      <p data-adventure-feature="A07"><b>章末對手</b><span>${view.duelBeat.opponent || definition.figure}・${view.duelBeat.state}</span></p>
      <p data-adventure-feature="A09"><b>重遊自主權</b><span>保留獎勵與成績；另有 ${view.replayAgency.alternatePathsAvailable} 條未走路徑。</span></p>
    </div></details>`;
}

function renderVow(root, definition, chapter) {
  const frame = chapter.storyFrame;
  setAdventureStage(`
    ${cinematicHeader(definition, '《文豪笑傳》章回模式', `開卷立誓・遇見${definition.figure}`, `<p class="story-tagline">${frame.tagline}</p><p class="story-epithet">${frame.epithet}</p>`)}
    <div class="adventure-stage-body">
      <div class="story-vows" role="group" aria-label="選擇本章行囊">
        ${frame.vows.map((vow) => `<button class="story-choice" data-vow-id="${vow.id}"><b>帶著這句話上路</b><span>「${vow.quote}」</span><small>${vow.insight}</small></button>`).join('')}
      </div>
      <p class="story-origin">本章採用<a href="https://wenhao-xiaozhuan.pages.dev/" target="_blank" rel="noopener noreferrer">《文豪笑傳》</a>的「立誓—章回—選擇—史實小註」節奏重新編寫；故事對話為本站原創。</p>
    </div>`, true);
  document.querySelectorAll('[data-vow-id]').forEach((button) => button.addEventListener('click', () => {
    if (!chooseChapterVow(deps.getCtx().meta, button.dataset.vowId, definition.id)) return;
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  }));
}

function renderFound(root, definition, progress) {
  const due = isEchoDue(deps.getCtx().meta, new Date(), definition.id);
  const dueText = progress.echoDueAt ? new Date(progress.echoDueAt).toLocaleDateString('zh-TW') : '';
  const nextDefinition = CHAPTERS.find((item) => item.order === definition.order + 1);
  const friendLine = CHAPTER_FRIEND_LINES[definition.id] || `${definition.figure}已成為你的文友。`;
  setAdventureStage(`
    ${cinematicHeader(definition, `第${definition.order}張文脈殘頁`, `${definition.pageName}・${progress.chapterStatus === 'stable' ? '已穩固' : '已尋回'}`)}
    <div class="adventure-stage-body">
      <p>${friendLine}真正的理解，要交給時間驗證。</p>
      ${progress.chapterStatus === 'stable'
        ? `<p class="adventure-success">${definition.echoTitle}已通過。這一頁的理解，穩穩留住了。</p>`
        : due
          ? `<button id="btn-echo" class="primary-btn">接受三題「${definition.echoTitle}」</button>`
          : `<p class="adventure-wait">${dueText} 後再回來完成三題短驗收；主線旅程可以繼續。</p>`}
      ${nextDefinition ? `<button id="btn-next-chapter" class="primary-btn">前往第${nextDefinition.number}章・遇見${nextDefinition.figure}</button>` : ''}
      <button id="btn-replay-chapter" class="ghost-btn">重新遊歷本章</button>
      <button id="btn-adventure-home" class="ghost-btn">收卷回首頁</button>
    </div>`, true);
  $('btn-adventure-home').addEventListener('click', goHome);
  $('btn-echo')?.addEventListener('click', startEcho);
  $('btn-next-chapter')?.addEventListener('click', () => {
    if (!selectChapter(deps.getCtx().meta, nextDefinition.id)) return;
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  });
  $('btn-replay-chapter').addEventListener('click', () => {
    if (!startChapterReplay(deps.getCtx().meta, definition.id)) return;
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  });
}

async function renderAdventure() {
  const { meta, root, definition, progress, chapter } = currentContext();
  $('adventure-progress').textContent = `${deps.getPlayerName()}・${progressLabel(definition, progress)}`;
  renderControls(root);
  renderChapterNav(meta, root);
  renderAdventureGamePanel(meta, root, definition, chapter);
  if (progress.chapterStatus !== 'locked' && !progress.replayActive) {
    renderFound(root, definition, progress);
    return;
  }
  if (!progress.vowId) {
    renderVow(root, definition, chapter);
    return;
  }
  const scene = chapter.scenes[progress.sceneIndex];
  const activeQuest = scene.quest ? resolveQuest(scene.quest, root.level) : null;
  const questAction = activeQuest ? questActionLabel(activeQuest.count, scene.visual?.mode === 'duel') : '';
  const body = selectLevelText(scene.body, root.level);
  const story = selectLevelText(scene.story, root.level);
  const isFinal = scene.id === definition.sceneIds.at(-1);
  const selectedChoiceId = progress.sceneChoices[scene.id];
  const selectedChoice = scene.choices.find((choice) => choice.id === selectedChoiceId);
  const choiceBlock = selectedChoice
    ? `<div class="story-choice-result"><small>你的選擇</small><b>${selectedChoice.label}</b><p>${selectedChoice.response}</p></div>`
    : `<div class="story-choices" role="group" aria-label="替${definition.figure}作出選擇">
        ${scene.choices.map((choice) => `<button class="story-choice" data-scene-choice="${choice.id}"><span>${choice.label}</span></button>`).join('')}
      </div>`;
  setAdventureStage(`
    ${cinematicHeader(definition, `第 ${progress.sceneIndex + 1} 幕・${chapter.title}`, scene.title)}
    <div class="adventure-stage-body">
      <div class="story-scene">${renderZhuyin(story, chapter.annotations, root.zhuyinMode)}</div>
      <div class="adventure-copy">${renderZhuyin(body, chapter.annotations, root.zhuyinMode)}</div>
      <aside class="story-fact"><b>史實小註</b><p>${scene.factNote}</p></aside>
      ${choiceBlock}
      ${sourceLine(chapter, scene)}
      ${selectedChoice ? `<button id="btn-scene-next" class="primary-btn">${scene.quest ? questAction : isFinal ? `修復${definition.pageName}` : '翻到下一幕'}</button>` : '<p class="story-choice-hint">先替角色作出選擇，故事才會繼續。</p>'}
    </div>`, true);
  document.querySelectorAll('[data-scene-choice]').forEach((button) => button.addEventListener('click', () => {
    if (!chooseScenePath(meta, scene.id, button.dataset.sceneChoice, definition.id)) return;
    saveMeta(meta);
    renderAdventure();
  }));
  $('btn-scene-next')?.addEventListener('click', () => scene.quest ? startQuest(scene) : advanceScene(scene, isFinal));
}

function advanceScene(scene, isFinal) {
  const { meta, definition, progress } = currentContext();
  if (isFinal && progress.replayActive) finishChapterReplay(meta, definition.id);
  else if (isFinal) markChapterFound(meta, new Date(), definition.id);
  else completeScene(meta, scene.id, definition.id);
  saveMeta(meta);
  renderAdventure();
}

async function startQuest(scene) {
  const { root, definition, chapter } = currentContext();
  const quest = resolveQuest(scene.quest, root.level);
  let entries;
  try { entries = await loadBank(quest.bankKey); }
  catch { deps.toast('委託題目暫時載入失敗，原有練功仍可使用'); return; }
  const selected = selectQuestEntries(shuffle(entries), quest);
  if (selected.length < quest.count) {
    deps.toast('這項委託的可用題目不足，已停止發布以避免重複灌題');
    return;
  }
  deps.startPractice(null, null, {
    entries: selected,
    limit: quest.count,
    title: scene.title,
    annotations: chapter.annotations,
    zhuyinMode: root.zhuyinMode,
    readingGuides: Object.fromEntries(Object.entries(chapter.readingGuides || {}).map(([work, guide]) => [work, {
      ...guide,
      support: selectLevelText(guide.support, root.level),
    }])),
    readingFallback: questReadingFallback(chapter, scene, root.level),
    exitLabel: `← 離開${scene.visual?.mode === 'duel' ? '對戰' : '委託'}（完成前不保留）`,
    completeExitLabel: `← 回到${definition.figure}篇（本關已完成）`,
    completeLabel: questCompleteLabel(quest.count, definition.figure, scene.visual?.mode === 'duel'),
    visual: scene.visual ? {
      ...scene.visual,
      title: scene.title,
      opponent: scene.visual.opponent || definition.figure,
      image: `assets/img/${scene.visual.art}`,
    } : null,
    onExit: openAdventureScreen,
    onTargetReached: (summary) => {
      const meta = deps.getCtx().meta;
      const progress = getChapterProgress(meta, definition.id);
      progress.questResults[scene.id] = { ...summary, completedAt: new Date().toISOString() };
      completeScene(meta, scene.id, definition.id);
      saveMeta(meta);
    },
    onComplete: openAdventureScreen,
  });
}

async function startEcho() {
  const { root, definition, chapter } = currentContext();
  const quest = resolveQuest(definition.echoQuest, root.level);
  let entries;
  try { entries = await loadBank(quest.bankKey); }
  catch { deps.toast(`${definition.echoTitle}暫時載入失敗`); return; }
  const selected = shuffle(selectQuestEntries(entries, quest));
  deps.startPractice(null, null, {
    entries: selected,
    limit: quest.count, title: definition.echoTitle, annotations: chapter.annotations, zhuyinMode: root.zhuyinMode,
    readingGuides: Object.fromEntries(Object.entries(chapter.readingGuides || {}).map(([work, guide]) => [work, {
      ...guide,
      support: selectLevelText(guide.support, root.level),
    }])),
    readingFallback: {
      title: definition.echoTitle,
      summary: `回想${definition.figure}篇各幕的作品線索，再完成這次短驗收。`,
      note: '題目只取本章人物作品；本站整理文字不冒充原文。',
      sources: chapter.sources.filter((source) => source.kind === 'primary'),
    },
    exitLabel: `← 離開回聲（完成前不保留）`,
    completeExitLabel: `← 回到${definition.figure}篇（本次已完成）`,
    completeLabel: `完成${quest.count}題，回到${definition.figure}篇（Enter）`,
    onExit: openAdventureScreen,
    onTargetReached: (summary) => {
      const meta = deps.getCtx().meta;
      if (summary.correct >= 2 && stabilizeChapter(meta, new Date(), definition.id)) deps.toast(`${definition.pageName}已穩固！`);
      else deps.toast('再溫習一次也沒關係，理解正在長出來');
      saveMeta(meta);
    },
    onComplete: openAdventureScreen,
  });
}

export async function openAdventureScreen() {
  deps.showScreen('screen-adventure');
  setAdventureStage('<p class="home-today">正在展開文心卷……</p>');
  try {
    await loadChapters();
    const root = ensureAdventure(deps.getCtx().meta);
    if (LEVELS.includes(deps.getLevel())) root.level = deps.getLevel();
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  } catch {
    setAdventureStage('<h2>文心卷暫時無法展開</h2><p>你的練功與收藏都還在，可以先回首頁繼續修練。</p><button id="btn-adventure-home" class="primary-btn">回首頁</button>');
    $('btn-adventure-home').addEventListener('click', goHome);
  }
}

export function initAdventureUI(nextDeps) {
  deps = nextDeps;
  $('btn-adventure-back').addEventListener('click', goHome);
  document.querySelectorAll('[data-story-level]').forEach((button) => button.addEventListener('click', async () => {
    await deps.switchLevel(button.dataset.storyLevel);
    ensureAdventure(deps.getCtx().meta).level = button.dataset.storyLevel;
    saveMeta(deps.getCtx().meta);
    openAdventureScreen();
  }));
  document.querySelectorAll('[data-zhuyin]').forEach((button) => button.addEventListener('click', () => {
    ensureAdventure(deps.getCtx().meta).zhuyinMode = button.dataset.zhuyin;
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  }));
}
