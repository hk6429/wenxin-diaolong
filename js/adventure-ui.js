import {
  CHAPTERS,
  chapterDefinition,
  ensureAdventure,
  getChapterProgress,
  isChapterUnlocked,
  selectChapter,
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

const $ = (id) => document.getElementById(id);
const LEVELS = ['國小', '國中', '高中'];
const LEVEL_NOTES = {
  國小: '文字較短、提供注音，委託只抽國小專屬題庫。',
  國中: '增加概念辨析與四大句型，委託只抽國中專屬題庫。',
  高中: '加入文言語法與深入格律，委託只抽高中專屬題庫。',
};
let deps;
let chapterMap = null;

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

function progressLabel(definition, progress) {
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
  $('adventure-level-note').innerHTML = `<strong>目前冒險：${root.level}版</strong>｜${LEVEL_NOTES[root.level]}切換後，故事文字與五題挑戰會一起更換，不只是按鈕外觀。`;
}

function renderChapterNav(meta, root) {
  $('adventure-chapters').innerHTML = CHAPTERS.map((definition) => {
    const unlocked = isChapterUnlocked(meta, definition.id);
    const active = definition.id === root.currentChapterId;
    const progress = getChapterProgress(meta, definition.id);
    const stateLabel = !unlocked ? '尚未解鎖' : progress.chapterStatus === 'stable' ? '已穩固' : progress.chapterStatus === 'found' ? '已尋回' : progress.sceneIndex ? '旅途中' : '可挑戰';
    return `<button class="adventure-chapter-tab${active ? ' active' : ''}" data-adventure-chapter="${definition.id}" ${unlocked ? '' : 'disabled'} aria-pressed="${active}">
      <small>第${definition.number}章・${definition.era}</small><b>${definition.figure}</b><span>${stateLabel}</span>
    </button>`;
  }).join('');
  document.querySelectorAll('[data-adventure-chapter]').forEach((button) => button.addEventListener('click', () => {
    if (!selectChapter(deps.getCtx().meta, button.dataset.adventureChapter)) return;
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  }));
}

function renderFound(root, definition, progress) {
  const due = isEchoDue(deps.getCtx().meta, new Date(), definition.id);
  const dueText = progress.echoDueAt ? new Date(progress.echoDueAt).toLocaleDateString('zh-TW') : '';
  const nextDefinition = CHAPTERS.find((item) => item.order === definition.order + 1);
  const friendLine = definition.id === 'preqin-zhuangzi'
    ? '莊周已成為你的第一位文友，夢蝶書籤也收入守卷閣。'
    : '屈原已成為你的第二位文友，香草流蘇也收入守卷閣。';
  $('adventure-stage').innerHTML = `
    <div class="adventure-character"><img src="assets/img/${definition.art}.webp" alt="${definition.figure}" onerror="this.replaceWith('文')"></div>
    <p class="scene-kicker">第${definition.order}張文脈殘頁</p><h2>${definition.pageName}・${progress.chapterStatus === 'stable' ? '已穩固' : '已尋回'}</h2>
    <p>${friendLine}真正的理解，要交給時間驗證。</p>
    ${progress.chapterStatus === 'stable'
      ? `<p class="adventure-success">${definition.echoTitle}已通過。這一頁的理解，穩穩留住了。</p>`
      : due
        ? `<button id="btn-echo" class="primary-btn">接受三題「${definition.echoTitle}」</button>`
        : `<p class="adventure-wait">${dueText} 後再回來完成三題短驗收；主線旅程可以繼續。</p>`}
    ${nextDefinition ? `<button id="btn-next-chapter" class="primary-btn">前往第${nextDefinition.number}章・遇見${nextDefinition.figure}</button>` : ''}
    <button id="btn-adventure-home" class="ghost-btn">收卷回首頁</button>`;
  $('btn-adventure-home').addEventListener('click', goHome);
  $('btn-echo')?.addEventListener('click', startEcho);
  $('btn-next-chapter')?.addEventListener('click', () => {
    if (!selectChapter(deps.getCtx().meta, nextDefinition.id)) return;
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  });
}

async function renderAdventure() {
  const { meta, root, definition, progress, chapter } = currentContext();
  $('adventure-progress').textContent = progressLabel(definition, progress);
  renderControls(root);
  renderChapterNav(meta, root);
  if (progress.chapterStatus !== 'locked') {
    renderFound(root, definition, progress);
    return;
  }
  const scene = chapter.scenes[progress.sceneIndex];
  const body = selectLevelText(scene.body, root.level);
  const isFinal = scene.id === definition.sceneIds.at(-1);
  const art = isFinal ? 'diaolong' : definition.art;
  $('adventure-stage').innerHTML = `
    <div class="adventure-character"><img src="assets/img/${art}.webp" alt="${isFinal ? '雕龍' : definition.figure}" onerror="this.replaceWith('文')"></div>
    <p class="scene-kicker">${chapter.title}</p><h2>${scene.title}</h2>
    <div class="adventure-copy">${renderZhuyin(body, chapter.annotations, root.zhuyinMode)}</div>
    ${sourceLine(chapter, scene)}
    <button id="btn-scene-next" class="primary-btn">${scene.quest ? '接受五題委託' : isFinal ? `修復${definition.pageName}` : '繼續前進'}</button>`;
  $('btn-scene-next').addEventListener('click', () => scene.quest ? startQuest(scene) : advanceScene(scene, isFinal));
}

function advanceScene(scene, isFinal) {
  const { meta, definition } = currentContext();
  if (isFinal) markChapterFound(meta, new Date(), definition.id);
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
  deps.startPractice(null, selected.map((entry) => entry.id), {
    limit: quest.count,
    title: scene.title,
    annotations: chapter.annotations,
    zhuyinMode: root.zhuyinMode,
    onExit: openAdventureScreen,
    onComplete: (summary) => {
      const meta = deps.getCtx().meta;
      const progress = getChapterProgress(meta, definition.id);
      progress.questResults[scene.id] = { ...summary, completedAt: new Date().toISOString() };
      completeScene(meta, scene.id, definition.id);
      saveMeta(meta);
      openAdventureScreen();
    },
  });
}

async function startEcho() {
  const { root, definition, chapter } = currentContext();
  const quest = resolveQuest(definition.echoQuest, root.level);
  let entries;
  try { entries = await loadBank(quest.bankKey); }
  catch { deps.toast(`${definition.echoTitle}暫時載入失敗`); return; }
  const selected = shuffle(selectQuestEntries(entries, quest));
  deps.startPractice(null, selected.map((entry) => entry.id), {
    limit: quest.count, title: definition.echoTitle, annotations: chapter.annotations, zhuyinMode: root.zhuyinMode,
    onExit: openAdventureScreen,
    onComplete: (summary) => {
      const meta = deps.getCtx().meta;
      if (summary.correct >= 2 && stabilizeChapter(meta, new Date(), definition.id)) deps.toast(`${definition.pageName}已穩固！`);
      else deps.toast('再溫習一次也沒關係，理解正在長出來');
      saveMeta(meta);
      openAdventureScreen();
    },
  });
}

export async function openAdventureScreen() {
  deps.showScreen('screen-adventure');
  $('adventure-stage').innerHTML = '<p class="home-today">正在展開文心卷……</p>';
  try {
    await loadChapters();
    const root = ensureAdventure(deps.getCtx().meta);
    if (LEVELS.includes(deps.getLevel())) root.level = deps.getLevel();
    saveMeta(deps.getCtx().meta);
    renderAdventure();
  } catch {
    $('adventure-stage').innerHTML = '<h2>文心卷暫時無法展開</h2><p>你的練功與收藏都還在，可以先回首頁繼續修練。</p><button id="btn-adventure-home" class="primary-btn">回首頁</button>';
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
