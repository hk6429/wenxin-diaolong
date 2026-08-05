const REASONS = [
  ['progress', '精熟度或進度異常'],
  ['question', '題目、答案或解析'],
  ['reading', '原文或白話文'],
  ['interface', '畫面或操作問題'],
  ['other', '其他問題'],
];

function reportMarkup() {
  return `<button id="btn-report" class="report-trigger" type="button" aria-haspopup="dialog">回報問題</button>
    <div id="report-overlay" class="overlay report-overlay" hidden>
      <form id="report-form" class="overlay-card report-card" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <small>不用重打題目</small>
        <h2 id="report-title">這裡有問題嗎？</h2>
        <p>選一個最接近的狀況即可；系統會自動附上目前頁面、學段、題目與進度資料。</p>
        <fieldset><legend>問題類型</legend><div class="report-reasons">
          ${REASONS.map(([value, label], index) => `<label><input type="radio" name="reason" value="${value}"${index === 0 ? ' checked' : ''}><span>${label}</span></label>`).join('')}
        </div></fieldset>
        <label class="report-note" for="report-note">補充說明（選填）</label>
        <textarea id="report-note" name="note" maxlength="500" rows="3" placeholder="若方便，再告訴老師你剛才看到什麼。"></textarea>
        <p class="report-privacy">不需填姓名、班級或聯絡資料，也請不要輸入個人資料。</p>
        <p id="report-status" class="report-status" role="status" aria-live="polite"></p>
        <div class="overlay-actions">
          <button id="btn-report-cancel" class="ghost-btn" type="button">先不回報</button>
          <button id="btn-report-submit" class="primary-btn" type="submit">送給老師</button>
        </div>
      </form>
    </div>`;
}

export function initReportUI(getContext = () => ({})) {
  document.body.insertAdjacentHTML('beforeend', reportMarkup());
  const trigger = document.getElementById('btn-report');
  const overlay = document.getElementById('report-overlay');
  const form = document.getElementById('report-form');
  const cancel = document.getElementById('btn-report-cancel');
  const submit = document.getElementById('btn-report-submit');
  const status = document.getElementById('report-status');

  const close = () => { overlay.hidden = true; trigger.focus(); };
  trigger.addEventListener('click', () => {
    status.textContent = '';
    overlay.hidden = false;
    form.querySelector('input[name="reason"]:checked')?.focus();
  });
  cancel.addEventListener('click', close);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = '正在送出……';
    const data = new FormData(form);
    const context = getContext() || {};
    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reason: data.get('reason'),
          note: data.get('note'),
          context: {
            ...context,
            path: location.pathname,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'send failed');
      status.textContent = '已送出，謝謝你幫忙把網站變得更好！';
      form.querySelector('textarea').value = '';
    } catch {
      status.textContent = '目前暫時送不出去，請稍後再試一次。';
    } finally {
      submit.disabled = false;
    }
  });
}
