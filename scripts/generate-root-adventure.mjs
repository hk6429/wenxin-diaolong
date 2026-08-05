import fs from 'node:fs';
import { buildLevelFields } from './level-design.mjs';

const LEVELS = [
  { label: '國小', suffix: 'elementary', code: 'e', difficulty: '易' },
  { label: '國中', suffix: 'junior', code: 'j', difficulty: '中' },
  { label: '高中', suffix: 'senior', code: 's', difficulty: '難' },
];

const GRAMMAR = new Set(['詞性', '詞語結構', '句型', '語病', '文言虛詞', '文言句式', '詞類活用', '標點符號']);
const PROSODY = new Set(['押韻', '對仗', '平仄', '詩體判別', '詞曲常識', '對聯']);
const CAT_SETS = {
  國小: ['摹寫', '句型', '詞性', '類疊'],
  國中: ['映襯', '文言句式', '引用', '層遞'],
  高中: ['示現', '文言句式', '引用', '錯綜'],
};

const specs = [
  {
    key: 'hanyu', start: 16001, id: 'late-tang-hanyu', author: '韓愈', era: '中唐・昌黎文道',
    title: '中唐・韓愈〈傳道問師〉', hero: '走進昌黎學堂，遇見韓愈', page: '問師之頁',
    source: 'https://zh.wikisource.org/zh-hant/師說', risk: '〈師說〉中的「師」以傳道、授業、解惑為核心，不能直接等同今日行政職稱；〈祭十二郎文〉為祭文中的敘事與抒情，不可把文學回憶當完整年譜。',
    segments: [
      { slug: 'teacher-way', work: '師說', title: '傳道解惑・誰可以為師', facts: [
        '開篇先提出古代求學者必有老師，再說老師負責傳道、授業與解惑。',
        '「無貴無賤，無長無少」把擇師標準從身分年齡移到「道之所存」。',
        '士大夫以向地位較低者學習為恥，與巫醫樂師百工不恥相師形成對照。',
        '孔子向郯子、萇弘、師襄、老聃學習，用事例支持「聖人無常師」。',
        '文章批評的是拒絕學習與身分偏見，不是要求學生盲從任何自稱老師的人。',
      ] },
      { slug: 'memorial-letter', work: '祭十二郎文', title: '一紙祭文・記憶如何成情', facts: [
        '祭文以家族離散與共同成長的回憶，使哀痛從抽象感嘆變成具體生命片段。',
        '文中多次追問與自責，表現面對死訊時無法接受、反覆確認的心理。',
        '敘事在幼年、離別、死訊與身後安排之間往返，形成情感逐層加深的結構。',
        '「汝病吾不知時，汝歿吾不知日」以對稱語句集中表現未能陪伴的遺憾。',
        '祭文是真實關係中的書寫，但個別句子仍需放回文體與情緒語境理解。',
      ] },
    ],
  },
  {
    key: 'liuzongyuan', start: 16201, id: 'late-tang-liuzongyuan', author: '柳宗元', era: '中唐・永州山水',
    title: '中唐・柳宗元〈永州心境〉', hero: '循著清溪，遇見柳宗元', page: '永州之頁',
    source: 'https://zh.wikisource.org/zh-hant/永州八記', risk: '永州山水遊記包含作者觀看與情緒安排，不是現代地理調查；「心凝形釋」等句不可脫離貶謫處境硬解成單純勵志。',
    segments: [
      { slug: 'western-hill', work: '始得西山宴遊記', title: '始得西山・觀看位置改變', facts: [
        '作者先寫平日漫遊「到則披草而坐」，再以登西山呈現不同於往常的觀看經驗。',
        '攀援、箕踞、遨遊等動作讓讀者跟著身體路徑逐步登高。',
        '岈然洼然、若垤若穴把高低地勢收進遠望，突顯西山視野的開闊。',
        '「心凝形釋，與萬化冥合」寫主客界線暫時淡去，不等於身體真的消失。',
        '題目中的「始得」是重新發現西山獨特意義，不是宣稱西山以前不存在。',
      ] },
      { slug: 'stone-pool', work: '小石潭記', title: '小石潭・清景轉幽情', facts: [
        '由竹林中的水聲引路，再伐竹取道見潭，景物依探索順序展開。',
        '「皆若空游無所依」以水清造成的視覺錯覺描寫游魚，不是魚真的浮在空中。',
        '日光、魚影、佁然不動與俶爾遠逝，結合光影和動靜變化。',
        '溪岸「斗折蛇行，明滅可見」以形象化語言寫曲折水勢。',
        '結尾的淒神寒骨與悄愴幽邃，使清麗景色轉入孤寂心境。',
      ] },
    ],
  },
  {
    key: 'baijuyi', start: 16401, id: 'late-tang-baijuyi', author: '白居易', era: '中唐・新樂府',
    title: '中唐・白居易〈歌詩見人〉', hero: '聽見弦聲與炭火，遇見白居易', page: '香山之頁',
    source: 'https://zh.wikisource.org/zh-hant/白氏長慶集', risk: '〈長恨歌〉以歷史素材構成敘事詩，不能逐句當宮廷檔案；〈賣炭翁〉關心制度與勞動者處境，不把苦難當獵奇場景。',
    segments: [
      { slug: 'pipa-river', work: '琵琶行', title: '潯陽江夜・聲音成為身世', facts: [
        '詩從潯陽送客聽見琵琶聲開始，陌生樂聲改變原本將散的夜宴。',
        '大弦、小弦、間關、幽咽等譬喻把不可見的聲音轉成可感的質地與節奏。',
        '「別有幽愁暗恨生，此時無聲勝有聲」把停頓寫成情感張力的一部分。',
        '琵琶女由京城得意寫到年長漂泊，身世敘事與演奏層次互相映照。',
        '「同是天涯淪落人」連結兩種處境，但不抹去兩人性別與人生經驗的差異。',
      ] },
      { slug: 'everlasting-song', work: '長恨歌', title: '長恨長歌・歷史如何入詩', facts: [
        '前段由宮廷寵愛寫到戰亂與馬嵬轉折，繁華和失去形成強烈對照。',
        '「回眸一笑百媚生」是高度凝縮的形象塑造，不是可量化的容貌紀錄。',
        '蜀道、行宮、月色與鈴聲承接人物思念，使景物帶有情緒色彩。',
        '後段加入尋訪仙境與信物，使人間無法挽回的遺憾延伸到想像空間。',
        '作品取材唐玄宗與楊貴妃故事，史實、傳說與詩人藝術安排必須分層。',
      ] },
      { slug: 'charcoal-seller', work: '賣炭翁', title: '一車炭重・誰決定價值', facts: [
        '「伐薪燒炭南山中」先交代勞動過程，再以外貌細節呈現長期辛苦。',
        '「可憐身上衣正單，心憂炭賤願天寒」以矛盾願望揭示生計壓力。',
        '牛困、人飢、日已高等細節拉長送炭路程，使讀者看見交換前的成本。',
        '宮使以文書與命令取炭，權力不對等使「半匹紅紗一丈綾」無法成為公平交易。',
        '閱讀重點是制度如何奪取勞動成果，不把老人受苦做成闖關獎勵。',
      ] },
    ],
  },
  {
    key: 'luoguanzhong', start: 16601, id: 'ming-luoguanzhong', author: '羅貫中', era: '明代・三國演義',
    title: '明代・羅貫中《三國演義》〈群雄筆陣〉', hero: '展開三國長卷，遇見羅貫中', page: '三國之頁',
    source: 'https://zh.wikisource.org/zh-hant/三國演義', risk: '本站鎖定維基文庫毛本系統；小說人物、對話與事件安排不可直接當作《三國志》等史書原貌，楊慎〈臨江仙〉也不是羅貫中原創。',
    segments: [
      { slug: 'oath-and-heroes', work: '三國演義', title: '群雄登場・人物如何被寫出', facts: [
        '章回題目與開場評語先建立亂世框架，再讓人物透過行動和對話登場。',
        '桃園結義是小說中凝聚劉關張關係的重要場景，不能直接等同史書逐字記載。',
        '外貌、兵器、語氣與稱號常被集中配置，用來快速區分群雄形象。',
        '同一事件常由不同陣營觀看，讀者必須分辨人物立場與敘事判斷。',
        '「演義」會整合史料、傳說與藝術虛構，不能用小說細節代替史料查證。',
      ] },
      { slug: 'strategy-language', work: '三國演義', title: '帳前論勢・計謀如何成立', facts: [
        '謀略場面往往先交代資訊差，再透過問答展示人物如何判讀局勢。',
        '隆中對以天下形勢、地理與人心安排長程策略，重點不只是背出地名。',
        '赤壁相關章回交錯使者、聯盟、疑兵與火攻，形成多線並進的敘事。',
        '成功計謀常依賴對手性格與有限資訊，不能解成軍師具有預知超能力。',
        '小說讚嘆智慧時仍會選擇敘事立場，讀者可以比較誰的代價被省略。',
      ] },
      { slug: 'history-fiction', work: '三國演義', title: '青史與演義・證據分層', facts: [
        '關羽、曹操、諸葛亮等人物在小說中具有鮮明價值色彩，與史書筆法不同。',
        '章回末常以詩句或評論收束人物，這是引導讀者評價的敘事裝置。',
        '虛構對話可以表現人物衝突，但不能宣稱古人當時逐字如此說話。',
        '毛綸、毛宗崗修訂本與早期版本有差異，設題必須先說明採用底本。',
        '讀小說可討論忠義、權力與選擇，查史實則須另比對史書與研究證據。',
      ] },
    ],
  },
  {
    key: 'shinaian', start: 16801, id: 'ming-shinaian', author: '施耐庵', era: '明代・水滸群像',
    title: '明代・施耐庵《水滸傳》〈江湖眾聲〉', hero: '走進眾聲江湖，遇見施耐庵', page: '水滸之頁',
    source: 'https://zh.wikisource.org/zh-hant/水滸傳', risk: '《水滸傳》有七十、百、百二十回等版本，本章鎖定百回本相關篇章；暴力場面只作人物、制度與敘事分析，不做爽感獎勵。',
    segments: [
      { slug: 'character-voices', work: '水滸傳', title: '眾聲入場・話語就是性格', facts: [
        '人物常以口頭語、綽號、動作與出場事件共同建立性格。',
        '魯智深的直率、林沖的忍讓、宋江的周旋不能只用單一標籤概括。',
        '同一衝突裡人物說法不同，顯示身分、利益與處境的差異。',
        '敘事者有時讚嘆好漢，也會展示衝動與暴力造成的後果。',
        '人物原型與歷史事件經小說擴寫，不能把所有細節當宋代實錄。',
      ] },
      { slug: 'pressure-and-choice', work: '水滸傳', title: '逼上梁山・選擇如何被推動', facts: [
        '「逼上梁山」可從制度壓力、人際陷害與人物選擇多方面理解。',
        '林沖故事以一再退讓和處境惡化形成層遞，使轉變具有過程。',
        '官府、豪強、地方網絡與江湖規則交織，衝突不只是個人恩怨。',
        '部分人物也會傷害無辜，閱讀時不應把「好漢」稱號當免責證明。',
        '暴力行動是文本分析對象，不宜設成鼓勵學生模仿的遊戲獎勵。',
      ] },
      { slug: 'versions-and-justice', work: '水滸傳', title: '忠義之問・版本改變結局', facts: [
        '聚義、招安與征戰在不同回本中篇幅和結局安排並不相同。',
        '「忠」與「義」有時互相支持，有時造成角色難以化解的衝突。',
        '群像敘事讓讀者同時看到個人豪氣、團體規範與權力代價。',
        '評點本會透過刪改與批語影響讀者理解，不能假定只有一個固定文本。',
        '判斷人物是否正義需回到具體行動與受影響者，不能只看綽號或陣營。',
      ] },
    ],
  },
  {
    key: 'wuchengen', start: 17001, id: 'ming-wuchengen', author: '吳承恩', era: '明代・西行幻境',
    title: '明代・吳承恩《西遊記》〈心猿取經〉', hero: '踏上西行路，遇見吳承恩', page: '西行之頁',
    source: 'https://zh.wikisource.org/zh-hant/西遊記', risk: '本章依通行吳承恩署名本教學，同時承認作者歸屬研究史；神魔情節是小說世界，不作宗教或歷史事實證明。',
    segments: [
      { slug: 'stone-monkey', work: '西遊記', title: '石猴出世・名字與欲望', facts: [
        '石猴由花果山奇石孕育，開篇先建立神話世界的特殊生命來源。',
        '尋訪水簾洞與被推為美猴王，呈現勇氣、承諾與群體認可的關係。',
        '拜師學藝到大鬧天宮，能力增長也伴隨欲望與規範衝突。',
        '「心猿」既指角色，也可作心念難以安定的象徵閱讀。',
        '神通與天界官職屬小說設定，不能直接當歷史制度資料。',
      ] },
      { slug: 'pilgrimage-team', work: '西遊記', title: '一路同行・團隊如何磨合', facts: [
        '取經隊伍的師徒角色具有不同能力、欲望與判斷方式。',
        '八戒的抱怨、悟空的急切、沙僧的穩定與唐僧的堅持形成對照。',
        '誤會常由變化、假象和有限視角造成，不能只靠外表判斷真偽。',
        '每次劫難既推進路程，也反覆考驗合作、信任與自我控制。',
        '角色有缺點不等於可以用羞辱性標籤取代文本分析。',
      ] },
      { slug: 'trial-and-growth', work: '西遊記', title: '九九之難・重複中的變化', facts: [
        '相似的遇怪、識破、求援結構會反覆出現，但人物關係與問題並不完全相同。',
        '妖怪的來歷常在結尾揭示，使前段線索獲得重新解釋。',
        '部分故事以諷刺方式映照貪欲、權力與盲信，不只提供奇觀。',
        '抵達靈山後仍有無字經與補足劫數，顯示完成不是單純抵達終點。',
        '作者署名與版本流傳有研究問題，教學時應說明採用的通行底本。',
      ] },
    ],
  },
  {
    key: 'pusongling', start: 17201, id: 'qing-pusongling', author: '蒲松齡', era: '清代・聊齋異聞',
    title: '清代・蒲松齡《聊齋志異》〈鬼狐照人〉', hero: '點亮聊齋燈火，遇見蒲松齡', page: '聊齋之頁',
    source: 'https://zh.wikisource.org/zh-hant/聊齋', risk: '鬼狐為文言小說的敘事角色與象徵資源，不能用故事證明超自然存在；不同刻本篇目、文字或次序可能有差異。',
    segments: [
      { slug: 'painted-skin', work: '聊齋志異', title: '畫皮・外表與判斷', facts: [
        '故事以美麗外表遮蔽異類身分，使觀看與判斷成為主要衝突。',
        '王生的選擇與輕信推動危機，不能把責任全部推給超自然角色。',
        '道士、乞者與畫皮形象造成真假反轉，挑戰只憑外貌判人的習慣。',
        '驚異情節同時包含道德警示與敘事懸念，不只是恐怖效果。',
        '故事角色與事件屬小說，不應設題要求學生相信其為真實案件。',
      ] },
      { slug: 'cricket', work: '聊齋志異', title: '促織・小蟲背後的制度', facts: [
        '徵促織由上而下層層加壓，最後落到無力承擔的家庭。',
        '成名一家遭遇顯示小小玩物如何因權力需求變成生存災難。',
        '孩子、促織與家庭命運的轉折帶有奇異色彩，也放大制度荒謬。',
        '結尾議論把個案連回官場與上意，不讓故事停在幸運翻身。',
        '不能把作品中的偶然得福解成受害者只要努力就能翻轉制度。',
      ] },
      { slug: 'strange-mirror', work: '聊齋志異', title: '異事如鏡・誰才是真正異類', facts: [
        '聊齋常讓狐鬼比人更守情義，藉角色反差重新追問「人」的標準。',
        '短篇以有限場景、關鍵物件和突然轉折快速建立完整衝突。',
        '篇末「異史氏曰」等評論可能補充、反轉或提升故事議題。',
        '同情異類角色不表示所有超自然行動都被作品認可。',
        '閱讀應區分敘事者、角色說法與篇末評論，避免混成作者單一宣言。',
      ] },
    ],
  },
  {
    key: 'caoxueqin', start: 17401, id: 'qing-caoxueqin', author: '曹雪芹', era: '清代・紅樓夢境',
    title: '清代・曹雪芹《紅樓夢》〈一夢見眾生〉', hero: '走入大觀園，遇見曹雪芹', page: '紅樓之頁',
    source: 'https://zh.wikisource.org/zh-hant/紅樓夢', risk: '本章只以曹雪芹前八十回為主要出題範圍；後四十回常署高鶚續作，人物結局與版本問題不可混成曹雪芹唯一原稿。',
    segments: [
      { slug: 'stone-enters-world', work: '紅樓夢', title: '頑石入世・真事如何隱去', facts: [
        '開篇以頑石、空空道人與抄錄故事建立多層敘事框架。',
        '「真事隱」「假語村言」讓人名與真假問題互相映照。',
        '石頭想進入紅塵，故事先提出欲望、經歷與回望的循環。',
        '神話框架不是家族史實本身，而是引導讀者理解繁華與幻滅。',
        '不同版本的回目與文字有差異，引用時須先鎖定底本。',
      ] },
      { slug: 'daiyu-enters-house', work: '紅樓夢', title: '黛玉進府・視線中的家族', facts: [
        '黛玉進賈府時謹慎觀察環境與禮節，讀者也跟著她逐步認識家族空間。',
        '人物外貌、座次、稱謂與對話共同呈現親疏和權力關係。',
        '王熙鳳先聞其聲後見其人，以出場次序強化鮮明性格。',
        '寶黛初見帶有似曾相識感，與前文神話線索形成呼應。',
        '不能只用「多愁善感」概括黛玉，還要看她的觀察、判斷與自我保護。',
      ] },
      { slug: 'poetry-society', work: '紅樓夢', title: '海棠詩社・眾聲不是一聲', facts: [
        '詩社讓不同人物以詩題、用字與評詩方式表現各自性格。',
        '同題作品並列後，差異不只在高下，也在觀看位置與生命經驗。',
        '大觀園既是創作空間，也受到家族資源和規範支撐。',
        '人物詩不能全部直接當作曹雪芹本人自傳式發言。',
        '閱讀詩社場景需同時看作品內容、人物關係與敘事安排。',
      ] },
      { slug: 'garden-decline', work: '紅樓夢', title: '繁華漸散・園中誰先受傷', facts: [
        '家族危機透過日常支出、僕役衝突、婚姻安排與園中變化逐步累積。',
        '抄檢大觀園把外部權力帶入少女生活空間，造成信任破裂。',
        '人物對同一事件反應不同，顯示地位、性格與風險並不相同。',
        '花落、秋景、病體等意象與情節互相照應，但不能簡化成固定一對一暗號。',
        '曹雪芹前八十回未完整呈現通行本所有人物結局，設題必須保留續書邊界。',
      ] },
    ],
  },
];

const aspectNames = ['文本重點', '結構推進', '語言效果', '合理推論', '版本邊界'];
const promptByLevel = {
  國小: (aspect, work) => `閱讀${formatWork(work)}時，關於「${aspect}」哪一項最符合故事或作品？`,
  國中: (aspect, work) => `依${formatWork(work)}的語句與章法判斷，「${aspect}」哪一項最有文本根據？`,
  高中: (aspect, work) => `若區分${formatWork(work)}的文本證據、合理推論與外部史實，「${aspect}」應如何判讀？`,
};

function formatWork(work) {
  return ['三國演義', '水滸傳', '西遊記', '聊齋志異', '紅樓夢'].includes(work) ? `《${work}》` : `〈${work}〉`;
}

function citationFor(spec, segment, fact) {
  if (spec.key === 'luoguanzhong' && fact.includes('毛綸、毛宗崗')) {
    return '羅貫中《三國演義》；本站採維基文庫毛本系統，並明示與早期版本有差異';
  }
  if (spec.key === 'shinaian' && /版本|回本|評點本/.test(fact)) {
    return '施耐庵《水滸傳》；本站採維基文庫百回本相關篇章，另明示不同回本與評點本差異';
  }
  if (spec.key === 'caoxueqin' && /版本|前八十回|後四十回|續書/.test(fact)) {
    return '曹雪芹《紅樓夢》；本站以維基文庫前八十回為主要出題範圍，後四十回另列續書邊界';
  }
  return `${spec.author}${formatWork(segment.work)}`;
}

function entryFor(spec, segment, fact, factIndex, segmentIndex, level) {
  const cat = CAT_SETS[level.label][segmentIndex % CAT_SETS[level.label].length];
  const zone = GRAMMAR.has(cat) ? '文法' : PROSODY.has(cat) ? '格律' : '修辭';
  const prefix = zone === '文法' ? 'gr' : zone === '格律' ? 'yl' : 'rh';
  const qformat = zone === '文法' ? (cat === '詞性' ? 'gr-pos' : cat === '文言虛詞' ? 'gr-particle' : 'gr-pattern') : zone === '格律' ? 'yl-form' : 'rh-pick';
  const number = spec.start + segmentIndex * 10 + factIndex;
  const entry = {
    id: `${prefix}-${level.code}-${number}`,
    level: level.label,
    zone,
    cat,
    subcat: aspectNames[factIndex],
    qformat,
    genre: ['琵琶行', '長恨歌', '賣炭翁'].includes(segment.work) ? '韻文' : '非韻文',
    textForm: ['琵琶行', '長恨歌', '賣炭翁'].includes(segment.work) ? '古典詩' : ['三國演義', '水滸傳', '西遊記', '聊齋志異', '紅樓夢'].includes(segment.work) ? '小說' : '文言文',
    question: promptByLevel[level.label](aspectNames[factIndex], segment.work),
    options: [fact, '暫存選項一', '暫存選項二', '暫存選項三'],
    answer: fact,
    explain: `${fact} ${level.label === '國小' ? '先抓住人物、事件與景物的直接關係。' : level.label === '國中' ? '判讀時要以語句、段落位置與前後轉折作證。' : '進階閱讀還要區分文學安排、合理推論、底本異文與可查證史實。'}`,
    origin: '自編',
    citation: citationFor(spec, segment, fact),
    difficulty: level.difficulty,
    author: spec.author,
    work: segment.work,
    ...(spec.key === 'wuchengen' ? { attributionStatus: '《西遊記》通行署吳承恩，作者與成書過程仍有研究討論' } : {}),
  };
  return {
    ...entry,
    ...buildLevelFields(entry, level.label, factIndex + segmentIndex * 5, fact),
  };
}

function choices(slug) {
  return [
    { id: `${slug}-guess`, label: '只憑印象猜人物與情節', response: '書頁沒有回應；先回到作品證據。' },
    { id: `${slug}-evidence`, label: '沿著原文與敘事線索判讀', response: '墨線亮起，人物、語言與處境重新連在一起。' },
    { id: `${slug}-fact`, label: '把小說或詩文直接當完整史實', response: '文體與版本邊界模糊了；需要重新分層。' },
  ];
}

function levelText(elementary, junior, senior) {
  return { 國小: elementary, 國中: junior, 高中: senior };
}

function chapterFor(spec) {
  const sourceId = `${spec.key}-primary`;
  const scenes = [{
    id: `${spec.key}-prologue`, title: `${spec.author}入卷・先認作品再闖關`, contentKind: 'fiction', sourceIds: [sourceId, 'fiction'],
    story: levelText(`守卷閣開出${spec.author}的作品長卷，你要先分清人物、作品和故事。`, `同一位作家的不同作品各有文體與觀看位置，本章從證據建立閱讀地圖。`, `本章同步處理敘事策略、版本來源與史實邊界，不把後世印象當原文。`),
    body: levelText('選擇用作品線索前進。', '辨認作者、作品與章法。', '鎖定底本並保留可爭議處。'),
    factNote: `${spec.source} 為公版原典入口；守卷閣相遇與闖關對話為本站原創。`, choices: choices(`${spec.key}-prologue`),
  }];
  spec.segments.forEach((segment, index) => {
    scenes.push({
      id: `${spec.key}-${segment.slug}`, title: segment.title, contentKind: 'primary', sourceIds: [sourceId],
      story: levelText(`你走進${formatWork(segment.work)}的場景，先看清誰在做什麼。`, `作品把人物、語言與轉折排成一條可追蹤的路。`, `從敘事位置、修辭效果與證據層級重新校讀這段作品。`),
      body: levelText('依本關題數找出人物、事件和景物線索。', '依本關題數分析句法、對照與敘事推進。', '依本關題數辨析推論、版本與文學安排。'),
      factNote: `${spec.risk} 本關題幹、選項與解析均由本站依公版原典自編。`, choices: choices(`${spec.key}-${segment.slug}`),
      visual: { mode: 'quest', art: `adventure-${spec.key}-${index === 0 ? 'cover' : 'scene'}.webp`, alt: `${spec.author}${formatWork(segment.work)}原創情境圖`, log: `依${formatWork(segment.work)}完成作品證據校讀。` },
      quest: { id: `${spec.key}-${segment.slug}-quest`, bankKey: spec.key, count: 5, authors: [spec.author], works: [segment.work], catsByLevel: Object.fromEntries(LEVELS.map((level) => [level.label, [CAT_SETS[level.label][index % CAT_SETS[level.label].length]]])) },
    });
  });
  scenes.push({
    id: `${spec.key}-trial`, title: `${spec.author}問卷・作品證據對決`, contentKind: 'primary', sourceIds: [sourceId, 'fiction'],
    story: levelText(`${spec.author}親自展卷，答對才能讓文字重新發光。`, `最後一戰混合本章作品，但作者與作品不會越界。`, `對戰檢驗文本、推論、版本與史實四層，不以背誦名句取代分析。`),
    body: levelText('迎戰本人，靠作品過關。', '從本章題庫抽出跨作品題目。', '以底本與敘事證據完成校讀。'),
    factNote: `人物對戰為本站原創遊戲橋段；所有問題仍只取自${spec.author}本章所列公版作品。`, choices: choices(`${spec.key}-trial`),
    visual: { mode: 'duel', art: `adventure-${spec.key}-duel.webp`, alt: `學子以筆迎戰${spec.author}`, opponent: spec.author, realm: spec.era, log: `${spec.author}展開作品長卷，等待你的證據。` },
    quest: { id: `${spec.key}-duel`, bankKey: spec.key, count: Math.min(spec.segments.length * 5, spec.segments.length >= 3 ? 6 : 5), authors: [spec.author], works: spec.segments.map((segment) => segment.work), catsByLevel: Object.fromEntries(LEVELS.map((level) => [level.label, spec.segments.map((_, index) => CAT_SETS[level.label][index % CAT_SETS[level.label].length])])) },
  });
  scenes.push({
    id: `archive-return-${spec.key}`, title: `守卷閣歸來・${spec.page}歸位`, contentKind: 'fiction', sourceIds: ['fiction'],
    story: levelText(`你帶著${spec.page}回到守卷閣。`, `作品中的人物、語言與選擇已收入閱讀地圖。`, `本章留下底本、文體、推論與史實邊界，等待七日回聲。`),
    body: levelText('七日後再回來複習。', '重新整理作品與證據。', '保留爭議，拒絕過度確定。'),
    factNote: `守卷閣與${spec.page}為本站原創；原典著作權已逾期，題目與故事包裝皆為本站自編。`, choices: choices(`archive-${spec.key}`),
  });
  return {
    id: spec.id, title: spec.title, version: 1,
    riskNotes: [spec.risk, '古典原作為公有領域；本站不搬用現代譯注、教科書題目或受著作權保護的改寫。'],
    storyFrame: {
      tagline: `${spec.author}把作品放上案前：先看見人物，再判斷文字如何使故事成立。`,
      epithet: `${spec.author}・以作品等待校讀的文人`,
      vows: [
        { id: `${spec.key}-read`, quote: '先讀作品，再下判斷', insight: '人物印象必須由文本證據支持。' },
        { id: `${spec.key}-layers`, quote: '分清故事、推論與史實', insight: '文學真實不等於逐字歷史紀錄。' },
        { id: `${spec.key}-versions`, quote: '版本有別，答案才公平', insight: '先鎖定底本，才不以異文設陷阱。' },
      ],
    },
    sources: [
      { id: sourceId, kind: 'primary', label: `${spec.author}本章作品（維基文庫公版原典）`, url: spec.source },
      { id: 'fiction', kind: 'fiction', label: '守卷閣相遇、對話、選擇與人物對戰均為本站原創' },
    ],
    annotations: [], scenes,
  };
}

for (const spec of specs) {
  fs.writeFileSync(`data/adventure/${spec.key}.json`, `${JSON.stringify(chapterFor(spec), null, 2)}\n`);
  for (const level of LEVELS) {
    const entries = spec.segments[0].facts.flatMap((_, factIndex) => spec.segments.map((segment, segmentIndex) => entryFor(spec, segment, segment.facts[factIndex], factIndex, segmentIndex, level)));
    fs.writeFileSync(`data/${spec.key}-${level.suffix}.json`, `${JSON.stringify(entries, null, 2)}\n`);
  }
}

console.log(`generated ${specs.length} chapters and ${specs.reduce((sum, spec) => sum + spec.segments.length * 5 * 3, 0)} entries`);
