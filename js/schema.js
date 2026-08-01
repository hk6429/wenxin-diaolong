// 文心雕龍題目 schema 驗證器（純函式，Node 與瀏覽器共用）。規格見 docs/SPEC.md。
export const LEVELS = new Set(['國小', '國中', '高中', '實戰']);
export const ZONES = { rh: '修辭', gr: '文法', yl: '格律' };

const EXAM_MC = 'exam-mc';
const EXAM_MC_MULTI = 'exam-mc-multi';
const EXAM_FORMATS = new Set([EXAM_MC, EXAM_MC_MULTI]);

export const ZONE_FORMATS = {
  修辭: new Set(['rh-identify', 'rh-pick', 'rh-odd', EXAM_MC, EXAM_MC_MULTI]),
  文法: new Set(['gr-pos', 'gr-structure', 'gr-pattern', 'gr-fix', 'gr-particle', EXAM_MC, EXAM_MC_MULTI]),
  格律: new Set(['yl-rhyme', 'yl-couplet', 'yl-tone', 'yl-form', EXAM_MC, EXAM_MC_MULTI]),
};

export const ZONE_CATS = {
  修辭: new Set(['譬喻', '轉化', '誇飾', '排比', '設問', '類疊', '摹寫', '感嘆',
    '借代', '映襯', '雙關', '層遞', '頂真', '回文', '引用', '倒反', '婉曲', '轉品',
    '互文', '示現', '錯綜', '藏詞', '飛白', '移覺']),
  文法: new Set(['詞性', '詞語結構', '句型', '語病', '文言虛詞', '文言句式', '詞類活用', '標點符號']),
  格律: new Set(['押韻', '對仗', '平仄', '詩體判別', '詞曲常識', '對聯']),
};

// 修辭格首次出現學段（高學段可考低學段的格，反之不可）
export const RH_CAT_LEVEL = {
  國小: ['譬喻', '轉化', '誇飾', '排比', '設問', '類疊', '摹寫', '感嘆'],
  國中: ['借代', '映襯', '雙關', '層遞', '頂真', '回文', '引用', '倒反', '婉曲', '轉品'],
  高中: ['互文', '示現', '錯綜', '藏詞', '飛白', '移覺'],
};

export const GENRE_FORMS = {
  韻文: new Set(['古典詩', '詞', '曲', '新詩', '童謠', '歌謠', '對聯']),
  非韻文: new Set(['文言文', '白話散文', '小說', '應用文', '一般語句']),
};
// 這些文體一律視為「引用真實作品」，citation 必填
const CITATION_REQUIRED_FORMS = new Set(['古典詩', '詞', '曲', '文言文']);

export function zoneOfId(id) {
  if (typeof id !== 'string') return null;
  return ZONES[id.slice(0, 2)] || null;
}

export function validateEntry(entry) {
  const errors = [];
  if (!entry.id || !/^(rh|gr|yl)-[ejsx]-\d{3,5}$/.test(entry.id)) errors.push('id 格式須為 {rh|gr|yl}-{e|j|s|x}-數字');
  if (!LEVELS.has(entry.level)) errors.push('level 須為 國小/國中/高中/實戰');
  if (entry.id && entry.level) {
    const code = entry.id.split('-')[1];
    const expect = { e: '國小', j: '國中', s: '高中', x: '實戰' }[code];
    if (expect && expect !== entry.level) errors.push('id 學段碼與 level 不一致');
  }
  const zone = zoneOfId(entry.id);
  if (!zone || entry.zone !== zone) errors.push('zone 必須與 id 前綴一致（rh↔修辭、gr↔文法、yl↔格律）');
  // 實戰真題官方未細標修辭格/文法點時，允許 cat=綜合
  const catOk = ZONE_CATS[zone]?.has(entry.cat) || (entry.level === '實戰' && entry.cat === '綜合');
  if (zone && !catOk) errors.push(`cat「${entry.cat}」不在 ${zone} 區控制詞表內`);
  if (zone && (typeof entry.qformat !== 'string' || !ZONE_FORMATS[zone]?.has(entry.qformat))) {
    errors.push(`qformat「${entry.qformat}」不允許用於 ${zone} 區`);
  }
  // 修辭格不得超前學段（實戰真題豁免——官方怎麼考就怎麼收）
  if (zone === '修辭' && entry.level !== '實戰' && LEVELS.has(entry.level)) {
    const order = ['國小', '國中', '高中'];
    const allowed = order.slice(0, order.indexOf(entry.level) + 1).flatMap((lv) => RH_CAT_LEVEL[lv]);
    if (entry.cat && !allowed.includes(entry.cat)) errors.push(`修辭格「${entry.cat}」尚未在 ${entry.level} 學段出現`);
  }

  const isExam = EXAM_FORMATS.has(entry.qformat);
  const allowedCounts = isExam ? [4, 5] : [4];
  if (!Array.isArray(entry.options) || !allowedCounts.includes(entry.options.length)) {
    errors.push(isExam ? 'options 須為 4 或 5 個' : 'options 須為恰好 4 個');
  } else if (entry.options.some((o) => typeof o !== 'string' || o.length === 0)
    || new Set(entry.options).size !== entry.options.length) {
    errors.push('options 須為互異的非空字串');
  }
  if (entry.qformat === EXAM_MC_MULTI) {
    const opts = Array.isArray(entry.options) ? entry.options : [];
    if (!Array.isArray(entry.answer) || entry.answer.length < 2
      || new Set(entry.answer).size !== entry.answer.length
      || entry.answer.some((a) => !opts.includes(a))) {
      errors.push('複選 answer 須為 ≥2 個互異且都在 options 內的字串');
    }
  } else if (!entry.answer || !Array.isArray(entry.options) || !entry.options.includes(entry.answer)) {
    errors.push('answer 須非空且在 options 內');
  }
  if (!entry.question) errors.push('question 必填');

  if (entry.origin !== '自編' && entry.origin !== '真題') errors.push('origin 須為 自編 或 真題');
  if (entry.origin === '真題') {
    if (!entry.year) errors.push('真題必填 year');
    if (!entry.citation) errors.push('真題必填 citation');
  } else {
    if (!entry.explain || String(entry.explain).length < 10) errors.push('自編題 explain 必填且須有實質辨析');
  }
  // 實戰真題無法逐題判定文體，genre/textForm 可缺；自編題必填
  const genreOptional = entry.level === '實戰' && entry.genre === undefined && entry.textForm === undefined;
  if (!genreOptional) {
    if (!GENRE_FORMS[entry.genre]) errors.push('genre 須為 韻文 或 非韻文');
    else if (!GENRE_FORMS[entry.genre].has(entry.textForm)) {
      errors.push(`textForm「${entry.textForm}」與 genre「${entry.genre}」不符`);
    }
  }
  if (CITATION_REQUIRED_FORMS.has(entry.textForm) && !entry.citation) {
    errors.push(`textForm=${entry.textForm} 視為引用真實作品，citation 必填`);
  }
  if (entry.difficulty !== undefined && !['易', '中', '難'].includes(entry.difficulty)) {
    errors.push('difficulty 須為 易/中/難');
  }
  return { valid: errors.length === 0, errors };
}
