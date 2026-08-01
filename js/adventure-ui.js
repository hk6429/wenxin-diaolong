import {
  SCENE_IDS,
  ensureAdventure,
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
let chapter;

function goHome() {
  deps.renderHome();
  deps.showScreen('screen-home');
}

async function loadChapter() {
  if (chapter) return chapter;
  const response = await fetch('data/adventure/zhuangzi.json');
  if (!response.ok) throw new Error(`chapter ${response.status}`);
  chapter = await response.json();
  return chapter;
}

function sourceLine(scene) {
  const labels = (scene.sourceIds || []).map((id) => chapter.sources.find((s) => s.id === id)?.label).filter(Boolean);
  return labels.length ? `<p class="adventure-source">內容依據：${labels.join('；')}</p>` : '';
}

function progressLabel(state) {
  if (state.chapterStatus === 'stable') return '觀物之頁・已穩固';
  if (state.chapterStatus === 'found') return '觀物之頁・已尋回';
  return `第一章・${state.sceneIndex + 1}／${SCENE_IDS.length}`;
}

function renderControls(state) {
  document.querySelectorAll('[data-story-level]').forEach((button) => {
    const active = button.dataset.storyLevel === state.level;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-zhuyin]').forEach((button) => {
    const active = button.dataset.zhuyin === state.zhuyinMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('adventure-level-note').innerHTML = `<strong>目前冒險：${state.level}版</strong>｜${LEVEL_NOTES[state.level]}切換後，故事文字與五題挑戰會一起更換，不只是按鈕外觀。`;
}

function renderFound(state) {
  const due = isEchoDue(deps.getCtx().meta);
  const dueText = state.echoDueAt ? new Date(state.echoDueAt).toLocaleDateString('zh-TW') : '';
  $('adventure-stage').innerHTML = `
    <div class="adventure-character"><img src="assets/img/diaolong.webp" alt="雕龍" onerror="this.replaceWith('🐉')"></div>
    <p class="scene-kicker">第一張文脈殘頁</p><h2>觀物之頁・${state.chapterStatus === 'stable' ? '已穩固' : '已尋回'}</h2>
    <p>莊周已成為你的第一位文友，夢蝶書籤也收入守卷閣。真正的理解，要交給時間驗證。</p>
    ${state.chapterStatus === 'stable'
      ? '<p class="adventure-success">蝶夢回聲已通過。這一頁的理解，穩穩留住了。</p>'
      : due
        ? '<button id="btn-echo" class="primary-btn">接受三題「蝶夢回聲」</button>'
        : `<p class="adventure-wait">${dueText} 後再回來完成三題短驗收。現在可以安心收卷。</p>`}
    <button id="btn-adventure-home" class="ghost-btn">收卷回首頁</button>`;
  $('btn-adventure-home').addEventListener('click', goHome);
  $('btn-echo')?.addEventListener('click', startEcho);
}

async function renderAdventure() {
  const ctx = deps.getCtx();
  const state = ensureAdventure(ctx.meta);
  $('adventure-progress').textContent = progressLabel(state);
  renderControls(state);
  if (state.chapterStatus !== 'locked') {
    renderFound(state);
    return;
  }
  const scene = chapter.scenes[state.sceneIndex];
  const body = selectLevelText(scene.body, state.level);
  const isFinal = scene.id === SCENE_IDS.at(-1);
  $('adventure-stage').innerHTML = `
    <div class="adventure-character"><img src="assets/img/${scene.id === 'zhuangzi-trial' ? 'zhuangzi' : scene.id === 'archive-return' ? 'diaolong' : 'zhuangzi'}.webp" alt="" onerror="this.replaceWith('🦋')"></div>
    <p class="scene-kicker">${chapter.title}</p><h2>${scene.title}</h2>
    <div class="adventure-copy">${renderZhuyin(body, chapter.annotations, state.zhuyinMode)}</div>
    ${sourceLine(scene)}
    <button id="btn-scene-next" class="primary-btn">${scene.quest ? '接受五題委託' : isFinal ? '修復觀物之頁' : '繼續前進'}</button>`;
  $('btn-scene-next').addEventListener('click', () => scene.quest ? startQuest(scene) : advanceScene(scene, isFinal));
}

function advanceScene(scene, isFinal) {
  const ctx = deps.getCtx();
  if (isFinal) {
    markChapterFound(ctx.meta);
  } else {
    completeScene(ctx.meta, scene.id);
  }
  saveMeta(ctx.meta);
  renderAdventure();
}

async function startQuest(scene) {
  const state = ensureAdventure(deps.getCtx().meta);
  const quest = resolveQuest(scene.quest, state.level);
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
    zhuyinMode: state.zhuyinMode,
    onExit: openAdventureScreen,
    onComplete: (summary) => {
      const ctx = deps.getCtx();
      const fresh = ensureAdventure(ctx.meta);
      fresh.questResults[scene.id] = { ...summary, completedAt: new Date().toISOString() };
      completeScene(ctx.meta, scene.id);
      saveMeta(ctx.meta);
      openAdventureScreen();
    },
  });
}

async function startEcho() {
  let entries;
  try { entries = await loadBank('rhetoric'); }
  catch { deps.toast('蝶夢回聲暫時載入失敗'); return; }
  const selected = shuffle(selectQuestEntries(entries, { cats: ['譬喻', '轉化', '誇飾', '設問'], count: 3 }));
  const state = ensureAdventure(deps.getCtx().meta);
  deps.startPractice(null, selected.map((entry) => entry.id), {
    limit: 3, title: '蝶夢回聲', annotations: chapter.annotations, zhuyinMode: state.zhuyinMode,
    onExit: openAdventureScreen,
    onComplete: (summary) => {
      const ctx = deps.getCtx();
      if (summary.correct >= 2 && stabilizeChapter(ctx.meta)) deps.toast('觀物之頁已穩固！');
      else deps.toast('再溫習一次也沒關係，理解正在長出來');
      saveMeta(ctx.meta);
      openAdventureScreen();
    },
  });
}

export async function openAdventureScreen() {
  deps.showScreen('screen-adventure');
  $('adventure-stage').innerHTML = '<p class="home-today">正在展開文心卷……</p>';
  try {
    await loadChapter();
    const state = ensureAdventure(deps.getCtx().meta);
    if (LEVELS.includes(deps.getLevel())) state.level = deps.getLevel();
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
