export function selectLevelText(variants, level) {
  if (typeof variants === 'string') return variants;
  if (!variants || typeof variants !== 'object') return '';
  return variants[level] ?? variants['國中'] ?? variants['國小'] ?? variants['高中'] ?? '';
}

export function resolveQuest(quest, level) {
  if (!quest || typeof quest !== 'object') return null;
  return { ...quest, cats: quest.catsByLevel?.[level] ?? quest.cats ?? [] };
}
