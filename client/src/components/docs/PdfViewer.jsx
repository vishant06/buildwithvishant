import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, Minus, Plus, ScanLine, TriangleAlert } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { pdfjs } from 'react-pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Recent PDF.js releases use Map/WeakMap "upsert" helpers that browsers released before 2026 do not have yet.
// Adding them (only when missing) keeps the reader working on those browsers.
for (const Collection of [Map, WeakMap]) {
  if (!Collection.prototype.getOrInsertComputed) {
    Collection.prototype.getOrInsertComputed = function getOrInsertComputed(key, compute) {
      if (this.has(key)) return this.get(key);
      const value = compute(key);
      this.set(key, value);
      return value;
    };
  }
  if (!Collection.prototype.getOrInsert) {
    Collection.prototype.getOrInsert = function getOrInsert(key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    };
  }
}

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// The reader. PDF.js loads the file in byte ranges (so a big PDF starts showing after the first
// chunk), pages are drawn only while they are near the viewport, and a text layer makes text
// selectable (used by "explain this passage"). Scripting inside PDFs is never enabled.
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const PAGE_GAP = 12;
const SIDE_PADDING = 24;

const friendlyError = (error) => {
  const status = error?.status;
  if (status === 404 || error?.name === 'MissingPDFException') return 'This note is not available.';
  if (status === 401 || status === 403) return 'You do not have access to this note.';
  if (error?.name === 'PasswordException') return 'This PDF is password protected.';
  if (error?.name === 'InvalidPDFException') return 'This file could not be read as a PDF.';
  return 'The document could not be loaded. Check your connection and try again.';
};

function PageSlot({ pdf, number, scale, width, height, root, onSize }) {
  const slotRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [near, setNear] = useState(number <= 2);

  useEffect(() => {
    const node = slotRef.current;
    if (!node || !root) return undefined;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { root, rootMargin: '1200px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const text = textRef.current;
    if (!near) {
      if (canvas) {
        canvas.width = 0; // free the bitmap of pages far away from the viewport
        canvas.height = 0;
      }
      text?.replaceChildren();
      return undefined;
    }
    let cancelled = false;
    let renderTask;
    let textLayer;
    (async () => {
      try {
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        onSize?.(number, base.width, base.height);
        const viewport = page.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({ canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
        await renderTask.promise;
        if (cancelled) return;
        text.replaceChildren();
        textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport });
        await textLayer.render();
      } catch (error) {
        if (error?.name !== 'RenderingCancelledException' && !cancelled) console.warn('PDF page render failed:', error?.message);
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [near, pdf, number, scale, onSize]);

  return (
    <div ref={slotRef} className="nd-page" data-page={number} style={{ width, height }} aria-label={`Page ${number}`}>
      <canvas ref={canvasRef} />
      <div ref={textRef} className="nd-text" />
    </div>
  );
}

const PdfViewer = forwardRef(function PdfViewer({ url, headers, onReady, onPageChange, onSelection, title = 'Document', height }, ref) {
  const shellRef = useRef(null);
  const scrollRef = useRef(null);
  const [state, setState] = useState({ status: 'loading', pdf: null, pages: 0, error: '', progress: 0 });
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [box, setBox] = useState({ width: 800 });
  const [base, setBase] = useState({ width: 612, height: 792 });
  const [current, setCurrent] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const headerKey = JSON.stringify(headers || {});

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', pdf: null, pages: 0, error: '', progress: 0 });
    const task = pdfjs.getDocument({
      url,
      httpHeaders: headers,
      withCredentials: false,
      rangeChunkSize: 256 * 1024,
      disableAutoFetch: true,
      isEvalSupported: false,
      enableXfa: false
    });
    task.onProgress = ({ loaded, total }) => !cancelled && total && setState((s) => (s.status === 'loading' ? { ...s, progress: Math.round((loaded / total) * 100) } : s));
    task.promise
      .then(async (pdf) => {
        if (cancelled) return pdf.destroy();
        const first = await pdf.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        setBase({ width: viewport.width, height: viewport.height });
        setCurrent(1);
        setState({ status: 'ready', pdf, pages: pdf.numPages, error: '', progress: 100 });
        onReady?.({ numPages: pdf.numPages });
        return undefined;
      })
      .catch((error) => !cancelled && setState({ status: 'error', pdf: null, pages: 0, error: friendlyError(error), progress: 0 }));
    return () => {
      cancelled = true;
      task.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, headerKey, reloadKey]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width }));
    observer.observe(node);
    return () => observer.disconnect();
  }, [state.status]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Each page is fitted to the width of the reading area (pages can have different sizes, e.g. landscape slides).
  const [sizes, setSizes] = useState({});
  const onSize = useCallback((n, w, h) => setSizes((prev) => (prev[n]?.w === w && prev[n]?.h === h ? prev : { ...prev, [n]: { w, h } })), []);
  useEffect(() => setSizes({}), [url, reloadKey]);
  const fitWidth = Math.max(120, box.width - SIDE_PADDING);
  const geometry = (n) => {
    const size = sizes[n] || { w: base.width, h: base.height };
    const pageScale = Math.max(0.1, (fitWidth / size.w) * zoom);
    return { scale: pageScale, width: Math.floor(size.w * pageScale), height: Math.floor(size.h * pageScale) };
  };
  const first = geometry(1);
  const scale = first.scale; // shown in the toolbar

  const goToPage = useCallback((n) => {
    const node = scrollRef.current?.querySelector(`[data-page="${n}"]`);
    if (node) scrollRef.current.scrollTo({ top: node.offsetTop - PAGE_GAP, behavior: 'smooth' });
  }, []);
  useImperativeHandle(ref, () => ({ goToPage, get currentPage() { return current; } }), [goToPage, current]);

  // current page = the one at the middle of the visible area
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || state.status !== 'ready') return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = node.scrollTop + node.clientHeight / 3;
      let next = 1;
      for (const slot of node.querySelectorAll('[data-page]')) {
        if (slot.offsetTop - PAGE_GAP <= middle) next = Number(slot.dataset.page);
        else break;
      }
      setCurrent((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [state.status, state.pages]);

  useEffect(() => {
    if (state.status === 'ready') onPageChange?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, state.status]);

  // selected text (for "explain this passage")
  useEffect(() => {
    if (!onSelection) return undefined;
    const report = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      const anchor = selection?.anchorNode?.parentElement?.closest?.('[data-page]');
      if (text && anchor && scrollRef.current?.contains(anchor)) onSelection({ text: text.slice(0, 1500), page: Number(anchor.dataset.page) });
      else onSelection(null);
    };
    let timer;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(report, 250);
    };
    document.addEventListener('selectionchange', later);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', later);
    };
  }, [onSelection]);

  const stepZoom = (direction) => {
    const index = ZOOM_STEPS.reduce((best, value, i) => (Math.abs(value - zoom) < Math.abs(ZOOM_STEPS[best] - zoom) ? i : best), 0);
    setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + direction))]);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else shellRef.current?.requestFullscreen?.();
  };

  const pageNumbers = useMemo(() => Array.from({ length: state.pages }, (_, i) => i + 1), [state.pages]);
  const canFullscreen = typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen);

  return (
    <div ref={shellRef} className={`nd-viewer${fullscreen ? ' is-fullscreen' : ''}`} style={height && !fullscreen ? { height } : undefined}>
      <div className="nd-toolbar" role="toolbar" aria-label="Document controls">
        <button type="button" className="nd-icon-btn" onClick={() => goToPage(Math.max(1, current - 1))} disabled={state.status !== 'ready' || current <= 1} aria-label="Previous page"><ChevronLeft size={18} /></button>
        <label className="nd-page-input">
          <span className="sr-only">Page number</span>
          <input
            type="number"
            min={1}
            max={state.pages || 1}
            value={current}
            disabled={state.status !== 'ready'}
            onChange={(event) => {
              const n = Number.parseInt(event.target.value, 10);
              if (n >= 1 && n <= state.pages) goToPage(n);
            }}
          />
          <span aria-hidden="true">/ {state.pages || '–'}</span>
        </label>
        <button type="button" className="nd-icon-btn" onClick={() => goToPage(Math.min(state.pages, current + 1))} disabled={state.status !== 'ready' || current >= state.pages} aria-label="Next page"><ChevronRight size={18} /></button>
        <span className="nd-spacer" />
        <button type="button" className="nd-icon-btn" onClick={() => stepZoom(-1)} disabled={state.status !== 'ready'} aria-label="Zoom out"><Minus size={18} /></button>
        <span className="nd-zoom" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" className="nd-icon-btn" onClick={() => stepZoom(1)} disabled={state.status !== 'ready'} aria-label="Zoom in"><Plus size={18} /></button>
        <button type="button" className="nd-icon-btn" onClick={() => setZoom(1)} disabled={state.status !== 'ready'} aria-label="Fit to width" title="Fit to width"><ScanLine size={18} /></button>
        {canFullscreen && (
          <button type="button" className="nd-icon-btn" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}
      </div>

      <div className="nd-scroll" ref={scrollRef} tabIndex={0} role="document" aria-label={`${title} (PDF)`}>
        {state.status === 'loading' && (
          <div className="nd-state" role="status">
            <Loader2 className="nd-spin" size={28} />
            <span>Opening document{state.progress ? ` ${state.progress}%` : '…'}</span>
          </div>
        )}
        {state.status === 'error' && (
          <div className="nd-state error" role="alert">
            <TriangleAlert size={28} />
            <span>{state.error}</span>
            <button type="button" className="btn ghost" onClick={() => setReloadKey((n) => n + 1)}>Try again</button>
          </div>
        )}
        {state.status === 'ready' && (
          <div className="nd-pages" style={{ gap: PAGE_GAP }}>
            {pageNumbers.map((n) => {
              const g = geometry(n);
              return <PageSlot key={n} pdf={state.pdf} number={n} scale={g.scale} width={g.width} height={g.height} root={scrollRef.current} onSize={onSize} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default PdfViewer;
