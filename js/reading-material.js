function meaningfulText(value) {
  const text = String(value || '').trim();
  return text.length >= 8 ? text : '';
}

function sharedOptionLead(options = []) {
  if (!Array.isArray(options) || options.length < 2) return '';
  const leads = options.map((option) => String(option).split('；')[0].trim());
  if (!leads[0] || leads[0].length < 12) return '';
  return leads.every((lead) => lead === leads[0]) ? leads[0] : '';
}

export function normalizeTraditionalSourceUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\/[^/]+\.cn(?:\/|$)/iu.test(url)) return '';
  if (/[?&]if=gb(?:&|$)/iu.test(url)) return '';
  if (!url.startsWith('https://zh.wikisource.org/')) return url;

  if (url.startsWith('https://zh.wikisource.org/wiki/')) {
    return url.replace('https://zh.wikisource.org/wiki/', 'https://zh.wikisource.org/zh-hant/');
  }
  if (url.startsWith('https://zh.wikisource.org/zh/')) {
    return url.replace('https://zh.wikisource.org/zh/', 'https://zh.wikisource.org/zh-hant/');
  }
  if (url.includes('/w/index.php') && !/[?&]variant=zh-hant(?:&|$)/u.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}variant=zh-hant`;
  }
  return url;
}

function selectSource(entry, sources = []) {
  const candidates = sources
    .filter(Boolean)
    .map((source) => ({ ...source, safeUrl: normalizeTraditionalSourceUrl(source.url) }))
    .filter((source) => source.safeUrl);
  const work = String(entry?.work || '').replace(/[《》〈〉・]/gu, '');
  const matched = work
    ? candidates.find((source) => String(source.label || '').replace(/[《》〈〉・]/gu, '').includes(work))
    : null;
  return matched || candidates.find((source) => source.kind === 'primary') || candidates[0] || null;
}

function materialTitle(entry, guide) {
  if (guide?.title) return guide.title;
  if (entry?.citation) return `${entry.citation}節錄`;
  if (entry?.work) return `〈${entry.work}〉節錄`;
  return '本題公版原文節錄';
}

export function buildReadingMaterial(entry = {}, { guide = null, fallback = null } = {}) {
  if (guide?.excerpt) {
    return {
      kind: 'public-domain-excerpt',
      title: materialTitle(entry, guide),
      excerpt: String(guide.excerpt).trim(),
      translation: entry.level === '國小' ? String(guide.translation || '').trim() : '',
      translationLabel: '白話譯文（本站自譯）',
      support: String(guide.support || '').trim(),
      sourceUrl: normalizeTraditionalSourceUrl(guide.sourceUrl),
      sourceLabel: '查看完整繁體公版原文',
      sharedLead: '',
    };
  }

  if (!fallback) return null;

  const sharedLead = sharedOptionLead(entry.options);
  const source = selectSource(entry, fallback?.sources);
  const text = sharedLead
    || meaningfulText(fallback?.summary)
    || meaningfulText(fallback?.note)
    || meaningfulText(String(entry.answer || '').split('；')[0]);
  if (!text) return null;

  const work = entry.work || entry.citation || fallback?.title || '本幕作品';
  return {
    kind: 'site-study-note',
    title: `${work}・關卡閱讀線索`,
    text,
    note: meaningfulText(fallback?.note),
    translation: entry.level === '國小' ? text : '',
    translationLabel: '白話導讀（本站自編）',
    support: entry.level === '國小'
      ? '先讀懂這段白話導讀，再回到題目找人物、事件與字詞線索。'
      : '這是本站依公版原典整理的作答線索，不是原文逐字翻譯。',
    sourceUrl: source?.safeUrl || '',
    sourceLabel: source?.safeUrl ? '查看完整繁體公版原文' : '',
    sharedLead,
  };
}

export function displayOptionText(option, material) {
  const text = String(option || '');
  if (!material?.sharedLead || !text.startsWith(material.sharedLead)) return text;
  return text.slice(material.sharedLead.length).replace(/^；\s*/u, '').trim() || text;
}
