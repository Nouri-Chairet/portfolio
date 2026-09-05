import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { View, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';
import '../styles/scene.css';

const DPR_MIN = 1;
const DPR_MAX = 2;

/**
 * drei's <View> points the root event layer at whichever tracked element
 * mounted last (`Container` calls `setEvents({ connected: track.current })`).
 * With two views alive at once — the hero astronaut and the call-me pose are
 * both mounted after you scroll down — the second would silently steal pointer
 * events from the first.
 *
 * Re-pointing the listeners at a common ancestor fixes it: each view's own
 * `compute` already filters on `event.target === track.current`, so the right
 * view still claims the event. Objects additionally guard on the event target
 * themselves (see Astronaut/CallMePose) so a click on unrelated DOM cannot
 * re-fire a stale raycast.
 *
 * This settles after one pass: once `connected` is the shared root, the
 * effect's condition is false and it stops.
 */
function ViewEventBridge({ target }) {
  const connected = useThree((s) => s.events.connected);
  const setEvents = useThree((s) => s.setEvents);
  useEffect(() => {
    if (target.current && connected !== target.current) {
      setEvents({ connected: target.current });
    }
  }, [connected, setEvents, target]);
  return null;
}

/**
 * The site's only WebGL context. Mounted once by App and never torn down, so
 * scrolling between sections never re-creates a GL context or re-uploads the
 * character's textures.
 *
 * 3D content is not declared here — each section declares a <View> tracking a
 * DOM box (.model in the hero, .nouri in the journey panel), and drei scissors
 * this canvas to that box. That keeps every object clipped to exactly the
 * region its own <Canvas> used to occupy.
 */
const SceneRoot = ({ eventSource }) => {
  // PerformanceMonitor steps this between DPR_MIN and DPR_MAX; AdaptiveDpr
  // drops it further during momentary stalls and restores it when idle.
  const [dpr, setDpr] = useState(DPR_MAX);
  const fallbackSource = useRef(null);

  return (
    <CanvasErrorBoundary>
      <Canvas
        className="scene-root"
        // R3F gives its wrapper an inline `position: relative; width: 100%;
        // height: 100%`, which beats any stylesheet rule. The layout has to be
        // passed here so it merges *after* those defaults — see scene.css for
        // why z-index 1 is the right layer.
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1,
          pointerEvents: 'none',
        }}
        shadows
        dpr={dpr}
        eventSource={eventSource ?? fallbackSource}
        eventPrefix="client"
        gl={{
          // `preserveDrawingBuffer` was on in both old canvases. Nothing reads
          // the canvas back (no toDataURL / screenshot path), and it forces an
          // extra full-buffer copy every frame, so it stays off.
          failIfMajorPerformanceCaveat: false,
          powerPreference: 'high-performance',
        }}
      >
        <PerformanceMonitor
          onIncline={() => setDpr(DPR_MAX)}
          onDecline={() => setDpr(DPR_MIN)}
        />
        <AdaptiveDpr pixelated />
        <View.Port />
        <ViewEventBridge target={eventSource ?? fallbackSource} />
      </Canvas>
    </CanvasErrorBoundary>
  );
};

export default SceneRoot;
