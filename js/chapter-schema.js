const LEVELS = ['國小', '國中', '高中'];
const SOURCE_KINDS = new Set(['primary', 'reference', 'fiction']);

export function validateChapter(chapter) {
  const errors = [];
  if (!chapter || typeof chapter !== 'object') return { valid: false, errors: ['章回必須是物件'] };
  if (!chapter.id) errors.push('章回 id 必填');
  if (!chapter.storyFrame?.tagline || !chapter.storyFrame?.epithet || !Array.isArray(chapter.storyFrame?.vows) || chapter.storyFrame.vows.length < 3) {
    errors.push('storyFrame 需包含人物標語、稱號與至少三句開卷立誓');
  }
  const sourceIds = new Set();
  if (!Array.isArray(chapter.sources) || !chapter.sources.length) errors.push('sources 必填');
  else for (const source of chapter.sources) {
    if (!source.id || !source.label || !SOURCE_KINDS.has(source.kind)) errors.push('來源需有 id、label 與合法 kind');
    else sourceIds.add(source.id);
  }
  for (const annotation of chapter.annotations || []) {
    if (!annotation?.text || !Array.isArray(annotation.bopomofo) || [...annotation.text].length !== annotation.bopomofo.length) {
      errors.push(`注音字數不符：${annotation?.text || '未知詞語'}`);
    }
  }
  if (!Array.isArray(chapter.scenes) || !chapter.scenes.length) errors.push('scenes 必填');
  else for (const scene of chapter.scenes) {
    if (!scene.id || !scene.title) errors.push('每幕需有 id 與 title');
    for (const level of LEVELS) {
      if (!scene.body?.[level]) errors.push(`${scene.id || '未知場景'} 缺少${level}文字`);
      if (!scene.story?.[level]) errors.push(`${scene.id || '未知場景'} 缺少${level}故事包裝`);
    }
    if (!scene.factNote) errors.push(`${scene.id} 缺少史實小註`);
    if (!Array.isArray(scene.choices) || scene.choices.length < 3) errors.push(`${scene.id} 至少需要三個故事選擇`);
    else if (new Set(scene.choices.map((choice) => choice.id)).size !== scene.choices.length || scene.choices.some((choice) => !choice.id || !choice.label || !choice.response)) {
      errors.push(`${scene.id} 故事選擇需有不重複 id、文字與回應`);
    }
    if (!['primary', 'reference', 'fiction'].includes(scene.contentKind)) errors.push(`${scene.id} 缺少內容分層`);
    for (const sourceId of scene.sourceIds || []) {
      if (!sourceIds.has(sourceId)) errors.push(`${scene.id} 使用未知來源：${sourceId}`);
    }
    if (scene.quest) {
      if (!Number.isInteger(scene.quest.count) || scene.quest.count < 1) errors.push(`${scene.id} 任務題數錯誤`);
      if (!scene.visual?.art || !['quest', 'duel'].includes(scene.visual?.mode)) errors.push(`${scene.id} 任務缺少合法關卡配圖`);
      const hasCats = Array.isArray(scene.quest.cats) && scene.quest.cats.length;
      const hasLevelCats = LEVELS.every((level) => Array.isArray(scene.quest.catsByLevel?.[level]) && scene.quest.catsByLevel[level].length);
      if (!hasCats && !hasLevelCats) errors.push(`${scene.id} 任務類別必填`);
    }
  }
  return { valid: errors.length === 0, errors };
}
