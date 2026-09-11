import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getQuery() {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia(QUERY);
}

function subscribe(listener) {
  const mq = getQuery();
  if (!mq) return () => {};
  // Safari < 14 only has the deprecated addListener.
  if (mq.addEventListener) {
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }
  mq.addListener(listener);
  return () => mq.removeListener(listener);
}

function getSnapshot() {
  return getQuery()?.matches ?? false;
}

/**
 * True when the visitor has asked for reduced motion. Live — flipping the OS
 * setting updates the site without a reload.
 *
 * Callers must not merely shorten their animation: land on the final visual
 * state with no movement, and keep everything reachable by scrolling.
 */
export default function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Non-reactive read, for imperative code that runs once (e.g. GSAP setup). */
export function prefersReducedMotion() {
  return getSnapshot();
}
