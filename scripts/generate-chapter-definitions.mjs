import fs from 'node:fs';

const rows = [
  ['hanyu', 22, '中唐・古文運動', '韓愈'],
  ['liuzongyuan', 23, '中唐・永州', '柳宗元'],
  ['baijuyi', 24, '中唐・新樂府', '白居易'],
  ['liuyuxi', 25, '中唐・陋室春臺', '劉禹錫'],
  ['dumu', 26, '晚唐・金陵詩境', '杜牧'],
  ['lishangyin', 27, '晚唐・錦瑟詩境', '李商隱'],
  ['liyu', 28, '五代十國・故國詞境', '李煜'],
  ['ouyangxiu', 29, '北宋・醉翁山水', '歐陽修'],
  ['wanganshi', 30, '北宋・金陵文境', '王安石'],
  ['suxun', 31, '北宋・策論書房', '蘇洵'],
  ['sushi', 32, '北宋・江月文境', '蘇軾'],
  ['suzhe', 33, '北宋・快哉樓', '蘇轍'],
  ['zenggong', 34, '北宋・墨池', '曾鞏'],
  ['fanzhongyan', 35, '北宋・岳陽樓', '范仲淹'],
  ['liuyong', 36, '北宋・長調詞境', '柳永'],
  ['huangtingjian', 37, '北宋・快閣詩境', '黃庭堅'],
  ['qinguan', 38, '北宋・星橋詞境', '秦觀'],
  ['yanshu', 39, '北宋・落花詞境', '晏殊'],
  ['yuefei', 40, '南宋・孤忠長夜', '岳飛'],
  ['liqingzhao', 41, '南宋・易安詞境', '李清照'],
  ['luyou', 42, '南宋・山河詩境', '陸游'],
  ['xinqiji', 43, '南宋・北固詞境', '辛棄疾'],
  ['wentianxiang', 44, '南宋・丹心史境', '文天祥'],
  ['guanhanqing', 45, '元代・雜劇舞臺', '關漢卿'],
  ['mazhiyuan', 46, '元代・散曲秋境', '馬致遠'],
  ['baipu', 47, '元代・秋色劇場', '白樸'],
  ['zhengguangzu', 48, '元代・倩魂劇場', '鄭光祖'],
  ['luoguanzhong', 49, '明代・三國群雄', '羅貫中'],
  ['shinaian', 50, '明代・水滸江湖', '施耐庵'],
  ['wuchengen', 51, '明代・西遊幻境', '吳承恩'],
  ['pusongling', 52, '清代・聊齋夜話', '蒲松齡'],
  ['caoxueqin', 53, '清代・紅樓一夢', '曹雪芹'],
];

function chineseNumber(value) {
  const digits = '零一二三四五六七八九';
  if (value < 10) return digits[value];
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${tens === 1 ? '' : digits[tens]}十${ones ? digits[ones] : ''}`;
}

const definitions = rows.map(([key, order, era, figure]) => {
  const chapter = JSON.parse(fs.readFileSync(`data/adventure/${key}.json`, 'utf8'));
  return {
    id: chapter.id,
    order,
    number: chineseNumber(order),
    era,
    figure,
    file: key,
    title: chapter.title,
    heroTitle: `穿越${era}，遇見${figure}`,
    pageName: `${figure}之頁`,
    echoTitle: `${figure}回音`,
    art: `adventure-${key}-cover`,
    sceneIds: chapter.scenes.map((scene) => scene.id),
    rewards: [`page-${key}`, `token-${key}`, `friend-${key}`],
    echoQuest: { bankKey: key, count: 3, authors: [figure] },
  };
});

const output = `// 由 scripts/generate-chapter-definitions.mjs 依章節資料產生，請勿手動編輯。\n`
  + `export const EXTENDED_CHAPTERS = Object.freeze(${JSON.stringify(definitions, null, 2)});\n`;

fs.writeFileSync('js/adventure-chapters.js', output);
console.log(`generated ${definitions.length} chapter definitions`);
