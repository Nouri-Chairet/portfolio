import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  AdaptiveDpr,
  PerformanceMonitor,
  PerspectiveCamera,
  useProgress,
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';
import StarField from './StarField';
import PerfOverlay from './PerfOverlay';
import Nebula from './Nebula';
import BackgroundGradient from './BackgroundGradient';
import Atmosphere from './Atmosphere';
import HeroScene from './HeroScene';
import ProjectPlanets from './ProjectPlanets';
import ContactBeam from './ContactBeam';
import {
  HERO_EVENTS,
  HERO_STATES,
  dispatchHero,
  hasCharacter,
  isSettled,
  useHeroState,
} from '../state/heroMachine';
import { openDialogue } from '../state/dialogue';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { BACKGROUND_PRIORITY, PERF_READ_PRIORITY } from './renderOrder';
import { preloadCriticalAssets } from './assets';
import { voyage } from '../state/voyage';
import { publishAssetProgress } from '../state/assetProgress';
import '../styles/scene.css';

const DPR_MIN = 1;
const DPR_MAX = 2;


/**
 * Bridges drei's loading progress to the shared store the hero's gate reads.
 *
 * It lives here, in the lazily-loaded canvas, so that `useProgress` — and the
 * three.js it drags along — never enters the bundle of a device that is not
 * going to render 3D at all.
 */
function AssetProgressReporter() {
  const { active, progress, loaded, total, errors } = useProgress();
  useEffect(() => {
    publishAssetProgress({ active, progress, loaded, total, errors: errors.length });
  }, [active, progress, loaded, total, errors.length]);
  return null;
}

/**
 * Flies the camera down the projects voyage.
 *
 * The camera is the thing that moves now. The project planets stand at fixed
 * places in the world and this travels past them (state/voyage.js), which is
 * what makes their entrances and exits overlap without anything scheduling it.
 *
 * Runs before anything is drawn, at a third of the background priority: a
 * frame's lag here shows up as the planets juddering against the star field,
 * because the field is parented to the camera and so moves with it exactly
 * while the planets do not move at all.
 */
function VoyageCamera({ showPerfRef }) {
  useFrame(({ camera }) => {
    if (!voyage.active) return;
    camera.position.set(voyage.camX, voyage.camY, voyage.camZ);
    if (showPerfRef.current) window.__camZ = Math.round(voyage.camZ);
  }, BACKGROUND_PRIORITY / 3);
  return null;
}

/**
 * Renders the scene when the bloom composer is switched off.
 *
 * Necessary because <EffectComposer enabled={false}> drops its useFrame
 * priority to 0 — but r3f's automatic render only runs when NO subscriber has
 * a positive priority, and VoyageCamera (and PerfProbe, under ?perf=1) keep
 * one. So without this, nothing at all would draw.
 *
 * This outlived the <View>s it was first written around. CLAUDE.md used to
 * say it could go when the last view did; it could not, for the reason above.
 */
function BackgroundPass({ active }) {
  useFrame(({ gl, scene, camera }) => {
    if (!active) return;
    gl.autoClear = true;
    gl.clear();
    gl.render(scene, camera);
  }, BACKGROUND_PRIORITY);
  return null;
}

/**
 * Publishes the renderer's own counters for a measurement harness to read.
 *
 * Only mounted with `?perf=1`. It turns `info.autoReset` off, because that flag
 * makes three reset the counters at the start of every `render()` — and this
 * scene renders more than once per frame (the background pass, then each view),
 * so the default would report only whatever the last render did. Reset is done
 * once per frame instead, before anything draws.
 */
function PerfProbe() {
  const { gl } = useThree();
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);
  useFrame(() => gl.info.reset(), BACKGROUND_PRIORITY / 4);
  // Triangle ownership, on demand. Answering "are the planets expensive?"
  // needs a denominator, and a fixed timer misses whatever has not mounted yet.
  useEffect(() => {
    window.__dump = () => {
      const scene = gl.__perfScene;
      if (!scene) return null;
      const rows = [];
      scene.traverse((o) => {
        const g = o.geometry;
        if (!g) return;
        const count = g.index ? g.index.count : g.attributes.position?.count ?? 0;
        if (o.isPoints) rows.push({ name: o.name || o.type, pts: count });
        else if (!o.isLine) rows.push({ name: o.name || o.type, tris: Math.floor(count / 3) });
      });
      rows.sort((a, b) => (b.tris ?? b.pts) - (a.tris ?? a.pts));
      return rows;
    };
    return () => {
      delete window.__dump;
    };
  }, [gl]);

  useFrame(({ scene }) => {
    gl.__perfScene = scene;
    window.__glinfo = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
    };
  }, PERF_READ_PRIORITY);
  return null;
}

/**
 * Debug overrides, read once from the query string:
 *   ?stars=low|high   force the star count tier
 *   ?bloom=0|1        force the bloom pass on or off
 *   ?atmos=0|1|vg     force the atmosphere off, fully on, or on without the
 *                     chromatic aberration — which is the only part of it that
 *                     costs a pass of its own (see scene/Atmosphere.jsx)
 *   ?dither=0|1       force the background gradient's dither on or off. Worth
 *                     keeping: "it bands without this" is a claim that should
 *                     be checkable on the machine in front of you, not taken
 *                     on trust from a commit message.
 *   ?skills=0|1       the hero's orbiting skill satellites. The DOM panel they
 *                     annotate is unaffected either way — it is the content,
 *                     they are the decoration — which is exactly what makes
 *                     this a clean A/B for their frame cost.
 *   ?perf=1 also publishes window.__planets — each project planet's live
 *                     opacity — so "no frame without a world on screen" is a
 *                     checkable claim rather than a draw-call inference.
 *   ?skillscale=<f>   multiply satellite size without moving the orbits, to
 *                     separate fill-rate cost from per-object cost. Read in
 *                     scene/SkillSatellites.jsx, alongside ?planetscale's
 *                     equivalent in ProjectPlanets.
 * Handy for A/B-ing the frame cost of each without rebuilding.
 */
function urlOverride(key) {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get(key);
  return v === null ? null : v;
}

/** Coarse pointer or a small viewport: thin the field and drop the bloom. */
function useIsHandheld() {
  const [handheld, setHandheld] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 820px), (pointer: coarse)');
    const onChange = (e) => setHandheld(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return handheld;
}

/**
 * The site's only WebGL context. Mounted once by App and never torn down, so
 * scrolling between sections never re-creates a GL context or re-uploads the
 * character's textures.
 *
 * ALL 3D lives directly in this root scene: the star field and nebula, the
 * hero's character and UFO, one planet per project, and the contact section's
 * UFO and beam. They share one camera and one depth buffer, which is what lets
 * the hero's departure fly out of the hero and dissolve into the stars as a
 * single continuous motion — a scissored <View> cannot be left — and it is
 * what lets Bloom reach every one of them.
 *
 * There are no <View>s left. The contact panel's was the last, and it went
 * with the contact rebuild (scene/ContactBeam.jsx); with it went the two
 * workarounds that existed only for views — resetting the viewport a view
 * left behind, and re-pointing the event layer a view stole.
 */
const SceneRoot = ({ eventSource, tier = 'high' }) => {
  // PerformanceMonitor drops this to DPR_MIN once and never raises it again;
  // AdaptiveDpr drops it further during momentary stalls and restores it when
  // idle, which is interaction-driven and so cannot oscillate with frame rate.
  const [dpr, setDpr] = useState(DPR_MAX);
  // What the monitor has observed. One-way: 'high' -> 'low', never back.
  const [runtimeTier, setRuntimeTier] = useState('high');
  /** Latch for the ratchet above: set once, never cleared. */
  const degraded = useRef(false);
  const handheld = useIsHandheld();
  const reducedMotion = usePrefersReducedMotion();
  const heroState = useHeroState();
  // One state earlier than "settled": the character has to be mounted in
  // order to fly in. `character_entering` is exactly that stage.
  const showHero = hasCharacter(heroState);
  // The satellites arrive when the character has landed, not while it is still
  // flying in, and stay through the departure so they leave with it.
  const heroSettled = isSettled(heroState);
  // Tappable only while it is actually standing in the hero. Mid-arrival it is
  // still flying, and once departing it is a speck receding into the star
  // field — a stray raycast onto either should not start a conversation.
  const heroInteractive =
    heroState === HERO_STATES.HERO_READY || heroState === HERO_STATES.EXPLORING;
  // Step 4 of the entrance ends here — the fly-in timeline's own onComplete,
  // relayed up to the machine.
  const handleArrived = useCallback(() => dispatchHero(HERO_EVENTS.CHARACTER_SETTLED), []);
  const fallbackSource = useRef(null);

  // Downloads start as soon as the canvas is mounted, which only happens on a
  // tier that can actually draw them.
  useEffect(() => {
    preloadCriticalAssets();
  }, []);

  const starsOverride = useMemo(() => urlOverride('stars'), []);
  const bloomOverride = useMemo(() => urlOverride('bloom'), []);
  const atmosOverride = useMemo(() => urlOverride('atmos'), []);
  const ditherOverride = useMemo(() => urlOverride('dither'), []);
  const showPerf = useMemo(() => urlOverride('perf') === '1', []);
  const perfRef = useRef(showPerf);
  perfRef.current = showPerf;
  const skillsOverride = useMemo(() => urlOverride('skills'), []);

  // ---------------------------------------------------------------- quality
  //
  // Two inputs, and keeping them apart is the whole point.
  //
  // `startupCapable` is a CAPABILITY answer: the device probe plus the
  // handheld media query. Both change only when a person does something —
  // opening the page, rotating a tablet, dragging a window wider — so neither
  // can enter a feedback loop with the frame rate.
  //
  // `runtimeTier` is an OBSERVATION, and it is a one-way ratchet (see the
  // PerformanceMonitor below). It may only ever make things cheaper.
  //
  // Everything visually dramatic hangs off the first one. Only the cheap,
  // barely-visible knobs hang off the second.
  const startupCapable = tier === 'high' && !handheld;
  const runtimeCapable = startupCapable && runtimeTier === 'high';

  // Star counts thin on either input; drawRange makes it allocation-free, so
  // this is the one runtime change with no stall behind it.
  const quality = starsOverride ?? (runtimeCapable ? 'high' : 'low');
  // Deliberately NOT tied to ?stars. The nebula used to ride the same
  // `quality === 'high'` gate, which meant the override documented as "force
  // the star count tier" also removed a full-screen fbm plane — so anyone
  // measuring the star field's cost with it was measuring the nebula too.
  const nebula = startupCapable;

  // Bloom is decided ONCE, from capability, and never from frame rate.
  //
  // It used to follow the PerformanceMonitor, and that was the bug: mounting
  // and unmounting the composer is the single most dramatic change available
  // here — it takes the glow off every star, the rim off every planet and the
  // light off the character in one frame — and it sat in a loop with nothing
  // to damp it. bloom on -> frame time up -> decline -> bloom off -> frame
  // time down -> incline -> bloom on, on a 2-6 second cycle. Whatever else is
  // true of a knob, an automatic one must not be the loudest one you have.
  const bloom = bloomOverride !== null ? bloomOverride === '1' : startupCapable;

  // The atmosphere rides in the same EffectPass as bloom — postprocessing
  // merges every effect in a composer into one shader — so it costs no extra
  // full-screen pass once the composer is already running. It cannot exist
  // without it either: with the composer off, BackgroundPass draws the scene
  // directly and there is nowhere to hang a screen-space effect.
  const atmosphere = atmosOverride !== null ? atmosOverride !== '0' : startupCapable;

  // The aberration is separable from the rest because it is separately costly:
  // it cannot be merged into the bloom pass, so it adds a second full-screen
  // pass where the vignette and grain add none. Measured at 562 ms/MP against
  // bloom's 137 (CLAUDE.md rule 13), for 2/255 of channel shift at the extreme
  // frame edge — the most expensive thing on the page and the least visible.
  //
  // So THIS is the runtime knob, not bloom. Shedding it frees four times what
  // dropping bloom would, and a visitor cannot see it go.
  const aberration =
    atmosOverride === 'vg'
      ? false
      : atmosOverride === '1'
        ? true
        : atmosphere && runtimeCapable;
  const skills = skillsOverride !== null ? skillsOverride !== '0' : true;
  // The satellite labels go with the star counts rather than with the
  // satellites. On a phone-sized viewport a label is a dozen unreadable pixels
  // riding a moving object, and every word on it is already in the skills
  // panel at a size that can actually be read.
  const skillLabels = quality === 'high';

  return (
    <CanvasErrorBoundary>
      <AssetProgressReporter />
      {showPerf && <PerfOverlay quality={quality} bloom={bloom} dpr={dpr} />}
      <Canvas
        className="scene-root"
        // R3F gives its wrapper an inline `position: relative; width: 100%;
        // height: 100%`, which beats any stylesheet rule. The layout has to be
        // passed here so it merges *after* those defaults — see scene.css for
        // why z-index 1 is the right layer.
        style={{
          position: 'fixed',
          // inset + percentages, never 100vw: vw includes the classic
          // scrollbar, so a full-width fixed layer sized that way overflows
          // the document by the scrollbar width on desktop.
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
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
        {/* A ONE-WAY RATCHET. Once this scene has been observed to be too
            expensive for this machine, it stays cheap for the rest of the
            session.

            It used to be symmetric, and symmetric is a feedback loop by
            construction: the thing that made the frame slow gets removed, the
            frame gets fast, the thing comes back, and the visitor watches the
            page flash on a several-second cycle. There is no threshold that
            fixes that — the two states genuinely have different frame times,
            which is the entire reason for switching between them — so the
            answer is not a better threshold, it is refusing to go back. */}
        <PerformanceMonitor
          onDecline={() => {
            if (degraded.current) return;
            degraded.current = true;
            setDpr(DPR_MIN);
            setRuntimeTier('low');
          }}
          // Intentionally empty, and intentionally present rather than
          // omitted: the absence of a recovery path is a decision, and a
          // reader should be able to see that it was made.
          onIncline={() => {}}
        />
        <AdaptiveDpr pixelated />

        {/* The camera keeps the hero's original framing ([4,6,23]) so the
            characters' hand-tuned transforms still read correctly now that they
            have left their scissor box. */}
        {showPerf && <PerfProbe />}
        <VoyageCamera showPerfRef={perfRef} />
        {/* fov was 50. Reduced to 42 to cut the off-axis perspective
            distortion on the UFO near the bottom of the frame — a wide fov
            shears anything away from screen centre, which is what made the
            saucer's rim ellipse asymmetric and its dome sit off-centre
            against the disc. HERO_DEPTH (HeroScene.jsx) and VIEW_DIST
            (state/voyage.js) both grew by the exact compensating ratio,
            tan(25°)/tan(21°) ≈ 1.2148, so every screen-fraction placement and
            every apparent object size is unchanged — narrower fov, camera
            further from its subjects, same framing. */}
        <PerspectiveCamera makeDefault position={[4, 6, 23]} fov={42} near={0.1} far={400}>
          {/* Parented to the camera: the star shells always surround the
              viewer and the nebula always sits behind them. That is the sky,
              and the sky travels with you. The planets used to be here too and
              are not any more — see below. */}
          {/* Behind everything, including the nebula at renderOrder -1. Writes
              no depth, so nothing downstream has to know it is there. */}
          <BackgroundGradient dither={ditherOverride === '0' ? 0 : 1} />
          {/* Startup capability, not frame rate. Dropping a full-screen fbm
              plane out of the sky is a visible cut, and the ratchet below can
              only fire once — but "once" is still a pop, and the cheap knobs
              (dpr, star count, the chromatic aberration) come first. */}
          {nebula && <Nebula reducedMotion={reducedMotion} />}
          <StarField quality={quality} reducedMotion={reducedMotion} />
        </PerspectiveCamera>

        {/* NOT parented to the camera any more: these are places, and the
            camera travels to them (VoyageCamera above, state/voyage.js).
            Parented to the camera they could only be positioned in screen
            terms, which is what forced each planet to be driven by its own
            panel's scroll progress — and that is what left a measured 360 px
            of empty sky between one planet and the next. */}
        <ProjectPlanets reducedMotion={reducedMotion} />

        {/* Placed every frame over the contact section's layout boxes; hidden
            until that section starts to come into view. */}
        <ContactBeam reducedMotion={reducedMotion} />

        <HeroScene
          visible={showHero}
          reducedMotion={reducedMotion}
          onArrived={handleArrived}
          onTalk={openDialogue}
          interactive={heroInteractive}
          settled={heroSettled}
          skills={skills}
          skillLabels={skillLabels}
        />

        <BackgroundPass active={!bloom} />
        <EffectComposer
          enabled={bloom}
          renderPriority={BACKGROUND_PRIORITY}
          multisampling={0}
          disableNormalPass
        >
          <Bloom
            luminanceThreshold={0.6}
            luminanceSmoothing={0.25}
            intensity={0.6}
            mipmapBlur
          />
          {atmosphere ? (
            <Atmosphere reducedMotion={reducedMotion} aberration={aberration} />
          ) : null}
        </EffectComposer>
      </Canvas>
    </CanvasErrorBoundary>
  );
};

export default SceneRoot;
