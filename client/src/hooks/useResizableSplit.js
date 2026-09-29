import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const clampRatio = (ratio, containerSize, min1, min2, handleSize) => {
  if (!containerSize) return ratio;
  // Each pane's rendered size is `ratio% of the full container` minus half
  // the handle (see the `calc(${ratio}% - ${handleSize / 2}px)` flex-basis
  // applied in the component) — so the minimum-ratio math has to mirror
  // that exact formula, not just divide by a "usable" container size, or
  // the enforced floor silently drifts a few px under the real minimum.
  const half = handleSize / 2;
  const minRatio1 = ((min1 + half) / containerSize) * 100;
  const maxRatio1 = 100 - ((min2 + half) / containerSize) * 100;
  if (minRatio1 > maxRatio1) return 50; // container smaller than both minimums combined
  return Math.min(Math.max(ratio, minRatio1), maxRatio1);
};

/**
 * Drives a single draggable divider between two flex siblings that live
 * inside `containerRef` (a flex row for axis 'x', a flex column for 'y').
 *
 * Returns a ratio (0-100, the first pane's share of the container) plus the
 * pointer handlers to spread onto the divider element. Sizing itself stays
 * in plain CSS (flex-basis percentages driven by `ratio`) — this hook only
 * owns the number and the drag interaction.
 *
 * min1 / min2: minimum pixel size for the first/second pane — enforced both
 * while dragging and whenever the container itself resizes (window resize,
 * fullscreen toggle, etc.), so a pane can never end up smaller than usable.
 */
export default function useResizableSplit({
  containerRef,
  axis,
  min1,
  min2,
  handleSize = 8,
  defaultRatio = 60,
  storageKey,
  enabled = true,
  onSettle,
}) {
  const [ratio, setRatio] = useState(() => {
    if (!storageKey) return defaultRatio;
    try {
      const raw = Number(localStorage.getItem(storageKey));
      return Number.isFinite(raw) && raw > 0 && raw < 100 ? raw : defaultRatio;
    } catch {
      return defaultRatio;
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef(null);
  const rafRef = useRef(null);
  const pendingRatioRef = useRef(null);

  const getContainerSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return axis === 'x' ? rect.width : rect.height;
  }, [containerRef, axis]);

  // Re-clamp whenever the container itself resizes, so a previously-valid
  // ratio can't leave a pane smaller than its minimum after the window (or
  // fit-to-screen container) shrinks.
  // useLayoutEffect: this re-clamps `ratio` against the container's real
  // measured size, so it must run before the browser paints — otherwise a
  // fast client-side route change can paint one frame with a ratio that
  // was computed (or restored from localStorage) before the flex layout
  // had actually settled, and nothing re-triggers the correction unless
  // the container happens to resize again later (matching the "only a
  // reload or manual window resize fixes it" symptom).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      const size = getContainerSize();
      setRatio((current) => clampRatio(current, size, min1, min2, handleSize));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, getContainerSize, min1, min2, handleSize]);

  const persist = useCallback(
    (value) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, String(value));
      } catch {
        // Storage unavailable (private browsing, quota) — resizing itself
        // still works, it just won't survive a refresh.
      }
    },
    [storageKey],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (!enabled || event.button > 0) return;
      const containerSize = getContainerSize();
      if (!containerSize) return;
      const rect = containerRef.current.getBoundingClientRect();
      dragState.current = {
        pointerId: event.pointerId,
        origin: axis === 'x' ? rect.left : rect.top,
        containerSize,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      event.preventDefault();
    },
    [axis, containerRef, enabled, getContainerSize],
  );

  const onPointerMove = useCallback(
    (event) => {
      const drag = dragState.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const pos = axis === 'x' ? event.clientX : event.clientY;
      const raw = ((pos - drag.origin) / drag.containerSize) * 100;
      pendingRatioRef.current = clampRatio(raw, drag.containerSize, min1, min2, handleSize);
      // A native pointermove can fire far more often than the browser can
      // actually paint (especially on high-poll-rate mice/trackpads). Every
      // update here re-lays-out Monaco and reflows the preview iframe —
      // both genuinely expensive — so setting React state synchronously on
      // every event was causing the browser to fall behind mid-drag,
      // visible as the editor/console briefly going blank or the preview
      // rendering at a stale size. Collapsing to one state update per
      // animation frame (last value wins) keeps the drag smooth.
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (pendingRatioRef.current !== null) setRatio(pendingRatioRef.current);
        });
      }
    },
    [axis, min1, min2, handleSize],
  );

  const endDrag = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const finalRatio = pendingRatioRef.current;
    pendingRatioRef.current = null;
    setIsDragging(false);
    setRatio((current) => {
      const settled = finalRatio ?? current;
      persist(settled);
      return settled;
    });
    // The preview iframe is a separate browsing context and, unlike a
    // normal element, doesn't reliably re-measure itself just because its
    // container's flex-basis changed via JS on every drag frame — it can
    // get stuck rendering at its pre-drag size indefinitely. Dispatching a
    // resize event is the same nudge `toggleFitToScreen` already uses
    // elsewhere in this file for the same class of problem, and forces the
    // iframe (and Monaco, redundantly-but-harmlessly) to re-measure now
    // that the drag has settled.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    onSettle?.();
  }, [persist, onSettle]);

  // Keyboard support: arrow keys nudge the split, Home/Enter resets it —
  // keeps the divider usable without a mouse/touchscreen.
  const onKeyDown = useCallback(
    (event) => {
      if (!enabled) return;
      const step = event.shiftKey ? 10 : 3;
      const decreaseKeys = axis === 'x' ? ['ArrowLeft'] : ['ArrowUp'];
      const increaseKeys = axis === 'x' ? ['ArrowRight'] : ['ArrowDown'];
      let next = null;
      if (decreaseKeys.includes(event.key)) next = ratio - step;
      else if (increaseKeys.includes(event.key)) next = ratio + step;
      else if (event.key === 'Home') next = defaultRatio;
      if (next === null) return;
      event.preventDefault();
      const size = getContainerSize();
      const clamped = clampRatio(next, size, min1, min2, handleSize);
      setRatio(clamped);
      persist(clamped);
    },
    [axis, defaultRatio, enabled, getContainerSize, handleSize, min1, min2, persist, ratio],
  );

  return {
    ratio,
    isDragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
      role: 'separator',
      'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal',
      tabIndex: enabled ? 0 : -1,
    },
  };
}
