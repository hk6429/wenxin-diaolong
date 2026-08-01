// 文心雕龍主控：畫面路由＋練習閉環。機制全走 js/meta/kernel.js 掛鉤，本檔只管 UI。
import { getLevel, setLevel, loadBank } from './bank.js';
import { initSession, onPracticeAnswer } from './meta/kernel.js';
import { getMasteryStats, getCollection, getMostWrong, GRADES } from './meta/collection.js';
import { getProgress } from './meta/progress.js';
import { getBalance } from './meta/economy.js';
import { getWeaknessSummary } from './meta/weakness.js';
import { PETS, petLevel, isUnlocked, bondStage, categoryMastery, LEVEL_STEP, MAX_LEVEL } from './meta/pet.js';
import { saveMeta } from './meta/store.js';
import { nextQuestionId } from './leitner.js';
import { createRoundState, nextInRound, recordRound, advanceRound } from './practice-round.js';
import { shuffle } from './shuffle.js';
import { shouldCheckpoint } from './session-checkpoint.js';

// 作答結果已透過 toast-zone（aria-live=polite）播報，這裡不需另設播報器
function announce(_msg) {}

import { initBattleUI, openBattleScreen } from './battle-ui.js';
import { initRtUI, openRtScreen } from './rtbattle-ui.js';
import { initAdventureUI, openAdventureScreen } from './adventure-ui.js';
import { renderZhuyin } from './zhuyin.js';
import { ensureAdventure, isEchoDue } from './adventure.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['screen-home', 'screen-adventure', 'screen-practice', 'screen-codex', 'screen-weak', 'screen-pets', 'screen-battle', 'screen-rt'];

let ctx = null;          // kernel session ctx（依目前學制的 mixed 全庫）
let fullBank = [];       // 目前學制 mixed 全部題目
let quiz = null;         // 進行中的練習 {entries, byId, rs, currentId, combo, answered, multiPicks}
let codexLevel = '全部';

const LEVEL_PROFILES = {
  國小: { audience: '國小學生', focus: '生活語句、關聯複句與具體例子', note: '使用國小專屬題庫，包含常見修辭、基本詞性、九類關聯複句、標點、押韻與對聯。' },
  國中: { audience: '國中學生', focus: '會考核心分類、四大句型與跨句辨析', note: '使用國中專屬題庫，加入十種進階修辭、完整詞性、詞語結構、語病、詩體與對仗。' },
  高中: { audience: '高中學生', focus: '文言語法、細緻辨析與近體詩格律', note: '使用高中專屬題庫，深化實虛詞、文言句式、詞類活用、平仄、詞曲與綜合修辭。' },
  實戰: { audience: '準備大型考試的學生', focus: '歷屆考題原貌與官方答案', note: '只載入基測、會考、學測、指考等實戰題庫；不是更難的隨機題，也不是裝飾按鈕。' },
};
const SCHOOL_LEVEL_ORDER = { 國小: 1, 國中: 2, 高中: 3 };
const READING_PROGRESS_KEY = 'wenxin-reading-progress-v1';

/* ---------- 初始化與學制 ---------- */
async function boot() {
  try {
    fullBank = await loadBank('mixed');
  } catch (e) {
    console.warn('[文心雕龍] 題庫載入失敗', e);
    fullBank = [];
  }
  ctx = initSession(fullBank);
  renderHud();
  renderHome();
}

async function switchLevel(level) {
  if (!setLevel(level) && getLevel() !== level) return;
  await boot();
  showScreen('screen-home');
}

/* ---------- 畫面切換 ---------- */
function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  window.scrollTo(0, 0);
}

/* ---------- HUD 與首頁 ---------- */
function renderHud() {
  const meta = ctx.meta;
  $('hud-pearls').textContent = `🪷 ${getBalance(meta)}`;
  $('hud-rank').textContent = getProgress(meta).rankName;
  $('hud-streak').textContent = `🔥 ${meta.daily.streak || 0}`;
}

function renderHome() {
  document.querySelectorAll('.level-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.level === getLevel());
  });
  renderLevelGuides();
  const d = ctx.meta.daily;
  const adventure = ensureAdventure(ctx.meta);
  if (adventure.chapterStatus === 'stable') {
    $('adventure-hero-kicker').textContent = '第一章・已穩固';
    $('adventure-hero-title').textContent = '觀物之頁重新發光';
    $('adventure-hero-cta').textContent = '回守卷閣看看 →';
  } else if (adventure.chapterStatus === 'found') {
    $('adventure-hero-kicker').textContent = isEchoDue(ctx.meta) ? '蝶夢回聲・可以驗收' : '第一章・已尋回';
    $('adventure-hero-title').textContent = isEchoDue(ctx.meta) ? '七日後的三題挑戰到了' : '觀物之頁等待時間沉澱';
    $('adventure-hero-cta').textContent = isEchoDue(ctx.meta) ? '接受回聲挑戰 →' : '查看旅程 →';
  } else if (adventure.sceneIndex > 0) {
    $('adventure-hero-kicker').textContent = `第一章・${adventure.sceneIndex + 1}／7`;
    $('adventure-hero-title').textContent = '繼續〈蝶夢逍遙〉';
    $('adventure-hero-cta').textContent = '從書籤繼續 →';
  }
  $('home-today').textContent = d.todayAnswered > 0
    ? `今日已練 ${d.todayAnswered} 題，答對 ${d.todayCorrect} 題——${d.todayCorrect / d.todayAnswered >= 0.8 ? '文氣充沛！' : '穩穩累積中。'}`
    : '今天還沒開張，來練幾題暖暖筆鋒吧。';
  const zones = [
    ['修辭', 'var(--rh)'], ['文法', 'var(--gr)'], ['格律', 'var(--yl)'],
  ];
  $('home-progress').innerHTML = zones.map(([zone, color]) => {
    const bank = fullBank.filter((e) => e.zone === zone);
    const s = getMasteryStats(ctx.meta, bank);
    const pct = s.total ? Math.round((s.known / s.total) * 100) : 0;
    return `<div class="zone-progress"><span>${zone}：已煉成 ${s.known}／${s.total} 題（精熟 ${s.mastered}）</span>
      <div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
  }).join('');
}

function renderLevelGuides() {
  const level = getLevel();
  const profile = LEVEL_PROFILES[level];
  const counts = ['修辭', '文法', '格律'].map((zone) => `${zone} ${fullBank.filter((e) => e.zone === zone).length} 題`).join('・');
  $('level-guide').innerHTML = `<p><strong>目前是「${level}」專屬題庫</strong>｜適合 ${profile.audience}</p>
    <p>${profile.note}</p><p class="level-counts">本學段共 ${fullBank.length} 題：${counts}</p>`;
  $('practice-level-guide').innerHTML = `<strong>現在練的是「${level}」題庫</strong>｜${profile.focus}。切回首頁即可更換學段。`;
}

/* ---------- 練習流程 ---------- */
async function startPractice(bankKey, fixedIds = null, options = {}) {
  let entries;
  try {
    entries = fixedIds
      ? fixedIds.map((id) => ctx.byId.get(id)).filter(Boolean)
      : await loadBank(bankKey);
  } catch { entries = []; }
  if (!entries.length) {
    toast('這個分區目前沒有題目');
    return;
  }
  quiz = {
    entries,
    byId: new Map(entries.map((e) => [e.id, e])),
    rs: createRoundState(shuffle(entries.map((e) => e.id))),
    currentId: null,
    combo: 0,
    answered: 0,
    correct: 0,
    multiPicks: new Set(),
    target: options.limit ? Math.min(options.limit, entries.length) : null,
    onComplete: typeof options.onComplete === 'function' ? options.onComplete : null,
    onExit: typeof options.onExit === 'function' ? options.onExit : null,
    title: options.title || '',
    annotations: options.annotations || [],
    zhuyinMode: options.zhuyinMode || 'off',
    completePending: false,
  };
  $('practice-zones').hidden = true;
  $('quiz-panel').hidden = false;
  showScreen('screen-practice');
  nextQuestion();
}

function pickNext(candidates) {
  return nextQuestionId(ctx.leitner, candidates, ctx.byId);
}

function nextQuestion() {
  if (quiz?.completePending) {
    finishPractice();
    return;
  }
  let id = nextInRound(quiz.rs, pickNext);
  if (id === null) {
    const adv = advanceRound(quiz.rs, quiz.entries.map((e) => e.id), shuffle);
    toast(adv.mode === 'wrong-review' ? `第 ${adv.round} 輪：複習剛剛答錯的 ${adv.size} 題` : `第 ${adv.round} 輪：整區重新開跑！`);
    id = nextInRound(quiz.rs, pickNext);
  }
  quiz.currentId = id;
  quiz.multiPicks = new Set();
  renderQuestion(quiz.byId.get(id));
}

function renderQuestion(e) {
  const isMulti = e.qformat === 'exam-mc-multi';
  $('btn-next').textContent = '下一題（Enter）';
  $('quiz-progress').textContent = quiz.target
    ? `${quiz.title ? quiz.title + '・' : ''}${quiz.answered + 1}／${quiz.target}`
    : `第 ${quiz.rs.round} 輪・${quiz.rs.served.size}／${quiz.rs.pool.length}`;
  $('quiz-combo').hidden = quiz.combo < 2;
  $('quiz-combo').textContent = `連對 ×${quiz.combo}`;
  $('quiz-tag').innerHTML = `<span class="zone-chip z-${e.zone}">${e.zone}</span>${e.cat}${e.subcat ? '・' + e.subcat : ''}` +
    (e.origin === '真題' ? `　<span>【${e.year} 年${e.exam || ''}真題】</span>` : '') +
    (isMulti ? '　<strong>（複選題）</strong>' : '');
  $('quiz-question').innerHTML = renderZhuyin(e.question, quiz.annotations, quiz.zhuyinMode, {
    suppress: /音|讀音|注音/.test(e.cat || '') || /音|讀音|注音/.test(e.question || ''),
  });
  $('quiz-feedback').hidden = true;
  $('btn-submit-multi').hidden = !isMulti;
  const box = $('quiz-options');
  box.innerHTML = '';
  e.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.dataset.opt = opt;
    b.innerHTML = `<span class="kbd">${i + 1}</span><span>${renderZhuyin(opt, quiz.annotations, quiz.zhuyinMode)}</span>`;
    b.addEventListener('click', () => (isMulti ? toggleMulti(b, opt) : submitAnswer([opt])));
    box.appendChild(b);
  });
}

function toggleMulti(btn, opt) {
  if (quiz.multiPicks.has(opt)) { quiz.multiPicks.delete(opt); btn.dataset.picked = ''; }
  else { quiz.multiPicks.add(opt); btn.dataset.picked = '1'; }
}

function submitAnswer(picked) {
  const e = quiz.byId.get(quiz.currentId);
  if (!e || !$('quiz-feedback').hidden) return;
  const answers = Array.isArray(e.answer) ? e.answer : [e.answer];
  const correct = picked.length === answers.length && answers.every((a) => picked.includes(a));

  document.querySelectorAll('.opt-btn').forEach((b) => {
    b.disabled = true;
    if (answers.includes(b.dataset.opt)) b.classList.add('correct');
    else if (picked.includes(b.dataset.opt)) b.classList.add('wrong');
  });

  quiz.combo = correct ? quiz.combo + 1 : 0;
  quiz.answered += 1;
  if (correct) quiz.correct += 1;
  recordRound(quiz.rs, e.id, correct);

  const { events } = onPracticeAnswer(ctx, e.id, correct);
  renderEvents(events);
  renderHud();

  const v = $('quiz-verdict');
  v.textContent = correct ? '答對了！' : `不對喔，正解：${answers.join('、')}`;
  v.className = `verdict ${correct ? 'ok' : 'bad'}`;
  $('quiz-explain').textContent = e.explain || '';
  const cit = $('quiz-citation');
  cit.hidden = !e.citation;
  cit.textContent = e.citation ? `出處：${e.citation}` : '';
  const off = $('quiz-official');
  off.hidden = !(e.origin === '真題' && typeof e.pass === 'number');
  if (!off.hidden) off.textContent = `官方通過率 ${(e.pass * 100).toFixed(0)}%——${e.pass < 0.5 ? '全國考生都覺得難，答對很了不起' : '基本題，務必拿下'}`;
  $('quiz-feedback').hidden = false;
  if (quiz.target && quiz.answered >= quiz.target) {
    quiz.completePending = true;
    $('btn-next').textContent = '完成本節（Enter）';
  } else {
    $('btn-next').textContent = '下一題（Enter）';
  }
  $('btn-next').focus();
  announce(correct ? '答對' : '答錯');

  if (shouldCheckpoint(quiz.answered)) {
    $('checkpoint-text').textContent = `你已經連續練了 ${quiz.answered} 題，今日共 ${ctx.meta.daily.todayAnswered} 題。要不要起來動一動？`;
    $('checkpoint-overlay').hidden = false;
  }
}

function exitPractice() {
  const onExit = quiz?.onExit;
  quiz = null;
  $('practice-zones').hidden = false;
  $('quiz-panel').hidden = true;
  if (onExit) onExit();
  else { renderHome(); showScreen('screen-home'); }
}

function finishPractice() {
  const current = quiz;
  quiz = null;
  $('practice-zones').hidden = false;
  $('quiz-panel').hidden = true;
  const summary = { answered: current.answered, correct: current.correct, target: current.target };
  if (current.onComplete) current.onComplete(summary);
  else { renderHome(); showScreen('screen-home'); }
}

/* ---------- kernel events → toast ---------- */
function renderEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'pearlForged': toast(`✨ 煉成${ev.payload.gradeName}！這一題你真的會了`); break;
      case 'pearlDusted': toast('🌫️ 字珠蒙塵了——再答對 2 次擦亮它'); break;
      case 'pearlPolished': toast('🫧 字珠擦亮，重放光芒！'); break;
      case 'gradeUp': toast(`💎 升階：${ev.payload.gradeName}！`); break;
      case 'rankUp': toast(`📜 境界提升——【${ev.payload.name}】${ev.payload.blessing}`); break;
      case 'petUnlocked': toast(`${ev.payload.icon} 四靈現身：${ev.payload.name}！`); break;
      case 'petLevelUp': toast(`${ev.payload.icon} ${ev.payload.name} 升到 Lv.${ev.payload.level}`); break;
      case 'pearls': if (ev.payload.capped) toast('今日墨珠已達上限，明天再來賺'); break;
      default: break;
    }
  }
}

let toastTimer = new Map();
function toast(msg) {
  const zone = $('toast-zone');
  if (zone.children.length > 3) zone.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  zone.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ---------- 文心圖鑑 ---------- */
let concepts = null;
async function renderCodex(tab = '修辭') {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const body = $('codex-body');
  $('codex-level-tools').hidden = tab === '珠';
  if (tab === '珠') {
    const col = getCollection(ctx.meta);
    body.innerHTML = `<div class="pearl-stats">${GRADES.map((g, i) =>
      `<div class="pearl-cell"><b>${col.counts[i]}</b>${g}</div>`).join('')}</div>` +
      (col.dustyCount ? `<p>目前有 ${col.dustyCount} 顆珠蒙塵——去弱點複習擦亮它們！</p>` : '<p>答對到滿盒就能煉珠；錯過再煉成的珠更珍貴。</p>');
    return;
  }
  if (concepts === null) {
    try {
      const r = await fetch('data/concepts.json?v=20260801-prosody-tables');
      concepts = r.ok ? await r.json() : [];
    } catch { concepts = []; }
  }
  if (!concepts.length) {
    body.innerHTML = '<p>圖鑑建置中，敬請期待。</p>';
    return;
  }
  document.querySelectorAll('[data-concept-level]').forEach((b) => b.classList.toggle('active', b.dataset.conceptLevel === codexLevel));
  const zoneConcepts = concepts.filter((c) => c.zone === tab);
  const list = zoneConcepts.filter((c) => codexLevel === '全部' || SCHOOL_LEVEL_ORDER[c.level] <= SCHOOL_LEVEL_ORDER[codexLevel]);
  body.innerHTML = renderLearningOutline(tab) + `<p class="codex-summary">${tab}共有 ${zoneConcepts.length} 個主題；目前顯示 ${codexLevel === '全部' ? '完整講義' : `${codexLevel}適用（含前階段基礎）`}的 ${list.length} 個。長篇內容已拆成解構步驟，讀完一節就會記錄進度。</p>` + list.map((c) => {
    const bank = fullBank.filter((e) => e.zone === c.zone && e.cat === c.cat);
    const s = getMasteryStats(ctx.meta, bank);
    const lit = s.known >= 5;
    return `<article class="concept-card ${lit ? `lit-${c.zone}` : 'dim'}" data-concept-cat="${escapeHtml(c.cat)}">
      <div class="concept-head"><h3>${c.cat}</h3><span class="concept-level">本站建議：${c.level}起</span>
        <span class="concept-progress">${lit ? '已點亮' : ''} 精通 ${s.known}／${s.total || '—'}</span></div>
      <p class="concept-def">${escapeHtml(c.definition)}</p>
      <p class="concept-tips">💡 ${escapeHtml(c.tips)}</p>
      ${renderSubtypeMap(c)}
      ${renderMetricalTables(c)}
      ${(c.examples || []).map((x) => `<div class="concept-ex">
        <span class="badge ${x.genre === '韻文' ? 'yun' : 'sanwen'}">${x.genre === '韻文' ? '韻' : '文'}</span>${escapeHtml(x.text)}
        <cite>${x.citation ? escapeHtml(x.citation) : '本站自編例句'}${x.note ? '｜' + escapeHtml(x.note) : ''}</cite>
      </div>`).join('')}
      ${renderDeepSections(c)}
    </article>`;
  }).join('');
  wireConceptReaders();
}

function renderLearningOutline(tab) {
  if (tab !== '修辭') return '';
  const stages = [
    { level: '國小', title: '先看懂大方向', detail: '8 種基礎修辭：譬喻、轉化、誇飾、排比、設問、類疊、摹寫、感嘆；先從生活語句找明顯線索。' },
    { level: '國中', title: '拆結構、分細類', detail: '保留國小基礎，再加入 10 種進階修辭；核心大類向下細分，例如譬喻分成明喻、暗喻、略喻、借喻。' },
    { level: '高中', title: '讀文言、辨複合效果', detail: '再加入互文、示現、錯綜、鑲嵌、藏詞、飛白、移覺，並處理多種修辭並用、文言省略與表達效果。' },
  ];
  return `<aside class="learning-outline" aria-label="修辭分級大綱">
    <div class="outline-head"><strong>修辭分級大綱</strong><span>從辨認大類，走到結構分析與文本效果</span></div>
    <div class="outline-stages">${stages.map((stage) => {
      const included = codexLevel === '全部' || SCHOOL_LEVEL_ORDER[stage.level] <= SCHOOL_LEVEL_ORDER[codexLevel];
      return `<section class="outline-stage${included ? ' included' : ''}${codexLevel === stage.level ? ' active' : ''}">
        <b>${stage.level}｜${stage.title}</b><p>${stage.detail}</p>
      </section>`;
    }).join('')}</div>
  </aside>`;
}

function renderSubtypeMap(c) {
  if (!Array.isArray(c.subtypes) || !c.subtypes.length) return '';
  const visible = c.subtypes.filter((subtype) => codexLevel === '全部'
    || SCHOOL_LEVEL_ORDER[subtype.level] <= SCHOOL_LEVEL_ORDER[codexLevel]);
  if (!visible.length) return '';
  return `<section class="subtype-map" aria-label="${escapeHtml(c.cat)}細分類">
    <div class="subtype-map-head"><strong>本階段細分類</strong><span>${visible.length} 類</span></div>
    <div class="subtype-grid">${visible.map((subtype) => `<article class="subtype-item">
      <div><b>${escapeHtml(subtype.name)}</b><span>${escapeHtml(subtype.level)}</span></div>
      <p>${escapeHtml(subtype.definition)}</p>
    </article>`).join('')}</div>
  </section>`;
}

function renderMetricalTables(c) {
  if (!Array.isArray(c.metricalTables) || !c.metricalTables.length) return '';
  const visible = c.metricalTables.filter((table) => codexLevel === '全部'
    || SCHOOL_LEVEL_ORDER[table.level] <= SCHOOL_LEVEL_ORDER[codexLevel]);
  if (!visible.length) return '';
  return `<section class="metrical-tables" aria-label="五言與七言絕句平仄格式表">
    <div class="metrical-head"><strong>基礎平仄表</strong><span>先判首句第二字，再看首句是否押韻</span></div>
    ${visible.map((table) => `<section class="metrical-family">
      <h4>${escapeHtml(table.title)}<span>${escapeHtml(table.level)}基礎</span></h4>
      <div class="metrical-grid">${table.rows.map((row) => `<article class="metrical-table" data-metrical-mode="${escapeHtml(row.name)}">
        <div class="metrical-mode"><b>${escapeHtml(row.name)}</b><span>${row.rhymeLines.includes(1) ? '首句入韻' : '首句不入韻'}</span></div>
        <ol class="metrical-lines">${row.lines.map((line, index) => `<li><span class="line-label">第 ${index + 1} 句</span><code>${escapeHtml(line)}</code>${row.rhymeLines.includes(index + 1) ? '<em class="rhyme-mark">韻</em>' : ''}</li>`).join('')}</ol>
      </article>`).join('')}</div>
    </section>`).join('')}
    <p class="metrical-note">「平起／仄起」看首句第二字；「入韻／不入韻」看首句末字是否與第二、四句同韻。表中標「韻」的是押韻句。</p>
  </section>`;
}

function renderDeepSections(c) {
  if (!Array.isArray(c.sections) || !c.sections.length) return '';
  const visibleSections = c.sections
    .map((section, index) => ({ ...section, originalIndex: index, level: section.level || c.level }))
    .filter((section) => codexLevel === '全部' || SCHOOL_LEVEL_ORDER[section.level] <= SCHOOL_LEVEL_ORDER[codexLevel]);
  if (!visibleSections.length) return '';
  const readingKey = `${c.zone}:${c.cat}`;
  const completed = new Set(loadReadingProgress()[readingKey] || []);
  const completedVisible = visibleSections.filter((section) => completed.has(section.originalIndex)).length;
  const percent = Math.round((completedVisible / visibleSections.length) * 100);
  const firstIncompleteIndex = visibleSections.findIndex((section) => !completed.has(section.originalIndex));
  const sources = (c.sources || []).map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>`).join('、');
  return `<details class="concept-deep">
    <summary>開始逐步解構（${visibleSections.length} 步）</summary>
    <div class="concept-reader" data-reading-key="${escapeHtml(readingKey)}">
      <div class="reading-progress" aria-live="polite">
        <div><strong>閱讀進度</strong><span class="reading-progress-text">${completedVisible}／${visibleSections.length} 步・${percent}%</span></div>
        <div class="reading-progress-bar" role="progressbar" aria-label="${escapeHtml(c.cat)}閱讀進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>
      </div>
      <p class="reader-hint">一次讀一個解構步驟；讀完按下按鈕，系統會記住位置並開啟下一步。</p>
      ${visibleSections.map((section, visibleIndex) => `<details class="concept-step${completed.has(section.originalIndex) ? ' completed' : ''}" ${visibleIndex === firstIncompleteIndex ? 'open' : ''}>
        <summary><span class="step-number">步驟 ${visibleIndex + 1}</span><span>${escapeHtml(section.title)}</span><span class="step-level">${escapeHtml(section.level)}</span></summary>
        <div class="concept-section">
          ${section.body ? `<p>${escapeHtml(section.body)}</p>` : ''}
          ${Array.isArray(section.points) ? `<ul>${section.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
          ${Array.isArray(section.patterns) ? `<div class="pattern-grid">${section.patterns.map((p) => `<div class="pattern-row"><code>${escapeHtml(p.name)}</code><span>${escapeHtml(p.form)}</span></div>`).join('')}</div>` : ''}
          <button class="step-complete" data-section-index="${section.originalIndex}" type="button" ${completed.has(section.originalIndex) ? 'disabled' : ''}>${completed.has(section.originalIndex) ? '✓ 已讀完' : '讀完這一步，前往下一步 →'}</button>
        </div>
      </details>`).join('')}
      ${sources ? `<p class="concept-sources">資料參考：${sources}</p>` : ''}
    </div>
  </details>`;
}

function loadReadingProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(READING_PROGRESS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }
  catch { return {}; }
}

function saveReadingProgress(progress) {
  try { localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(progress)); }
  catch { /* 無痕模式或儲存空間受限時，仍可繼續閱讀 */ }
}

function wireConceptReaders() {
  document.querySelectorAll('.concept-reader').forEach((reader) => {
    reader.querySelectorAll('.step-complete').forEach((button) => button.addEventListener('click', () => {
      const progress = loadReadingProgress();
      const key = reader.dataset.readingKey;
      const completed = new Set(progress[key] || []);
      completed.add(Number(button.dataset.sectionIndex));
      progress[key] = [...completed].sort((a, b) => a - b);
      saveReadingProgress(progress);

      const steps = [...reader.querySelectorAll('.concept-step')];
      const currentStep = button.closest('.concept-step');
      currentStep.classList.add('completed');
      button.disabled = true;
      button.textContent = '✓ 已讀完';
      const completedVisible = steps.filter((step) => step.classList.contains('completed')).length;
      const percent = Math.round((completedVisible / steps.length) * 100);
      reader.querySelector('.reading-progress-text').textContent = `${completedVisible}／${steps.length} 步・${percent}%`;
      const bar = reader.querySelector('.reading-progress-bar');
      bar.setAttribute('aria-valuenow', String(percent));
      bar.querySelector('i').style.width = `${percent}%`;

      const nextStep = steps.slice(steps.indexOf(currentStep) + 1).find((step) => !step.classList.contains('completed'));
      if (nextStep) {
        currentStep.open = false;
        nextStep.open = true;
        nextStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }));
  });
}

/* ---------- 弱點複習 ---------- */
function renderWeak() {
  const rows = getWeaknessSummary(ctx.meta).slice(0, 12);
  $('weak-list').innerHTML = rows.length
    ? rows.map((r) => `<div class="weak-row"><span>${r.zone}・${r.cat}｜答對率 ${(r.accuracy * 100).toFixed(0)}%（${r.correct}／${r.total}）</span>
        <div class="bar"><i style="width:${Math.max(4, r.accuracy * 100)}%"></i></div></div>`).join('')
    : '<p class="weak-empty">還沒有累積作答紀錄——先去練功，弱點雷達就會亮起來。</p>';
  $('btn-weak-train').disabled = getMostWrong(ctx.meta, fullBank, 15).length === 0;
}

function startWeakTraining() {
  const worst = getMostWrong(ctx.meta, fullBank, 15);
  if (!worst.length) return;
  startPractice(null, worst.map((w) => w.id));
}

/* ---------- 文心四靈 ---------- */
function renderPets() {
  $('pets-grid').innerHTML = PETS.map((p) => {
    const unlocked = isUnlocked(ctx.meta, p);
    const lv = petLevel(ctx.meta, p);
    const mastery = categoryMastery(ctx.meta, p.category);
    const nextAt = unlocked ? Math.min(MAX_LEVEL, lv + 1) * LEVEL_STEP : p.unlockAt;
    const pct = nextAt ? Math.min(100, (mastery / nextAt) * 100) : 100;
    const isActive = ctx.meta.pet.active === p.id;
    return `<div class="pet-card ${unlocked ? '' : 'locked'} ${isActive ? 'active-pet' : ''}" data-pet="${p.id}"
      role="button" tabindex="${unlocked ? 0 : -1}" aria-label="${p.name}">
      <div class="pet-icon">${unlocked
        ? `<span class="art-slot"><img src="assets/img/${p.id}.webp" alt="" loading="lazy" onerror="this.parentElement.textContent='${p.icon}'"></span>`
        : '❓'}</div>
      <div class="pet-name">${unlocked ? p.name : '？？？'}</div>
      <div class="pet-level">${unlocked ? `Lv.${lv}｜${p.category}` : `${p.category}精通 ${Math.floor(mastery)}／${p.unlockAt} 解鎖`}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="pet-line">${unlocked ? p.lines[bondStage(ctx.meta, p)].replace(/^[^：]+：/, '') : p.intro}</p>
      ${isActive ? '<small>👑 隨行中（對戰加成）</small>' : ''}
    </div>`;
  }).join('');
  document.querySelectorAll('.pet-card:not(.locked)').forEach((card) => {
    card.addEventListener('click', () => {
      ctx.meta.pet.active = card.dataset.pet;
      saveMeta(ctx.meta);
      renderPets();
      toast(`已選定隨行四靈`);
    });
  });
}

/* ---------- 工具 ---------- */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- 事件綁定 ---------- */
$('btn-home').addEventListener('click', () => { renderHome(); showScreen('screen-home'); });
document.querySelectorAll('.level-btn').forEach((b) => b.addEventListener('click', () => switchLevel(b.dataset.level)));
$('btn-practice').addEventListener('click', () => { $('practice-zones').hidden = false; $('quiz-panel').hidden = true; showScreen('screen-practice'); });
$('btn-codex').addEventListener('click', () => {
  codexLevel = SCHOOL_LEVEL_ORDER[getLevel()] ? getLevel() : '全部';
  showScreen('screen-codex');
  renderCodex('修辭');
});
$('btn-weak').addEventListener('click', () => { renderWeak(); showScreen('screen-weak'); });
$('btn-pets').addEventListener('click', () => { renderPets(); showScreen('screen-pets'); });
document.querySelectorAll('.zone-card').forEach((b) => b.addEventListener('click', () => startPractice(b.dataset.bank)));
$('btn-quiz-exit').addEventListener('click', exitPractice);
$('btn-next').addEventListener('click', nextQuestion);
$('btn-submit-multi').addEventListener('click', () => {
  if (quiz.multiPicks.size < 2) { toast('複選題至少要選兩個答案'); return; }
  submitAnswer([...quiz.multiPicks]);
});
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => renderCodex(b.dataset.tab)));
document.querySelectorAll('[data-concept-level]').forEach((b) => b.addEventListener('click', () => {
  codexLevel = b.dataset.conceptLevel;
  const activeTab = document.querySelector('.tab.active')?.dataset.tab || '修辭';
  renderCodex(activeTab);
}));
$('btn-weak-train').addEventListener('click', startWeakTraining);
$('btn-continue').addEventListener('click', () => { $('checkpoint-overlay').hidden = true; });
$('btn-rest').addEventListener('click', () => { $('checkpoint-overlay').hidden = true; exitPractice(); });

$('btn-battle').addEventListener('click', openBattleScreen);
$('btn-rt').addEventListener('click', openRtScreen);
const battleDeps = { getCtx: () => ctx, toast, renderEvents, renderHud, showScreen };
initBattleUI(battleDeps);
initRtUI(battleDeps);

const adventureDeps = {
  getCtx: () => ctx,
  getLevel,
  switchLevel,
  startPractice,
  showScreen,
  renderHome,
  toast,
};
initAdventureUI(adventureDeps);
$('btn-adventure').addEventListener('click', openAdventureScreen);

document.addEventListener('keydown', (ev) => {
  if (!quiz || $('quiz-panel').hidden) return;
  if (ev.key >= '1' && ev.key <= '5') {
    const btns = document.querySelectorAll('.opt-btn');
    const b = btns[Number(ev.key) - 1];
    if (b && !b.disabled) b.click();
  } else if (ev.key === 'Enter' && !$('quiz-feedback').hidden) {
    nextQuestion();
  }
});

boot();
