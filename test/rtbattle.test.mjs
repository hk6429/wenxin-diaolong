import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyComputerTurn, buildComputerScript, COMPUTER_ROUNDS,
} from '../js/meta/rtbattle.js';

test('電腦出招腳本同 seed、同學段必須一致', () => {
  assert.deepEqual(buildComputerScript(42, '國中'), buildComputerScript(42, '國中'));
  assert.equal(buildComputerScript(42, '國中').length, COMPUTER_ROUNDS);
});

test('學段越高，電腦答對回合不會反而減少', () => {
  const levels = ['國小', '國中', '高中', '實戰'];
  const counts = levels.map((level) => buildComputerScript(20260801, level, 500).filter(Boolean).length);
  assert.deepEqual([...counts].sort((a, b) => a - b), counts);
});

test('電腦第三次連續答對發動強招，答錯會斷連擊', () => {
  let state = { dmg: 0, round: 0, combo: 0, correct: 0 };
  state = applyComputerTurn(state, true);
  state = applyComputerTurn(state, true);
  assert.equal(state.dmg, 16);
  state = applyComputerTurn(state, true);
  assert.equal(state.dmg, 28);
  state = applyComputerTurn(state, false);
  assert.equal(state.combo, 0);
  assert.equal(state.round, 4);
});
