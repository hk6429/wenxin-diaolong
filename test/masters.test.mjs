import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { masterUnlocked, masterStrike, recordMasterWin, beatenCount } from '../js/meta/masters.js';
import { defaultMeta } from '../js/meta/store.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MASTERS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'masters.json'), 'utf8'));

test('masters.json 結構與難度曲線', () => {
  assert.ok(MASTERS.length >= 8);
  const ids = new Set();
  let prevAtk = 0;
  for (const m of MASTERS) {
    for (const k of ['id', 'name', 'icon', 'bankKey', 'unlockZone', 'unlockAt', 'atk', 'hp', 'intro', 'taunt', 'winLine', 'loseLine']) {
      assert.ok(m[k] !== undefined && m[k] !== '', `${m.id || '?'} 缺 ${k}`);
    }
    assert.ok(['rhetoric', 'grammar', 'prosody', 'mixed'].includes(m.bankKey));
    assert.ok(['修辭', '文法', '格律', '混合'].includes(m.unlockZone));
    assert.ok(!ids.has(m.id)); ids.add(m.id);
    assert.ok(m.atk >= prevAtk, '難度須遞增排列');
    prevAtk = m.atk;
  }
  // 非線性：後段跳幅要大於前段（不可等差）
  const gaps = MASTERS.slice(1).map((m, i) => m.atk - MASTERS[i].atk);
  assert.ok(new Set(gaps).size > 1, '難度曲線不可是等差級數');
});

test('解鎖靠真實精通量、首位大師人人可戰', () => {
  const meta = defaultMeta();
  assert.ok(masterUnlocked(meta, MASTERS[0]), '第一位大師 unlockAt=0');
  assert.ok(!masterUnlocked(meta, MASTERS[MASTERS.length - 1]), '最終 boss 不可一開場就解鎖');
});

test('低血量留手與勝場記錄', () => {
  const boss = MASTERS[MASTERS.length - 1];
  assert.ok(masterStrike(boss, 20) < masterStrike(boss, 100));
  const meta = defaultMeta();
  assert.ok(recordMasterWin(meta, 'libai'), '首勝回傳 true');
  assert.ok(!recordMasterWin(meta, 'libai'), '二勝回傳 false');
  assert.equal(beatenCount(meta), 1);
});
