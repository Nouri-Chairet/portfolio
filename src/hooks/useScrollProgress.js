import { useEffect, useState } from 'react';

/**
 * The single scroll-progress source of truth for the whole site.
 *
 * Exactly one ScrollTrigger exists against `.hero`, and it lives in
 * `src/scene/HeroView.jsx` (the only writer — it calls `setHeroProgress` from
 * that trigger's `onUpdate`). Everything else *reads* from here. Do not
 * register another ScrollTrigger against `.hero` anywhere else: before this
 * existed, Model.jsx registered two and CallMe.jsx killed them all on unmount.
 *
 * Progress is kept on a module-level mutable object rather than in React
 * state, because it updates every scroll frame and re-rendering the R3F tree
 * that often would be wasteful. Read it inside `useFrame`:
 *
 *   const scroll = useScrollProgressRef();
 *   useFrame(() => { doSomethingWith(scroll.hero); });
 *
 * If you genuinely need a re-render on change (DOM UI, not 3D), use
 * `useScrollProgress()` instead — it subscribes and re-renders, throttled to
 * one update per animation frame.
 */

const scrollState = { hero: 0 };
const subscribers = new Set();
let flushQueued = false;

/** Called by the single owning ScrollTrigger. */
export function setHeroProgress(value) {
  if (value === scrollState.hero) return;
  scrollState.hero = value;
  if (subscribers.size === 0 || flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(() => {
    flushQueued = false;
    for (const fn of subscribers) fn(scrollState.hero);
  });
}

/**
 * Non-reactive read handle. Returns a stable object whose `.hero` is mutated
 * in place — safe to read from `useFrame` without causing renders.
 */
export function useScrollProgressRef() {
  return scrollState;
}

/** Reactive read. Re-renders the caller at most once per animation frame. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(scrollState.hero);
  useEffect(() => {
    subscribers.add(setProgress);
    setProgress(scrollState.hero);
    return () => subscribers.delete(setProgress);
  }, []);
  return progress;
}
