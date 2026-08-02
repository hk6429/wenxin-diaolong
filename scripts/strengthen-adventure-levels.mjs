import fs from 'node:fs';
import { buildLevelFields, LEVEL_DESIGN, READING_CATS } from './level-design.mjs';

const REBUILD_KEYS = [
  'hanyu', 'liuzongyuan', 'baijuyi', 'liuyuxi', 'dumu', 'lishangyin', 'liyu',
  'ouyangxiu', 'wanganshi', 'suxun', 'sushi', 'suzhe', 'zenggong', 'fanzhongyan',
  'liuyong', 'huangtingjian', 'qinguan', 'yanshu',
  'yuefei', 'liqingzhao', 'luyou', 'xinqiji', 'wentianxiang',
  'guanhanqing', 'mazhiyuan', 'baipu', 'zhengguangzu',
  'luoguanzhong', 'shinaian', 'wuchengen', 'pusongling', 'caoxueqin',
];

const EARLIER_KEYS = [
  'lunyu', 'shiji', 'duange', 'dianlun', 'caozhi', 'chushibiao', 'jikang', 'shishuo',
  'taoyuanming', 'xielingyun', 'wangxizhi', 'wangbo', 'luobinwang', 'dushenyan',
  'libai', 'dufu', 'wangmeng', 'frontier', 'twintowers',
];

const EARLIER_CHAPTER_FILES = {
  lunyu: 'confucius', shiji: 'simaqian', duange: 'caocao', dianlun: 'caopi',
  caozhi: 'caozhi', chushibiao: 'zhugeliang', jikang: 'jikang', shishuo: 'shishuo',
  taoyuanming: 'taoyuanming', xielingyun: 'xielingyun', wangxizhi: 'wangxizhi',
  wangbo: 'wangbo', luobinwang: 'luobinwang', dushenyan: 'dushenyan', libai: 'libai',
  dufu: 'dufu', wangmeng: 'wangmeng', frontier: 'frontier', twintowers: 'twintowers',
};

const CUSTOM_FACTS = {
  liuyuxi: [
    '「斯是陋室，惟吾德馨」把居所是否可貴連到居住者的品德，而不是房屋大小。',
    '「苔痕上階綠，草色入簾青」以綠色景物寫出陋室清幽，也暗示環境少人打擾。',
    '「談笑有鴻儒，往來無白丁」從交往人物側面表現主人重視學問與志趣。',
    '「無絲竹之亂耳，無案牘之勞形」用兩個否定句寫出沒有嘈雜宴樂與公務勞累的生活。',
    '篇末列舉諸葛廬、子雲亭，再引孔子「何陋之有」，共同收束陋室不陋的主張。',
    '「巴山楚水淒涼地，二十三年棄置身」交代詩人長期遭貶、遠離朝廷的處境。',
    '聞笛賦與爛柯人的典故分別連到悼念故友及返鄉後恍如隔世的感受。',
    '「沉舟側畔千帆過」以沉舟和千帆並置，呈現受挫者與持續前進世界的張力。',
    '「病樹前頭萬木春」與上句構成對偶，從個人衰病轉向新生事物蓬勃發展。',
    '「今日聽君歌一曲，暫憑杯酒長精神」回應白居易贈詩，也把情緒轉向振作。',
  ],
  dumu: [
    '「覆壓三百餘里，隔離天日」以誇張尺度先建立阿房宮龐大、遮蔽天空的整體印象。',
    '「五步一樓，十步一閣」用密集數量與整齊句式，寫宮室連綿、建築繁複。',
    '「鼎鐺玉石，金塊珠礫」把珍寶當日常器物，顯示秦宮揮霍與價值顛倒。',
    '「後人哀之而不鑑之」從敘寫宮殿與秦亡轉為警告後世應吸取歷史教訓。',
    '〈赤壁〉先從沉沙折戟這件小物寫起，再由辨認舊物轉入對歷史成敗的想像。',
    '「東風不與周郎便」用假設語氣改變赤壁勝負條件，追問英雄成功與時勢機會的關係。',
    '「銅雀春深鎖二喬」以人物命運想像戰敗後果，並非史書對實際事件的逐字記錄。',
    '「煙籠寒水月籠沙」讓煙、水、月、沙彼此交疊，先形成朦朧而帶寒意的秦淮夜景。',
    '「商女不知亡國恨」表面責備歌女，深層批判的是仍沉迷享樂、忽略歷史教訓的人。',
    '「隔江猶唱後庭花」以亡國歌曲收尾，使眼前歌聲和陳後主覆亡的歷史記憶重疊。',
  ],
  lishangyin: [
    '〈錦瑟〉從無端五十弦起筆，由樂器觸發對往事與情感的追憶。',
    '「莊生曉夢迷蝴蝶」借用莊周夢蝶典故，寫夢境、身分與記憶難以分清的感受。',
    '「滄海月明珠有淚」把月、海、珠、淚組合成朦朧意象，不能簡化為單一事件報告。',
    '「此情可待成追憶，只是當時已惘然」把今日追憶與當時迷惘疊合，留下多義空間。',
    '「相見時難別亦難」以兩個「難」同時寫相聚不易與離別痛苦。',
    '「春蠶到死絲方盡」以蠶絲連結情思，寫情感延續到生命終點的強度。',
    '「蠟炬成灰淚始乾」把燭淚與人的眼淚相連，和上句形成整齊對偶。',
    '「君問歸期未有期」把對方的詢問和自己無法確定歸期的回答放在同一句中。',
    '「巴山夜雨漲秋池」寫詩人當下所處的夜雨場景，使離別與等待有了具體背景。',
    '「何當共剪西窗燭」由當下孤獨跳到未來重逢的想像，再回望今日巴山夜雨。',
  ],
  liyu: [
    '「春花秋月何時了」面對年年重來的美景，反而感到往事與今日處境形成痛苦對照。',
    '「小樓昨夜又東風」中的「又」指出季節再次來臨，也加深時間流逝與故國不再的感受。',
    '「雕闌玉砌應猶在，只是朱顏改」把可能仍在的宮殿和已改變的人事並置。',
    '「恰似一江春水向東流」以不斷流動的江水譬喻綿延、無法收束的愁。',
    '「簾外雨潺潺，春意闌珊」先以雨聲和將盡春意建立清冷的醒後環境。',
    '「夢裏不知身是客」寫夢中暫忘現實身分，醒來後失落反而更加強烈。',
    '「流水落花春去也」以水流、花落和春逝共同寫出美好事物無法挽回。',
    '「無言獨上西樓」以沉默、獨自與登樓三個線索集中表現人物孤單。',
    '「剪不斷，理還亂」把看不見的離愁寫成難以整理的絲線，使抽象情緒形象化。',
    '「別是一般滋味在心頭」不直接替愁命名，保留複雜感受難以說盡的餘味。',
  ],
};

const FACT_OVERRIDES = {
  xinqiji: {
    5: '作品先寫挑燈看劍、夢回連營與沙場點兵，篇末再以白髮點出壯志難酬的現實。',
  },
};

function readBank(key, suffix) {
  return JSON.parse(fs.readFileSync(`data/${key}-${suffix}.json`, 'utf8'));
}

function writeBank(key, suffix, entries) {
  fs.writeFileSync(`data/${key}-${suffix}.json`, `${JSON.stringify(entries, null, 2)}\n`);
}

function useReadingCategories(chapterFile) {
  const chapterPath = `data/adventure/${chapterFile}.json`;
  const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
  for (const scene of chapter.scenes || []) {
    if (!scene.quest) continue;
    scene.quest.catsByLevel = Object.fromEntries(
      Object.entries(READING_CATS).map(([level, cats]) => [level, [...cats]]),
    );
    delete scene.quest.cats;
  }
  fs.writeFileSync(chapterPath, `${JSON.stringify(chapter, null, 2)}\n`);
}

for (const key of REBUILD_KEYS) {
  const elementary = readBank(key, 'elementary');
  const baseFacts = (CUSTOM_FACTS[key] || elementary.map((entry) => entry.answer))
    .map((fact, index) => FACT_OVERRIDES[key]?.[index] || fact);
  if (baseFacts.length !== elementary.length) throw new Error(`${key} 基礎敘述數量不符`);

  for (const [level, design] of Object.entries(LEVEL_DESIGN)) {
    const entries = readBank(key, design.suffix);
    if (entries.length !== elementary.length) throw new Error(`${key}${level}題數無法對齊`);
    const rebuilt = entries.map((entry, index) => ({
      ...entry,
      ...buildLevelFields(entry, level, index, baseFacts[index]),
    }));
    writeBank(key, design.suffix, rebuilt);
  }

  useReadingCategories(key);
}

for (const key of EARLIER_KEYS) {
  const baseFacts = readBank(key, 'elementary').map((entry) => entry.answer);
  for (const [level, design] of Object.entries(LEVEL_DESIGN)) {
    const entries = readBank(key, design.suffix).map((entry, index) => ({
      ...entry,
      ...buildLevelFields(entry, level, index, baseFacts[index]),
    }));
    writeBank(key, design.suffix, entries);
  }
  useReadingCategories(EARLIER_CHAPTER_FILES[key]);
}

console.log(`rebuilt ${REBUILD_KEYS.length + EARLIER_KEYS.length} author banks across all three levels`);
