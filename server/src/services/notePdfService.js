import PDFDocument from 'pdfkit';

// Converts a Note document (structured `blocks`, or legacy `content` +
// `codeExamples`) into a formatted PDF stream. No external network calls are
// made here — image blocks are rendered as a labelled placeholder instead of
// fetching the remote image, keeping generation fast, offline, and immune to
// SSRF/timeout failure modes on a request-scoped endpoint.

const FONT = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique',
  mono: 'Courier',
};

const COLORS = {
  text: '#1a1f27',
  muted: '#5c6470',
  accent: '#1f6feb',
  border: '#d8dde3',
  codeBg: '#f4f5f7',
  codeText: '#1f2937',
  outputBg: '#111827',
  outputText: '#e5e7eb',
  inlineCode: '#a8330f',
  calloutBg: { note: '#eef2ff', important: '#fef2f2', tip: '#ecfdf5', warning: '#fffbeb' },
  calloutBorder: { note: '#6366f1', important: '#ef4444', tip: '#10b981', warning: '#f59e0b' },
  calloutLabel: { note: 'Note', important: 'Important', tip: 'Tip', warning: 'Warning' },
};

const PAGE_MARGINS = { top: 74, bottom: 66, left: 56, right: 56 };

// ---------------------------------------------------------------------------
// Inline markdown (bold / italic / inline code / links) — mirrors the same
// small token set the client's inlineMarkdown.jsx supports, so PDFs match
// what's shown on the site.
// ---------------------------------------------------------------------------
const BLOCK_TOKEN = /(\*\*.+?\*\*|__.+?__|`[^`]+`|\[.+?\]\(\S+?\))/g;
const ITALIC_TOKEN = /(\*[^*\n]+?\*|_[^_\n]+?_)/g;

function tokenizeInline(text) {
  const out = [];
  const parts = String(text || '').split(BLOCK_TOKEN).filter((part) => part !== '');
  for (const part of parts) {
    if (/^\*\*.+\*\*$/.test(part) || /^__.+__$/.test(part)) {
      out.push({ text: part.slice(2, -2), bold: true });
      continue;
    }
    if (/^`[^`]+`$/.test(part)) {
      out.push({ text: part.slice(1, -1), code: true });
      continue;
    }
    const linkMatch = part.match(/^\[(.+?)\]\((\S+?)\)$/);
    if (linkMatch) {
      out.push({ text: linkMatch[1], link: linkMatch[2] });
      continue;
    }
    part
      .split(ITALIC_TOKEN)
      .filter((seg) => seg !== '')
      .forEach((seg) => {
        if (/^\*[^*]+\*$/.test(seg) || /^_[^_]+_$/.test(seg)) {
          out.push({ text: seg.slice(1, -1), italic: true });
        } else {
          out.push({ text: seg });
        }
      });
  }
  return out;
}

const plainText = (text) => tokenizeInline(text).map((t) => t.text).join('');

function pickFont(token, baseBold) {
  if (token.code) return FONT.mono;
  if (baseBold && token.italic) return FONT.boldItalic;
  if (baseBold) return FONT.bold;
  if (token.bold && token.italic) return FONT.boldItalic;
  if (token.bold) return FONT.bold;
  if (token.italic) return FONT.italic;
  return FONT.regular;
}

// Renders a run of inline-formatted text starting at the document's current
// position (or an explicit x), wrapping within `width`.
function drawInline(doc, text, { size = 11, color = COLORS.text, x, width, baseBold = false } = {}) {
  const tokens = tokenizeInline(text);
  if (tokens.length === 0) return;
  if (x !== undefined) doc.x = x;
  const usableWidth = width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.fontSize(size);
  tokens.forEach((token, index) => {
    const isLast = index === tokens.length - 1;
    const font = pickFont(token, baseBold);
    const fillColor = token.code ? COLORS.inlineCode : token.link ? COLORS.accent : color;
    const options = { continued: !isLast, lineGap: 3 };
    if (index === 0) options.width = usableWidth;
    if (token.link) {
      options.link = token.link;
      options.underline = true;
    }
    doc.font(font).fillColor(fillColor).text(token.text, options);
  });
  doc.font(FONT.regular).fillColor(COLORS.text);
}

function ensureSpace(doc, height) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) doc.addPage();
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------
const HEADING_SIZES = { 1: 20, 2: 17, 3: 14, 4: 12 };

function renderHeading(doc, block) {
  const size = HEADING_SIZES[block.level] || 15;
  doc.moveDown(0.6);
  ensureSpace(doc, size + 14);
  drawInline(doc, block.content, { size, color: COLORS.text, baseBold: true });
  doc.moveDown(0.25);
}

function renderText(doc, block) {
  if (!block.content || !block.content.trim()) return;
  ensureSpace(doc, 20);
  drawInline(doc, block.content, { size: 11, color: COLORS.text });
  doc.moveDown(0.5);
}

function renderList(doc, block, ordered) {
  const items = (block.items || []).map(plainText).filter(Boolean);
  if (items.length === 0) return;
  ensureSpace(doc, 20);
  doc.font(FONT.regular).fontSize(11).fillColor(COLORS.text);
  doc.list(items, {
    listType: ordered ? 'numbered' : 'bullet',
    textIndent: 18,
    bulletIndent: 4,
    lineGap: 3,
  });
  doc.moveDown(0.35);
}

// Shared renderer for `code` and `output` blocks: a rounded background box
// containing monospaced text, automatically split across pages if the block
// is longer than a single page can hold.
function renderCodeLike(doc, content, { bg, fg, label }) {
  const lines = String(content || '').split('\n');
  const fontSize = 9.5;
  const padding = 10;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.moveDown(0.3);
  if (label) {
    ensureSpace(doc, 16);
    doc.font(FONT.regular).fontSize(8.5).fillColor(COLORS.muted).text(label.toUpperCase());
    doc.moveDown(0.15);
  }

  doc.font(FONT.mono).fontSize(fontSize).lineGap(2);
  const lineHeight = doc.currentLineHeight(true);
  const availableFullPage = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - padding * 2;
  const maxLinesPerPage = Math.max(3, Math.floor(availableFullPage / lineHeight) - 1);

  let i = 0;
  while (i < lines.length) {
    const chunk = lines.slice(i, i + maxLinesPerPage);
    const boxHeight = chunk.length * lineHeight + padding * 2;
    ensureSpace(doc, boxHeight);
    const startY = doc.y;

    doc.roundedRect(doc.page.margins.left, startY, usableWidth, boxHeight, 4).fill(bg);
    doc.fillColor(fg).font(FONT.mono).fontSize(fontSize);
    doc.text(chunk.join('\n'), doc.page.margins.left + padding, startY + padding, {
      width: usableWidth - padding * 2,
      lineGap: 2,
    });

    doc.y = startY + boxHeight;
    doc.x = doc.page.margins.left;
    i += chunk.length;
    if (i < lines.length) doc.addPage();
  }

  doc.lineGap(0);
  doc.font(FONT.regular).fillColor(COLORS.text);
  doc.moveDown(0.5);
}

function renderCode(doc, block) {
  if (!block.content || !block.content.trim()) return;
  renderCodeLike(doc, block.content, {
    bg: COLORS.codeBg,
    fg: COLORS.codeText,
    label: block.language || 'code',
  });
}

function renderOutput(doc, block) {
  if (!block.content || !block.content.trim()) return;
  renderCodeLike(doc, block.content, {
    bg: COLORS.outputBg,
    fg: COLORS.outputText,
    label: 'Output',
  });
}

function renderCallout(doc, block) {
  if (!block.content || !block.content.trim()) return;
  const type = COLORS.calloutBorder[block.calloutType] ? block.calloutType : 'note';
  const bg = COLORS.calloutBg[type];
  const border = COLORS.calloutBorder[type];
  const label = COLORS.calloutLabel[type];
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const padding = 10;
  const innerWidth = usableWidth - padding * 2 - 4;

  doc.font(FONT.bold).fontSize(9.5);
  const labelHeight = doc.heightOfString(label, { width: innerWidth });
  doc.font(FONT.regular).fontSize(10.5);
  const bodyHeight = doc.heightOfString(plainText(block.content), { width: innerWidth, lineGap: 3 });
  const boxHeight = labelHeight + bodyHeight + padding * 2 + 8;

  doc.moveDown(0.3);
  ensureSpace(doc, boxHeight);
  const startY = doc.y;

  doc.rect(doc.page.margins.left, startY, usableWidth, boxHeight).fill(bg);
  doc.rect(doc.page.margins.left, startY, 4, boxHeight).fill(border);

  doc.fillColor(border).font(FONT.bold).fontSize(9.5)
    .text(label.toUpperCase(), doc.page.margins.left + padding + 4, startY + padding, { width: innerWidth });
  doc.moveDown(0.2);

  drawInline(doc, block.content, {
    size: 10.5,
    color: COLORS.text,
    x: doc.page.margins.left + padding + 4,
    width: innerWidth,
  });

  doc.y = startY + boxHeight;
  doc.x = doc.page.margins.left;
  doc.moveDown(0.4);
}

function renderTable(doc, block) {
  const headers = block.headers || [];
  const rows = block.rows || [];
  if (headers.length === 0) return;

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / headers.length;
  const cellPadding = 6;
  const fontSize = 9.5;

  const cellHeight = (text, bold) => {
    doc.font(bold ? FONT.bold : FONT.regular).fontSize(fontSize);
    return doc.heightOfString(String(text || ''), { width: colWidth - cellPadding * 2 }) + cellPadding * 2;
  };

  const drawRow = (cells, y, bold, bg) => {
    const rowHeight = Math.max(...cells.map((c) => cellHeight(c, bold)), 22);
    if (bg) doc.rect(doc.page.margins.left, y, usableWidth, rowHeight).fill(bg);
    doc.strokeColor(COLORS.border).lineWidth(0.5);
    cells.forEach((cellText, i) => {
      const x = doc.page.margins.left + i * colWidth;
      doc.rect(x, y, colWidth, rowHeight).stroke();
      doc.fillColor(COLORS.text).font(bold ? FONT.bold : FONT.regular).fontSize(fontSize)
        .text(String(cellText || ''), x + cellPadding, y + cellPadding, { width: colWidth - cellPadding * 2 });
    });
    return rowHeight;
  };

  doc.moveDown(0.3);
  ensureSpace(doc, 30);
  let rowHeight = drawRow(headers, doc.y, true, '#eef1f5');
  doc.y += rowHeight;

  rows.forEach((row) => {
    const cells = row.cells || [];
    while (cells.length < headers.length) cells.push('');
    const rh = Math.max(...cells.map((c) => cellHeight(c, false)), 20);
    ensureSpace(doc, rh);
    const drawn = drawRow(cells, doc.y, false, null);
    doc.y += drawn;
  });

  doc.x = doc.page.margins.left;
  doc.moveDown(0.5);
}

function renderDivider(doc) {
  ensureSpace(doc, 24);
  doc.moveDown(0.3);
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function renderImagePlaceholder(doc, block) {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const label = block.caption || block.alt || 'Image';
  ensureSpace(doc, 44);
  doc.moveDown(0.2);
  const y = doc.y;
  doc.dash(3, { space: 2 }).strokeColor(COLORS.border)
    .rect(doc.page.margins.left, y, usableWidth, 34).stroke();
  doc.undash();
  doc.fillColor(COLORS.muted).font(FONT.italic).fontSize(9.5)
    .text(`[Image: ${label}]`, doc.page.margins.left + 10, y + 11, { width: usableWidth - 20 });
  doc.y = y + 34;
  doc.x = doc.page.margins.left;
  doc.moveDown(0.5);
}

function renderBlock(doc, block) {
  switch (block.type) {
    case 'heading': return renderHeading(doc, block);
    case 'text': return renderText(doc, block);
    case 'code': return renderCode(doc, block);
    case 'output': return renderOutput(doc, block);
    case 'bulletList': return renderList(doc, block, false);
    case 'numberedList': return renderList(doc, block, true);
    case 'callout': return renderCallout(doc, block);
    case 'image': return renderImagePlaceholder(doc, block);
    case 'table': return renderTable(doc, block);
    case 'divider': return renderDivider(doc);
    default: return undefined;
  }
}

// Notes created before the block editor existed store a single `content`
// string (with a light "## Heading" convention) plus a separate
// `codeExamples` array — mirrors NoteRenderer.jsx's <LegacyNote> handling.
function renderLegacyContent(doc, note) {
  String(note.content || '').split('\n').forEach((line) => {
    if (!line.trim()) return;
    if (line.startsWith('#### ')) return renderHeading(doc, { level: 4, content: line.slice(5) });
    if (line.startsWith('### ')) return renderHeading(doc, { level: 3, content: line.slice(4) });
    if (line.startsWith('## ')) return renderHeading(doc, { level: 2, content: line.slice(3) });
    return renderText(doc, { content: line });
  });

  (note.codeExamples || []).forEach((example) => {
    if (example.title) renderText(doc, { content: `**${example.title}**` });
    renderCode(doc, { content: example.code || '', language: example.language });
  });
}

// ---------------------------------------------------------------------------
// Header / footer — drawn once at the end (after content + pagination is
// known) so the footer can show an accurate "Page X of Y".
// ---------------------------------------------------------------------------
function addHeaderAndFooter(doc, note) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const { left, right } = doc.page.margins;
    const pageWidth = doc.page.width;
    const footerY = doc.page.height - doc.page.margins.bottom + 20;

    doc.font(FONT.bold).fontSize(9).fillColor(COLORS.accent)
      .text('BuildWithVishant', left, 30, { continued: true })
      .font(FONT.regular).fillColor(COLORS.muted)
      .text(`  ·  ${note.title}`, { width: pageWidth - left - right - 10, ellipsis: true });
    doc.moveTo(left, 48).lineTo(pageWidth - right, 48).strokeColor(COLORS.border).lineWidth(0.75).stroke();

    doc.moveTo(left, footerY - 10).lineTo(pageWidth - right, footerY - 10).strokeColor(COLORS.border).lineWidth(0.75).stroke();
    doc.font(FONT.regular).fontSize(8).fillColor(COLORS.muted)
      .text('BuildWithVishant — Developer Learning Resources · https://www.buildwithvishant.in', left, footerY, {
        width: pageWidth - left - right - 90,
      });
    doc.text(`Page ${i + 1} of ${range.count}`, pageWidth - right - 90, footerY, { width: 90, align: 'right' });
  }
}

/**
 * Builds a note PDF and pipes it directly into `outputStream` (typically the
 * HTTP response). Returns the PDFDocument in case the caller wants to listen
 * for stream events (e.g. 'error').
 */
export function renderNotePdf(note, outputStream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: PAGE_MARGINS,
    bufferPages: true,
    info: {
      Title: `${note.title} | BuildWithVishant`,
      Author: note.author?.name || 'BuildWithVishant',
      Subject: note.description || '',
    },
  });

  doc.pipe(outputStream);

  // Title block
  doc.font(FONT.bold).fontSize(9).fillColor(COLORS.accent)
    .text('BUILDWITHVISHANT — PROGRAMMING NOTES', { characterSpacing: 0.4 });
  doc.moveDown(0.4);
  doc.font(FONT.bold).fontSize(22).fillColor(COLORS.text).text(note.title);

  const meta = [note.category, note.difficulty].filter(Boolean).join('  ·  ');
  if (meta) {
    doc.moveDown(0.2);
    doc.font(FONT.regular).fontSize(10.5).fillColor(COLORS.muted).text(meta);
  }
  if (note.description) {
    doc.moveDown(0.3);
    doc.font(FONT.regular).fontSize(11.5).fillColor(COLORS.text).text(note.description);
  }
  doc.moveDown(0.3);
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor(COLORS.border).lineWidth(1).stroke();
  doc.moveDown(0.8);

  const blocks = note.blocks || [];
  if (blocks.length > 0) {
    blocks.forEach((block) => renderBlock(doc, block));
  } else {
    renderLegacyContent(doc, note);
  }

  addHeaderAndFooter(doc, note);
  doc.end();
  return doc;
}

// Converts a note title/slug into a safe download filename, e.g.
// "JavaScript Basics" -> "javascript-basics-notes.pdf".
export function noteFilename(note) {
  const base = String(note.slug || note.title || 'note')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'note';
  return base.endsWith('-notes') ? `${base}.pdf` : `${base}-notes.pdf`;
}
