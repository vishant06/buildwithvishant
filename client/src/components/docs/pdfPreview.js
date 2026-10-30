import { pdfjs } from 'react-pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// Reads a chosen file in the browser BEFORE uploading: page count for early feedback and a small
// first-page thumbnail. This is a convenience only. The server re-validates the file from scratch and
// treats the thumbnail as untrusted.
export const previewPdf = async (file, { maxWidth = 360 } = {}) => {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, isEvalSupported: false, enableXfa: false });
  try {
    const pdf = await task.promise;
    const pages = pdf.numPages;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maxWidth / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
    return { pages, thumbnail: blob && blob.size <= 380 * 1024 ? blob : null, thumbnailUrl: blob ? URL.createObjectURL(blob) : '' };
  } finally {
    task.destroy();
  }
};
