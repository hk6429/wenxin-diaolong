// v1 UI 冒煙：起本機伺服器 → 首頁 → 練功答一題 → 圖鑑 → 弱點 → 四靈，全程零 console error。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('console', (m) => {
  // 本機無後端：/api 的 404 資源載入訊息是預期中的降級路徑，不算錯
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
page.on('requestfailed', () => {});
page.on('pageerror', (e) => errors.push(String(e)));

const fail = (msg) => { console.error('FAIL:', msg); process.exitCode = 1; };

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(600);
if (!(await page.textContent('#home-today'))?.trim()) fail('home-today 空白');

// 古代冒險：序章→智慧/全文注音→蝶夢五題委託→北冥風口
await page.click('#btn-adventure');
await page.waitForSelector('#adventure-stage h2');
if (!(await page.textContent('#adventure-stage'))?.includes('殘卷飛蝶')) fail('莊子序章未顯示');
await page.click('[data-story-level="國中"]');
await page.waitForFunction(() => document.querySelector('.adventure-copy')?.textContent.includes('教室翻開'));
await page.click('[data-story-level="高中"]');
await page.waitForFunction(() => document.querySelector('.adventure-copy')?.textContent.includes('來歷不明'));
await page.click('[data-story-level="國小"]');
await page.waitForFunction(() => document.querySelector('.adventure-copy')?.textContent.includes('你翻開一本'));
await page.click('[data-zhuyin="full"]');
if ((await page.$$('#adventure-stage ruby')).length === 0) fail('全文注音模式沒有 ruby 標記');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('蝶夢之門'));
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
for (let i = 0; i < 5; i += 1) {
  await page.click('#quiz-options .opt-btn');
  await page.waitForSelector('#quiz-feedback:not([hidden])');
  await page.click('#btn-next');
  if (i < 4) await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });
}
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('北冥風口'));
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('庖丁迷陣'));
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('濠梁水畔'));
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('莊周論藝'));
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
for (let i = 0; i < 5; i += 1) {
  await page.click('#quiz-options .opt-btn');
  await page.waitForSelector('#quiz-feedback:not([hidden])');
  await page.click('#btn-next');
  if (i < 4) await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });
}
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('守卷閣歸來'));
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('觀物之頁'));
const adventureSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wxdl_meta')).adventure);
if (adventureSaved.chapterStatus !== 'found' || !adventureSaved.echoDueAt) fail('章回尋回狀態未正確保存');
if (adventureSaved.rewards?.length !== 3) fail('章回三項獎勵未正確保存');
await page.reload();
await page.waitForSelector('#btn-adventure');
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('觀物之頁'));
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.echoDueAt = '2000-01-01T00:00:00.000Z';
  meta.adventure.zhuyinMode = 'off';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForSelector('#btn-echo');
await page.click('#btn-echo');
const elementaryRhetoric = JSON.parse(await readFile(join(ROOT, 'data/rhetoric-elementary.json'), 'utf8'));
const answerByQuestion = new Map(elementaryRhetoric.map((entry) => [entry.question, entry.answer]));
for (let i = 0; i < 3; i += 1) {
  await page.waitForSelector('#quiz-options .opt-btn');
  const question = await page.textContent('#quiz-question');
  const answer = answerByQuestion.get(question);
  if (!answer) fail('蝶夢回聲找不到正式答案');
  await page.evaluate((expected) => {
    [...document.querySelectorAll('#quiz-options .opt-btn')].find((button) => button.dataset.opt === expected)?.click();
  }, answer);
  await page.waitForSelector('#quiz-feedback:not([hidden])');
  await page.click('#btn-next');
  if (i < 2) await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });
}
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('已穩固'));
const stableStatus = await page.evaluate(() => JSON.parse(localStorage.getItem('wxdl_meta')).adventure.chapterStatus);
if (stableStatus !== 'stable') fail('蝶夢回聲通過後未穩固');
await page.click('#btn-adventure-back');
await page.waitForFunction(() => document.querySelector('#adventure-hero-kicker')?.textContent.includes('已穩固'));

// 練功：修辭區答一題
await page.click('#btn-practice');
await page.click('.zone-card.zone-rh');
await page.waitForSelector('#quiz-options .opt-btn');
const qText = await page.textContent('#quiz-question');
if (!qText?.trim()) fail('題幹空白');
await page.click('#quiz-options .opt-btn');
await page.waitForSelector('#quiz-feedback:not([hidden])');
if (!(await page.textContent('#quiz-verdict'))?.trim()) fail('verdict 空白');
await page.click('#btn-next');
await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });

// 圖鑑
await page.click('#btn-quiz-exit');
await page.click('#btn-codex');
await page.waitForTimeout(400);
const codex = await page.textContent('#codex-body');
if (!codex?.includes('譬喻') && !codex?.includes('建置中')) fail('圖鑑內容異常: ' + codex?.slice(0, 60));
await page.click('.tab[data-tab="珠"]');
await page.waitForTimeout(200);

// 弱點 + 四靈
await page.click('#btn-home'); await page.click('#btn-weak');
await page.click('#btn-home'); await page.click('#btn-pets');
const pets = await page.$$('.pet-card');
if (pets.length !== 4) fail(`pet-card 數量 ${pets.length} ≠ 4`);

// PvE 試煉：名單→阿誦→答一題（新玩家只有阿誦可戰）
await page.click('#btn-home');
await page.click('#btn-battle');
await page.waitForTimeout(400);
const unlockedMasters = await page.$$('.master-card:not(.locked)');
if (unlockedMasters.length !== 1) fail(`新玩家可挑戰大師數 ${unlockedMasters.length} ≠ 1`);
await unlockedMasters[0].click();
await page.click('#btn-duel-start');
await page.waitForSelector('#duel-options .opt-btn');
await page.click('#duel-options .opt-btn');
await page.waitForSelector('#duel-feedback:not([hidden])');
const hpB = await page.textContent('#hp-b-num');
if (!hpB?.includes('／')) fail('大師血條未渲染');
await page.click('#btn-duel-flee');
await page.waitForSelector('#master-roster:not([hidden])');

// PvP：無後端環境下優雅降級（本機 127.0.0.1 走同源 /api → 404 → res 非 ok）
await page.click('#btn-battle-back');
await page.click('#btn-rt');
await page.fill('#rt-nick', '測試文士');
await page.click('#btn-rt-create');
await page.waitForTimeout(800);
const rtStatus = await page.textContent('#rt-status');
if (!rtStatus?.trim()) fail('PvP 降級訊息未顯示');
await page.click('#btn-rt-back');

// 學段切換
await page.click('#btn-home');
await page.click('.level-btn[data-level="國中"]');
await page.waitForTimeout(500);

// 橫向捲動檢查
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
if (overflow) fail('390px 出現橫向捲動');

if (errors.length) fail('console errors:\n' + errors.join('\n'));
console.log(process.exitCode ? 'UI SMOKE FAILED' : 'UI SMOKE ALL CLEAN');
await browser.close();
server.close();
