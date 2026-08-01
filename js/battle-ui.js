// PvE 文心試煉：大師名單→對話→戰鬥→勝負。戰鬥邏輯全走 battle-adapter，本檔零機制。
import { loadBank } from './bank.js';
import { masterUnlocked, masterProgress, masterStrike, recordMasterWin, beatenCount } from './meta/masters.js';
import {
  createBattleContext, createBattleStateEx, applyAnswerEx, isOverEx,
} from './meta/battle-adapter.js';
import { battleMods } from './meta/pet.js';
import { onBattleAnswer, onBattleEnd } from './meta/kernel.js';
import { saveMeta } from './meta/store.js';
import { shuffle } from './shuffle.js';

const $ = (id) => document.getElementById(id);
let deps = null;      // { getCtx, toast, renderEvents, renderHud, showScreen }
let masters = [];
let battle = null;    // { master, bctx, state, queue, qi, current, maxHpB, ended, timer }

const AUTO_NEXT_MS = 2500;

// 立繪：有 assets/img/<id>.webp 用圖，載入失敗回退 emoji（美術可分批補齊）
function artHtml(id, emoji, cls) {
  return `<span class="${cls} art-slot"><img src="assets/img/${id}.webp" alt="" loading="lazy"
    onerror="this.parentElement.textContent='${emoji}'"></span>`;
}

export async function initBattleUI(d) {
  deps = d;
  try {
    const r = await fetch('data/masters.json');
    masters = r.ok ? await r.json() : [];
  } catch { masters = []; }
  $('btn-battle-back').addEventListener('click', () => { stopAuto(); deps.showScreen('screen-home'); });
  $('btn-duel-flee').addEventListener('click', () => { stopAuto(); renderRoster(); });
}

export function openBattleScreen() {
  renderRoster();
  deps.showScreen('screen-battle');
}

/* ---------- 大師名單 ---------- */
function renderRoster() {
  stopAuto();
  $('duel-panel').hidden = true;
  $('master-roster').hidden = false;
  const meta = deps.getCtx().meta;
  $('battle-beaten').textContent = `已破關 ${beatenCount(meta)}／${masters.length} 位大師`;
  $('master-grid').innerHTML = masters.map((m) => {
    const unlocked = masterUnlocked(meta, m);
    const wins = meta.pvpMasters?.[m.id]?.wins || 0;
    const prog = masterProgress(meta, m);
    return `<button class="master-card ${unlocked ? '' : 'locked'}" data-master="${m.id}" ${unlocked ? '' : 'disabled'}>
      ${unlocked ? artHtml(m.id, m.icon, 'master-icon') : '<span class="master-icon">🌑</span>'}
      <span class="master-name">${unlocked ? m.name : '？？？'}</span>
      <span class="master-spec">${m.specialty}</span>
      ${unlocked
        ? (wins > 0 ? `<span class="master-badge">🏆 已破關・勝 ${wins} 場</span>` : '<span class="master-badge new">可挑戰</span>')
        : `<span class="master-badge">${m.unlockZone}精通 ${prog.have}／${prog.need} 解鎖</span>`}
    </button>`;
  }).join('');
  document.querySelectorAll('.master-card:not(.locked)').forEach((b) =>
    b.addEventListener('click', () => showIntro(masters.find((m) => m.id === b.dataset.master))));
}

function showIntro(master) {
  $('master-roster').hidden = true;
  $('duel-panel').hidden = false;
  $('duel-stage').innerHTML = `<div class="duel-intro">
    <div class="duel-portrait">${artHtml(master.id, master.icon, 'duel-portrait-art')}</div>
    <h3>${master.name}</h3>
    <p class="duel-line">${escapeHtml(master.intro)}</p>
    <p class="duel-taunt">「${escapeHtml(master.taunt)}」</p>
    <div class="overlay-actions">
      <button class="ghost-btn" id="btn-duel-cancel">改天再戰</button>
      <button class="primary-btn" id="btn-duel-start">開戰！</button>
    </div>
  </div>`;
  $('btn-duel-cancel').addEventListener('click', renderRoster);
  $('btn-duel-start').addEventListener('click', () => startBattle(master));
}

/* ---------- 戰鬥 ---------- */
async function startBattle(master) {
  const kctx = deps.getCtx();
  let entries;
  try { entries = await loadBank(master.bankKey); } catch { entries = []; }
  if (!entries.length) { deps.toast('這位大師的題庫還沒就緒'); renderRoster(); return; }
  const bctx = createBattleContext(kctx.meta, battleMods(kctx.meta));
  battle = {
    master,
    bctx,
    state: createBattleStateEx(bctx),
    queue: shuffle(entries.slice()),
    qi: 0,
    current: null,
    bestCombo: 0,
    misses: 0,
    ended: false,
    timer: null,
  };
  $('duel-stage').innerHTML = `
    <div class="duel-hp-row">
      <div class="duel-side"><span>你</span><div class="bar hp-a"><i></i></div><b id="hp-a-num"></b></div>
      <div class="duel-vs">⚔️</div>
      <div class="duel-side"><span>${master.icon} ${master.name.split('・').pop()}</span><div class="bar hp-b"><i></i></div><b id="hp-b-num"></b></div>
    </div>
    <p id="duel-combo" class="combo" hidden></p>
    <article class="quiz-card">
      <p class="quiz-tag" id="duel-tag"></p>
      <div class="quiz-question" id="duel-question"></div>
      <div class="quiz-options" id="duel-options" role="group" aria-label="選項"></div>
      <p class="duel-feedback" id="duel-feedback" hidden></p>
    </article>`;
  renderHp();
  nextDuelQuestion();
}

function renderHp() {
  const { state, bctx, master } = battle;
  const maxA = bctx.mods.maxHp;
  // adapter 內部 100 制；顯示端依 master.hp 比例換算
  const shownB = Math.round((state.hpB / 100) * master.hp);
  document.querySelector('.hp-a > i').style.width = `${(state.hpA / maxA) * 100}%`;
  document.querySelector('.hp-b > i').style.width = `${state.hpB}%`;
  $('hp-a-num').textContent = `${Math.max(0, Math.round(state.hpA))}／${maxA}`;
  $('hp-b-num').textContent = `${Math.max(0, shownB)}／${master.hp}`;
  const combo = $('duel-combo');
  combo.hidden = state.comboA < 2;
  combo.textContent = `連對 ×${state.comboA}`;
}

function nextDuelQuestion() {
  if (battle.ended) return;
  if (battle.qi >= battle.queue.length) battle.qi = 0; // 題庫循環
  const e = battle.queue[battle.qi++];
  battle.current = e;
  $('duel-tag').innerHTML = `<span class="zone-chip z-${e.zone}">${e.zone}</span>${e.cat}`;
  $('duel-question').textContent = e.question;
  $('duel-feedback').hidden = true;
  const box = $('duel-options');
  box.innerHTML = '';
  e.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.dataset.opt = opt;
    b.innerHTML = `<span class="kbd">${i + 1}</span><span>${escapeHtml(opt)}</span>`;
    b.addEventListener('click', () => answerDuel(opt));
    box.appendChild(b);
  });
}

function answerDuel(picked) {
  if (battle.ended || !$('duel-feedback').hidden) return;
  const e = battle.current;
  const answers = Array.isArray(e.answer) ? e.answer : [e.answer];
  const correct = answers.includes(picked) && answers.length === 1;

  document.querySelectorAll('#duel-options .opt-btn').forEach((b) => {
    b.disabled = true;
    if (answers.includes(b.dataset.opt)) b.classList.add('correct');
    else if (b.dataset.opt === picked) b.classList.add('wrong');
  });

  // 玩家出招
  const r = applyAnswerEx(battle.state, 'A', correct, battle.bctx);
  battle.state = r.state; battle.bctx = r.ctx;
  for (const ev of r.events) { const label = evLabel(ev); if (label) deps.toast(label); }
  battle.bestCombo = Math.max(battle.bestCombo, battle.state.comboA);

  // 學習數據照記
  const kctx = deps.getCtx();
  const { events } = onBattleAnswer(kctx, e.id, correct);
  deps.renderEvents(events);
  deps.renderHud();

  // 答錯→大師出招（直接扣玩家血，不走 applyAnswer 的 B 方連對制，難度由 atk 控制）
  const fb = $('duel-feedback');
  if (!correct) {
    battle.misses += 1;
    const dmg = masterStrike(battle.master, battle.state.hpA);
    battle.state = { ...battle.state, hpA: Math.max(0, battle.state.hpA - dmg) };
    fb.textContent = `正解：${answers.join('、')}　${battle.master.icon} 大師出招，你受了 ${dmg} 點傷！`;
  } else {
    fb.textContent = '好招！';
  }
  fb.hidden = false;
  renderHp();

  if (battle.state.hpA <= 0 || isOverEx(battle.state, battle.bctx)) { endBattle(); return; }
  battle.timer = setTimeout(nextDuelQuestion, AUTO_NEXT_MS);
}

function endBattle() {
  battle.ended = true;
  stopAuto();
  const won = battle.state.hpB <= 0 && battle.state.hpA > 0;
  const kctx = deps.getCtx();
  let firstWin = false;
  if (won) {
    firstWin = recordMasterWin(kctx.meta, battle.master.id);
    saveMeta(kctx.meta);
  }
  const endEvents = onBattleEnd(kctx, { won, bestCombo: battle.bestCombo, perfect: won && battle.misses === 0 });
  deps.renderHud();
  const m = battle.master;
  $('duel-stage').innerHTML = `<div class="duel-intro">
    <div class="duel-portrait">${won ? '🏆' : artHtml(m.id, m.icon, 'duel-portrait-art')}</div>
    <h3>${won ? '勝！' : '敗北……'}</h3>
    <p class="duel-line">「${escapeHtml(won ? m.winLine : m.loseLine)}」</p>
    ${firstWin ? '<p class="duel-taunt">🎉 首次破關！名單上多了一枚徽章。</p>' : ''}
    ${won ? '<p class="duel-line">戰利品：墨珠 +20</p>' : ''}
    <div class="overlay-actions">
      <button class="ghost-btn" id="btn-duel-roster">回名單</button>
      <button class="primary-btn" id="btn-duel-again">再戰一場</button>
    </div>
  </div>`;
  if (Array.isArray(endEvents?.events)) deps.renderEvents(endEvents.events);
  $('btn-duel-roster').addEventListener('click', renderRoster);
  $('btn-duel-again').addEventListener('click', () => startBattle(m));
}

function stopAuto() { if (battle?.timer) { clearTimeout(battle.timer); battle.timer = null; } }

function evLabel(ev) {
  switch (ev.type) {
    case 'doubleDamage': return `💥 雙倍墨勁！造成 ${ev.payload.dmg} 傷害`;
    case 'burst': return `🌊 ${ev.payload.gear}爆發，追加 ${ev.payload.dmg} 傷害！`;
    case 'comboShielded': return `🛡️ ${ev.payload.name}護住了連對`;
    case 'charmTriggered': return `✨ ${ev.payload.name}：${ev.payload.message}`;
    case 'reflect': return `🖋️ ${ev.payload.gear}反擊 ${ev.payload.dmg} 點`;
    case 'artReady': return '🖌️ 墨氣已滿，文訣可發動！';
    default: return '';
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
