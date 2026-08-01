// PvP 文友過招：seeded 同題對戰＋輪詢。後端未部署（WXAPI 回 null）時優雅降級。
import { getLevel, loadBank } from './bank.js';
import { WXAPI } from './meta/api.js';
import { buildQuestions, judge, POLL_MS, ROUNDS, DEAD_MS } from './meta/rtbattle.js';
import { onBattleAnswer, onBattleEnd } from './meta/kernel.js';
import { PETS, petLevel } from './meta/pet.js';

const $ = (id) => document.getElementById(id);
let deps = null;
let rt = null; // { code, role, token, seed, questions, qi, myDmg, myCorrect, combo, bestCombo, done, oppSnap, oppState, oppHb, pollTimer, ended }

const BASE_DMG = 10, COMBO_DMG = 15, COMBO_AT = 3, MY_HP = 100;

export function initRtUI(d) {
  deps = d;
  $('btn-rt-back').addEventListener('click', () => { teardown(); deps.showScreen('screen-home'); });
  $('btn-rt-create').addEventListener('click', () => lobbyAction('create'));
  $('btn-rt-join').addEventListener('click', () => lobbyAction('join'));
}

export function openRtScreen() {
  teardown();
  $('rt-lobby').hidden = false;
  $('rt-arena').hidden = true;
  $('rt-status').textContent = '';
  deps.showScreen('screen-rt');
}

function mySnap() {
  const meta = deps.getCtx().meta;
  const nick = ($('rt-nick').value || '').trim() || '無名文士';
  const pet = PETS.find((p) => p.id === meta.pet?.active);
  return {
    nick: nick.slice(0, 12),
    petId: pet?.id || '', petName: pet?.name || '墨靈',
    lv: pet ? Math.max(1, petLevel(meta, pet)) : 1, hp: 200,
    scope: { bank: 'mixed', level: rtLevel(), difficulty: 'all' },
  };
}

// 後端 OK_LEVEL 沿用學段；實戰對戰題量足夠也開放
function rtLevel() { return getLevel(); }

async function lobbyAction(kind) {
  const status = $('rt-status');
  status.textContent = '連線中……';
  const body = { op: kind, snap: mySnap() };
  if (kind === 'join') {
    const code = ($('rt-code').value || '').trim();
    if (!/^\d{4}$/.test(code)) { status.textContent = '請輸入 4 位數房號'; return; }
    body.code = code;
  }
  const res = await WXAPI.call('/api/rt-room', { body });
  if (!res) { status.textContent = '線上對戰建置中，請先挑戰「文心試煉」的大師們！'; return; }
  if (res.error || res.ok === 0) { status.textContent = res.error || '連線失敗，再試一次'; return; }

  rt = {
    code: kind === 'create' ? res.code : body.code,
    role: kind === 'create' ? 'p1' : 'p2',
    token: res.token, seed: res.seed,
    questions: null, qi: 0,
    myDmg: 0, myCorrect: 0, combo: 0, bestCombo: 0, done: false,
    oppSnap: kind === 'join' ? res.opp : null, oppState: null, oppHb: Date.now(),
    pollTimer: null, ended: false,
  };
  let entries;
  try { entries = await loadBank('mixed'); } catch { entries = []; }
  if (entries.length < 4) { status.textContent = '題庫尚未就緒'; teardown(); return; }
  rt.questions = buildQuestions(rt.seed, entries, ROUNDS);

  $('rt-lobby').hidden = true;
  $('rt-arena').hidden = false;
  if (kind === 'create') {
    $('rt-arena-head').innerHTML = `房號 <b class="rt-code">${rt.code}</b>　把房號告訴對手，等待加入……`;
  } else {
    $('rt-arena-head').textContent = `對手：${rt.oppSnap?.nick || '？'}　開打！`;
    renderRtQuestion();
  }
  startPolling();
}

function startPolling() {
  const tick = async () => {
    if (!rt || rt.ended) return;
    const res = await WXAPI.call('/api/rt-room', { body: { op: 'poll', code: rt.code, role: rt.role, token: rt.token } });
    if (res?.ok && res.opp) {
      if (!rt.oppSnap) { // 房主等到人了
        rt.oppSnap = res.opp.snap;
        $('rt-arena-head').textContent = `對手：${rt.oppSnap.nick}　開打！`;
        renderRtQuestion();
      }
      rt.oppState = res.opp.state;
      rt.oppHb = res.opp.hb;
      renderRtHp();
      checkEnd();
    }
    if (rt && !rt.ended) rt.pollTimer = setTimeout(tick, POLL_MS);
  };
  rt.pollTimer = setTimeout(tick, POLL_MS);
}

async function push() {
  await WXAPI.call('/api/rt-room', {
    body: {
      op: 'push', code: rt.code, role: rt.role, token: rt.token,
      state: { dmg: rt.myDmg, round: rt.qi, combo: rt.combo, correct: rt.myCorrect, done: rt.done ? 1 : 0 },
    },
  });
}

function myHp() { return Math.max(0, MY_HP - (rt.oppState?.dmg || 0)); }
function oppHp() { return Math.max(0, MY_HP - rt.myDmg); }

function renderRtHp() {
  if ($('rt-hp-row')) {
    document.querySelector('#rt-hp-row .hp-a > i').style.width = `${myHp()}%`;
    document.querySelector('#rt-hp-row .hp-b > i').style.width = `${oppHp()}%`;
    $('rt-hp-a').textContent = myHp();
    $('rt-hp-b').textContent = oppHp();
    $('rt-progress').textContent = `你 ${rt.qi}／${ROUNDS} 題・對方 ${rt.oppState?.round || 0}／${ROUNDS} 題`;
  }
}

function renderRtQuestion() {
  const body = $('rt-body');
  if (rt.qi >= rt.questions.length) { rt.done = true; push(); checkEnd(true); return; }
  const q = rt.questions[rt.qi];
  if (!$('rt-hp-row')) {
    body.innerHTML = `
      <div class="duel-hp-row" id="rt-hp-row">
        <div class="duel-side"><span>你</span><div class="bar hp-a"><i></i></div><b id="rt-hp-a"></b></div>
        <div class="duel-vs">⚔️</div>
        <div class="duel-side"><span>${escapeHtml(rt.oppSnap?.nick || '對手')}</span><div class="bar hp-b"><i></i></div><b id="rt-hp-b"></b></div>
      </div>
      <p id="rt-progress" class="home-today"></p>
      <article class="quiz-card">
        <p class="quiz-tag" id="rt-tag"></p>
        <div class="quiz-question" id="rt-question"></div>
        <div class="quiz-options" id="rt-options" role="group" aria-label="選項"></div>
      </article>`;
  }
  $('rt-tag').textContent = `第 ${rt.qi + 1} 題`;
  $('rt-question').textContent = q.question;
  const box = $('rt-options');
  box.innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.dataset.opt = opt;
    b.innerHTML = `<span class="kbd">${i + 1}</span><span>${escapeHtml(opt)}</span>`;
    b.addEventListener('click', () => answerRt(q, opt));
    box.appendChild(b);
  });
  renderRtHp();
}

function answerRt(q, picked) {
  const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
  const correct = answers.includes(picked) && answers.length === 1;
  document.querySelectorAll('#rt-options .opt-btn').forEach((b) => {
    b.disabled = true;
    if (answers.includes(b.dataset.opt)) b.classList.add('correct');
    else if (b.dataset.opt === picked) b.classList.add('wrong');
  });
  if (correct) {
    rt.combo += 1;
    rt.bestCombo = Math.max(rt.bestCombo, rt.combo);
    rt.myCorrect += 1;
    rt.myDmg += rt.combo >= COMBO_AT ? COMBO_DMG : BASE_DMG;
  } else {
    rt.combo = 0;
  }
  rt.qi += 1;
  const kctx = deps.getCtx();
  const { events } = onBattleAnswer(kctx, q.id, correct);
  deps.renderEvents(events);
  deps.renderHud();
  push();
  renderRtHp();
  if (!checkEnd()) setTimeout(renderRtQuestion, 1200);
}

function checkEnd(force = false) {
  if (!rt || rt.ended) return true;
  const verdict = judge({
    myHp: myHp(), oppHp: oppHp(),
    myDone: rt.done || rt.qi >= ROUNDS,
    oppDone: !!rt.oppState?.done,
    oppHbAgeMs: rt.oppSnap ? Date.now() - (rt.oppHb || 0) : 0, // 還沒對手前不算斷線
  });
  if (verdict === null && !force) return false;
  if (verdict === null) return false;
  rt.ended = true;
  clearTimeout(rt.pollTimer);
  const kctx = deps.getCtx();
  const endEvents = onBattleEnd(kctx, { won: verdict === 'win', bestCombo: rt.bestCombo, perfect: rt.myCorrect === ROUNDS });
  if (Array.isArray(endEvents?.events)) deps.renderEvents(endEvents.events);
  deps.renderHud();
  const label = verdict === 'win' ? '🏆 你贏了！' : verdict === 'lose' ? '敗北……再練練' : '平手！';
  $('rt-body').innerHTML = `<div class="duel-intro">
    <div class="duel-portrait">${verdict === 'win' ? '🏆' : verdict === 'draw' ? '🤝' : '📜'}</div>
    <h3>${label}</h3>
    <p class="duel-line">你答對 ${rt.myCorrect} 題，輸出 ${rt.myDmg} 傷害${verdict === 'win' ? '，墨珠 +20' : ''}</p>
    <div class="overlay-actions"><button class="primary-btn" id="btn-rt-again">回大廳</button></div>
  </div>`;
  $('btn-rt-again').addEventListener('click', openRtScreen);
  return true;
}

function teardown() {
  if (rt?.pollTimer) clearTimeout(rt.pollTimer);
  rt = null;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
