// 文心四靈設計不變式：數值只能來自真實學習量（collection 煉成），不可被互動刷出來。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PETS, LEVEL_STEP, MAX_LEVEL, WRONG_MASTERY_WEIGHT, categoryMastery, petLevel, isUnlocked, battleMods, petEventsOnAnswer } from '../js/meta/pet.js';
import { defaultMeta } from '../js/meta/store.js';

function metaWithForged(ids, wrongIds = []) {
  const meta = defaultMeta();
  for (const id of ids) {
    meta.collection[id] = { grade: 0, wrong: wrongIds.includes(id) ? 2 : 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
  }
  return meta;
}

test('等級 = floor(該區精通值/20)，上限 15', () => {
  const ids = Array.from({ length: 45 }, (_, i) => `rh-e-${String(i).padStart(4, '0')}`);
  const meta = metaWithForged(ids);
  const diaolong = PETS.find((p) => p.id === 'diaolong');
  assert.equal(categoryMastery(meta, '修辭'), 45);
  assert.equal(petLevel(meta, diaolong), Math.floor(45 / LEVEL_STEP));
  const many = metaWithForged(Array.from({ length: 999 }, (_, i) => `rh-e-${i}`));
  assert.equal(petLevel(many, diaolong), MAX_LEVEL);
});

test('答錯過才煉成的題加權 1.5（攻克弱點升更快）', () => {
  const meta = metaWithForged(['gr-e-0001', 'gr-e-0002'], ['gr-e-0002']);
  assert.equal(categoryMastery(meta, '文法'), 1 + WRONG_MASTERY_WEIGHT);
});

test('未煉成的題（earnedAt 空）完全不計入精通值', () => {
  const meta = defaultMeta();
  meta.collection['yl-e-0001'] = { grade: -1, wrong: 5, earnedAt: '', dusty: false, polish: 0, streak: 0 };
  assert.equal(categoryMastery(meta, '格律'), 0);
});

test('petEventsOnAnswer 只偵測、不推進任何數值（重複呼叫零副作用）', () => {
  const meta = metaWithForged(Array.from({ length: 10 }, (_, i) => `rh-e-${i}`));
  petEventsOnAnswer(meta, null, true);
  const before = categoryMastery(meta, '混合');
  for (let i = 0; i < 50; i++) petEventsOnAnswer(meta, null, true);
  assert.equal(categoryMastery(meta, '混合'), before, '重複互動不得改變精通值');
});

test('解鎖門檻與混合類計算', () => {
  const qilin = PETS.find((p) => p.id === 'qilin');
  const meta = metaWithForged([
    ...Array.from({ length: 10 }, (_, i) => `rh-e-${i}`),
    ...Array.from({ length: 10 }, (_, i) => `gr-e-${i}`),
    ...Array.from({ length: 10 }, (_, i) => `yl-e-${i}`),
  ]);
  assert.equal(categoryMastery(meta, '混合'), 30);
  assert.ok(isUnlocked(meta, qilin));
});

test('戰鬥加成上限：damageBonus ≤ 3、只走 opts 注入欄位', () => {
  const meta = metaWithForged(Array.from({ length: 500 }, (_, i) => `rh-e-${i}`));
  meta.pet.active = 'diaolong';
  const mods = battleMods(meta);
  assert.ok(mods.damageBonus <= 3);
  assert.deepEqual(Object.keys(mods).sort(), ['damageBonus', 'freeEliminate']);
});
