// 文心任務臺：把遊戲化建議轉成可操作、可停止、不懲罰的首頁介面。

const PREF_KEY = 'wxdl_gamification_prefs_v1';
let actions = {};
let latestView = null;

function readPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return {
      sessionSize: [5, 10, 15].includes(parsed.sessionSize) ? parsed.sessionSize : 5,
      dailyLimit: [0, 20, 40].includes(parsed.dailyLimit) ? parsed.dailyLimit : 0,
      calm: Boolean(parsed.calm),
    };
  } catch { return { sessionSize: 5, dailyLimit: 0, calm: false }; }
}

function savePrefs(prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
}

function applyCalm(calm) {
  document.documentElement.classList.toggle('calm-mode', calm);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function initGamificationUI(callbacks) {
  actions = callbacks || {};
  const prefs = readPrefs();
  applyCalm(prefs.calm);
  document.getElementById('gamification-hub')?.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.sessionSize) {
      const next = { ...readPrefs(), sessionSize: Number(button.dataset.sessionSize) };
      savePrefs(next);
      renderGamificationHub(latestView);
    } else if (button.dataset.dailyLimit !== undefined) {
      const next = { ...readPrefs(), dailyLimit: Number(button.dataset.dailyLimit) };
      savePrefs(next);
      actions.refresh?.();
    } else if (button.dataset.gameAction === 'adventure') actions.adventure?.();
    else if (button.dataset.gameAction === 'weak') actions.weak?.();
    else if (button.dataset.gameAction === 'practice') {
      const zone = latestView?.recommendedZone?.zone || '修辭';
      actions.practice?.(zone, readPrefs().sessionSize);
    } else if (button.dataset.gameAction === 'calm') {
      const next = { ...readPrefs(), calm: !readPrefs().calm };
      savePrefs(next);
      applyCalm(next.calm);
      renderGamificationHub(latestView);
    }
  });
}

export function renderGamificationHub(view) {
  latestView = view;
  const root = document.getElementById('gamification-hub');
  if (!root || !view) return;
  const prefs = readPrefs();
  applyCalm(prefs.calm);
  const compass = view.masteryCompass.map((item) => `<div><span>${item.zone}</span><b>${item.pct}%</b><i><em style="width:${item.pct}%"></em></i></div>`).join('');
  const retentionItems = view.retention ? Object.values(view.retention) : [];
  root.innerHTML = `
    <div class="game-hub-head"><div><small>TODAY'S QUEST</small><h2>今日文心任務</h2></div><button type="button" class="calm-toggle" data-interface-id="U09" data-game-action="calm" aria-pressed="${prefs.calm}">${prefs.calm ? '靜心中' : '開啟靜心'}</button></div>
    <div class="game-mission" data-interface-id="U01"><div><b>${escapeHtml(view.mission.title)}</b><span>${escapeHtml(view.mission.detail)}</span></div><strong>${view.nextMilestone.current}%</strong></div>
    <div class="game-quick-actions">
      <button type="button" data-interface-id="U02" data-game-action="adventure"><small>主線</small><b>${escapeHtml(view.continueAdventure.label)}</b><span>從書籤繼續，不重跑內容</span></button>
      <button type="button" data-interface-id="U05" data-game-action="practice"><small>推薦練功</small><b>${escapeHtml(view.recommendedZone.zone)}・${prefs.sessionSize} 題</b><span>${escapeHtml(view.recommendedZone.reason)}</span></button>
      <button type="button" data-interface-id="U03" data-game-action="weak"><small>修補破綻</small><b>${escapeHtml(view.weaknessShortcut.label)}</b><span>只練需要複習的內容</span></button>
    </div>
    <div class="game-session-row" data-interface-id="U04"><span>這一回合想練多久？</span><div>${view.sessionChoices.map((item) => `<button type="button" data-session-size="${item.count}" class="${prefs.sessionSize === item.count ? 'active' : ''}">${item.label}<small>約 ${item.minutes} 分</small></button>`).join('')}</div></div>
    <div class="game-compass" data-interface-id="U07" aria-label="三區精熟羅盤">${compass}</div>
    <div class="game-hub-foot"><span data-interface-id="U08">下一個旅程碑：${view.nextMilestone.target}%（還差 ${view.nextMilestone.remaining}%）</span><span data-interface-id="U06">${escapeHtml(view.rewardPreview.five)}</span></div>
    <p class="game-autonomy" data-interface-id="U10">${escapeHtml(view.autonomy.message)}</p>
    ${retentionItems.length ? `<details class="healthy-play"><summary>健康練習與收卷提醒</summary>
      <div class="daily-limit"><span>每日學習界線</span>${[0,20,40].map((limit) => `<button type="button" data-daily-limit="${limit}" class="${prefs.dailyLimit === limit ? 'active' : ''}">${limit || '不設定'}${limit ? ' 題' : ''}</button>`).join('')}</div>
      <div class="healthy-play-grid">${retentionItems.map((item) => `<article data-retention-id="${item.id}"><small>${item.id}</small><b>${escapeHtml(item.label)}</b><p>${escapeHtml(item.message)}</p></article>`).join('')}</div>
    </details>` : ''}`;
}

export function gamificationPreferences() {
  return readPrefs();
}
