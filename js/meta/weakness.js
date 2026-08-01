// 弱點分類統計：依「zone·cat」累計正確/錯誤次數，供弱點複習與統計頁顯示。
// 純函式，資料落在 meta.weak（見 store.js）。

export function weakKeyOf(entry) {
  if (!entry) return '';
  return `${entry.zone}·${entry.cat}`;
}

export function recordWeakness(meta, key, correct) {
  if (!key) return;
  if (!meta.weak) meta.weak = {};
  const w = meta.weak[key] || (meta.weak[key] = { correct: 0, wrong: 0 });
  if (correct) w.correct += 1;
  else w.wrong += 1;
}

// 回傳依正確率由低到高排序的弱點分類清單：[{key, zone, cat, correct, wrong, total, accuracy}]
export function getWeaknessSummary(meta) {
  const weak = (meta && meta.weak) || {};
  return Object.keys(weak)
    .map((key) => {
      const { correct, wrong } = weak[key];
      const total = correct + wrong;
      const [zone, cat] = key.split('·');
      return { key, zone, cat, correct, wrong, total, accuracy: total > 0 ? correct / total : 0 };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy);
}
