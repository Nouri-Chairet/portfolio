import { useGLTF } from '@react-three/drei';

/**
 * The models the hero cannot render without. Both are above the fold, so they
 * are fetched as early as possible rather than waiting for a component to
 * mount — the loading gate watches these through drei's useProgress, and it
 * can only watch loads that have actually started.
 *
 * Keep the second argument in sync with the useGLTF call sites: it selects the
 * Draco decoder path, and a preload with different options warms a different
 * cache key (i.e. downloads twice).
 */
export const CHARACTER_URL = '/character.glb';
export const UFO_URL = '/ufo.glb';

/** How many loader items the gate should expect before declaring readiness. */
export const CRITICAL_ASSET_COUNT = 2;

let started = false;

export function preloadCriticalAssets() {
  if (started) return;
  started = true;
  useGLTF.preload(CHARACTER_URL);
  useGLTF.preload(UFO_URL, true);
}
