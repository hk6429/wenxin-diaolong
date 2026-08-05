import { kvFor } from './_kv.js';

export const REPORT_REASONS = Object.freeze({
  progress: '精熟度或進度異常',
  question: '題目、答案或解析',
  reading: '原文或白話文',
  interface: '畫面或操作問題',
  other: '其他問題',
});

const text = (value, max = 200) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/gu, ' ').trim().slice(0, max);
const list = (value, maxItems = 6, maxText = 300) => Array.isArray(value) ? value.slice(0, maxItems).map((item) => text(item, maxText)) : [];

export function cleanReportBody(body) {
  if (!body || !REPORT_REASONS[body.reason]) return null;
  const source = body.context && typeof body.context === 'object' ? body.context : {};
  const question = source.question && typeof source.question === 'object' ? source.question : {};
  const progress = source.progress && typeof source.progress === 'object' ? source.progress : {};
  return {
    reason: body.reason,
    note: text(body.note, 500),
    context: {
      screen: text(source.screen, 40),
      path: text(source.path, 120),
      level: text(source.level, 10),
      chapterId: text(source.chapterId, 80),
      sceneId: text(source.sceneId, 80),
      quizTitle: text(source.quizTitle, 120),
      question: {
        id: text(question.id, 80),
        work: text(question.work, 120),
        cat: text(question.cat, 80),
        prompt: text(question.prompt, 600),
        options: list(question.options),
        answer: Array.isArray(question.answer) ? list(question.answer) : text(question.answer, 300),
      },
      progress: {
        todayAnswered: Math.max(0, Number(progress.todayAnswered) || 0),
        totalAnswered: Math.max(0, Number(progress.totalAnswered) || 0),
        mastered: Math.max(0, Number(progress.mastered) || 0),
        readingAttempted: Math.max(0, Number(progress.readingAttempted) || 0),
      },
      viewport: text(source.viewport, 30),
      userAgent: text(source.userAgent, 300),
    },
  };
}

export function formatReportText(report) {
  const q = report.context.question;
  const p = report.context.progress;
  return [
    '【文心雕龍問題回報】',
    `類型：${REPORT_REASONS[report.reason]}`,
    `頁面：${report.context.screen || '未知'}｜學段：${report.context.level || '未知'}`,
    report.context.chapterId ? `章回：${report.context.chapterId}${report.context.sceneId ? `／${report.context.sceneId}` : ''}` : '',
    report.context.quizTitle ? `關卡：${report.context.quizTitle}` : '',
    q.id ? `題目：${q.id}｜${q.work || '未標作品'}｜${q.cat || '未標分類'}` : '',
    q.prompt ? `題幹：${q.prompt}` : '',
    q.options.length ? `選項：${q.options.join('／')}` : '',
    q.answer && (Array.isArray(q.answer) ? q.answer.length : q.answer) ? `正解：${Array.isArray(q.answer) ? q.answer.join('、') : q.answer}` : '',
    `進度：今日 ${p.todayAnswered} 題／累積 ${p.totalAnswered} 題／煉成 ${p.mastered} 題／章回已練 ${p.readingAttempted} 題`,
    report.note ? `補充：${report.note}` : '補充：未填',
    `裝置：${report.context.viewport || '未知'}｜${report.context.userAgent || '未知'}`,
  ].filter(Boolean).join('\n');
}

const allowedOrigin = (origin) => origin === 'https://wenxin-diaolong.pages.dev'
  || /^https:\/\/[a-f0-9]{8}\.wenxin-diaolong\.pages\.dev$/u.test(origin || '')
  || /^http:\/\/localhost(?::\d+)?$/u.test(origin || '')
  || /^http:\/\/127\.0\.0\.1(?::\d+)?$/u.test(origin || '');

const headersFor = (request) => ({
  'access-control-allow-origin': allowedOrigin(request.headers.get('origin')) ? request.headers.get('origin') : 'https://wenxin-diaolong.pages.dev',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'Content-Type',
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
});

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: headersFor(request) });
}

export async function onRequestPost({ request, env }) {
  const headers = headersFor(request);
  const cleaned = cleanReportBody(await request.json().catch(() => null));
  if (!cleaned) return new Response(JSON.stringify({ ok: false, error: '回報類型不正確' }), { status: 400, headers });
  if (!env?.wenxin_db) return new Response(JSON.stringify({ ok: false, error: '回報服務暫時無法使用' }), { status: 503, headers });

  const kv = kvFor(env.wenxin_db);
  const ip = text(request.headers.get('cf-connecting-ip') || 'unknown', 80);
  if (await kv.incr(`wx:report:rl:${ip}`, 600) > 6) {
    return new Response(JSON.stringify({ ok: false, error: '回報太頻繁，請稍後再試' }), { status: 429, headers });
  }

  const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...cleaned };
  await kv.lpush('wx:report:inbox', record);
  await kv.ltrim('wx:report:inbox', 0, 199);

  let notified = false;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_REPORT_CHAT_ID) {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_REPORT_CHAT_ID, text: formatReportText(record) }),
    }).catch(() => null);
    notified = Boolean(response?.ok);
  }

  return new Response(JSON.stringify({ ok: true, id: record.id, notified }), { status: 200, headers });
}
