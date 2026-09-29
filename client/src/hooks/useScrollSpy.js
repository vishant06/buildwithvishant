import { useEffect, useState } from 'react';

// Tracks which of `ids` (heading element ids, in document order) is
// currently "active" while the user scrolls `containerRef`. The rootMargin
// carves out a thin band near the top of the viewport — below the sticky
// topbar, above the fold — so the id that becomes active is whichever
// heading the reader is actually at, not whatever merely entered/left the
// full viewport.
export default function useScrollSpy(containerRef, ids, { rootMargin = '-150px 0px -65% 0px' } = {}) {
  const [activeId, setActiveId] = useState(null);
  const key = ids.join('|');

  useEffect(() => {
    if (!ids.length) {
      setActiveId(null);
      return undefined;
    }

    const container = containerRef.current;
    if (!container) return undefined;

    const elements = ids
      .map((id) => (id ? container.querySelector(`#${CSS.escape(id)}`) : null))
      .filter(Boolean);

    if (!elements.length) return undefined;

    const visible = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });

        if (visible.size > 0) {
          // Earliest-in-document visible heading is the "current" section —
          // matches how a reader would describe where they are.
          const current = elements.find((el) => visible.has(el.id));
          if (current) setActiveId(current.id);
        }
      },
      { root: null, rootMargin, threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    // Sensible default the moment a new note's headings mount, before the
    // user has scrolled at all.
    setActiveId(elements[0].id);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the intentional identity for `ids`
  }, [containerRef, key, rootMargin]);

  return activeId;
}
