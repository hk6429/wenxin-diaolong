import { rolloverDaily } from './daily.js';

export function localDay(now = new Date()) {
  return now.toLocaleDateString('sv');
}

export function syncSessionDay(ctx, now = new Date()) {
  if (!ctx?.meta) throw new TypeError('ctx.meta 必須存在');
  const today = localDay(now);
  const changed = ctx.today !== today || ctx.meta.daily?.date !== today;
  ctx.today = today;
  const events = rolloverDaily(ctx.meta, today);
  return { changed, today, events };
}
