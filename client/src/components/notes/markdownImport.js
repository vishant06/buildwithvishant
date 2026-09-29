import { createBlock, normalizeLanguage } from './blockTypes.js';

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_RE = /^!\[(.*?)\]\((\S+?)(?:\s+"(.*?)")?\)\s*$/;
const BULLET_RE = /^[-*+]\s+(.*)$/;
const NUMBERED_RE = /^\d+[.)]\s+(.*)$/;
const TABLE_ROW_RE = /^\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const CODE_FENCE_RE = /^```\s*([^\s`]*)\s*$/;
const CODE_FENCE_END_RE = /^```\s*$/;
const ALERT_RE = /^>\s*\[!(NOTE|IMPORTANT|TIP|WARNING)\]\s*$/i;
const QUOTE_LINE_RE = /^>\s?(.*)$/;

const ALERT_TO_CALLOUT = { note: 'note', important: 'important', tip: 'tip', warning: 'warning' };

const splitTableRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/**
 * Parses a full Markdown document into the note block-editor's structured
 * block format. Deliberately conservative: it only recognizes constructs the
 * editor already knows how to render (headings, paragraphs, fenced code —
 * with a `output`/`out` language treated as an Output block — bullet/numbered
 * lists, GitHub-style `> [!NOTE]` alerts or plain blockquotes as callouts,
 * standalone images, pipe tables, and `---` dividers). Anything else falls
 * back to a plain text/paragraph block so no content is silently dropped.
 */
export const parseMarkdownToBlocks = (markdown) => {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let paragraphBuffer = [];

  const flushParagraph = () => {
    while (paragraphBuffer.length && paragraphBuffer[paragraphBuffer.length - 1] === '') {
      paragraphBuffer.pop();
    }
    const text = paragraphBuffer.join('\n').trim();
    if (text) blocks.push({ ...createBlock('text'), content: text });
    paragraphBuffer = [];
  };

  let i = 0;
  const total = lines.length;

  while (i < total) {
    const line = lines[i];

    // Blank line — paragraph break within the current buffer.
    if (!line.trim()) {
      if (paragraphBuffer.length && paragraphBuffer[paragraphBuffer.length - 1] !== '') {
        paragraphBuffer.push('');
      }
      i += 1;
      continue;
    }

    // Fenced code / output block.
    const fenceMatch = line.match(CODE_FENCE_RE);
    if (fenceMatch) {
      flushParagraph();
      const rawLang = fenceMatch[1].toLowerCase();
      const codeLines = [];
      i += 1;
      while (i < total && !CODE_FENCE_END_RE.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // consume closing fence
      const content = codeLines.join('\n');
      if (rawLang === 'output' || rawLang === 'out') {
        blocks.push({ ...createBlock('output'), content });
      } else {
        blocks.push({ ...createBlock('code'), language: normalizeLanguage(rawLang), content });
      }
      continue;
    }

    // Heading.
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ ...createBlock('heading'), level: Math.min(headingMatch[1].length, 4), content: headingMatch[2].trim() });
      i += 1;
      continue;
    }

    // Table (header row + separator row required).
    if (TABLE_ROW_RE.test(line) && lines[i + 1] && TABLE_SEP_RE.test(lines[i + 1])) {
      flushParagraph();
      const headers = splitTableRow(line);
      i += 2;
      const rows = [];
      while (i < total && TABLE_ROW_RE.test(lines[i])) {
        rows.push({ cells: splitTableRow(lines[i]) });
        i += 1;
      }
      blocks.push({ ...createBlock('table'), headers, rows });
      continue;
    }

    // GitHub-style alert callout: > [!NOTE] / [!IMPORTANT] / [!TIP] / [!WARNING]
    const alertMatch = line.match(ALERT_RE);
    if (alertMatch) {
      flushParagraph();
      const calloutType = ALERT_TO_CALLOUT[alertMatch[1].toLowerCase()] || 'note';
      const contentLines = [];
      i += 1;
      while (i < total && QUOTE_LINE_RE.test(lines[i]) && lines[i].trim() !== '>') {
        contentLines.push(lines[i].replace(QUOTE_LINE_RE, '$1'));
        i += 1;
      }
      blocks.push({ ...createBlock('callout'), calloutType, content: contentLines.join(' ').trim() });
      continue;
    }

    // Plain blockquote -> Note callout.
    if (QUOTE_LINE_RE.test(line)) {
      flushParagraph();
      const contentLines = [];
      while (i < total && QUOTE_LINE_RE.test(lines[i]) && lines[i].trim() !== '>') {
        contentLines.push(lines[i].replace(QUOTE_LINE_RE, '$1'));
        i += 1;
      }
      blocks.push({ ...createBlock('callout'), calloutType: 'note', content: contentLines.join(' ').trim() });
      continue;
    }

    // Standalone image.
    const imageMatch = line.match(IMAGE_RE);
    if (imageMatch) {
      flushParagraph();
      blocks.push({ ...createBlock('image'), alt: imageMatch[1] || '', url: imageMatch[2] || '', caption: imageMatch[3] || '' });
      i += 1;
      continue;
    }

    // Horizontal rule / divider. Checked after headings/tables since `---`
    // can also be a Setext heading underline — treated here as a divider,
    // the simpler and more common case in plain notes.
    if (HR_RE.test(line)) {
      flushParagraph();
      blocks.push(createBlock('divider'));
      i += 1;
      continue;
    }

    // Bullet list.
    if (BULLET_RE.test(line)) {
      flushParagraph();
      const items = [];
      while (i < total && BULLET_RE.test(lines[i])) {
        items.push(lines[i].match(BULLET_RE)[1].trim());
        i += 1;
      }
      blocks.push({ ...createBlock('bulletList'), items });
      continue;
    }

    // Numbered list.
    if (NUMBERED_RE.test(line)) {
      flushParagraph();
      const items = [];
      while (i < total && NUMBERED_RE.test(lines[i])) {
        items.push(lines[i].match(NUMBERED_RE)[1].trim());
        i += 1;
      }
      blocks.push({ ...createBlock('numberedList'), items });
      continue;
    }

    // Anything else is regular paragraph text.
    paragraphBuffer.push(line);
    i += 1;
  }

  flushParagraph();
  return blocks;
};
