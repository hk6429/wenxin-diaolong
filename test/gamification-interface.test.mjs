import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInterfaceView, SESSION_SIZES } from '../js/gamification/interface.js';

const bank = [
  { id: 'r1', zone: '修辭' }, { id: 'r2', zone: '修辭' },
  { id: 'g1', zone: '文法' }, { id: 'p1', zone: '格律' },
];
const meta = {
  daily: { todayAnswered: 3 },
  collection: { r1: { earnedAt: 'now' }, g1: { earnedAt: 'now' } },
};
const chapter = { id: 'preqin-zhuangzi', figure: '莊子', sceneIds: Array.from({ length: 8 }, (_, i) => `s${i}`) };

test('U01-U05：今日任務、續玩、弱點捷徑、短回合與推薦分區可直接呈現', () => {
  const view = buildInterfaceView({ meta, bank, adventure: { sceneIndex: 2 }, chapter, level: '國小' });
  assert.match(view.mission.title, /3/);
  assert.match(view.continueAdventure.label, /第 3 幕/);
  assert.equal(view.weaknessShortcut.safe, true);
  assert.deepEqual(SESSION_SIZES, [5, 10, 15]);
  assert.equal(view.recommendedZone.zone, '格律');
});

test('U06-U10：獎勵透明、精熟羅盤、里程碑、靜心與自主權皆有穩定欄位', () => {
  const view = buildInterfaceView({ meta, bank, adventure: { sceneIndex: 2 }, chapter, level: '國中' });
  assert.equal(view.rewardPreview.noLootBox, true);
  assert.equal(view.masteryCompass.length, 3);
  assert.equal(view.nextMilestone.target, 50);
  assert.match(view.calmMode.effect, /不影響/);
  assert.match(view.autonomy.message, /不會扣分/);
});

test('空資料也能安全產生介面，不以零除或負值製造壓力', () => {
  const view = buildInterfaceView();
  assert.ok(Number.isFinite(view.nextMilestone.current));
  assert.ok(view.sessionChoices.every((item) => item.count > 0));
});
