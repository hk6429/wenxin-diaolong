import fs from 'node:fs';
import { READING_CATS } from './level-design.mjs';

const LEVELS = [
  ['國小', 'elementary'],
  ['國中', 'junior'],
  ['高中', 'senior'],
];

const CONFIGS = [
  {
    key: 'wangwei', group: 'wangmeng', id: 'high-tang-wangwei', order: 19,
    era: '盛唐・空山詩境', figure: '王維', work: '山居秋暝', sourceId: 'autumn-mountain',
    title: '盛唐・王維〈空山新雨〉', heroTitle: '走入空山，遇見王維',
    pageName: '空山之頁', echoTitle: '松泉回音',
    tagline: '一場秋雨洗亮空山。王維請你聽見松風、清泉、竹喧與蓮動各自在詩中的位置。',
    epithet: '在光影與聲響之間安排山居世界的盛唐詩人',
    riskNote: '〈山居秋暝〉通行分類為五言律詩；本站不以現代國語聲調直接判定唐詩平仄。',
    vows: [['明月松間照', '先看光落在哪裡。'], ['清泉石上流', '再聽聲音如何穿過畫面。'], ['王孫自可留', '最後判斷詩人為何願意留下。']],
    zhuyin: ['ㄨㄤˊ', 'ㄨㄟˊ'],
  },
  {
    key: 'menghaoran', group: 'wangmeng', id: 'high-tang-menghaoran', order: 20,
    era: '盛唐・故莊田園', figure: '孟浩然', work: '過故人莊', sourceId: 'old-friend-farm',
    title: '盛唐・孟浩然〈故莊菊約〉', heroTitle: '循著菊香，遇見孟浩然',
    pageName: '故莊之頁', echoTitle: '菊約回音',
    tagline: '故人備好雞黍，田園也準備好一場不急著結束的相聚。孟浩然邀你讀懂景色裡的人情。',
    epithet: '把田家風光、朋友談笑與重陽約定寫進同一首詩的盛唐詩人',
    riskNote: '〈過故人莊〉第三聯有「開筵」與「開軒」異文；本站依所列底本採「開筵」，不以異文字樣判定學生錯誤。',
    vows: [['故人具雞黍', '從一頓飯看見真誠邀請。'], ['把酒話桑麻', '從談話讀出田園裡的人情。'], ['還來就菊花', '從約定看見關係仍會延續。']],
    zhuyin: ['ㄇㄥˋ', 'ㄏㄠˋ', 'ㄖㄢˊ'],
  },
  {
    key: 'gaoshi', group: 'frontier', id: 'high-tang-gaoshi', order: 21,
    era: '盛唐・燕歌邊地', figure: '高適', work: '燕歌行並序', sourceId: 'yan-song',
    title: '盛唐・高適〈燕歌邊聲〉', heroTitle: '踏入邊地，遇見高適',
    pageName: '燕歌之頁', echoTitle: '邊聲回音',
    tagline: '鼓聲震動塞外，戰士與將領的處境卻不相同。高適要你穿過聲勢，看見戰爭真正的代價。',
    epithet: '在邊塞壯闊與軍中不平之間保留批判目光的盛唐詩人',
    riskNote: '〈燕歌行並序〉通行本有多處異文；本站鎖定所列維基文庫版本，不混用不同底本。',
    vows: [['漢家煙塵在東北', '先確認戰事如何被展開。'], ['戰士軍前半死生', '把目光留給承受代價的人。'], ['至今猶憶李將軍', '辨認結尾寄託的期待與批判。']],
    zhuyin: ['ㄍㄠ', 'ㄕˋ'],
  },
  {
    key: 'wangchangling', group: 'frontier', id: 'high-tang-wangchangling', order: 22,
    era: '盛唐・秦月關塞', figure: '王昌齡', work: '出塞其一', sourceId: 'out-frontier',
    title: '盛唐・王昌齡〈秦月長關〉', heroTitle: '走上關塞，遇見王昌齡',
    pageName: '秦月之頁', echoTitle: '長關回音',
    tagline: '同一輪月照過秦漢，也照著尚未歸來的人。王昌齡請你從短短四句讀出千年的重量。',
    epithet: '以凝鍊絕句把關塞、時間與未歸之人疊在一起的盛唐詩人',
    riskNote: '〈出塞・其一〉第二句另有異文；本站採「萬里長征人未還」，不把另一版本判為錯誤。',
    vows: [['秦時明月漢時關', '先分辨互文與時空疊合。'], ['萬里長征人未還', '不讓未歸者只剩一個數字。'], ['不教胡馬度陰山', '辨認願望、條件與現實的距離。']],
    zhuyin: ['ㄨㄤˊ', 'ㄔㄤ', 'ㄌㄧㄥˊ'],
  },
  {
    key: 'censhen', group: 'frontier', id: 'high-tang-censhen', order: 23,
    era: '盛唐・輪臺風雪', figure: '岑參', work: '白雪歌送武判官歸京', sourceId: 'snow-song',
    title: '盛唐・岑參〈風雪送歸〉', heroTitle: '穿過風雪，遇見岑參',
    pageName: '雪歌之頁', echoTitle: '輪臺回音',
    tagline: '北風捲地，白雪忽然像春花盛開。岑參請你一面看奇景，一面記得這仍是一場艱難送別。',
    epithet: '以奇峭想像寫出塞外風雪與送別情意的盛唐詩人',
    riskNote: '〈白雪歌送武判官歸京〉有「角／雕」「難／猶」「百丈／千尺」等異文；本站題目不混考。',
    vows: [['忽如一夜春風來', '辨認想像如何改變雪景。'], ['瀚海闌干百丈冰', '看見壯闊背後的嚴寒。'], ['雪上空留馬行處', '從空白與足跡讀懂送別。']],
    zhuyin: ['ㄘㄣˊ', 'ㄕㄣ'],
  },
  {
    key: 'wangzhihuan', group: 'twintowers', id: 'high-tang-wangzhihuan', order: 24,
    era: '盛唐・鸛雀樓', figure: '王之渙', work: '登鸛雀樓', sourceId: 'stork',
    title: '盛唐・王之渙〈更上一樓〉', heroTitle: '登上高樓，遇見王之渙',
    pageName: '鸛樓之頁', echoTitle: '千里回音',
    tagline: '夕陽、黃河與樓梯構成一條向上的視線。王之渙要你判斷，詩句如何從眼前景物推向更遠的志意。',
    epithet: '用二十個字把登樓視野與進取志意推向遠方的盛唐詩人',
    riskNote: '〈登鸛雀樓〉通行歸王之渙，所列公版頁面另註一作朱斌；本站保留歸屬異說，也不把「黃河入海」當成樓上可直接測量的地理紀錄。',
    vows: [['白日依山盡', '先看視線如何由近及遠。'], ['黃河入海流', '分辨詩筆延展與地理測量。'], ['更上一層樓', '理解行動如何回應願望。']],
    zhuyin: ['ㄨㄤˊ', 'ㄓ', 'ㄏㄨㄢˋ'],
  },
  {
    key: 'cuihao', group: 'twintowers', id: 'high-tang-cuihao', order: 25,
    era: '盛唐・黃鶴樓', figure: '崔顥', work: '黃鶴樓', sourceId: 'crane',
    title: '盛唐・崔顥〈日暮鄉關〉', heroTitle: '登臨江樓，遇見崔顥',
    pageName: '黃鶴之頁', echoTitle: '鄉關回音',
    tagline: '傳說中的黃鶴已去，眼前只剩白雲、芳草與江上煙波。崔顥請你沿著章法找到鄉愁如何出現。',
    epithet: '從黃鶴傳說轉向江城實景，再於日暮收束鄉愁的盛唐詩人',
    riskNote: '〈黃鶴樓〉採首句作「昔人已乘黃鶴去」的固定底本；黃鶴傳說是詩歌材料，不作可直接證實的歷史事件。',
    vows: [['黃鶴一去不復返', '分清傳說材料與歷史事實。'], ['晴川歷歷漢陽樹', '讓眼前實景接回登樓位置。'], ['煙波江上使人愁', '追蹤日暮如何喚起鄉關。']],
    zhuyin: ['ㄘㄨㄟ', 'ㄏㄠˋ'],
  },
];

function chineseNumber(value) {
  const digits = '零一二三四五六七八九';
  if (value < 10) return digits[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${tens === 1 ? '' : digits[tens]}十${ones ? digits[ones] : ''}`;
}

function quest(config, duel = false) {
  return {
    bankKey: config.key,
    count: 5,
    authors: [config.figure],
    works: [config.work],
    catsByLevel: Object.fromEntries(Object.entries(READING_CATS).map(([level, cats]) => [level, [...cats]])),
    ...(duel ? { id: `${config.key}-duel` } : {}),
  };
}

function choices(config, sceneIndex) {
  return [
    { id: `${config.key}-${sceneIndex}-literal`, label: '先找原文明寫的線索', response: `${config.figure}點頭，作品中的人物、景物與動作逐一清楚起來。` },
    { id: `${config.key}-${sceneIndex}-structure`, label: '再看前後句如何連接', response: `頁面展開，單句被放回${config.work}的完整章法中。` },
    { id: `${config.key}-${sceneIndex}-boundary`, label: '分清文本、推論與史實', response: '守卷閣的證據尺亮起，想像與可查證事實各自回到正確位置。' },
  ];
}

function scene(config, index, title, fact, kind, art, mode = 'quest') {
  const primary = kind === 'primary';
  return {
    id: `${config.key}-${index}`,
    title,
    contentKind: kind,
    sourceIds: primary ? [config.sourceId, 'fiction'] : ['fiction'],
    story: {
      國小: `${config.figure}展開${config.work}的第 ${index} 道線索。先看清楚詩裡寫了誰、發生什麼事，以及景物怎麼改變。`,
      國中: `${config.figure}不只問字面意思，還要你把這道線索放回前後句，說明段落、修辭與情緒如何互相推進。`,
      高中: `${config.figure}要求你檢查這項解讀的證據範圍：哪些是原文明示、哪些是合理推論，哪些仍須版本或史料支持。`,
    },
    body: {
      國小: `${fact}。先從作品直接提供的線索開始判斷。`,
      國中: `${fact}。接著說明這項安排在句段中產生的作用。`,
      高中: `${fact}。最後評估這項主張能否延伸到作者生平、時代背景或其他版本。`,
    },
    factNote: `${config.figure}${config.work}的原文採本章所列公版來源；${config.riskNote}本幕對話、守卷閣與挑戰情節為本站原創。`,
    choices: choices(config, index),
    ...(primary ? {
      visual: { art, mode, ...(mode === 'duel' ? { opponent: config.figure } : {}) },
      quest: quest(config, mode === 'duel'),
    } : {}),
  };
}

const definitions = [];
for (const config of CONFIGS) {
  for (const [level, suffix] of LEVELS) {
    const ownBankPath = `data/${config.key}-${suffix}.json`;
    const groupBankPath = `data/${config.group}-${suffix}.json`;
    const sourceBank = JSON.parse(fs.readFileSync(fs.existsSync(ownBankPath) ? ownBankPath : groupBankPath, 'utf8'));
    const entries = sourceBank.filter((entry) => entry.author === config.figure && entry.work === config.work);
    if (entries.length !== 5) throw new Error(`${config.figure}${level}應有 5 題，實得 ${entries.length}`);
    fs.writeFileSync(`data/${config.key}-${suffix}.json`, `${JSON.stringify(entries, null, 2)}\n`);
  }

  const ownChapterPath = `data/adventure/${config.key}.json`;
  const groupChapterPath = `data/adventure/${config.group}.json`;
  const sourceChapter = JSON.parse(fs.readFileSync(fs.existsSync(ownChapterPath) ? ownChapterPath : groupChapterPath, 'utf8'));
  const primarySource = sourceChapter.sources.find((source) => source.id === config.sourceId);
  if (!primarySource) throw new Error(`${config.figure}找不到來源 ${config.sourceId}`);
  const facts = JSON.parse(fs.readFileSync(`data/${config.key}-elementary.json`, 'utf8')).map((entry) => entry.answer);
  const art = {
    cover: `adventure-${config.group}-cover.webp`,
    scene: `adventure-${config.group}-scene.webp`,
    duel: `adventure-${config.group}-duel.webp`,
  };
  const scenes = [
    scene(config, 1, `${config.figure}・獨立開卷`, facts[0], 'fiction', art.cover),
    scene(config, 2, `${config.work}・初見`, facts[0], 'primary', art.cover),
    scene(config, 3, '文字線索・景與人', facts[1], 'primary', art.scene),
    scene(config, 4, '章法轉折・前與後', facts[2], 'primary', art.scene),
    scene(config, 5, '觀點回聲・證據尺', facts[3], 'primary', art.scene),
    scene(config, 6, `${config.figure}問筆`, facts[4], 'primary', art.duel, 'duel'),
    scene(config, 7, `${config.pageName}・歸卷`, facts[4], 'fiction', art.cover),
  ];
  const chapter = {
    id: config.id,
    title: config.title,
    version: 1,
    variantNote: config.riskNote,
    storyFrame: {
      tagline: config.tagline,
      epithet: config.epithet,
      vows: config.vows.map(([quote, insight], index) => ({ id: `${config.key}-vow-${index + 1}`, quote, insight })),
    },
    sources: [primarySource, { id: 'fiction', kind: 'fiction', label: `${config.figure}獨立章回、守卷閣對話與對戰為本站原創` }],
    annotations: [{ text: config.figure, bopomofo: config.zhuyin }],
    scenes,
  };
  fs.writeFileSync(`data/adventure/${config.key}.json`, `${JSON.stringify(chapter, null, 2)}\n`);
  definitions.push({
    id: config.id,
    order: config.order,
    number: chineseNumber(config.order),
    era: config.era,
    figure: config.figure,
    file: config.key,
    title: config.title,
    heroTitle: config.heroTitle,
    pageName: config.pageName,
    echoTitle: config.echoTitle,
    art: `adventure-${config.group}-cover`,
    sceneIds: scenes.map((item) => item.id),
    rewards: [`page-${config.key}`, `token-${config.key}`, `friend-${config.key}`],
    echoQuest: { bankKey: config.key, count: 3, authors: [config.figure], works: [config.work] },
  });
}

const output = `// 由 scripts/generate-individual-tang-chapters.mjs 產生，請勿手動編輯。\n`
  + `export const INDIVIDUAL_TANG_CHAPTERS = Object.freeze(${JSON.stringify(definitions, null, 2)});\n`;
fs.writeFileSync('js/adventure-individual-chapters.js', output);
console.log(`generated ${CONFIGS.length} individual Tang chapters and ${CONFIGS.length * 15} levelled entries`);
