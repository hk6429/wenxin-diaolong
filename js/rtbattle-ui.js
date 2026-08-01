// 文友過招：單人電腦演武＋seeded 真人同題對戰。後端未部署時真人模式優雅降級。
import { getLevel, loadBank } from './bank.js';
import { WXAPI } from './meta/api.js';
import {
  applyComputerTurn, assassinSeed, buildComputerScript, buildQuestions,
  COMPUTER_ROUNDS, judge, POLL_MS, ROUNDS, DEAD_MS,
} from './meta/rtbattle.js';
import { onBattleAnswer, onBattleEnd } from './meta/kernel.js';
import { PETS, petLevel } from './meta/pet.js';

const $ = (id) => document.getElementById(id);
let deps = null;
let rt = null; // { code, role, token, seed, questions, qi, myDmg, myCorrect, combo, bestCombo, done, oppSnap, oppState, oppHb, pollTimer, ended }

const BASE_DMG = 10, COMBO_DMG = 15, COMBO_AT = 3, MY_HP = 100;

export function initRtUI(d) {
  deps = d;
  $('btn-rt-back').addEventListener('click', () => { teardown(); deps.showScreen('screen-home'); });
  $('btn-rt-computer').addEventListener('click', startComputerBattle);
  $('btn-rt-create').addEventListener('click', () => lobbyAction('create'));
  $('btn-rt-join').addEventListener('click', () => lobbyAction('join'));
}

async function startComputerBattle() {
  const status = $('rt-status');
  status.textContent = '墨靈書生正在展卷……';
  let entries;
  try { entries = await loadBank('mixed'); } catch { entries = []; }
  if (entries.length < 4) { status.textContent = '題庫尚未就緒'; return; }

  const level = rtLevel();
  const today = new Date().toLocaleDateString('sv-SE');
  const seed = assassinSeed(`${today}|${level}`);
  const computerSeed = assassinSeed(today);
  const my = mySnap();
  const aiLv = { '國小': 2, '國中': 4, '高中': 6, '實戰': 8 }[level] || 4;
  rt = {
    mode: 'computer', code: '', role: 'solo', token: '', seed, mySnap: my,
    questions: buildQuestions(seed, entries, COMPUTER_ROUNDS), qi: 0,
    myDmg: 0, myCorrect: 0, combo: 0, bestCombo: 0, done: false,
    oppSnap: { nick: '墨靈書生', petName: '玄龜', lv: aiLv },
    oppState: { dmg: 0, round: 0, combo: 0, correct: 0, done: 0 },
    computerScript: buildComputerScript(computerSeed, level, COMPUTER_ROUNDS),
    oppHb: Date.now(), pollTimer: null, turnTimer: null, ended: false,
  };
  $('rt-lobby').hidden = true;
  $('rt-arena').hidden = false;
  $('rt-arena-head').textContent = `單人演武・${level}難度・墨靈書生應戰`;
  renderRtQuestion();
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
    mode: 'online',
    code: kind === 'create' ? res.code : body.code,
    role: kind === 'create' ? 'p1' : 'p2',
    token: res.token, seed: res.seed, mySnap: body.snap,
    questions: null, qi: 0,
    myDmg: 0, myCorrect: 0, combo: 0, bestCombo: 0, done: false,
    oppSnap: kind === 'join' ? res.opp : null, oppState: null, oppHb: Date.now(),
    pollTimer: null, turnTimer: null, ended: false,
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
  if (!rt || rt.mode === 'computer') return;
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
    const total = rt.questions?.length || ROUNDS;
    const opponent = rt.mode === 'computer' ? '墨靈' : '對方';
    $('rt-progress').textContent = `你 ${rt.qi}／${total} 題・${opponent} ${rt.oppState?.round || 0}／${total} 題`;
    if ($('rt-round')) $('rt-round').textContent = `第 ${Math.min(rt.qi + 1, total)} 回合`;
    if ($('rt-combo-a')) $('rt-combo-a').textContent = `連擊 ${rt.combo}`;
    if ($('rt-combo-b')) $('rt-combo-b').textContent = `連擊 ${rt.oppState?.combo || 0}`;
  }
}

function renderRtQuestion() {
  const body = $('rt-body');
  if (rt.qi >= rt.questions.length) { rt.done = true; push(); checkEnd(true); return; }
  const q = rt.questions[rt.qi];
  if (!$('rt-hp-row')) {
    body.innerHTML = `
      <section class="rt-battle-board">
      <div class="rt-battle-visual">
        <img src="assets/img/rt-computer-arena.webp" alt="" aria-hidden="true" onerror="this.src='assets/img/home-duel.webp'">
        <div class="rt-round-banner"><small>${rt.mode === 'computer' ? '墨靈演武' : '文心過招'}</small><b id="rt-round">第 1 回合</b></div>
        <div class="duel-hp-row" id="rt-hp-row">
          <div class="duel-side rt-fighter rt-fighter-a"><span>${escapeHtml(rt.mySnap?.nick || '無名文士')}</span><small class="rt-loadout">${escapeHtml(rt.mySnap?.petName || '墨靈')}・境界 ${rt.mySnap?.lv || 1}</small><div class="rt-statline"><b>文氣 <em id="rt-hp-a"></em></b><small id="rt-combo-a">連擊 0</small></div><div class="bar hp-a"><i></i></div><div class="rt-skills"><b>你的招式</b><span>識義・答對造成 10 點</span><span>連珠・三連後造成 15 點</span></div></div>
          <div class="duel-vs"><span>文</span><small>VS</small></div>
          <div class="duel-side rt-fighter rt-fighter-b"><span>${escapeHtml(rt.oppSnap?.nick || '對手')}</span><small class="rt-loadout">${escapeHtml(rt.oppSnap?.petName || '墨靈')}・境界 ${rt.oppSnap?.lv || 1}</small><div class="rt-statline"><b>文氣 <em id="rt-hp-b"></em></b><small id="rt-combo-b">連擊 0</small></div><div class="bar hp-b"><i></i></div><div class="rt-skills"><b>${rt.mode === 'computer' ? '墨靈招式' : '對手招式'}</b><span>觀文・答對造成 ${rt.mode === 'computer' ? '8' : '10'} 點</span><span>破句・三連後造成 ${rt.mode === 'computer' ? '12' : '15'} 點</span></div></div>
        </div>
        <div class="rt-terrain"><b>戰場・書院山門</b><span>同題交鋒</span><span>文氣歸零者敗</span></div>
        <div class="rt-battle-rules"><span>你先出招・墨靈後應招</span><span>答錯斷連擊・三連發動強招</span><span>${rt.questions.length} 回合後以文氣判勝負</span></div>
      </div>
      <p id="rt-action-log" class="rt-action-log" aria-live="polite">輪到你出招</p>
      <p id="rt-progress" class="home-today"></p>
      <article class="quiz-card rt-quiz-card">
        <p class="quiz-tag" id="rt-tag"></p>
        <div class="quiz-question" id="rt-question"></div>
        <div class="quiz-options" id="rt-options" role="group" aria-label="選項"></div>
      </article>
      </section>`;
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
  const damageBefore = rt.myDmg;
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
  renderRtHp();
  if (rt.mode === 'computer') {
    const dealt = rt.myDmg - damageBefore;
    $('rt-action-log').textContent = correct
      ? `你的「${rt.combo >= COMBO_AT ? '連珠' : '識義'}」命中，墨靈文氣 −${dealt}；墨靈正在應招……`
      : '你的判斷未中，連擊中斷；墨靈正在應招……';
    if (oppHp() <= 0) { checkEnd(); return; }
    const currentBattle = rt;
    rt.turnTimer = setTimeout(() => resolveComputerTurn(currentBattle), 900);
    return;
  }
  push();
  if (!checkEnd()) rt.turnTimer = setTimeout(renderRtQuestion, 1200);
}

function resolveComputerTurn(currentBattle) {
  if (!rt || rt !== currentBattle || rt.ended) return;
  const damageBefore = rt.oppState?.dmg || 0;
  const computerCorrect = !!rt.computerScript[rt.qi - 1];
  rt.oppState = applyComputerTurn(rt.oppState, computerCorrect);
  rt.oppState.done = rt.qi >= rt.questions.length ? 1 : 0;
  renderRtHp();
  const dealt = rt.oppState.dmg - damageBefore;
  $('rt-action-log').textContent = computerCorrect
    ? `墨靈以「${rt.oppState.combo >= 3 ? '破句' : '觀文'}」反擊，你的文氣 −${dealt}`
    : '墨靈判讀失誤，反擊落空；你的文氣不變';
  if (!checkEnd()) rt.turnTimer = setTimeout(renderRtQuestion, 900);
}

function checkEnd(force = false) {
  if (!rt || rt.ended) return true;
  const total = rt.questions?.length || ROUNDS;
  let verdict;
  if (rt.mode === 'computer') {
    const finished = myHp() <= 0 || oppHp() <= 0 || rt.qi >= total;
    verdict = finished ? (myHp() > oppHp() ? 'win' : myHp() < oppHp() ? 'lose' : 'draw') : null;
  } else {
    verdict = judge({
      myHp: myHp(), oppHp: oppHp(),
      myDone: rt.done || rt.qi >= total,
      oppDone: !!rt.oppState?.done,
      oppHbAgeMs: rt.oppSnap ? Date.now() - (rt.oppHb || 0) : 0,
    });
  }
  if (verdict === null && !force) return false;
  if (verdict === null) return false;
  rt.ended = true;
  clearTimeout(rt.pollTimer);
  const kctx = deps.getCtx();
  const endEvents = onBattleEnd(kctx, { won: verdict === 'win', bestCombo: rt.bestCombo, perfect: rt.myCorrect === total });
  if (Array.isArray(endEvents?.events)) deps.renderEvents(endEvents.events);
  deps.renderHud();
  const label = verdict === 'win' ? '你贏了！' : verdict === 'lose' ? '敗北……再練練' : '平手！';
  const opponentResult = rt.mode === 'computer' ? `；墨靈答對 ${rt.oppState?.correct || 0} 題` : '';
  $('rt-body').innerHTML = `<div class="duel-intro">
    <div class="rt-verdict-seal">${verdict === 'win' ? '勝' : verdict === 'draw' ? '和' : '惜敗'}</div>
    <h3>${label}</h3>
    <p class="duel-line">你答對 ${rt.myCorrect} 題，輸出 ${rt.myDmg} 傷害${opponentResult}${verdict === 'win' ? '，墨珠 +20' : ''}</p>
    <div class="overlay-actions"><button class="primary-btn" id="btn-rt-again">回大廳</button></div>
  </div>`;
  $('btn-rt-again').addEventListener('click', openRtScreen);
  return true;
}

function teardown() {
  if (rt?.pollTimer) clearTimeout(rt.pollTimer);
  if (rt?.turnTimer) clearTimeout(rt.turnTimer);
  rt = null;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
