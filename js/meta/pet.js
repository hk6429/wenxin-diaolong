// 文心四靈：收藏養成層。設計不變式（純邏輯測試鎖定）：
//   等級不存檔，一律由圖鑑精通量推算：level = floor(該區精通值 / 20)，上限 15。
//   精通值 = 已煉成題數；曾答錯過才煉成的題加權 1.5（攻克弱點升得快）。
//   任何互動（點擊/查看）都不能推進數值——唯一路徑是真的把題目練熟。
export const LEVEL_STEP = 20;
export const MAX_LEVEL = 15;
export const WRONG_MASTERY_WEIGHT = 1.5;

// category：'修辭'/'文法'/'格律' 依 id 前綴計；'混合' 全收。
export const PETS = [
  {
    id: 'diaolong', name: '雕龍', category: '修辭', unlockAt: 0, icon: '🐉',
    intro: '劉勰筆下躍出的文心之龍，最愛雕琢辭采。',
    lines: ['初見：你也想學雕琢文字嗎？', '漸熟：你的辭采，開始有光了。', '知己：字字珠璣，你我共雕此龍。'],
  },
  {
    id: 'mingfeng', name: '鳴鳳', category: '格律', unlockAt: 5, icon: '🐦‍🔥',
    intro: '棲於梧桐的韻律之鳳，一鳴便合宮商。',
    lines: ['初見：你聽得出詩句裡的節拍嗎？', '漸熟：你的耳朵，越來越懂押韻了。', '知己：平平仄仄，皆是你我的和鳴。'],
  },
  {
    id: 'xuangui', name: '玄龜', category: '文法', unlockAt: 5, icon: '🐢',
    intro: '馱著文法典籍的上古玄龜，走得慢，錯不了。',
    lines: ['初見：句子的骨架，要一根一根摸清。', '漸熟：你拆解句子的手法愈發俐落。', '知己：萬句之法，盡在你我掌中。'],
  },
  {
    id: 'qilin', name: '麒麟', category: '混合', unlockAt: 30, icon: '🦄',
    intro: '文林祥獸，唯有三藝兼修者能得一見。',
    lines: ['初見：能見到我，代表你三藝皆有根基。', '漸熟：你的文心，已然圓融。', '知己：文質彬彬，然後君子——說的就是你。'],
  },
];

const ZONE_OF_PREFIX = { rh: '修辭', gr: '文法', yl: '格律' };

function idCategory(id) {
  return ZONE_OF_PREFIX[String(id).slice(0, 2)] || null;
}

// 精通值：掃 meta.collection，earnedAt 有值才算（唯一數值來源＝真實學習量）
export function categoryMastery(meta, category) {
  let n = 0;
  for (const [id, r] of Object.entries(meta.collection || {})) {
    if (!r?.earnedAt) continue;
    if (category !== '混合' && idCategory(id) !== category) continue;
    n += r.wrong > 0 ? WRONG_MASTERY_WEIGHT : 1;
  }
  return n;
}

export function petLevel(meta, pet) {
  return Math.min(MAX_LEVEL, Math.floor(categoryMastery(meta, pet.category) / LEVEL_STEP));
}

export function isUnlocked(meta, pet) {
  return categoryMastery(meta, pet.category) >= pet.unlockAt;
}

export function bondStage(meta, pet) {
  const lv = petLevel(meta, pet);
  return lv >= 10 ? 2 : lv >= 4 ? 1 : 0;
}

// 戰鬥加成：全部折算進 battle-adapter 既有的 opts 注入點，不動戰鬥引擎。
export function battleMods(meta) {
  const active = PETS.find((p) => p.id === meta.pet?.active);
  if (!active || !isUnlocked(meta, active)) return { damageBonus: 0, freeEliminate: 0 };
  const lv = petLevel(meta, active);
  return { damageBonus: Math.min(3, Math.floor(lv / 5)), freeEliminate: lv >= 8 ? 1 : 0 };
}

// kernel 每題結算後呼叫：偵測解鎖與升級，發事件（不改任何數值——數值由 collection 推算）
export function petEventsOnAnswer(meta, _entry, _correct) {
  const events = [];
  if (!meta.pet) meta.pet = { seen: {}, active: null, ownedEquip: [], equipped: {}, unlockedAt: {} };
  for (const pet of PETS) {
    const unlocked = isUnlocked(meta, pet);
    if (unlocked && !meta.pet.unlockedAt[pet.id]) {
      meta.pet.unlockedAt[pet.id] = new Date().toISOString();
      if (!meta.pet.active) meta.pet.active = pet.id;
      events.push({ type: 'petUnlocked', payload: { id: pet.id, name: pet.name, icon: pet.icon, intro: pet.intro }, fx: 'pet-unlock' });
    }
    const lv = petLevel(meta, pet);
    const seenLv = meta.pet.seen[pet.id] ?? 0;
    if (unlocked && lv > seenLv) {
      meta.pet.seen[pet.id] = lv;
      if (seenLv > 0 || lv > 0) {
        events.push({ type: 'petLevelUp', payload: { id: pet.id, name: pet.name, icon: pet.icon, level: lv }, fx: 'pet-level' });
      }
    }
  }
  return events;
}
