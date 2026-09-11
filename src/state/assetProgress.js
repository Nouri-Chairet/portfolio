import { useSyncExternalStore } from 'react';

/**
 * Loading progress for the 3D assets, published by the canvas.
 *
 * This exists so `useAssetGate` — which the hero mounts on every device — does
 * not have to import drei's `useProgress`. Importing it would pull the whole
 * `@react-three/drei` barrel, and with it three.js, into the hero's chunk, so
 * a device on the `low` tier would download ~287 KB of a renderer it is never
 * going to use. The canvas is the only thing that imports three now, and it is
 * lazy-loaded.
 *
 * The snapshot object is replaced only when a value actually changes, so
 * useSyncExternalStore sees a stable reference between updates.
 */

let snapshot = { active: false, progress: 0, loaded: 0, total: 0, errors: 0 };
const listeners = new Set();

export function publishAssetProgress(next) {
  const merged = { ...snapshot, ...next };
  const unchanged = Object.keys(merged).every((k) => merged[k] === snapshot[k]);
  if (unchanged) return;
  snapshot = merged;
  for (const fn of listeners) fn();
}

export function getAssetProgress() {
  return snapshot;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAssetProgress() {
  return useSyncExternalStore(subscribe, getAssetProgress, getAssetProgress);
}
