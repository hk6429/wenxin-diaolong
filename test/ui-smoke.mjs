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
const levelGuide = await page.textContent('#level-guide');
if (!levelGuide?.includes('國小') || !levelGuide.includes('527 題')) fail('首頁未說明國小專屬題庫與題數');

// 古代冒險：序章→智慧/全文注音→蝶夢五題委託→北冥風口
await page.click('#btn-adventure');
await page.waitForSelector('#adventure-stage h2');
if (!(await page.textContent('#adventure-stage'))?.includes('殘卷飛蝶')) fail('莊子序章未顯示');
if (!(await page.textContent('#adventure-level-note'))?.includes('五題挑戰會一起更換')) fail('冒險學段差異未說明');
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
if (!codex?.includes('修辭分級大綱') || !codex.includes('從辨認大類')) fail('修辭分級大綱未顯示');
if (!(await page.locator('[data-concept-level="國小"]').getAttribute('class'))?.includes('active')) fail('圖鑑未跟隨首頁學段');
await page.click('[data-concept-level="國中"]');
const metaphorCard = page.locator('.concept-card[data-concept-cat="譬喻"]');
if (!(await metaphorCard.locator('.concept-deep > summary').textContent())?.includes('9 步')) fail('國中譬喻未顯示國小基礎＋國中細分的 9 步');
await metaphorCard.locator('.concept-deep > summary').click();
const metaphorLecture = await metaphorCard.textContent();
for (const term of ['喻體', '喻詞', '喻依', '明喻', '暗喻', '略喻', '借喻']) {
  if (!metaphorLecture?.includes(term)) fail(`國中譬喻講義缺 ${term}`);
}
const transformCard = page.locator('.concept-card[data-concept-cat="轉化"]');
const transformSubtypes = await transformCard.locator('.subtype-item b').allTextContents();
for (const term of ['擬人法', '擬物法', '形象化']) {
  if (!transformSubtypes.includes(term)) fail(`國中轉化細分類缺 ${term}`);
}
if (!(await transformCard.locator('.concept-deep > summary').textContent())?.includes('6 步')) fail('國中轉化未顯示分級六步講義');
const punCard = page.locator('.concept-card[data-concept-cat="雙關"]');
const punSubtypes = await punCard.locator('.subtype-item b').allTextContents();
for (const term of ['字音雙關', '詞義雙關', '語意雙關']) {
  if (!punSubtypes.includes(term)) fail(`國中雙關細分類缺 ${term}`);
}
await page.click('[data-concept-level="高中"]');
const inlayCard = page.locator('.concept-card[data-concept-cat="鑲嵌"]');
const inlaySubtypes = await inlayCard.locator('.subtype-item b').allTextContents();
for (const term of ['鑲字', '嵌字', '增字', '配字']) {
  if (!inlaySubtypes.includes(term)) fail(`高中鑲嵌細分類缺 ${term}`);
}
if (inlaySubtypes.some((term) => term.includes('雙關'))) fail('雙關被錯列為鑲嵌子類');
await page.click('.tab[data-tab="文法"]');
await page.evaluate(() => localStorage.removeItem('wenxin-reading-progress-v1'));
await page.click('[data-concept-level="國小"]');
const sentenceCard = page.locator('.concept-card[data-concept-cat="句型"]');
const elementarySentenceSubtypes = await sentenceCard.locator('.subtype-item b').allTextContents();
for (const term of ['並列句', '承接句', '轉折句', '因果句', '條件句', '選擇句', '假設句', '遞進句', '目的句']) {
  if (!elementarySentenceSubtypes.includes(term)) fail(`國小關聯複句缺 ${term}`);
}
if (!(await sentenceCard.locator('.concept-deep > summary').textContent())?.includes('12 步')) fail('國小句型未顯示十二步關聯複句講義');
if ((await sentenceCard.textContent())?.includes('第一型：敘事句')) fail('國小篩選混入國中四大句型步驟');
await page.click('[data-concept-level="高中"]');
const posCard = page.locator('.concept-card[data-concept-cat="詞性"]');
await posCard.locator('.concept-deep > summary').click();
const posLecture = await posCard.textContent();
for (const term of ['實詞六類', '虛詞四類', '中綴', '時貌助詞']) {
  if (!posLecture?.includes(term)) fail(`詞性完整講義缺 ${term}`);
}
const stepLevels = await posCard.locator('.step-level').allTextContents();
for (const level of ['國小', '國中', '高中']) {
  if (!stepLevels.includes(level)) fail(`詞性解構步驟缺 ${level} 標示`);
}
if (!(await posCard.locator('.reading-progress-text').textContent())?.includes('0%')) fail('閱讀進度初始值不是 0%');
await posCard.locator('.concept-step[open] .step-complete').click();
if ((await posCard.locator('.reading-progress-text').textContent())?.includes('0%')) fail('讀完步驟後百分比未更新');
if (!(await posCard.locator('.concept-step[open] .step-number').textContent())?.includes('2')) fail('讀完後未自動開啟下一步');
const savedReading = await page.evaluate(() => JSON.parse(localStorage.getItem('wenxin-reading-progress-v1') || '{}'));
if (!savedReading['文法:詞性']?.includes(0)) fail('閱讀位置未寫入瀏覽器');
await page.click('.tab[data-tab="格律"]');
await page.click('[data-concept-level="國中"]');
const toneCard = page.locator('.concept-card[data-concept-cat="平仄"]');
if (await toneCard.count() !== 1) fail('國中格律未顯示平仄卡');
const metricalFamilies = await toneCard.locator('.metrical-family h4').allTextContents();
if (!metricalFamilies.some((text) => text.includes('五言絕句四式'))) fail('缺五言絕句四式表');
if (!metricalFamilies.some((text) => text.includes('七言絕句四式'))) fail('缺七言絕句四式表');
if (await toneCard.locator('.metrical-table').count() !== 8) fail('平仄格式卡不是八式');
for (const table of await toneCard.locator('.metrical-table').all()) {
  if (await table.locator('.metrical-lines li').count() !== 4) fail('平仄格式未拆成四句');
}
const rhymeIn = toneCard.locator('.metrical-table[data-metrical-mode="平起入韻"]').first();
const rhymeOut = toneCard.locator('.metrical-table[data-metrical-mode="平起不入韻"]').first();
if (await rhymeIn.locator('.rhyme-mark').count() !== 3) fail('首句入韻式未標示一、二、四句');
if (await rhymeOut.locator('.rhyme-mark').count() !== 2) fail('首句不入韻式未標示二、四句');
const juniorToneStepTitles = await toneCard.locator('.concept-step > summary').allTextContents();
if (juniorToneStepTitles.some((title) => title.includes('三仄尾'))) fail('國中篩選不應提前顯示高中三仄尾步驟');
await page.click('[data-concept-level="高中"]');
const seniorToneStepTitles = await toneCard.locator('.concept-step > summary').allTextContents();
if (!seniorToneStepTitles.some((title) => title.includes('三仄尾'))) fail('高中平仄講義缺三仄尾');
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
