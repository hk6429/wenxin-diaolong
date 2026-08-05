import fs from 'node:fs';
import { CHAPTERS } from '../js/adventure.js';

const SUFFIXES = ['elementary', 'junior', 'senior'];
const BOOK_PREFIXES = ['論語', '史記', '莊子', '楚辭'];
const NOVELS = new Set(['三國演義', '水滸傳', '西遊記', '聊齋志異', '紅樓夢', '世說新語']);

function inferWork(entry) {
  if (entry.work) return entry.work;
  const citation = String(entry.citation || '');
  const matched = citation.match(/[《〈]([^》〉]+)[》〉]/u)?.[1]?.trim();
  if (!matched) throw new Error(`${entry.id} 無法由 citation 推得作品名`);
  return matched;
}

function formatWork(work) {
  if (NOVELS.has(work) || BOOK_PREFIXES.some((prefix) => work.startsWith(prefix))) return `《${work}》`;
  return `〈${work}〉`;
}

function cleanQuestion(question, work) {
  return String(question || '')
    .replace(/[《〈]?本篇作品[》〉]?/gu, formatWork(work))
    .replace(/的第\s*\d+\s*組線索，/gu, '，')
    .replace(/（第\s*\d+\s*組線索）/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

const bankKeys = [...new Set(CHAPTERS.map((definition) => definition.echoQuest.bankKey))];
let changed = 0;

for (const bankKey of bankKeys) {
  for (const suffix of SUFFIXES) {
    const file = `data/${bankKey}-${suffix}.json`;
    const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    const repaired = entries.map((entry, index) => {
      const work = inferWork(entry);
      const next = {
        ...entry,
        work,
        readingKey: `${bankKey}-${String(index + 1).padStart(2, '0')}`,
        question: cleanQuestion(entry.question, work),
      };
      if (JSON.stringify(next) !== JSON.stringify(entry)) changed += 1;
      return next;
    });
    fs.writeFileSync(file, `${JSON.stringify(repaired, null, 2)}\n`);
  }
}

console.log(`repaired ${changed} reading entries across ${bankKeys.length} author banks`);
