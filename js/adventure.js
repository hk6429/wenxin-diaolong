export const CHAPTERS = Object.freeze([
  {
    id: 'preqin-zhuangzi', order: 1, number: '一', era: '先秦', figure: '莊子', file: 'zhuangzi',
    title: '先秦・莊子〈蝶夢逍遙〉', heroTitle: '穿越蝶夢，遇見莊子',
    pageName: '觀物之頁', echoTitle: '蝶夢回聲', art: 'zhuangzi',
    sceneIds: ['modern-prologue', 'butterfly-gate', 'north-sea', 'cook-maze', 'hao-river', 'zhuangzi-trial', 'archive-return'],
    rewards: ['observation-page', 'dream-butterfly-bookmark', 'friend-zhuangzi'],
    echoQuest: { bankKey: 'rhetoric', cats: ['譬喻', '轉化', '誇飾', '設問'], count: 3 },
  },
  {
    id: 'warring-quyuan', order: 2, number: '二', era: '戰國楚地', figure: '屈原', file: 'quyuan',
    title: '戰國楚地・屈原〈香草求索〉', heroTitle: '踏入楚澤，遇見屈原',
    pageName: '求索之頁', echoTitle: '楚聲回音', art: 'quyuan',
    sceneIds: ['chu-prologue', 'fragrant-path', 'river-dialogue', 'nine-song-wind', 'loyalty-gate', 'quyuan-trial', 'archive-return-quyuan'],
    rewards: ['seeking-page', 'fragrant-herb-tassel', 'friend-quyuan'],
    echoQuest: {
      bankKey: 'mixed', count: 3,
      catsByLevel: {
        '國小': ['譬喻', '轉化', '詞性', '押韻'],
        '國中': ['引用', '映襯', '句型', '詩體判別'],
        '高中': ['引用', '映襯', '文言句式', '詩體判別'],
      },
    },
  },
  {
    id: 'dream-confucius', order: 3, number: '三', era: '外篇・夢境', figure: '孔子', file: 'confucius',
    title: '外篇・孔子〈夢入杏壇〉', heroTitle: '枕書入夢，遇見孔子',
    pageName: '好學之頁', echoTitle: '杏壇回聲', art: 'confucius',
    sceneIds: ['dream-prologue', 'learning-gate', 'knowing-mirror', 'ren-path', 'junzi-court', 'confucius-trial', 'wake-return'],
    rewards: ['learning-page', 'bamboo-slip-bookmark', 'friend-confucius'],
    echoQuest: {
      bankKey: 'lunyu', count: 3,
      catsByLevel: {
        '國小': ['詞性', '句型', '設問'],
        '國中': ['文言虛詞', '文言句式', '引用'],
        '高中': ['文言虛詞', '文言句式', '詞類活用'],
      },
    },
  },
  {
    id: 'han-simaqian', order: 4, number: '四', era: '漢代・太史書房', figure: '司馬遷', file: 'simaqian',
    title: '漢代・司馬遷〈太史書魂〉', heroTitle: '走入漢代，遇見司馬遷',
    pageName: '史筆之頁', echoTitle: '太史回聲', art: 'simaqian',
    sceneIds: ['han-prologue', 'father-vow', 'five-paths', 'hongmen-night', 'historian-scale', 'simaqian-trial', 'archive-return-simaqian'],
    rewards: ['historian-page', 'bamboo-annals-bookmark', 'friend-simaqian'],
    echoQuest: {
      bankKey: 'shiji', count: 3,
      catsByLevel: {
        '國小': ['詞性', '句型', '設問'],
        '國中': ['文言虛詞', '文言句式', '引用'],
        '高中': ['文言虛詞', '文言句式', '詞類活用'],
      },
    },
  },
  {
    id: 'jianan-caocao', order: 5, number: '五', era: '漢末・建安', figure: '曹操', file: 'caocao',
    title: '建安・曹操〈月下求賢〉', heroTitle: '踏入建安，遇見曹操',
    pageName: '求賢之頁', echoTitle: '月下回聲', art: 'caocao',
    sceneIds: ['jianan-prologue', 'morning-dew', 'deer-feast', 'magpie-road', 'mountain-sea', 'caocao-trial', 'archive-return-caocao'],
    rewards: ['talent-page', 'morning-dew-cup', 'friend-caocao'],
    echoQuest: { bankKey: 'duange', count: 3, catsByLevel: {
      '國小': ['譬喻', '設問', '摹寫', '感嘆', '詞性'],
      '國中': ['譬喻', '設問', '引用', '句型', '押韻'],
      '高中': ['引用', '映襯', '文言虛詞', '詞類活用', '詩體判別'],
    } },
  },
  {
    id: 'wei-caopi', order: 6, number: '六', era: '曹魏・文論殿', figure: '曹丕', file: 'caopi',
    title: '曹魏・曹丕〈文章千秋〉', heroTitle: '走入文論殿，遇見曹丕',
    pageName: '文論之頁', echoTitle: '千秋回聲', art: 'caopi',
    sceneIds: ['caopi-prologue', 'mirror-broom', 'genre-hall', 'qi-scale', 'immortal-essay', 'caopi-trial', 'archive-return-caopi'],
    rewards: ['criticism-page', 'genre-seal', 'friend-caopi'],
    echoQuest: { bankKey: 'dianlun', count: 3, catsByLevel: {
      '國小': ['詞性', '句型', '譬喻', '設問'], '國中': ['文言虛詞', '文言句式', '引用', '映襯'], '高中': ['文言虛詞', '詞類活用', '文言句式', '引用'],
    } },
  },
  {
    id: 'wei-caozhi', order: 7, number: '七', era: '曹魏・洛川', figure: '曹植', file: 'caozhi',
    title: '曹魏・曹植〈洛水驚鴻〉', heroTitle: '渡過洛川，遇見曹植',
    pageName: '驚鴻之頁', echoTitle: '洛水回聲', art: 'caozhi',
    sceneIds: ['luo-prologue', 'astonished-swan', 'cloud-moon', 'river-distance', 'white-horse', 'caozhi-trial', 'archive-return-caozhi'],
    rewards: ['imagery-page', 'luo-river-jade', 'friend-caozhi'],
    echoQuest: { bankKey: 'caozhi', count: 3, catsByLevel: {
      '國小': ['譬喻', '摹寫', '設問', '詞性'], '國中': ['譬喻', '轉化', '引用', '句型'], '高中': ['譬喻', '映襯', '文言虛詞', '詞類活用'],
    } },
  },
  {
    id: 'shuhan-zhugeliang', order: 8, number: '八', era: '蜀漢・出師前夜', figure: '諸葛亮', file: 'zhugeliang',
    title: '蜀漢・諸葛亮〈出師忠策〉', heroTitle: '走入蜀漢，遇見諸葛亮',
    pageName: '忠策之頁', echoTitle: '出師回聲', art: 'zhugeliang',
    sceneIds: ['shu-prologue', 'open-counsel', 'fair-law', 'worthy-gate', 'thatched-cottage', 'zhugeliang-trial', 'archive-return-zhugeliang'],
    rewards: ['loyalty-page', 'feather-fan-token', 'friend-zhugeliang'],
    echoQuest: { bankKey: 'chushibiao', count: 3, catsByLevel: {
      '國小': ['詞性', '句型', '類疊', '設問'], '國中': ['借代', '映襯', '文言虛詞', '文言句式'], '高中': ['文言虛詞', '文言句式', '詞類活用', '映襯'],
    } },
  },
  {
    id: 'weijin-jikang', order: 9, number: '九', era: '魏晉・竹林', figure: '嵇康', file: 'jikang',
    title: '魏晉・嵇康〈竹林絕響〉', heroTitle: '走入竹林，遇見嵇康',
    pageName: '竹林之頁', echoTitle: '琴聲回音', art: 'jikang',
    sceneIds: ['bamboo-prologue', 'recommendation-scroll', 'seven-unbearables', 'two-impossibles', 'alley-wish', 'jikang-trial', 'archive-return-jikang'],
    rewards: ['bamboo-page', 'qin-string-token', 'friend-jikang'],
    echoQuest: { bankKey: 'jikang', count: 3, authors: ['嵇康'], catsByLevel: {
      '國小': ['詞性', '句型', '摹寫', '設問'],
      '國中': ['句型', '文言虛詞', '文言句式', '映襯', '引用'],
      '高中': ['文言虛詞', '文言句式', '詞類活用', '映襯', '引用'],
    } },
  },
  {
    id: 'weijin-shishuo', order: 10, number: '十', era: '魏晉南北朝・人物卷', figure: '劉義慶', file: 'shishuo',
    title: '魏晉・劉義慶《世說新語》〈人物清談〉', heroTitle: '展開人物卷，遇見劉義慶',
    pageName: '品藻之頁', echoTitle: '世說回音', art: 'shishuo',
    sceneIds: ['shishuo-prologue', 'cut-mat', 'willow-snow', 'yuanfang-door', 'snow-boat', 'shishuo-trial', 'archive-return-shishuo'],
    rewards: ['character-page', 'willow-snow-token', 'friend-liuyiqing'],
    echoQuest: { bankKey: 'shishuo', count: 3, authors: ['劉義慶'], catsByLevel: {
      '國小': ['詞性', '句型', '摹寫', '譬喻'],
      '國中': ['句型', '文言虛詞', '文言句式', '映襯', '譬喻'],
      '高中': ['文言虛詞', '文言句式', '詞類活用', '映襯', '譬喻'],
    } },
  },
  {
    id: 'weijin-taoyuanming', order: 11, number: '十一', era: '東晉・田園', figure: '陶淵明', file: 'taoyuanming',
    title: '東晉・陶淵明〈桃源歸田〉', heroTitle: '循著菊香，遇見陶淵明',
    pageName: '歸田之頁', echoTitle: '南山回音', art: 'taoyuanming',
    sceneIds: ['field-prologue', 'peach-forest', 'peach-village', 'lost-path', 'return-home', 'garden-field', 'nanshan-heart', 'taoyuanming-trial', 'archive-return-taoyuanming'],
    rewards: ['homecoming-page', 'chrysanthemum-token', 'friend-taoyuanming'],
    echoQuest: { bankKey: 'taoyuanming', count: 3, authors: ['陶淵明'], catsByLevel: {
      '國小': ['句型', '詞性', '摹寫', '設問'],
      '國中': ['文言虛詞', '文言句式', '設問', '映襯', '詩體判別'],
      '高中': ['文言虛詞', '文言句式', '詞類活用', '設問', '映襯', '詩體判別', '意象'],
    } },
  },
  {
    id: 'liusong-xielingyun', order: 12, number: '十二', era: '劉宋・池樓', figure: '謝靈運', file: 'xielingyun',
    title: '劉宋・謝靈運〈池草清暉〉', heroTitle: '登上池樓，遇見謝靈運',
    pageName: '池草之頁', echoTitle: '清暉回音', art: 'xielingyun',
    sceneIds: ['spring-feather', 'sickroom', 'tower-window', 'spring-grass', 'lake-return', 'xielingyun-trial', 'archive-return-xielingyun'],
    rewards: ['spring-grass-page', 'clear-radiance-token', 'friend-xielingyun'],
    echoQuest: { bankKey: 'xielingyun', count: 3, authors: ['謝靈運'], catsByLevel: {
      '國小': ['詞性', '句型', '摹寫'],
      '國中': ['句型', '文言句式', '映襯', '摹寫', '引用', '頂真'],
      '高中': ['文言句式', '映襯', '摹寫', '引用', '頂真', '詩體判別'],
    } },
  },
  {
    id: 'weijin-wangxizhi', order: 13, number: '十三', era: '東晉・蘭亭', figure: '王羲之', file: 'wangxizhi',
    title: '東晉・王羲之〈蘭亭集序〉', heroTitle: '循著曲水，遇見王羲之',
    pageName: '蘭亭之頁', echoTitle: '曲水回音', art: 'wangxizhi',
    sceneIds: ['lanting-prologue', 'gathering-at-lanting', 'joyful-view', 'feeling-changes', 'life-and-writing', 'wangxizhi-trial', 'archive-return-wangxizhi'],
    rewards: ['lanting-page', 'flowing-cup-token', 'friend-wangxizhi'],
    echoQuest: { bankKey: 'wangxizhi', count: 3, authors: ['王羲之'], works: ['蘭亭集序'], catsByLevel: {
      '國小': ['句型', '詞性', '摹寫', '排比'],
      '國中': ['句型', '文言虛詞', '文言句式', '映襯', '排比'],
      '高中': ['文言虛詞', '文言句式', '詞類活用', '映襯', '排比'],
    } },
  },
  {
    id: 'early-tang-wangbo', order: 14, number: '十四', era: '初唐・洪都', figure: '王勃', file: 'wangbo',
    title: '初唐・王勃〈滕閣長天〉', heroTitle: '登上滕閣，遇見王勃',
    pageName: '長天之頁', echoTitle: '滕閣回音', art: 'wangbo',
    sceneIds: ['tengwang-prologue', 'stars-and-guests', 'autumn-pavilion', 'sky-water', 'fortune-crossroads', 'wangbo-trial', 'archive-return-wangbo'],
    rewards: ['long-sky-page', 'wild-goose-token', 'friend-wangbo'],
    echoQuest: { bankKey: 'wangbo', count: 3, authors: ['王勃'], works: ['滕王閣序'], catsByLevel: {
      '國小': ['詞性', '句型', '摹寫', '排比', '設問', '感嘆', '轉化', '譬喻'],
      '國中': ['句型', '文言虛詞', '文言句式', '映襯', '引用', '排比', '摹寫'],
      '高中': ['文言虛詞', '文言句式', '詞類活用', '映襯', '引用', '排比', '摹寫'],
    } },
  },
  {
    id: 'early-tang-luobinwang', order: 15, number: '十五', era: '初唐・江都', figure: '駱賓王', file: 'luobinwang',
    title: '初唐・駱賓王〈檄卷風雷〉', heroTitle: '走入江都，遇見駱賓王',
    pageName: '辨檄之頁', echoTitle: '檄卷回音', art: 'luobinwang',
    sceneIds: ['luobinwang-prologue', 'accusation-scroll', 'stolen-throne', 'jiangdu-army', 'realm-appeal', 'luobinwang-trial', 'archive-return-luobinwang'],
    rewards: ['rhetoric-audit-page', 'evidence-scale-token', 'friend-luobinwang'],
    echoQuest: { bankKey: 'luobinwang', count: 3, authors: ['駱賓王'], works: ['徐敬業討武曌檄'], catsByLevel: {
      '國小': ['句型', '詞性', '排比', '摹寫', '設問', '誇飾'],
      '國中': ['句型', '文言虛詞', '文言句式', '排比', '映襯', '引用', '設問', '誇飾'],
      '高中': ['句型', '文言虛詞', '文言句式', '排比', '映襯', '引用', '設問', '誇飾'],
    } },
  },
  {
    id: 'early-tang-dushenyan', order: 16, number: '十六', era: '初唐・江南', figure: '杜審言', file: 'dushenyan',
    title: '初唐・杜審言〈早春遊望〉', heroTitle: '走入江南早春，遇見杜審言',
    pageName: '早春之頁', echoTitle: '江南回音', art: 'dushenyan',
    sceneIds: ['dushenyan-prologue', 'traveler-spring', 'cloud-plum-river', 'yellow-bird-green-duckweed', 'old-song-home-thought', 'dushenyan-trial', 'archive-return-dushenyan'],
    rewards: ['early-spring-page', 'oriole-token', 'friend-dushenyan'],
    echoQuest: { bankKey: 'dushenyan', count: 3, authors: ['杜審言'], works: ['和晉陵陸丞早春遊望'], catsByLevel: {
      '國小': ['句型', '詞性', '摹寫', '轉化', '詩體判別'],
      '國中': ['句型', '摹寫', '轉化', '映襯', '對仗', '詩體判別'],
      '高中': ['句型', '轉化', '映襯', '對仗', '詞類活用', '詩體判別'],
    } },
  },
  {
    id: 'high-tang-libai', order: 17, number: '十七', era: '盛唐・天外詩境', figure: '李白', file: 'libai',
    title: '盛唐・李白〈天外詩境〉', heroTitle: '踏入三境，遇見李白',
    pageName: '青蓮之頁', echoTitle: '太白回音', art: 'libai',
    sceneIds: ['libo-prologue', 'shu-road-origins', 'shu-road-thunder', 'tianmu-moonflight', 'tianmu-heaven-gate', 'wine-river', 'wine-feast', 'libo-trial', 'archive-return-libo'],
    rewards: ['green-lotus-page', 'moon-river-token', 'friend-libai'],
    echoQuest: { bankKey: 'libai', count: 3, authors: ['李白'], catsByLevel: {
      '國小': ['句型', '詞性', '譬喻', '轉化', '誇飾', '感嘆', '類疊', '摹寫'],
      '國中': ['句型', '文言虛詞', '引用', '映襯', '設問', '轉化', '誇飾', '感嘆', '類疊', '摹寫'],
      '高中': ['文言虛詞', '文言句式', '詞類活用', '引用', '映襯', '誇飾', '感嘆', '摹寫'],
    } },
  },
  {
    id: 'high-tang-dufu', order: 18, number: '十八', era: '盛唐・人間詩證', figure: '杜甫', file: 'dufu',
    title: '盛唐・杜甫〈人間詩證〉', heroTitle: '走進詩史，遇見杜甫',
    pageName: '少陵之頁', echoTitle: '人間回音', art: 'dufu',
    sceneIds: ['dufu-prologue', 'spring-capital', 'letters-worth-gold', 'stone-village-night', 'old-woman-voice', 'autumn-high-platform', 'endless-river', 'dufu-trial', 'archive-return-dufu'],
    rewards: ['shaoling-page', 'home-letter-token', 'friend-dufu'],
    echoQuest: { bankKey: 'dufu', count: 3, authors: ['杜甫'], catsByLevel: {
      '國小': ['句型', '詞性', '摹寫', '詩體判別', '誇飾', '類疊'],
      '國中': ['句型', '文言句式', '摹寫', '映襯', '詩體判別', '誇飾', '類疊'],
      '高中': ['句型', '文言句式', '摹寫', '映襯', '詩體判別', '誇飾', '類疊'],
    } },
  },
  {
    id: 'high-tang-wangmeng', order: 19, number: '十九', era: '盛唐・山水田園', figure: '王維・孟浩然', file: 'wangmeng',
    title: '盛唐・王維與孟浩然〈空山故莊〉', heroTitle: '走入雙重詩境，遇見王維與孟浩然',
    pageName: '王孟之頁', echoTitle: '空山故莊回音', art: 'wangmeng',
    sceneIds: ['wangmeng-prologue', 'empty-mountain-after-rain', 'moon-spring-bamboo-lotus', 'old-friend-chicken-millet', 'field-garden-mulberry-hemp', 'two-landscapes-mirror', 'wangmeng-trial', 'archive-return-wangmeng'],
    rewards: ['wangmeng-page', 'moon-chrysanthemum-token', 'friend-wangmeng'],
    echoQuest: { bankKey: 'wangmeng', count: 4, authors: ['王維', '孟浩然'], works: ['山居秋暝', '過故人莊'], catsByLevel: {
      '國小': ['句型', '詞性', '摹寫', '詩體判別'],
      '國中': ['句型', '詞性', '文言句式', '映襯', '對仗', '詩體判別'],
      '高中': ['句型', '文言句式', '摹寫', '映襯', '對仗', '詩體判別'],
    } },
  },
  {
    id: 'high-tang-frontier', order: 20, number: '二十', era: '盛唐・邊塞詩', figure: '高適・王昌齡・岑參', file: 'frontier',
    title: '盛唐・邊塞三家〈風雪未歸〉', heroTitle: '走入邊塞三重詩境，遇見高適、王昌齡與岑參',
    pageName: '邊聲之頁', echoTitle: '風雪未歸回音', art: 'frontier',
    sceneIds: ['frontier-prologue', 'yan-song-departure', 'yan-song-cost', 'moon-pass', 'unreturned-road', 'snow-bloom', 'wheel-tower-farewell', 'frontier-trial', 'archive-return-frontier'],
    rewards: ['frontier-page', 'snow-moon-token', 'friend-frontier'],
    echoQuest: { bankKey: 'frontier', count: 6, authors: ['高適', '王昌齡', '岑參'], works: ['燕歌行並序', '出塞其一', '白雪歌送武判官歸京'], catsByLevel: {
      '國小': ['句型', '詞性', '譬喻', '摹寫', '感嘆'],
      '國中': ['句型', '譬喻', '映襯', '文言虛詞', '詩體判別'],
      '高中': ['文言句式', '文言虛詞', '映襯', '互文', '詩體判別'],
    } },
  },
  {
    id: 'high-tang-twin-towers', order: 21, number: '二十一', era: '盛唐・登樓詩', figure: '王之渙・崔顥', file: 'twintowers',
    title: '盛唐・王之渙與崔顥〈雙樓望遠〉', heroTitle: '登上雙樓，遇見王之渙與崔顥',
    pageName: '雙樓之頁', echoTitle: '雙樓望遠回音', art: 'twintowers',
    sceneIds: ['twin-towers-prologue', 'stork-tower-horizon', 'one-more-storey', 'yellow-crane-legend', 'hanyang-trees', 'sunset-homeland', 'twin-towers-trial', 'archive-return-twin-towers'],
    rewards: ['twin-towers-page', 'crane-sunset-token', 'friend-twin-towers'],
    echoQuest: { bankKey: 'twintowers', count: 6, authors: ['王之渙', '崔顥'], works: ['登鸛雀樓', '黃鶴樓'], catsByLevel: {
      '國小': ['句型', '詞性', '摹寫', '詩體判別'],
      '國中': ['句型', '文言虛詞', '對仗', '設問', '詩體判別'],
      '高中': ['文言句式', '文言虛詞', '對仗', '設問', '詩體判別'],
    } },
  },
]);

// 保留第一章常數，讓既有資料與外部測試不必一次改名。
export const CHAPTER_ID = CHAPTERS[0].id;
export const SCENE_IDS = CHAPTERS[0].sceneIds;
export const ECHO_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export function chapterDefinition(chapterId) {
  return CHAPTERS.find((item) => item.id === chapterId) || CHAPTERS[0];
}

function normalizeProgress(progress, definition) {
  const value = progress && typeof progress === 'object' ? progress : {};
  value.sceneIndex = Number.isInteger(value.sceneIndex)
    ? Math.max(0, Math.min(definition.sceneIds.length - 1, value.sceneIndex))
    : 0;
  value.chapterStatus = ['locked', 'found', 'stable'].includes(value.chapterStatus)
    ? value.chapterStatus : 'locked';
  value.echoDueAt = typeof value.echoDueAt === 'string' ? value.echoDueAt : '';
  value.questResults = value.questResults && typeof value.questResults === 'object' ? value.questResults : {};
  value.vowId = typeof value.vowId === 'string' ? value.vowId : '';
  value.sceneChoices = value.sceneChoices && typeof value.sceneChoices === 'object' ? value.sceneChoices : {};
  value.replayActive = value.replayActive === true;
  value.rewards = Array.isArray(value.rewards) ? [...new Set(value.rewards)] : [];
  return value;
}

function syncLegacyAliases(state) {
  const active = state.chapters[state.currentChapterId];
  state.chapterId = state.currentChapterId;
  state.sceneIndex = active.sceneIndex;
  state.chapterStatus = active.chapterStatus;
  state.echoDueAt = active.echoDueAt;
  state.questResults = active.questResults;
  return state;
}

export function ensureAdventure(meta) {
  if (!meta.adventure || typeof meta.adventure !== 'object') meta.adventure = {};
  const state = meta.adventure;
  state.level = ['國小', '國中', '高中'].includes(state.level) ? state.level : '國小';
  state.zhuyinMode = ['smart', 'full', 'off'].includes(state.zhuyinMode) ? state.zhuyinMode : 'smart';
  state.rewards = Array.isArray(state.rewards) ? [...new Set(state.rewards)] : [];

  const hasKnownChapter = state.chapters && typeof state.chapters === 'object' && !Array.isArray(state.chapters)
    && CHAPTERS.some((definition) => state.chapters[definition.id]);
  if (!hasKnownChapter) {
    const legacy = {
      sceneIndex: state.sceneIndex,
      chapterStatus: state.chapterStatus,
      echoDueAt: state.echoDueAt,
      questResults: state.questResults,
      rewards: state.rewards,
    };
    state.chapters = { [CHAPTER_ID]: normalizeProgress(legacy, CHAPTERS[0]) };
  }
  for (const definition of CHAPTERS) {
    state.chapters[definition.id] = normalizeProgress(state.chapters[definition.id], definition);
  }
  const requested = state.currentChapterId || state.chapterId;
  state.currentChapterId = CHAPTERS.some((item) => item.id === requested) ? requested : CHAPTER_ID;
  return syncLegacyAliases(state);
}

export function getChapterProgress(meta, chapterId = null) {
  const state = ensureAdventure(meta);
  return state.chapters[chapterId || state.currentChapterId];
}

export function isChapterUnlocked(meta, chapterId) {
  const state = ensureAdventure(meta);
  const index = CHAPTERS.findIndex((item) => item.id === chapterId);
  if (index <= 0) return index === 0;
  return state.chapters[CHAPTERS[index - 1].id].chapterStatus !== 'locked';
}

export function selectChapter(meta, chapterId) {
  const state = ensureAdventure(meta);
  if (!isChapterUnlocked(meta, chapterId)) return false;
  state.currentChapterId = chapterId;
  syncLegacyAliases(state);
  return true;
}

export function chooseChapterVow(meta, vowId, chapterId = null) {
  const state = ensureAdventure(meta);
  const progress = state.chapters[chapterId || state.currentChapterId];
  if (!vowId || progress.vowId) return false;
  progress.vowId = vowId;
  syncLegacyAliases(state);
  return true;
}

export function chooseScenePath(meta, sceneId, choiceId, chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  const progress = state.chapters[id];
  if (!sceneId || !choiceId || progress.sceneChoices[sceneId]) return false;
  progress.sceneChoices[sceneId] = choiceId;
  syncLegacyAliases(state);
  return true;
}

export function startChapterReplay(meta, chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  const progress = state.chapters[id];
  if (progress.chapterStatus === 'locked' || progress.replayActive) return false;
  state.currentChapterId = id;
  progress.replayActive = true;
  progress.sceneIndex = 0;
  progress.vowId = '';
  progress.sceneChoices = {};
  syncLegacyAliases(state);
  return true;
}

export function finishChapterReplay(meta, chapterId = null) {
  const state = ensureAdventure(meta);
  const progress = state.chapters[chapterId || state.currentChapterId];
  if (!progress.replayActive) return false;
  progress.replayActive = false;
  syncLegacyAliases(state);
  return true;
}

export function completeScene(meta, sceneId, chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  const definition = chapterDefinition(id);
  const progress = state.chapters[id];
  if (definition.sceneIds[progress.sceneIndex] !== sceneId) return false;
  if (progress.sceneIndex < definition.sceneIds.length - 1) progress.sceneIndex += 1;
  syncLegacyAliases(state);
  return true;
}

export function markChapterFound(meta, now = new Date(), chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  const definition = chapterDefinition(id);
  const progress = state.chapters[id];
  progress.chapterStatus = 'found';
  progress.echoDueAt = new Date(now.getTime() + ECHO_DELAY_MS).toISOString();
  progress.rewards = [...new Set([...progress.rewards, ...definition.rewards])];
  state.rewards = [...new Set([...state.rewards, ...definition.rewards])];
  syncLegacyAliases(state);
  return progress;
}

export function isEchoDue(meta, now = new Date(), chapterId = null) {
  const state = ensureAdventure(meta);
  const progress = state.chapters[chapterId || state.currentChapterId];
  if (progress.chapterStatus !== 'found' || !progress.echoDueAt) return false;
  return now.getTime() >= new Date(progress.echoDueAt).getTime();
}

export function stabilizeChapter(meta, now = new Date(), chapterId = null) {
  const state = ensureAdventure(meta);
  const id = chapterId || state.currentChapterId;
  if (!isEchoDue(meta, now, id)) return false;
  state.chapters[id].chapterStatus = 'stable';
  syncLegacyAliases(state);
  return true;
}

export function selectQuestEntries(entries, quest) {
  const allowed = new Set(quest?.cats || []);
  const authors = new Set(quest?.authors || []);
  const works = new Set(quest?.works || []);
  const count = Math.max(1, Number(quest?.count) || 1);
  const seen = new Set();
  return (entries || []).filter((entry) => {
    if (!entry?.id || seen.has(entry.id) || (allowed.size && !allowed.has(entry.cat))) return false;
    if (authors.size && !authors.has(entry.author)) return false;
    if (works.size && !works.has(entry.work)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, count);
}
