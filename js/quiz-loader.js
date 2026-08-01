import { validateEntry } from './schema.js';

export function loadQuizBank(rawEntries, _kind) {
  const usable = [];
  const rejected = [];
  for (const entry of rawEntries) {
    const result = validateEntry(entry);
    if (result.valid) usable.push(entry);
    else rejected.push({ entry, errors: result.errors });
  }
  return { usable, rejected };
}
