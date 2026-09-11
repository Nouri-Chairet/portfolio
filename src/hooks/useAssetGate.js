import { useEffect, useRef, useState } from 'react';
import { useAssetProgress } from '../state/assetProgress';

/**
 * How many loader items to expect. Mirrors CRITICAL_ASSET_COUNT in
 * scene/assets.js, duplicated as a plain number on purpose: importing that
 * module here would drag drei and three into the hero's chunk, which is
 * exactly what the `low` tier must avoid.
 */
const CRITICAL_ASSET_COUNT = 2;

/**
 * Holds the intro back until the models the hero needs are actually decoded.
 *
 * drei's useProgress reads THREE's DefaultLoadingManager, which is also what
 * useGLTF loads through, so this reports real download+parse progress for
 * character.glb and ufo.glb.
 *
 * Note on the star field: it has nothing to wait for. Its geometry is built in
 * JS and its sprite is drawn into a CanvasTexture at runtime (see
 * scene/StarField.jsx, scene/starSprite.js), so it fetches no asset at all.
 *
 * Two timers exist here on purpose, and neither one is choreography:
 *   minDisplayMs — floor on how briefly the Loader can flash. Without it a
 *                  warm cache shows a 40 ms flicker of "Loading".
 *   maxWaitMs    — failsafe. If a model 404s or the Draco decoder is blocked,
 *                  the visitor still gets a usable site instead of a permanent
 *                  loading screen.
 */
export default function useAssetGate({
  minDisplayMs = 600,
  maxWaitMs = 12000,
  enabled = true,
} = {}) {
  // The canvas starts the downloads and publishes progress here; on the `low`
  // tier it is never mounted, so nothing is fetched and the gate opens at once.
  const { progress, active, loaded, total, errors } = useAssetProgress();
  const [ready, setReady] = useState(false);
  const startedAt = useRef(null);
  if (startedAt.current === null) startedAt.current = performance.now();

  // `total` climbs as items register with the loading manager, so require the
  // expected count before trusting loaded >= total — otherwise the very first
  // render (total 0, loaded 0) looks complete.
  // Nothing to wait for without the canvas: the intro starts immediately.
  const settled = !enabled || (total >= CRITICAL_ASSET_COUNT && loaded >= total && !active);
  const failed = errors > 0;

  useEffect(() => {
    if (ready || (!settled && !failed)) return undefined;
    const elapsed = performance.now() - startedAt.current;
    const remaining = Math.max(0, minDisplayMs - elapsed);
    const id = setTimeout(() => setReady(true), remaining);
    return () => clearTimeout(id);
  }, [ready, settled, failed, minDisplayMs]);

  useEffect(() => {
    if (ready) return undefined;
    const id = setTimeout(() => setReady(true), maxWaitMs);
    return () => clearTimeout(id);
  }, [ready, maxWaitMs]);

  return {
    ready,
    /** 0-100, for a progress readout. */
    progress: settled ? 100 : progress,
    enabled,
    failed,
  };
}
