import { useEffect, useState } from 'react';

// Keep in sync with the `@media (max-width: 820px)` breakpoint in
// global.css that switches the Playground from the resizable split layout
// to the stacked mobile/tablet layout.
const DESKTOP_QUERY = '(min-width: 821px)';

export default function useIsDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event) => setIsDesktop(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
