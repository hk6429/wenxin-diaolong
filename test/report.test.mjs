import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanReportBody, formatReportText, REPORT_REASONS } from '../functions/api/report.js';

test('回報只接受五種快速分類，前三類不強迫填說明', () => {
  assert.equal(Object.keys(REPORT_REASONS).length, 5);
  assert.equal(cleanReportBody({ reason: 'wrong', note: '' }), null);
  assert.equal(cleanReportBody({ reason: 'progress', note: '' }).note, '');
});

test('回報會保存當下題目、進度與裝置脈絡並限制長度', () => {
  const report = cleanReportBody({
    reason: 'progress',
    note: '精熟度一直是 0'.repeat(100),
    context: {
      screen: 'screen-practice', level: '國小', chapterId: 'preqin-zhuangzi', sceneId: 'butterfly-gate', quizTitle: '蝶夢之門',
      question: { id: 'rd-e-18001', work: '齊物論', cat: '明示訊息', prompt: '哪一項正確？', options: ['甲', '乙'], answer: '甲' },
      progress: { todayAnswered: 5, totalAnswered: 5, mastered: 0, readingAttempted: 5 },
      viewport: '390x844', userAgent: 'Test Browser',
    },
  });
  assert.equal(report.note.length, 500);
  assert.equal(report.context.question.id, 'rd-e-18001');
  assert.equal(report.context.progress.readingAttempted, 5);
  assert.match(formatReportText(report), /精熟度或進度異常/);
  assert.match(formatReportText(report), /rd-e-18001/);
  assert.match(formatReportText(report), /章回已練 5 題/);
});
