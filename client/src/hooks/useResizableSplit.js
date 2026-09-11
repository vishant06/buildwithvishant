import { useCallback, useEffect, useRef, useState } from 'react';

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

  const getContainerSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return axis === 'x' ? rect.width : rect.height;
  }, [containerRef, axis]);

  // Re-clamp whenever the container itself resizes, so a previously-valid
  // ratio can't leave a pane smaller than its minimum after the window (or
  // fit-to-screen container) shrinks.
  useEffect(() => {
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
      setRatio(clampRatio(raw, drag.containerSize, min1, min2, handleSize));
    },
    [axis, min1, min2, handleSize],
  );

  const endDrag = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    setIsDragging(false);
    setRatio((current) => {
      persist(current);
      return current;
    });
  }, [persist]);

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
