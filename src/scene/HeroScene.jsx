import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import * as THREE from 'three';
import Astronaut, { ARRIVAL_REST_X } from './Astronaut';
import Ufo from './Ufo';
import DepartureTrail from './DepartureTrail';
import SkillSatellites from './SkillSatellites';
import { subscribeScroll } from '../hooks/useScrollProgress';
import { voyage } from '../state/voyage';

gsap.registerPlugin(MotionPathPlugin);

/**
 * The hero's character and UFO, in the shared root scene.
 *
 * This replaces HeroView, which put them in a drei <View> scissored to a
 * `.model` div. A scissor box cannot be left, so the departure below — flying
 * away from the camera and dissolving into the star field — was impossible to
 * build there: the UFO would have been clipped at the box edge, and the stars
 * live in a different scene under a different camera. Being in the root scene
 * also means the composer's Bloom now reaches them, which is what sells the
 * "absorbed into starlight" read.
 *
 * Placement is expressed as a fraction of the visible half-width at the
 * character's depth, so the composition holds as the viewport changes rather
 * than being pinned to one hard-coded x.
 */

/**
 * Where the character sits, as a fraction of the visible half-extent: 0 is
 * centre, ±1 is the edge. The group is placed so that the character's REST
 * position (ARRIVAL_REST_X in `inner`) lands on this fraction — placement is
 * in screen terms, and the arrival path's own units never reach the frame.
 *
 * Landscape 0.55 reproduces exactly where the old maths put it at 1440x900
 * (group offset 0.09 of half-width, plus the path's 8 units).
 *
 * PORTRAIT IS A DIFFERENT COMPOSITION, not the same one squeezed. A phone has
 * about 5 world units of half-width where a laptop has 17, so an offset that
 * reads as "just right of centre" on a laptop is off the edge on a phone: at
 * 390 the character, its satellites and the thing "tap me twice" refers to
 * were all outside the viewport. Portrait centres it and drops it into the
 * lower band, under the skills panel — the stacked layout, with the character
 * as the shorter band below the text.
 */
const HERO_X_FRACTION = 0.55;
const HERO_Y_FRACTION = -0.62;
const HERO_X_FRACTION_PORTRAIT = 0;
const HERO_Y_FRACTION_PORTRAIT = -1.02;

/** Below this aspect the portrait composition takes over. */
const PORTRAIT_ASPECT = 0.95;

/**
 * Camera distance to the character's plane.
 *
 * Was 23, matching the camera's own z (so the hero group sat at world z = 0).
 * When the shared camera's fov dropped from 50 to 42 to fix the UFO's edge
 * distortion, this grew by the same ratio, tan(25°)/tan(21°) ≈ 1.2148 — that
 * exact ratio is what keeps `halfHeight` (below) unchanged, which is what
 * keeps every HERO_X_FRACTION/HERO_Y_FRACTION placement and the character's
 * apparent on-screen size identical to before. See SceneRoot.jsx's camera
 * comment for the other half of this pair.
 */
const HERO_DEPTH = 27.94;

const STARLIGHT = new THREE.Color('#cfe0ff');

/**
 * Under reduced motion there is no departure to scrub, so the character is
 * cut from the scene at this much raw hero progress instead.
 */
const REDUCED_MOTION_CUT = 0.5;

/**
 * Collect the materials of a subtree, cloning them first so this instance can
 * be faded without touching anything else that shares the cached GLTF.
 * The contact section's UFO (scene/ContactBeam.jsx) is built from the same
 * cached ufo.glb — without this, the hero's departure would fade it too.
 */
function ownMaterials(root) {
  const materials = [];
  root.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    // The character's invisible tap target (scene/Astronaut.jsx) is a mesh in
    // this subtree. Fading it along with the rest would set its opacity to 1
    // and paint a black sphere over the hero.
    if (child.userData?.hitProxy) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    const cloned = list.map((m) => {
      const c = m.clone();
      c.transparent = true;
      c.emissive = c.emissive ?? new THREE.Color(0, 0, 0);
      c.userData.baseEmissive = c.emissive.clone();
      c.userData.baseEmissiveIntensity = c.emissiveIntensity ?? 1;
      materials.push(c);
      return c;
    });
    child.material = Array.isArray(child.material) ? cloned : cloned[0];
  });
  return materials;
}

const HeroScene = ({
  visible,
  reducedMotion,
  onArrived,
  onTalk,
  interactive,
  settled,
  skills = true,
  skillLabels = true,
}) => {
  const group = useRef();
  const inner = useRef();
  const [astronaut, setAstronaut] = useState(null);
  const [ufo, setUfo] = useState(null);
  const [scale, setScale] = useState(1);
  /**
   * The departure's live state, shared with everything that has to dissolve in
   * step with the character: the trail reads `progress`, the skill satellites
   * read `fade`. A ref rather than state, because both consumers run in
   * useFrame and neither should cause a React render at scroll rate.
   */
  const departureRef = useRef({ progress: 0, fade: 1 });
  const { size } = useThree();

  useEffect(() => {
    const handleResize = () => {
      // 0.8 on a phone, not 0.9: portrait stacks the skills panel above the
      // character, and at 0.9 the head sat behind the panel's lower edge.
      if (window.innerWidth < 600) setScale(0.8);
      else if (window.innerWidth < 1024) setScale(0.8);
      else setScale(1);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keep the group where the old scissor box used to put it, in proportional
  // terms, so the composition survives a resize.
  //
  // It holds HERO_DEPTH in front of wherever the camera is. During the hero
  // the camera is at home, so this is world z = 0. It matters for the few
  // frames where a fast scroller has started the voyage before the smoothed
  // departure has finished: the craft finishes leaving in front of the moving
  // camera instead of being left behind at the origin.
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const halfHeight = HERO_DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = size.width / size.height;
    const halfWidth = halfHeight * aspect;
    const portrait = aspect < PORTRAIT_ASPECT;
    const xFraction = portrait ? HERO_X_FRACTION_PORTRAIT : HERO_X_FRACTION;
    const yFraction = portrait ? HERO_Y_FRACTION_PORTRAIT : HERO_Y_FRACTION;
    // Minus the rest offset: the character lands ON the fraction, whatever the
    // arrival path's own numbers are.
    g.position.x = camera.position.x + xFraction * halfWidth - ARRIVAL_REST_X;
    g.position.y = camera.position.y + yFraction * halfHeight;
    g.position.z = camera.position.z - HERO_DEPTH;
  });

  // ---------------------------------------------------------- departure
  useEffect(() => {
    if (!astronaut || !ufo || !inner.current) return undefined;

    const materials = [...ownMaterials(astronaut), ...ownMaterials(ufo)];
    const node = inner.current;
    const state = { fade: 1, emissive: 0 };

    const apply = () => {
      for (const m of materials) {
        m.opacity = state.fade;
        m.depthWrite = state.fade > 0.98;
        if (m.emissive) {
          m.emissive.copy(m.userData.baseEmissive).lerp(STARLIGHT, state.emissive);
          m.emissiveIntensity =
            (m.userData.baseEmissiveIntensity ?? 1) + state.emissive * 1.6;
        }
      }
      departureRef.current.fade = state.fade;
      departureRef.current.progress = 1 - state.fade;
      // Gone means gone: once the dissolve completes the character, the UFO,
      // the satellites and the tap proxy stop being drawn and stop being
      // raycast. Fully transparent is not the same thing — five meshes and
      // four satellite draw calls would go on rendering nothing for the rest
      // of the page, and the proxy would stay hittable.
      node.visible = state.fade > 0.001;
    };

    if (reducedMotion) {
      // No departure flight: the scene sits at rest while the hero is on
      // screen, and is simply not there once it has been scrolled away — the
      // departure's END STATE, reached without its movement (rule 4). Before
      // this the canvas, being fixed, kept the character standing behind the
      // projects and the contact section for the rest of the page.
      //
      // A cut, not a fade: a fade is motion. Halfway out of the hero is where
      // the section it belongs to stops being the one on screen, and the same
      // threshold brings it back on the way up.
      state.fade = 1;
      state.emissive = 0;
      apply();
      node.position.set(0, 0, 0);
      node.scale.setScalar(1);
      const unsubscribeStill = subscribeScroll((s) => {
        node.visible = s.heroRaw < REDUCED_MOTION_CUT;
      });
      return () => {
        unsubscribeStill();
        state.fade = 1;
        state.emissive = 0;
        apply();
      };
    }

    let timeline;
    const ctx = gsap.context(() => {
      timeline = gsap.timeline({ paused: true, onUpdate: apply });

      // A curve, not a straight line: it banks right and lifts as it recedes,
      // so the exit reads as flying away rather than being pushed backwards.
      timeline.to(
        node.position,
        {
          motionPath: {
            path: [
              { x: 0, y: 0, z: 0 },
              { x: 3.5, y: 2.4, z: -22 },
              { x: 8.5, y: 5.2, z: -58 },
              { x: 12, y: 7.4, z: -104 },
            ],
            type: 'cubic',
          },
          ease: 'none',
          duration: 1,
        },
        0
      );
      timeline.fromTo(
        node.scale,
        { x: 1, y: 1, z: 1 },
        { x: 0.12, y: 0.12, z: 0.12, ease: 'power1.in', duration: 1 },
        0
      );
      // Hold full opacity briefly so it is clearly *leaving* before it starts
      // to go transparent, then dissolve over the back half.
      timeline.to(state, { fade: 0, ease: 'power2.in', duration: 0.68 }, 0.32);
      timeline.to(state, { emissive: 1, ease: 'power1.out', duration: 0.55 }, 0.25);
    });

    // Scrubbed straight off scroll progress, so it is exactly reversible:
    // scrolling back up runs the whole thing backwards, frame for frame.
    //
    // This is the character's last appearance. It used to fade back in during
    // the projects voyage and travel beside the planets; it does not any more.
    //
    // Once the voyage has started, the departure is held complete. The
    // smoothed `hero` value lags the scroll by about a second, and there are
    // two ways to be mid-voyage while it is still low: a deep link to a
    // project (it climbs from 0 after load, which would play the whole
    // departure in front of the planet you landed on) and a fast flick out of
    // the hero. Scrolling back into the hero releases the hold and the
    // departure runs in reverse, returning it exactly where it left.
    const unsubscribe = subscribeScroll((s) => {
      timeline?.progress(voyage.progress > 0 ? 1 : s.hero);
    });

    return () => {
      unsubscribe();
      ctx.revert();
      state.fade = 1;
      state.emissive = 0;
      apply();
    };
  }, [astronaut, ufo, reducedMotion]);

  const setAstronautRef = useCallback((node) => setAstronaut(node), []);
  const setUfoRef = useCallback((node) => setUfo(node), []);

  if (!visible) return null;

  return (
    <group ref={group}>
      <directionalLight position={[0, 26, 0]} intensity={1.3} castShadow />
      <ambientLight intensity={1} />
      <group ref={inner}>
        <Suspense fallback={null}>
          <Astronaut
            ref={setAstronautRef}
            scale={scale}
            reducedMotion={reducedMotion}
            onArrived={onArrived}
            onTalk={onTalk}
            interactive={interactive}
          />
        </Suspense>
        <Suspense fallback={null}>
          <Ufo ref={setUfoRef} scale={scale} reducedMotion={reducedMotion} />
        </Suspense>
        {/* Inside `inner`, so the departure carries the satellites away with
            the character for free: the motion path and the scale-down are
            already on this group, and the fade is handed over through the
            same ref the trail reads. Nothing about the orbits has to be
            unwound on scroll-up, for the same reason the trail does not. */}
        {skills && (
          <SkillSatellites
            character={astronaut}
            departure={departureRef}
            settled={settled}
            interactive={interactive}
            reducedMotion={reducedMotion}
            labels={skillLabels}
          />
        )}
      </group>
      {!reducedMotion && <DepartureTrail state={departureRef} />}
    </group>
  );
};

export default HeroScene;
