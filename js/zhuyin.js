function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

export function renderZhuyin(text, annotations = [], mode = 'off', { suppress = false } = {}) {
  const source = String(text ?? '');
  if (mode === 'off' || suppress) return escapeHtml(source);

  const usable = annotations
    .filter((item) => item && typeof item.text === 'string' && item.text && Array.isArray(item.bopomofo)
      && (mode === 'full' || !item.fullOnly))
    .sort((a, b) => b.text.length - a.text.length);
  let html = '';
  let cursor = 0;
  while (cursor < source.length) {
    const match = usable.find((item) => source.startsWith(item.text, cursor));
    if (!match) {
      html += escapeHtml(source[cursor]);
      cursor += 1;
      continue;
    }
    html += [...match.text].map((char, index) => {
      const reading = match.bopomofo[index];
      return reading
        ? `<ruby>${escapeHtml(char)}<rt>${escapeHtml(reading)}</rt></ruby>`
        : escapeHtml(char);
    }).join('');
    cursor += match.text.length;
  }
  return html;
}
