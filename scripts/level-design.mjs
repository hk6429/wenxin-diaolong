export const LEVEL_DESIGN = Object.freeze({
  國小: Object.freeze({ suffix: 'elementary', difficulty: '易', learningFocus: '明示理解' }),
  國中: Object.freeze({ suffix: 'junior', difficulty: '中', learningFocus: '統整解釋' }),
  高中: Object.freeze({ suffix: 'senior', difficulty: '難', learningFocus: '省思評鑑' }),
});

export const READING_CATS = Object.freeze({
  國小: Object.freeze(['明示訊息', '事件順序', '字詞理解', '簡單推論', '文體辨識']),
  國中: Object.freeze(['句意詮釋', '段落結構', '修辭作用', '推論統整', '觀點辨析']),
  高中: Object.freeze(['證據評鑑', '章法分析', '多元詮釋', '思想辨析', '版本文體']),
});

export function readingId(entry, level) {
  const code = { 國小: 'e', 國中: 'j', 高中: 's' }[level];
  const number = String(entry.id).match(/(\d+)$/)?.[1];
  if (!code || !number) throw new Error(`無法轉換閱讀題 ID：${entry.id}`);
  return `rd-${code}-${number}`;
}

const NOVELS = new Set(['三國演義', '水滸傳', '西遊記', '聊齋志異', '紅樓夢', '世說新語']);
const BOOK_PREFIXES = ['論語', '史記', '莊子', '楚辭'];

export function formatWork(work) {
  if (!work) throw new Error('閱讀題缺少 work，停止產生題庫');
  if (/^[《〈]/.test(work)) return work;
  return NOVELS.has(work) || BOOK_PREFIXES.some((prefix) => work.startsWith(prefix)) ? `《${work}》` : `〈${work}〉`;
}

function elementaryDistractors(mode) {
  return [
    [
      '這段只交代作者所處的年代，沒有呈現作品中的人物或事件。',
      '這段主要列出作品名稱，沒有描寫人物的行動或所見景物。',
      '這段表示人物始終停在原地，沒有發生任何新的觀看經驗。',
    ],
    [
      '作品先寫結果，再補寫一件與結果無關的往事。',
      '前後景物同時出現，沒有移動、發現或情緒變化的先後。',
      '作品省略所有過程，只用一句話直接宣布最後結果。',
    ],
    [
      '這個寫法只交代時間，沒有形成畫面、聲音或人物感受。',
      '句中景物只是背景，與人物當下的觀察和情緒完全無關。',
      '這段是在記錄可查證的實物清單，沒有使用形象化語言。',
    ],
    [
      '這段只能說明作者姓名，不能推知人物的處境或感受。',
      '由這一條線索可斷定作品中的所有人物想法完全相同。',
      '只要作品沒有直接說出結論，前後線索就不能幫助判斷。',
    ],
    [
      '作品裡的對話、夢境與想像都能直接當成完整歷史紀錄。',
      '不同版本的文字一定完全相同，不需要確認採用哪一種。',
      '只要作品很有名，其中每一個細節就都是真實事件。',
    ],
  ][mode];
}

const JUNIOR_TASKS = [
  {
    question: (work) => `閱讀${work}的前後語句，哪個分析能同時指出明示內容與段落作用？`,
    correct: (fact) => `${fact}；這項判讀既符合文字明示內容，也能說明它在段落中的作用。`,
    wrong: (fact) => [
      `${fact}；因此可以不看前後文，直接把這一句當成全文唯一主旨。`,
      `${fact}；所以角色的說法必然等於作者最後的價值判斷。`,
      `${fact}；這足以證明作者現實生活中的每一件事都完全相同。`,
    ],
  },
  {
    question: (work) => `依${work}的事件或景物順序判斷，哪個說明最能解釋篇章如何推進？`,
    correct: (fact) => `${fact}；把它放回前後次序，才能看出轉折如何推動後續內容。`,
    wrong: (fact) => [
      `${fact}；但段落前後可以任意調換，完全不會改變閱讀效果。`,
      `${fact}；這表示後段與前段沒有因果、對照或情緒上的聯繫。`,
      `${fact}；只需判斷單一句型，不必注意它在篇章中的位置。`,
    ],
  },
  {
    question: (work) => `分析${work}的語言效果時，哪個答案同時使用文字線索並說明其作用？`,
    correct: (fact) => `${fact}；分析時還要指出用字、形象或節奏如何造成這項效果。`,
    wrong: (fact) => [
      `${fact}；只要說「很生動」即可，不需要指出任何具體文字。`,
      `${fact}；這只是裝飾性語句，與人物、情境及篇章語氣都無關。`,
      `${fact}；既然語言有形象，就代表句中描寫必定是可查證史實。`,
    ],
  },
  {
    question: (work) => `根據${work}提供的線索，哪個推論最完整而且沒有超出文本？`,
    correct: (fact) => `${fact}；這是由作品線索支持的合理推論，不宜擴大成無限制的結論。`,
    wrong: (fact) => [
      `${fact}；既然可以推論，就能進一步斷定所有讀者都只能有同一種理解。`,
      `${fact}；這是作者沒有寫出的部分，因此完全不必提出文本依據。`,
      `${fact}；由此可把文學角色、敘事者與歷史作者視為同一個聲音。`,
    ],
  },
  {
    question: (work) => `閱讀${work}時，哪個判斷最能分清作品內容、文體安排與外部史實？`,
    correct: (fact) => `${fact}；這項理解須限定在作品證據內，若談史實或版本仍要另行查證。`,
    wrong: (fact) => [
      `${fact}；作品既然提到此事，就等於已完成所有歷史與版本查證。`,
      `${fact}；只要是文學作品，便完全不能討論其中的現實背景。`,
      `${fact}；不同底本若有異文，也不會影響任何句意或人物理解。`,
    ],
  },
];

const SENIOR_TASKS = [
  {
    question: (work) => `若要以${work}建立一項文本主張，下列哪個論證的證據範圍最嚴謹？`,
    correct: (fact) => `${fact}；這足以支持作品內的判讀，但若推及作者生平、時代事實或普遍人性，仍須補充其他證據。`,
    wrong: (fact) => [
      `${fact}；單憑這項文字即可還原作者全部生平，其他史料都可以省略。`,
      `${fact}；這項證據可證明歷代所有讀者必然得到完全相同的結論。`,
      `${fact}；既然有文本依據，就不必區分角色話語、敘事安排與作者立場。`,
    ],
  },
  {
    question: (work) => `從章法角度評析${work}，哪個答案最能說明段落位置與意義的關係？`,
    correct: (fact) => `${fact}；還須連結前後轉折與敘事位置，才能說明這項安排如何改變讀者理解。`,
    wrong: (fact) => [
      `${fact}；句子本身已完整，移到作品任何位置都會產生完全相同的意義。`,
      `${fact}；只要找出修辭名稱，就能取代對全文結構與論證順序的分析。`,
      `${fact}；篇章次序只是抄寫習慣，與人物形象、情緒及觀點建構無關。`,
    ],
  },
  {
    question: (work) => `面對${work}可能存在的不同詮釋，哪個評析最符合語言證據與閱讀方法？`,
    correct: (fact) => `${fact}；此解讀需由具體用字、句法或意象支持，也應容許其他有充分證據的解釋。`,
    wrong: (fact) => [
      `${fact}；只要這個解讀常見，就不必指出它依據哪些字句。`,
      `${fact}；文學可以多元詮釋，所以任何說法即使沒有證據也同樣成立。`,
      `${fact}；既然句中有形象語言，就能證明它只具有一種固定象徵意義。`,
    ],
  },
  {
    question: (work) => `若比較「文本明示、合理推論與讀者評價」三個層次，${work}的哪個判讀最周延？`,
    correct: (fact) => `${fact}；應先標明這是明示內容或由線索形成的推論，再提出可被文本檢驗的評價。`,
    wrong: (fact) => [
      `${fact}；只要結論合理，就不必交代它是原文明示還是讀者推論。`,
      `${fact}；讀者評價可以直接取代作品內容，反例與上下文都不必處理。`,
      `${fact}；角色的選擇既已出現，便可直接判定作者在所有作品中的思想。`,
    ],
  },
  {
    question: (work) => `若把${work}放入版本、文體與歷史背景中校讀，哪個處理方式最可靠？`,
    correct: (fact) => `${fact}；引用時仍要鎖定底本、辨認文體，並以獨立史料檢查作品以外的事實主張。`,
    wrong: (fact) => [
      `${fact}；通行本最常見，因此可代表所有早期版本的文字完全一致。`,
      `${fact}；文學取材歷史，所以作品中的對話可以視為人物當時逐字實錄。`,
      `${fact}；只要先說「版本有爭議」，便不需要再指出採用的文本與判讀依據。`,
    ],
  },
];

export function buildLevelFields(entry, level, index, baseFact = entry.answer) {
  const design = LEVEL_DESIGN[level];
  if (!design) throw new Error(`未知學段：${level}`);
  const mode = index % 5;
  const work = formatWork(entry.work);
  const fact = String(baseFact).replace(/[。；;]+$/u, '');

  if (level === '國小') {
    const answerPosition = index % 4;
    const wrong = elementaryDistractors(mode);
    const options = [...wrong];
    options.splice(answerPosition, 0, fact);
    return {
      id: readingId(entry, level),
      readingKey: entry.readingKey,
      level,
      zone: '閱讀',
      cat: READING_CATS[level][mode],
      qformat: 'rd-pick',
      difficulty: design.difficulty,
      learningFocus: design.learningFocus,
      question: `閱讀${work}時，關於「${entry.subcat || '作品內容'}」，哪一項最符合文字直接提供的內容？`,
      options,
      answer: fact,
      explain: `${fact}。國小階段先找人物、事件、景物或句中明白寫出的線索，再排除與原文相反的說法。`,
    };
  }

  const task = level === '國中' ? JUNIOR_TASKS[mode] : SENIOR_TASKS[mode];
  const answer = task.correct(fact);
  const answerPosition = (index + (level === '國中' ? 1 : 2)) % 4;
  const options = [...task.wrong(fact)];
  options.splice(answerPosition, 0, answer);
  return {
    id: readingId(entry, level),
    readingKey: entry.readingKey,
    level,
    zone: '閱讀',
    cat: READING_CATS[level][mode],
    qformat: 'rd-pick',
    difficulty: design.difficulty,
    learningFocus: design.learningFocus,
    question: task.question(work),
    options,
    answer,
    explain: level === '國中'
      ? `${answer} 國中階段不能只認出單句，還要用前後文說明句段關係、修辭作用或推論依據。`
      : `${answer} 高中階段需比較主張與證據的距離，並處理章法、不同詮釋、文體、版本或史實邊界。`,
  };
}
