import { useEffect, useRef, useState } from 'react';

// Returns [ref, inView]. Once the element enters the viewport it latches to
// true and the observer disconnects — so a gated Canvas mounts on first scroll
// into view and never tears down its WebGL context afterward.
export default function useInView({ rootMargin = '200px', threshold = 0 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    // No IntersectionObserver (very old browsers / SSR) → render eagerly.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin, threshold]);

  return [ref, inView];
}
