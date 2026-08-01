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
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const fail = (msg) => { console.error('FAIL:', msg); process.exitCode = 1; };

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(600);
if (!(await page.textContent('#home-today'))?.trim()) fail('home-today 空白');

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
