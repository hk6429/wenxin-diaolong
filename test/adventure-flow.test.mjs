import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAPTERS } from '../js/adventure.js';
import { questActionLabel, questCompleteLabel } from '../js/quest-copy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('三、四、五、六、八題關卡皆依實際題數顯示，不再一律寫五題', () => {
  const counts = new Set();
  for (const definition of CHAPTERS) {
    const chapter = JSON.parse(fs.readFileSync(path.join(ROOT, `data/adventure/${definition.file}.json`), 'utf8'));
    for (const scene of chapter.scenes.filter((item) => item.quest)) counts.add(scene.quest.count);
  }
  assert.deepEqual([...counts].sort((a, b) => a - b), [3, 4, 5, 6, 8]);
  for (const count of counts) {
    assert.equal(questActionLabel(count, false), `接受${count}題委託`);
    assert.equal(questActionLabel(count, true), `接受${count}回合對戰`);
    assert.equal(questCompleteLabel(count, '蘇軾', true), `完成${count}回合，繼續蘇軾篇（Enter）`);
  }
});
