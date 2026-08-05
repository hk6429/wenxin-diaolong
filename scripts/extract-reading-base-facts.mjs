import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CHAPTERS } from '../js/adventure.js';

const GENERIC_ANSWERS = /^(動詞|名詞|形容詞|副詞|設問|轉折|判斷句|有無句|類疊|譬喻|摹寫|感嘆|五言律詩)[。；;]?$/u;

function firstSentence(text) {
  const sentence = String(text || '').split('。')[0].trim();
  return sentence ? `${sentence}。` : '';
}

function baseFact(entry) {
  const explained = firstSentence(entry.explain);
  if (explained.length >= 10 && !GENERIC_ANSWERS.test(explained)) return explained;

  const quotes = String(entry.question || '').match(/[「『][^」』]+[」』]/gu) || [];
  if (quotes.length) return `${quotes.join('、')}在本題中的正確判讀是「${entry.answer}」。`;

  const prompt = String(entry.question || '').replace(/[？?]+$/u, '').trim();
  return `${prompt}，正確判讀是「${entry.answer}」。`;
}

const facts = {};
const bankKeys = [...new Set(CHAPTERS.map((definition) => definition.echoQuest.bankKey))];

for (const bankKey of bankKeys) {
  const file = `data/${bankKey}-elementary.json`;
  const creationCommit = execFileSync('git', ['log', '--reverse', '--format=%H', '--', file], { encoding: 'utf8' })
    .trim()
    .split(/\s+/u)[0];
  if (!creationCommit) throw new Error(`${file} 找不到建立版本`);
  const original = JSON.parse(execFileSync('git', ['show', `${creationCommit}:${file}`], { encoding: 'utf8' }));
  facts[bankKey] = original.map(baseFact);
}

fs.writeFileSync('data/reading-base-facts.json', `${JSON.stringify(facts, null, 2)}\n`);
console.log(`extracted ${Object.values(facts).reduce((total, items) => total + items.length, 0)} base facts for ${bankKeys.length} author banks`);
