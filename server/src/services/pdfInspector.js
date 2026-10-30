import { createHash } from 'node:crypto';

// Decides whether an uploaded buffer really is an acceptable PDF, and pulls out what the
// rest of the system needs (page count, per-page text for the AI assistant, a hash).
//
// Nothing the client says is trusted: not the file name, not the MIME type, not the size
// header. The bytes themselves are checked.
export class PdfRejected extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.name = 'PdfRejected';
  }
}

// Actions a PDF can carry that run code or reach outside the file. A study note never needs
// them, so they are refused outright. (This looks at the raw bytes; the viewer also runs
// with scripting switched off, so it is defence in depth rather than the only barrier.)
const DANGEROUS = /\/(?:JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|SubmitForm|ImportData|XFA)(?![A-Za-z])/;

let pdfjsPromise;
const loadPdfjs = () => (pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs'));

const withTimeout = (promise, ms, message) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new PdfRejected(message)), ms); })]).finally(() => clearTimeout(timer));
};

export const checkPdfBytes = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new PdfRejected('That file is empty or too small to be a PDF.');
  // Must START with the PDF header (no leading junk), which also stops "polyglot" files.
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new PdfRejected('That file is not a valid PDF.');
  if (!buffer.subarray(Math.max(0, buffer.length - 2048)).toString('latin1').includes('%%EOF')) throw new PdfRejected('That PDF looks truncated or damaged.');
  if (DANGEROUS.test(buffer.toString('latin1'))) throw new PdfRejected('This PDF contains scripts, embedded files or form actions, which are not allowed on notes.');
};

export const inspectPdf = async (buffer, { maxPages, maxTextChars, timeoutMs = 25_000 }) => {
  checkPdfBytes(buffer);
  const pdfjs = await loadPdfjs();
  let doc;
  try {
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, verbosity: 0, stopAtErrors: true });
    doc = await withTimeout(task.promise, timeoutMs, 'That PDF took too long to read.');
  } catch (error) {
    if (error instanceof PdfRejected) throw error;
    if (error?.name === 'PasswordException') throw new PdfRejected('Password-protected PDFs are not supported. Remove the password and upload it again.');
    throw new PdfRejected('That file could not be read as a PDF.');
  }

  try {
    const pages = doc.numPages;
    if (!pages || pages < 1) throw new PdfRejected('That PDF has no pages.');
    if (pages > maxPages) throw new PdfRejected(`That PDF has ${pages} pages. The limit is ${maxPages}.`);

    const pageText = [];
    let total = 0;
    await withTimeout((async () => {
      for (let n = 1; n <= pages && total < maxTextChars; n += 1) {
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
        page.cleanup();
        if (text) {
          pageText.push({ n, text });
          total += text.length;
        }
      }
    })(), timeoutMs, 'That PDF took too long to read.');

    return {
      pages,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      pageText,
      totalChars: total,
      hasText: total > 40
    };
  } catch (error) {
    if (error instanceof PdfRejected) throw error;
    throw new PdfRejected('That file could not be read as a PDF.');
  } finally {
    await doc.destroy().catch(() => null);
  }
};

// Thumbnails are optional and come from the uploader's browser, so they are checked too:
// real image bytes (PNG / JPEG / WebP), small, nothing else.
export const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};
