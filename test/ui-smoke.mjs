// v1 UI 冒煙：起本機伺服器 → 首頁 → 練功答一題 → 圖鑑 → 弱點 → 四靈，全程零 console error。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { CHAPTERS } from '../js/adventure.js';

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
await page.waitForSelector('#profile-overlay:not([hidden])');
if (!(await page.textContent('#profile-title'))?.includes('冒險者姓名')) fail('首次進站沒有要求設定冒險者姓名');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/profile-onboarding.png`, fullPage: true });
await page.fill('#profile-name', '測試文士');
await page.click('#profile-form button[type="submit"]');
await page.waitForSelector('#profile-overlay[hidden]', { state: 'attached' });
if (!(await page.textContent('#btn-profile'))?.includes('測試文士')) fail('冒險者姓名沒有顯示在頁首');
if ((await page.textContent('#journey-total')) !== '0') fail('新玩家累積答題應從 0 開始');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/journey-dashboard.png`, fullPage: true });
if (!(await page.textContent('#home-today'))?.trim()) fail('home-today 空白');
const interfaceIds = await page.locator('[data-interface-id]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.interfaceId))]);
if (interfaceIds.length !== 10) fail(`操作介面專家的十項方案只有 ${interfaceIds.length} 項進入首頁`);
const retentionIds = await page.locator('[data-retention-id]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.retentionId))]);
if (retentionIds.length !== 10) fail(`健康留存專家的十項方案只有 ${retentionIds.length} 項進入首頁`);
await page.click('[data-session-size="10"]');
if (!(await page.getAttribute('[data-session-size="10"]', 'class'))?.includes('active')) fail('十題短回合無法選取');
await page.click('[data-session-size="5"]');
await page.click('[data-game-action="calm"]');
if (!(await page.getAttribute('html', 'class'))?.includes('calm-mode')) fail('靜心模式沒有停用動畫');
await page.click('[data-game-action="calm"]');
const levelGuide = await page.textContent('#level-guide');
if (!levelGuide?.includes('國小') || !levelGuide.includes('527 題')) fail('首頁未說明國小專屬題庫與題數');
if (await page.locator('.entry-card .entry-art').count() !== 6) fail('六個首頁入口未全部改用配圖');
if (await page.locator('.entry-card .entry-icon').count() !== 0) fail('首頁入口仍殘留 emoji icon');
if (await page.locator('img[src*="visitor-badge.laobi.icu"]').count() !== 0) fail('舊訪客 badge 未移除');
if (await page.locator('script[data-site="wenxin-diaolong"]').count() !== 1) fail('右下角共用學習工具未接入');
const failedEntryArt = await page.locator('.entry-card .entry-art').evaluateAll((images) => images.filter((img) => !img.complete || img.naturalWidth === 0).length);
if (failedEntryArt) fail(`首頁有 ${failedEntryArt} 張配圖載入失敗`);
const siteBackground = await page.evaluate(async () => {
  const backgroundImage = getComputedStyle(document.body, '::before').backgroundImage;
  const image = new Image();
  image.src = 'assets/img/site-background-v1.webp';
  await image.decode();
  return { backgroundImage, width: image.naturalWidth, height: image.naturalHeight };
});
if (!siteBackground.backgroundImage.includes('site-background-v1.webp')) fail('全版沉浸背景沒有套用到網站');
if (siteBackground.width !== 1536 || siteBackground.height !== 1024) fail('全版沉浸背景尺寸或檔案載入異常');

// 六個首頁入口都要有清楚可見的返回首頁按鈕，不要求學生猜「站名可以按」。
for (const [entryId, screenId, backId] of [
  ['btn-practice', 'screen-practice', 'btn-practice-back'],
  ['btn-codex', 'screen-codex', 'btn-codex-back'],
  ['btn-weak', 'screen-weak', 'btn-weak-back'],
  ['btn-pets', 'screen-pets', 'btn-pets-back'],
  ['btn-battle', 'screen-battle', 'btn-battle-back'],
  ['btn-rt', 'screen-rt', 'btn-rt-back'],
]) {
  await page.click(`#${entryId}`);
  await page.waitForSelector(`#${screenId}:not([hidden])`);
  const backLabel = await page.textContent(`#${backId}`);
  if (!backLabel?.includes('回首頁')) fail(`${entryId} 沒有清楚標示回首頁`);
  await page.click(`#${backId}`);
  await page.waitForSelector('#screen-home:not([hidden])');
}

// 古代冒險：開卷立誓→章回選擇→智慧/全文注音→五題委託
await page.click('#btn-adventure');
await page.waitForSelector('#adventure-stage h2');
const adventureFeatureIds = await page.locator('[data-adventure-feature]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.adventureFeature))]);
if (adventureFeatureIds.length !== 10) fail(`冒險專家的十項方案只有 ${adventureFeatureIds.length} 項進入章回`);
const adventureLayout = await page.evaluate(() => {
  const panel = document.querySelector('#adventure-game-panel');
  const nav = document.querySelector('#adventure-chapters');
  const stage = document.querySelector('#adventure-stage');
  return {
    panelBeforeAtlas: panel.getBoundingClientRect().top < nav.getBoundingClientRect().top,
    atlasBeforeStory: nav.getBoundingClientRect().top < stage.getBoundingClientRect().top,
    atlasViewport: nav.clientHeight,
    atlasScrollable: nav.scrollHeight > nav.clientHeight,
  };
});
if (!adventureLayout.panelBeforeAtlas || !adventureLayout.atlasBeforeStory) fail('本章狀態、章回圖譜與故事正文的順序錯誤');
if (adventureLayout.atlasViewport > 270 || !adventureLayout.atlasScrollable) fail('五十七章圖譜沒有收進可捲動區域');
if (!(await page.textContent('#adventure-stage'))?.includes('開卷立誓')) fail('莊子篇沒有《文豪笑傳》式開卷立誓');
if (await page.locator('.adventure-cover').count() !== 1) fail('莊子篇沒有滿版章回封面');
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-zhuangzi-butterfly.webp')) fail('莊子篇滿版封面未使用章回主視覺');
await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
const coverLayout = await page.locator('.adventure-cover').evaluate((cover) => {
  const image = cover.querySelector('img');
  const title = cover.querySelector('h2');
  return {
    imageCoverage: image.getBoundingClientRect().width / cover.getBoundingClientRect().width,
    titleInside: cover.contains(title),
    objectFit: getComputedStyle(image).objectFit,
  };
});
if (coverLayout.imageCoverage < .99 || coverLayout.objectFit !== 'cover') fail('莊子篇主視覺沒有真正滿版鋪滿');
if (!coverLayout.titleInside) fail('莊子篇標題沒有疊在主視覺上');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/adventure-cover.png`, fullPage: true });
if (await page.locator('[data-vow-id]').count() !== 3) fail('莊子篇立誓選項不是三句');
await page.click('[data-vow-id]');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('殘卷飛蝶'));
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
if (!(await page.textContent('.story-fact'))?.includes('史實小註')) fail('莊子序章缺少史實小註');
if (await page.locator('[data-scene-choice]').count() !== 3) fail('莊子序章不是三個故事選擇');
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('蝶夢之門'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
await page.waitForSelector('#quiz-reading:not([hidden])');
if (!(await page.textContent('#quiz-reading'))?.includes('夢為胡蝶')) fail('蝶夢之門作答前沒有顯示〈齊物論〉本文');
if (!(await page.textContent('#quiz-reading'))?.includes('不用先背過')) fail('蝶夢之門沒有說明可直接依本文作答');
if (!(await page.textContent('#btn-quiz-exit'))?.includes('暫停委託，回到莊子篇')) fail('冒險五題的返回按鈕仍會讓人誤以為已完成關卡');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-zhuangzi-butterfly.webp')) fail('蝶夢之門沒有顯示專屬插畫');
await page.waitForFunction(() => document.querySelector('#quiz-story-image')?.naturalWidth > 0);
if (!(await page.evaluate(() => document.querySelector('#quiz-story-image')?.naturalWidth > 0))) fail('蝶夢之門配圖載入失敗');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/butterfly-quest.png`, fullPage: true });
for (let i = 0; i < 5; i += 1) {
  await page.click('#quiz-options .opt-btn');
  await page.waitForSelector('#quiz-feedback:not([hidden])');
  if (i === 4 && !(await page.textContent('#btn-next'))?.includes('完成五題，繼續莊子篇')) fail('第五題後沒有清楚標示完成並繼續章回');
  await page.click('#btn-next');
  if (i < 4) await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });
}
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('北冥風口'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('庖丁迷陣'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('濠梁水畔'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('莊周論藝'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-zhuangzi-duel.webp')) fail('莊子試煉沒有切換對戰配圖');
if ((await page.textContent('#quiz-opponent-name')) !== '莊子') fail('莊子試煉的對手不是莊子');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/zhuangzi-duel.png`, fullPage: true });
const hpBefore = await page.evaluate(() => [Number(document.querySelector('#quiz-player-hp').textContent), Number(document.querySelector('#quiz-opponent-hp').textContent)]);
await page.click('#quiz-options .opt-btn');
await page.waitForSelector('#quiz-feedback:not([hidden])');
const hpAfter = await page.evaluate(() => [Number(document.querySelector('#quiz-player-hp').textContent), Number(document.querySelector('#quiz-opponent-hp').textContent)]);
if ((hpBefore[0] !== hpAfter[0]) === (hpBefore[1] !== hpAfter[1])) fail('莊子對戰每回合必須只有一方扣血');
await page.click('#btn-next');
for (let i = 0; i < 5; i += 1) {
  if (i === 4) break;
  await page.click('#quiz-options .opt-btn');
  await page.waitForSelector('#quiz-feedback:not([hidden])');
  await page.click('#btn-next');
  if (i < 3) await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });
}
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('守卷閣歸來'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('觀物之頁'));
const adventureSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wxdl_meta')).adventure);
if (adventureSaved.chapterStatus !== 'found' || !adventureSaved.echoDueAt) fail('章回尋回狀態未正確保存');
if (adventureSaved.rewards?.length !== 3) fail('章回三項獎勵未正確保存');
if (await page.locator('#btn-replay-chapter').count() !== 1) fail('完成莊子後沒有重新遊歷入口');
const beforeReplayMeta = await page.evaluate(() => localStorage.getItem('wxdl_meta'));
await page.click('#btn-replay-chapter');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('開卷立誓'));
const replaySaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wxdl_meta')).adventure);
if (!replaySaved.chapters['preqin-zhuangzi'].replayActive) fail('重新遊歷沒有啟動');
if (replaySaved.chapters['preqin-zhuangzi'].chapterStatus !== 'found' || replaySaved.rewards?.length !== 3) fail('重遊錯誤清除了尋回狀態或獎勵');
if (await page.locator('[data-adventure-chapter="warring-quyuan"]').isDisabled()) fail('重遊莊子不應重新鎖住屈原');
await page.evaluate((raw) => localStorage.setItem('wxdl_meta', raw), beforeReplayMeta);
await page.reload();
await page.waitForSelector('#btn-adventure');
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('開卷立誓'));
if (!(await page.textContent('#adventure-stage'))?.includes('《文豪笑傳》章回模式')) fail('屈原篇沒有沿用《文豪笑傳》章回模式');
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-quyuan-fragrant.webp')) fail('屈原篇滿版封面未使用章回主視覺');
await page.click('[data-vow-id]');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('楚澤'));
if (await page.locator('.adventure-chapter-tab').count() !== 57) fail('冒險沒有顯示莊子至曹雪芹五十七章');
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('香草之徑'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-quyuan-fragrant.webp')) fail('屈原香草之徑沒有顯示專屬插畫');
await page.waitForFunction(() => document.querySelector('#quiz-story-image')?.naturalWidth > 0);
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/quyuan-fragrant.png`, fullPage: true });
await page.click('#btn-quiz-exit');
await page.click('[data-adventure-chapter="preqin-zhuangzi"]');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('觀物之頁'));
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.echoDueAt = '2000-01-01T00:00:00.000Z';
  meta.adventure.chapters['preqin-zhuangzi'].echoDueAt = '2000-01-01T00:00:00.000Z';
  meta.adventure.zhuyinMode = 'off';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.click('[data-adventure-chapter="preqin-zhuangzi"]');
await page.waitForSelector('#btn-echo');
await page.click('#btn-echo');
const elementaryZhuangzi = JSON.parse(await readFile(join(ROOT, 'data/zhuangzi-elementary.json'), 'utf8'));
const answerByQuestion = new Map(elementaryZhuangzi.map((entry) => [entry.question, entry.answer]));
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
const stableStatus = await page.evaluate(() => JSON.parse(localStorage.getItem('wxdl_meta')).adventure.chapters['preqin-zhuangzi'].chapterStatus);
if (stableStatus !== 'stable') fail('蝶夢回聲通過後未穩固');
await page.click('#btn-adventure-back');
await page.waitForFunction(() => document.querySelector('#adventure-hero-kicker')?.textContent.includes('第二章'));

// 外篇・孔子：完成屈原後解鎖，所有委託題只來自《論語》專屬題庫
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['warring-quyuan'].chapterStatus = 'found';
  meta.adventure.currentChapterId = 'dream-confucius';
  meta.adventure.chapterId = 'dream-confucius';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('遇見孔子'));
if (await page.locator('.adventure-chapter-tab').count() !== 57) fail('冒險沒有顯示全部五十七章入口');
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-confucius-dream.webp')) fail('孔子外篇沒有夢境滿版封面');
await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/confucius-dream-cover.png`, fullPage: true });
await page.click('[data-vow-id]');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('枕書入夢'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('學而之門'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-confucius-academy.webp')) fail('孔子論語委託沒有杏壇配圖');
const lunyuElementary = JSON.parse(await readFile(join(ROOT, 'data/lunyu-elementary.json'), 'utf8'));
const lunyuQuestions = new Set(lunyuElementary.map((entry) => entry.question));
for (let i = 0; i < 5; i += 1) {
  const question = await page.textContent('#quiz-question');
  if (!lunyuQuestions.has(question)) fail('孔子外篇混入非論語專屬題庫');
  await page.click('#quiz-options .opt-btn');
  await page.waitForSelector('#quiz-feedback:not([hidden])');
  await page.click('#btn-next');
  if (i < 4) await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });
}
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('知之鏡'));
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['dream-confucius'].sceneIndex = 5;
  meta.adventure.sceneIndex = 5;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('孔子問學'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-confucius-duel.webp')) fail('孔子最終問學沒有專屬對戰圖');
if ((await page.textContent('#quiz-opponent-name')) !== '孔子') fail('孔子外篇最終對戰的對手不是孔子');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/confucius-duel.png`, fullPage: true });
await page.click('#btn-quiz-exit');
await page.click('#btn-adventure-back');

// 漢代・司馬遷：完成孔子外篇後解鎖，穿行《史記》五體並與太史公對決
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['dream-confucius'].chapterStatus = 'found';
  meta.adventure.currentChapterId = 'han-simaqian';
  meta.adventure.chapterId = 'han-simaqian';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('遇見司馬遷'));
if (await page.locator('.adventure-chapter-tab').count() !== 57) fail('冒險章回數不是五十七章');
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-simaqian-archive.webp')) fail('司馬遷篇沒有漢宮書房滿版封面');
await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/simaqian-cover.png`, fullPage: true });
await page.click('[data-vow-id]');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('竹簡長河'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('龍門遺命'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('五體迷宮'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-simaqian-fivepaths.webp')) fail('史記五體委託沒有專屬配圖');
const shijiElementary = JSON.parse(await readFile(join(ROOT, 'data/shiji-elementary.json'), 'utf8'));
const shijiQuestions = new Set(shijiElementary.map((entry) => entry.question));
for (let i = 0; i < 5; i += 1) {
  const question = await page.textContent('#quiz-question');
  if (!shijiQuestions.has(question)) fail('司馬遷篇混入非史記專屬題庫');
  await page.click('#quiz-options .opt-btn');
  await page.waitForSelector('#quiz-feedback:not([hidden])');
  await page.click('#btn-next');
  if (i < 4) await page.waitForSelector('#quiz-feedback[hidden]', { state: 'attached' });
}
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('鴻門夜宴'));
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['han-simaqian'].sceneIndex = 5;
  meta.adventure.sceneIndex = 5;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('太史問筆'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-simaqian-duel.webp')) fail('司馬遷最終史筆對決沒有專屬戰場圖');
if ((await page.textContent('#quiz-opponent-name')) !== '司馬遷') fail('司馬遷篇最終對手不是司馬遷');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/simaqian-duel.png`, fullPage: true });
await page.click('#btn-quiz-exit');
await page.click('#btn-adventure-back');

// 建安・曹操：完成司馬遷後解鎖，以《短歌行》進入月下求賢
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['han-simaqian'].chapterStatus = 'found';
  meta.adventure.currentChapterId = 'jianan-caocao';
  meta.adventure.chapterId = 'jianan-caocao';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('遇見曹操'));
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-caocao-camp.webp')) fail('曹操篇沒有建安月夜滿版封面');
await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/caocao-cover.png`, fullPage: true });
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['jianan-caocao'].vowId = 'seek-talent';
  meta.adventure.chapters['jianan-caocao'].sceneIndex = 5;
  meta.adventure.sceneIndex = 5;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('孟德問志'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-caocao-duel.webp')) fail('曹操篇沒有短歌行對戰圖');
if ((await page.textContent('#quiz-opponent-name')) !== '曹操') fail('曹操篇最終對手不是曹操');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/caocao-duel.png`, fullPage: true });
await page.click('#btn-quiz-exit');
await page.click('#btn-adventure-back');

// 曹丕、曹植、諸葛亮：逐章解鎖，封面與最終對戰皆使用人物專屬圖片
const laterChapters = [
  { previous: 'jianan-caocao', id: 'wei-caopi', figure: '曹丕', title: '魏文問章', cover: 'adventure-caopi-hall.webp', duel: 'adventure-caopi-duel.webp', shot: 'caopi' },
  { previous: 'wei-caopi', id: 'wei-caozhi', figure: '曹植', title: '子建問象', cover: 'adventure-caozhi-river.webp', duel: 'adventure-caozhi-duel.webp', shot: 'caozhi' },
  { previous: 'wei-caozhi', id: 'shuhan-zhugeliang', figure: '諸葛亮', title: '孔明問策', cover: 'adventure-zhugeliang-tent.webp', duel: 'adventure-zhugeliang-duel.webp', shot: 'zhugeliang' },
];
for (const item of laterChapters) {
  await page.evaluate(({ previous, id }) => {
    const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
    meta.adventure.chapters[previous].chapterStatus = 'found';
    meta.adventure.currentChapterId = id;
    meta.adventure.chapterId = id;
    localStorage.setItem('wxdl_meta', JSON.stringify(meta));
  }, item);
  await page.reload();
  await page.click('#btn-adventure');
  await page.waitForFunction((figure) => document.querySelector('#adventure-stage h2')?.textContent.includes(`遇見${figure}`), item.figure);
  if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes(item.cover)) fail(`${item.figure}篇沒有專屬滿版封面`);
  await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
  if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/${item.shot}-cover.png`, fullPage: true });
  await page.evaluate((id) => {
    const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
    meta.adventure.chapters[id].vowId = 'smoke-vow';
    meta.adventure.chapters[id].sceneIndex = 5;
    meta.adventure.sceneIndex = 5;
    localStorage.setItem('wxdl_meta', JSON.stringify(meta));
  }, item.id);
  await page.reload();
  await page.click('#btn-adventure');
  await page.waitForFunction((title) => document.querySelector('#adventure-stage h2')?.textContent.includes(title), item.title);
  await page.click('[data-scene-choice]');
  await page.click('#btn-scene-next');
  await page.waitForSelector('#quiz-story-visual:not([hidden])');
  if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes(item.duel)) fail(`${item.figure}篇沒有專屬對戰圖`);
  if ((await page.textContent('#quiz-opponent-name')) !== item.figure) fail(`${item.figure}篇最終對手錯誤`);
  if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/${item.shot}-duel.png`, fullPage: true });
  await page.click('#btn-quiz-exit');
  await page.click('#btn-adventure-back');
}

// 魏晉・嵇康：完成諸葛亮後解鎖，五項委託只抽〈與山巨源絕交書〉
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['shuhan-zhugeliang'].chapterStatus = 'found';
  meta.adventure.currentChapterId = 'weijin-jikang';
  meta.adventure.chapterId = 'weijin-jikang';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('遇見嵇康'));
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-jikang-bamboo.webp')) fail('嵇康篇沒有竹林滿版封面');
await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/jikang-cover.png`, fullPage: true });
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-jikang'].vowId = 'keep-nature';
  meta.adventure.chapters['weijin-jikang'].sceneIndex = 1;
  meta.adventure.sceneIndex = 1;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('薦書之門'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-jikang-letter.webp')) fail('嵇康作品關沒有寫信情境圖');
const jikangElementary = JSON.parse(await readFile(join(ROOT, 'data/jikang-elementary.json'), 'utf8'));
const jikangQuestions = new Set(jikangElementary.map((entry) => entry.question));
if (!jikangQuestions.has(await page.textContent('#quiz-question'))) fail('嵇康篇混入非絕交書專屬題庫');
await page.click('#btn-quiz-exit');
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-jikang'].sceneIndex = 5;
  meta.adventure.sceneIndex = 5;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('廣陵絕響'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-jikang-duel.webp')) fail('嵇康篇沒有琴筆對戰圖');
if ((await page.textContent('#quiz-opponent-name')) !== '嵇康') fail('嵇康篇最終對手不是嵇康');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/jikang-duel.png`, fullPage: true });
await page.click('#btn-quiz-exit');
await page.click('#btn-adventure-back');

// 魏晉・世說新語：完成嵇康後解鎖，群像故事與劉義慶品藻對戰
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-jikang'].chapterStatus = 'found';
  meta.adventure.currentChapterId = 'weijin-shishuo';
  meta.adventure.chapterId = 'weijin-shishuo';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('遇見劉義慶'));
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-shishuo-gathering.webp')) fail('世說篇沒有人物群像滿版封面');
await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/shishuo-cover.png`, fullPage: true });
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-shishuo'].vowId = 'judge-actions';
  meta.adventure.chapters['weijin-shishuo'].sceneIndex = 2;
  meta.adventure.sceneIndex = 2;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('言語之門'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-shishuo-stories.webp')) fail('世說篇題目沒有四則人物故事圖');
const shishuoElementary = JSON.parse(await readFile(join(ROOT, 'data/shishuo-elementary.json'), 'utf8'));
const shishuoQuestions = new Set(shishuoElementary.map((entry) => entry.question));
if (!shishuoQuestions.has(await page.textContent('#quiz-question'))) fail('世說篇混入非世說專屬題庫');
await page.click('#btn-quiz-exit');
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-shishuo'].sceneIndex = 5;
  meta.adventure.sceneIndex = 5;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('臨川品藻'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-shishuo-duel.webp')) fail('世說篇沒有品藻對戰圖');
if ((await page.textContent('#quiz-opponent-name')) !== '劉義慶') fail('世說篇最終對手不是劉義慶');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/shishuo-duel.png`, fullPage: true });
await page.click('#btn-quiz-exit');
await page.click('#btn-adventure-back');

// 東晉・陶淵明：核心九幕、三篇專屬作品題與靖節問心對戰
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-shishuo'].chapterStatus = 'found';
  meta.adventure.currentChapterId = 'weijin-taoyuanming';
  meta.adventure.chapterId = 'weijin-taoyuanming';
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('遇見陶淵明'));
if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes('adventure-taoyuanming-field.webp')) fail('陶淵明篇沒有南山田園滿版封面');
await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/taoyuanming-cover.png`, fullPage: true });
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-taoyuanming'].vowId = 'seek-source';
  meta.adventure.chapters['weijin-taoyuanming'].sceneIndex = 1;
  meta.adventure.sceneIndex = 1;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('桃林初遇'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-options .opt-btn');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-taoyuanming-peach.webp')) fail('陶淵明篇題目沒有桃花源情境圖');
const taoElementary = JSON.parse(await readFile(join(ROOT, 'data/taoyuanming-elementary.json'), 'utf8'));
const peachQuestions = new Set(taoElementary.filter((entry) => entry.work === '桃花源記').map((entry) => entry.question));
if (!peachQuestions.has(await page.textContent('#quiz-question'))) fail('桃花源關卡混入陶淵明其他作品');
await page.click('#btn-quiz-exit');
await page.evaluate(() => {
  const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
  meta.adventure.chapters['weijin-taoyuanming'].sceneIndex = 7;
  meta.adventure.sceneIndex = 7;
  localStorage.setItem('wxdl_meta', JSON.stringify(meta));
});
await page.reload();
await page.click('#btn-adventure');
await page.waitForFunction(() => document.querySelector('#adventure-stage h2')?.textContent.includes('靖節問心'));
await page.click('[data-scene-choice]');
await page.click('#btn-scene-next');
await page.waitForSelector('#quiz-story-visual:not([hidden])');
if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes('adventure-taoyuanming-duel.webp')) fail('陶淵明篇沒有靖節問心對戰圖');
if ((await page.textContent('#quiz-opponent-name')) !== '陶淵明') fail('陶淵明篇最終對手不是陶淵明');
if (process.env.SMOKE_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.SMOKE_SCREENSHOTS_DIR}/taoyuanming-duel.png`, fullPage: true });
await page.click('#btn-quiz-exit');
await page.click('#btn-adventure-back');

async function smokeWorkChapter(config) {
  await page.evaluate(({ previousId, chapterId }) => {
    const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
    meta.adventure.chapters[previousId].chapterStatus = 'found';
    meta.adventure.currentChapterId = chapterId;
    meta.adventure.chapterId = chapterId;
    localStorage.setItem('wxdl_meta', JSON.stringify(meta));
  }, config);
  await page.reload();
  await page.click('#btn-adventure');
  await page.waitForFunction((text) => document.querySelector('#adventure-stage h2')?.textContent.includes(text), config.heroText);
  if (!(await page.getAttribute('.adventure-cover img', 'src'))?.includes(config.cover)) fail(`${config.label}沒有滿版封面`);
  await page.waitForFunction(() => document.querySelector('.adventure-cover img')?.naturalWidth > 0);
  await page.evaluate(({ chapterId, vowId, questIndex }) => {
    const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
    meta.adventure.chapters[chapterId].vowId = vowId;
    meta.adventure.chapters[chapterId].sceneIndex = questIndex;
    meta.adventure.sceneIndex = questIndex;
    localStorage.setItem('wxdl_meta', JSON.stringify(meta));
  }, config);
  await page.reload();
  await page.click('#btn-adventure');
  await page.waitForFunction((text) => document.querySelector('#adventure-stage h2')?.textContent.includes(text), config.questTitle);
  await page.click('[data-scene-choice]');
  await page.click('#btn-scene-next');
  await page.waitForSelector('#quiz-options .opt-btn');
  if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes(config.sceneArt)) fail(`${config.label}題目沒有情境圖`);
  const bank = JSON.parse(await readFile(join(ROOT, `data/${config.bank}-elementary.json`), 'utf8'));
  if (!new Set(bank.map((entry) => entry.question)).has(await page.textContent('#quiz-question'))) fail(`${config.label}混入非本人作品題庫`);
  await page.click('#btn-quiz-exit');
  await page.evaluate(({ chapterId, duelIndex }) => {
    const meta = JSON.parse(localStorage.getItem('wxdl_meta'));
    meta.adventure.chapters[chapterId].sceneIndex = duelIndex;
    meta.adventure.sceneIndex = duelIndex;
    localStorage.setItem('wxdl_meta', JSON.stringify(meta));
  }, config);
  await page.reload();
  await page.click('#btn-adventure');
  await page.waitForFunction((text) => document.querySelector('#adventure-stage h2')?.textContent.includes(text), config.duelTitle);
  await page.click('[data-scene-choice]');
  await page.click('#btn-scene-next');
  await page.waitForSelector('#quiz-story-visual:not([hidden])');
  if (!(await page.getAttribute('#quiz-story-image', 'src'))?.includes(config.duelArt)) fail(`${config.label}沒有專屬對戰圖`);
  if ((await page.textContent('#quiz-opponent-name')) !== config.opponent) fail(`${config.label}最終對手不是${config.opponent}`);
  await page.click('#btn-quiz-exit');
  await page.click('#btn-adventure-back');
}

await smokeWorkChapter({
  previousId: 'weijin-taoyuanming', chapterId: 'liusong-xielingyun', heroText: '遇見謝靈運', label: '謝靈運篇',
  cover: 'xielingyun-cover.webp', vowId: 'notice-spring', questIndex: 2, questTitle: '褰窗登樓',
  sceneArt: 'xielingyun-cover.webp', bank: 'xielingyun', duelIndex: 5, duelTitle: '池樓試煉',
  duelArt: 'xielingyun-duel.webp', opponent: '謝靈運',
});
await smokeWorkChapter({
  previousId: 'liusong-xielingyun', chapterId: 'weijin-wangxizhi', heroText: '遇見王羲之', label: '王羲之篇',
  cover: 'adventure-wangxizhi-cover.webp', vowId: 'see-wide', questIndex: 1, questTitle: '群賢畢至',
  sceneArt: 'adventure-wangxizhi-cover.webp', bank: 'wangxizhi', duelIndex: 5, duelTitle: '蘭亭墨辯',
  duelArt: 'adventure-wangxizhi-duel.webp', opponent: '王羲之',
});
await smokeWorkChapter({
  previousId: 'weijin-wangxizhi', chapterId: 'early-tang-wangbo', heroText: '遇見王勃', label: '王勃篇',
  cover: 'adventure-wangbo-pavilion.webp', vowId: 'see-one-color', questIndex: 1, questTitle: '星分翼軫',
  sceneArt: 'adventure-wangbo-pavilion.webp', bank: 'wangbo', duelIndex: 5, duelTitle: '子安臨席',
  duelArt: 'adventure-wangbo-duel.webp', opponent: '王勃',
});
await smokeWorkChapter({
  previousId: 'early-tang-wangbo', chapterId: 'early-tang-luobinwang', heroText: '遇見駱賓王', label: '駱賓王篇',
  cover: 'adventure-luobinwang-camp.webp', vowId: 'hear-position', questIndex: 1, questTitle: '指控卷軸',
  sceneArt: 'adventure-luobinwang-scroll.webp', bank: 'luobinwang', duelIndex: 5, duelTitle: '檄卷對決',
  duelArt: 'adventure-luobinwang-duel.webp', opponent: '駱賓王',
});
await smokeWorkChapter({
  previousId: 'early-tang-luobinwang', chapterId: 'early-tang-dushenyan', heroText: '遇見杜審言', label: '杜審言篇',
  cover: 'adventure-dushenyan-spring.webp', vowId: 'notice-change', questIndex: 1, questTitle: '宦遊人',
  sceneArt: 'adventure-dushenyan-spring.webp', bank: 'dushenyan', duelIndex: 5, duelTitle: '物候詩陣',
  duelArt: 'adventure-dushenyan-duel.webp', opponent: '杜審言',
});
await smokeWorkChapter({
  previousId: 'early-tang-dushenyan', chapterId: 'high-tang-libai', heroText: '遇見李白', label: '李白篇',
  cover: 'adventure-libai-moon.webp', vowId: 'face-hard-road', questIndex: 1, questTitle: '蠶叢鳥道',
  sceneArt: 'adventure-libai-realms.webp', bank: 'libai', duelIndex: 7, duelTitle: '太白問天',
  duelArt: 'adventure-libai-duel.webp', opponent: '李白',
});
await smokeWorkChapter({
  previousId: 'high-tang-libai', chapterId: 'high-tang-dufu', heroText: '遇見杜甫', label: '杜甫篇',
  cover: 'adventure-dufu-cottage.webp', vowId: 'cherish-letter', questIndex: 2, questTitle: '花鳥家書',
  sceneArt: 'adventure-dufu-witness.webp', bank: 'dufu', duelIndex: 7, duelTitle: '少陵對讀',
  duelArt: 'adventure-dufu-duel.webp', opponent: '杜甫',
});
await smokeWorkChapter({
  previousId: 'high-tang-dufu', chapterId: 'high-tang-wangwei', heroText: '遇見王維', label: '王維篇',
  cover: 'adventure-wangmeng-cover.webp', vowId: 'wangwei-vow-1', questIndex: 1, questTitle: '山居秋暝・初見',
  sceneArt: 'adventure-wangmeng-cover.webp', bank: 'wangwei', duelIndex: 5, duelTitle: '王維問筆',
  duelArt: 'adventure-wangmeng-duel.webp', opponent: '王維',
});
await smokeWorkChapter({
  previousId: 'high-tang-wangwei', chapterId: 'high-tang-menghaoran', heroText: '遇見孟浩然', label: '孟浩然篇',
  cover: 'adventure-wangmeng-cover.webp', vowId: 'menghaoran-vow-1', questIndex: 1, questTitle: '過故人莊・初見',
  sceneArt: 'adventure-wangmeng-cover.webp', bank: 'menghaoran', duelIndex: 5, duelTitle: '孟浩然問筆',
  duelArt: 'adventure-wangmeng-duel.webp', opponent: '孟浩然',
});
await smokeWorkChapter({
  previousId: 'high-tang-menghaoran', chapterId: 'high-tang-gaoshi', heroText: '遇見高適', label: '高適篇',
  cover: 'adventure-frontier-cover.webp', vowId: 'gaoshi-vow-1', questIndex: 1, questTitle: '燕歌行並序・初見',
  sceneArt: 'adventure-frontier-cover.webp', bank: 'gaoshi', duelIndex: 5, duelTitle: '高適問筆',
  duelArt: 'adventure-frontier-duel.webp', opponent: '高適',
});
await smokeWorkChapter({
  previousId: 'high-tang-gaoshi', chapterId: 'high-tang-wangchangling', heroText: '遇見王昌齡', label: '王昌齡篇',
  cover: 'adventure-frontier-cover.webp', vowId: 'wangchangling-vow-1', questIndex: 1, questTitle: '出塞其一・初見',
  sceneArt: 'adventure-frontier-cover.webp', bank: 'wangchangling', duelIndex: 5, duelTitle: '王昌齡問筆',
  duelArt: 'adventure-frontier-duel.webp', opponent: '王昌齡',
});
await smokeWorkChapter({
  previousId: 'high-tang-wangchangling', chapterId: 'high-tang-censhen', heroText: '遇見岑參', label: '岑參篇',
  cover: 'adventure-frontier-cover.webp', vowId: 'censhen-vow-1', questIndex: 1, questTitle: '白雪歌送武判官歸京・初見',
  sceneArt: 'adventure-frontier-cover.webp', bank: 'censhen', duelIndex: 5, duelTitle: '岑參問筆',
  duelArt: 'adventure-frontier-duel.webp', opponent: '岑參',
});
await smokeWorkChapter({
  previousId: 'high-tang-censhen', chapterId: 'high-tang-wangzhihuan', heroText: '遇見王之渙', label: '王之渙篇',
  cover: 'adventure-twintowers-cover.webp', vowId: 'wangzhihuan-vow-1', questIndex: 1, questTitle: '登鸛雀樓・初見',
  sceneArt: 'adventure-twintowers-cover.webp', bank: 'wangzhihuan', duelIndex: 5, duelTitle: '王之渙問筆',
  duelArt: 'adventure-twintowers-duel.webp', opponent: '王之渙',
});
await smokeWorkChapter({
  previousId: 'high-tang-wangzhihuan', chapterId: 'high-tang-cuihao', heroText: '遇見崔顥', label: '崔顥篇',
  cover: 'adventure-twintowers-cover.webp', vowId: 'cuihao-vow-1', questIndex: 1, questTitle: '黃鶴樓・初見',
  sceneArt: 'adventure-twintowers-cover.webp', bank: 'cuihao', duelIndex: 5, duelTitle: '崔顥問筆',
  duelArt: 'adventure-twintowers-duel.webp', opponent: '崔顥',
});

// 第 26–57 章：逐章確認滿版封面、本人作品題庫與本人章末對戰。
for (const definition of CHAPTERS.filter((chapter) => chapter.order >= 26)) {
  const chapter = JSON.parse(await readFile(join(ROOT, `data/adventure/${definition.file}.json`), 'utf8'));
  const questIndex = chapter.scenes.findIndex((scene) => scene.quest && scene.visual?.mode !== 'duel');
  const duelIndex = chapter.scenes.findIndex((scene) => scene.visual?.mode === 'duel');
  const previousId = CHAPTERS.find((item) => item.order === definition.order - 1).id;
  const questScene = chapter.scenes[questIndex];
  const duelScene = chapter.scenes[duelIndex];
  await smokeWorkChapter({
    previousId,
    chapterId: definition.id,
    heroText: `遇見${definition.figure}`,
    label: `${definition.figure}篇`,
    cover: `adventure-${definition.file}-cover.webp`,
    vowId: `smoke-${definition.file}`,
    questIndex,
    questTitle: questScene.title,
    sceneArt: questScene.visual.art,
    bank: definition.file,
    duelIndex,
    duelTitle: duelScene.title,
    duelArt: duelScene.visual.art,
    opponent: definition.figure,
  });
}

// 練功：修辭區答一題
await page.click('#btn-practice');
if (await page.locator('.zone-card > img').count() !== 4) fail('四個練功分區未全部改用生圖卡片');
if (await page.locator('.zone-card [aria-hidden="true"]').count()) fail('練功分區仍殘留 emoji icon');
const failedZoneArt = await page.locator('.zone-card > img').evaluateAll((images) => images.filter((img) => !img.complete || img.naturalWidth === 0).length);
if (failedZoneArt) fail(`練功分區有 ${failedZoneArt} 張生圖載入失敗`);
await page.click('.zone-card.zone-rh');
await page.waitForSelector('#quiz-options .opt-btn');
const qText = await page.textContent('#quiz-question');
if (!qText?.trim()) fail('題幹空白');
await page.click('#quiz-options .opt-btn');
await page.waitForSelector('#quiz-feedback:not([hidden])');
const feedbackIds = await page.locator('[data-feedback-id]').evaluateAll((nodes) => [...new Set(nodes.map((node) => node.dataset.feedbackId))]);
if (feedbackIds.length !== 10) fail(`回饋專家的十項方案只有 ${feedbackIds.length} 項進入答題回饋`);
if (await page.locator('.session-health span').count() !== 2) fail('作答後沒有休息提醒與收卷摘要');
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
const grammarOutline = page.locator('.learning-outline[aria-label="文法分級大綱"]');
if (await grammarOutline.count() !== 1) fail('文法分級大綱未顯示');
if (!(await grammarOutline.textContent())?.includes('從詞句基本零件')) fail('文法分級路徑說明缺失');
await page.evaluate(() => localStorage.removeItem('wenxin-reading-progress-v1'));
await page.click('[data-concept-level="國小"]');
if (await grammarOutline.locator('.outline-stage.active').count() !== 1) fail('文法大綱未跟隨國小篩選');
if (!(await grammarOutline.locator('.outline-stage.active').textContent())?.includes('認識詞句基本零件')) fail('文法國小階段內容錯誤');
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
const prosodyOutline = page.locator('.learning-outline[aria-label="格律分級大綱"]');
if (await prosodyOutline.count() !== 1) fail('格律分級大綱未顯示');
if (!(await prosodyOutline.textContent())?.includes('從聽見韻腳')) fail('格律分級路徑說明缺失');
await page.click('[data-concept-level="國中"]');
if (await prosodyOutline.locator('.outline-stage.active').count() !== 1) fail('格律大綱未跟隨國中篩選');
if (!(await prosodyOutline.locator('.outline-stage.active').textContent())?.includes('辨詩體、查八種格式')) fail('格律國中階段內容錯誤');
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
if (await page.locator('.master-battle-visual > img').count() !== 1) fail('文心大師對戰缺少沉浸式戰場主視覺');
if (!(await page.locator('.master-round-banner').textContent())?.includes('第 1 回合')) fail('文心大師對戰缺少回合資訊');
if (await page.locator('.master-fighter').count() !== 2) fail('文心大師對戰不是雙方對峙版面');
if (!(await page.locator('.master-battle-rules').textContent())?.includes('三連')) fail('文心大師對戰缺少招式規則');
await page.click('#duel-options .opt-btn');
await page.waitForSelector('#duel-feedback:not([hidden])');
const hpB = await page.textContent('#hp-b-num');
if (!hpB?.includes('／')) fail('大師血條未渲染');
await page.click('#btn-duel-flee');
await page.waitForSelector('#master-roster:not([hidden])');

// PvP：無後端環境下優雅降級（本機 127.0.0.1 走同源 /api → 404 → res 非 ok）
await page.click('#btn-battle-back');
await page.click('#btn-rt');
if (await page.locator('#rt-lobby .rt-lobby-hero img').count() !== 1) fail('文友過招大廳缺少生圖主視覺');
if (!(await page.locator('#rt-lobby .rt-rule-chips').textContent())?.includes('三連增幅')) fail('文友過招大廳缺少回合規則');
await page.fill('#rt-nick', '測試文士');
await page.click('#btn-rt-computer');
await page.waitForSelector('.rt-battle-board');
if (!(await page.locator('#rt-arena-head').textContent())?.includes('墨靈書生')) fail('電腦過招沒有進入墨靈戰場');
if (!(await page.locator('.rt-fighter-b .rt-skills').textContent())?.includes('墨靈招式')) fail('電腦過招缺少招式面板');
await page.click('#rt-options .opt-btn');
const immediateRtProgress = await page.locator('#rt-progress').textContent();
if (!immediateRtProgress?.includes('墨靈 0／12')) fail('玩家出招時墨靈不應同時完成反擊');
if (!(await page.locator('#rt-action-log').textContent())?.includes('墨靈正在應招')) fail('玩家出招後缺少分段回合提示');
await page.waitForTimeout(1000);
if (!(await page.locator('#rt-progress').textContent())?.includes('墨靈 1／12')) fail('電腦沒有完成同回合反擊');
if ((await page.locator('#rt-action-log').textContent())?.includes('正在應招')) fail('墨靈反擊後仍停在等待提示');
await page.click('#btn-rt-back');
await page.click('#btn-rt');
await page.fill('#rt-nick', '測試文士');
await page.click('#btn-rt-create');
await page.waitForTimeout(800);
const rtStatus = await page.textContent('#rt-status');
if (!rtStatus?.trim()) fail('PvP 降級訊息未顯示');
await page.evaluate(() => {
  window.WXAPI.call = async (_path, { body }) => {
    if (body.op === 'join') return { ok: 1, token: 'smoke-token', seed: 42, opp: { nick: '對手墨客', petName: '鳴鳳', lv: 3 } };
    if (body.op === 'poll') return { ok: 1, opp: { snap: { nick: '對手墨客', petName: '鳴鳳', lv: 3 }, state: { dmg: 0, round: 0, combo: 0, correct: 0, done: 0 }, hb: Date.now() } };
    return { ok: 1 };
  };
});
await page.fill('#rt-code', '2468');
await page.click('#btn-rt-join');
await page.waitForSelector('.rt-battle-board');
if (await page.locator('.rt-battle-visual > img').count() !== 1) fail('文友過招戰場缺少左右對峙主視覺');
if (!(await page.locator('.rt-round-banner').textContent())?.includes('第 1 回合')) fail('文友過招戰場缺回合標示');
if (!(await page.locator('.rt-round-banner').textContent())?.includes('書院山門')) fail('回合與戰場資訊尚未合併');
if (await page.locator('.rt-terrain').count()) fail('舊戰場浮卡仍殘留，會造成版面堆疊');
if (await page.locator('.rt-fighter').count() !== 2) fail('文友過招戰場不是雙方對峙版面');
if (!(await page.locator('.rt-battle-rules').textContent())?.includes('三連')) fail('文友過招戰場缺招式規則');
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
