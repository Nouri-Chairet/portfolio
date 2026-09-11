/**
 * Frame order on the shared canvas, expressed as useFrame priorities.
 *
 *   1/4  PerfProbe resets the renderer's counters (?perf=1 only)
 *   1/3  VoyageCamera moves the camera, before anything reads it
 *   1    the scene is drawn: the bloom composer, or BackgroundPass without it
 *   2    PerfProbe reads the counters back (?perf=1 only)
 *
 * This used to also order two drei <View>s (priorities 2 and 3) drawn over the
 * background with autoClear off. Both are gone — every 3D object now lives in
 * the root scene — so the whole frame is a single draw at priority 1.
 *
 * These live in their own module so a component can import a priority without
 * pulling SceneRoot — and therefore the postprocessing bundle — into its
 * chunk.
 */
export const BACKGROUND_PRIORITY = 1;
/** After every draw, so the counters describe the whole frame. */
export const PERF_READ_PRIORITY = 2;
