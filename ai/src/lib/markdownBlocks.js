// A small, safe Markdown block parser for assistant replies (no HTML is ever interpreted).
// Inline formatting (bold, italic, code, links) is handled by each app's inline renderer; this file only
// decides the BLOCK structure: code fences, headings, lists, quotes, rules, tables, paragraphs.
// Pure and framework-free: it is unit-tested in Node and shared (copied) into the mobile app.

const FENCE = /^```([^\n`]*)\n?([\s\S]*?)(?:```|$)/;

export const splitCodeFences = (text) => {
  const parts = [];
  let rest = String(text ?? '');
  while (rest.length) {
    const start = rest.indexOf('```');
    if (start === -1) {
      parts.push({ type: 'text', text: rest });
      break;
    }
    if (start > 0) parts.push({ type: 'text', text: rest.slice(0, start) });
    const match = FENCE.exec(rest.slice(start));
    const consumed = match ? match[0].length : rest.length - start;
    if (match) parts.push({ type: 'code', language: (match[1] || '').trim(), code: match[2].replace(/\n$/, '') });
    rest = rest.slice(start + consumed);
  }
  return parts;
};

const isTableSeparator = (line) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('|');
const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

export const parseTextBlocks = (text) => {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush();
      blocks.push({ type: 'hr' });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ type: 'heading', level: Math.min(4, heading[1].length), text: heading[2] });
      continue;
    }
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flush();
      const header = splitRow(trimmed);
      const align = splitRow(lines[i + 1]).map((cell) => (cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left'));
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      i -= 1;
      blocks.push({ type: 'table', header, align, rows });
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flush();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      i -= 1;
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)/.exec(trimmed);
    const numbered = /^(\d+)[.)]\s+(.*)/.exec(trimmed);
    if (bullet || numbered) {
      flush();
      const ordered = Boolean(numbered);
      const items = [];
      const start = numbered ? Number.parseInt(numbered[1], 10) : 1;
      while (i < lines.length) {
        const current = lines[i].trim();
        const b = /^[-*+]\s+(.*)/.exec(current);
        const n = /^(\d+)[.)]\s+(.*)/.exec(current);
        if ((ordered && n) || (!ordered && b)) {
          items.push((ordered ? n[2] : b[1]).trim());
          i += 1;
        } else if (current && /^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ` ${current}`;
          i += 1;
        } else break;
      }
      i -= 1;
      blocks.push({ type: 'list', ordered, start, items });
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
};

export const parseMarkdown = (text) =>
  splitCodeFences(text).flatMap((part) => (part.type === 'code' ? [part] : parseTextBlocks(part.text)));
