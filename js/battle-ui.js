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
    <section class="master-battle-board">
    <div class="master-battle-visual">
      <img src="assets/img/rt-computer-arena.webp" alt="${escapeHtml(deps.getPlayerName?.() || '你')}與${escapeHtml(master.name.split('・').pop())}在書院山門以文會武" onerror="this.src='assets/img/home-duel.webp'">
      <div class="master-round-banner"><small>文心試煉・${escapeHtml(master.specialty)}</small><b id="duel-round">第 1 回合</b><span id="duel-phase">輪到你出招</span></div>
      <div class="duel-hp-row" id="master-hp-row">
        <div class="duel-side master-fighter master-fighter-a"><span>${escapeHtml(deps.getPlayerName?.() || '你')}</span><small class="rt-loadout">文心門生・境界試煉</small><div class="rt-statline"><b>文氣 <em id="hp-a-num"></em></b><small id="duel-combo" class="master-combo" hidden></small></div><div class="bar hp-a"><i></i></div><div class="rt-skills"><b>你的招式</b><span>識義・答對造成 10 點</span><span>連珠・三連後造成 15 點</span></div></div>
        <div class="duel-vs"><span>文</span><small>VS</small></div>
        <div class="duel-side master-fighter master-fighter-b"><img class="master-fighter-avatar" src="assets/img/${master.id}.webp" alt="" onerror="this.hidden=true"><span>${escapeHtml(master.name.split('・').pop())}</span><small class="rt-loadout">${escapeHtml(master.specialty)}・大師應戰</small><div class="rt-statline"><b>文氣 <em id="hp-b-num"></em></b><small>反擊 ${master.atk} 點</small></div><div class="bar hp-b"><i></i></div><div class="rt-skills"><b>大師招式</b><span>破綻・答錯立即反擊</span><span>守關・文氣歸零方落敗</span></div></div>
      </div>
      <div class="master-battle-rules"><span>你先出招・大師後應招</span><span>答錯受反擊・三連發動強招</span><span>文氣歸零即分勝負</span></div>
    </div>
    <p id="duel-action-log" class="rt-action-log player-turn" aria-live="polite">輪到你出招</p>
    <p id="duel-progress" class="home-today"></p>
    <article class="quiz-card rt-quiz-card">
      <p class="quiz-tag" id="duel-tag"></p>
      <div class="quiz-question" id="duel-question"></div>
      <div class="quiz-options" id="duel-options" role="group" aria-label="選項"></div>
      <p class="duel-feedback" id="duel-feedback" hidden></p>
    </article>
    </section>`;
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
  if ($('duel-round')) $('duel-round').textContent = `第 ${battle.qi} 回合`;
  if ($('duel-phase')) $('duel-phase').textContent = '輪到你出招';
  if ($('duel-progress')) $('duel-progress').textContent = `已出招 ${battle.qi} 次・最佳連擊 ${battle.bestCombo}`;
  if ($('duel-action-log')) {
    $('duel-action-log').className = 'rt-action-log player-turn';
    $('duel-action-log').textContent = '輪到你出招';
  }
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
  const beforeHpB = battle.state.hpB;
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
    if ($('duel-action-log')) {
      $('duel-action-log').className = 'rt-action-log computer-turn';
      $('duel-action-log').textContent = `${battle.master.name.split('・').pop()}看破破綻，反擊 ${dmg} 點文氣`;
    }
    if ($('duel-phase')) $('duel-phase').textContent = '大師反擊';
  } else {
    const dmg = Math.max(0, Math.round(beforeHpB - battle.state.hpB));
    fb.textContent = `好招！你削減了大師 ${dmg} 點文氣。`;
    if ($('duel-action-log')) $('duel-action-log').textContent = `招式命中，削減 ${dmg} 點文氣`;
    if ($('duel-phase')) $('duel-phase').textContent = '招式命中';
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
