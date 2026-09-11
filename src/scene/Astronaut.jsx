import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

gsap.registerPlugin(MotionPathPlugin);

// Clip names from the three merged source exports. See
// scripts/merge-character.mjs — address clips by name, never by index.
const IDLE_CLIP = 'Energic_conductor_Clean';
const DANCE_CLIP = 'Brag_n_Claps_Clean';

/** How many times the dance repeats before settling back to the idle pose. */
const DANCE_REPEATS = 3;

/**
 * Seconds for the arrival flight. Shared with Ufo.jsx, which rides the same
 * path — the two must land together — and counted against the entrance's
 * five-second budget alongside WRITING_BUDGET and MORPH_DURATION.
 */
export const FLY_IN_DURATION = 1.8;

/**
 * Extra clearance above wherever the arrival path (below) and the UFO's own
 * (Ufo.jsx) land, so the saucer clears the bottom of the viewport with a
 * little room to spare.
 *
 * Applied inside the path's OWN values (each y gets `+ ARRIVAL_Y_OFFSET`,
 * folded on below) — the animation's base value, not a parent-group wrapper,
 * even though a wrapper was the first thing tried here. `scene/SkillSatellites.jsx`
 * reads the character ref's `.position` directly and assumes it is relative
 * to `inner`, the shared parent both it and the character sit under
 * (`rigNode.position.copy(character.position)`); a wrapping group would have
 * put the character one parent deeper, silently orbiting the satellites
 * `ARRIVAL_Y_OFFSET` units below where the character actually ended up. Folding
 * the offset into the path avoids adding a parent at all, so nothing reading
 * that position needs to know this offset exists.
 *
 * Shared with Ufo.jsx (imported alongside FLY_IN_DURATION) so the character
 * stays standing on the saucer rather than the two drifting apart vertically.
 */
export const ARRIVAL_Y_OFFSET = 1.4;

/**
 * The character's base yaw, radians, so it faces the camera instead of
 * standing square to the world axes and looking off to one side.
 *
 * The model's bind pose faces +Z; the camera does not sit on that axis. It is
 * at CAM_HOME (4, 6, 23) looking down -Z, while the character lands at the
 * arrival path's local x (7) inside a group placed at
 * `camera.x + HERO_X_FRACTION * halfWidth` — so it ends up a good eight world
 * units to the RIGHT of the camera's own line, and the bind-pose facing points
 * past the camera's shoulder rather than at it.
 *
 * The correction is `atan2(camX - charX, camZ - charZ)`, and it is a constant
 * rather than a per-frame lookAt because it barely moves with the viewport:
 * `halfHeight` is fixed by HERO_DEPTH and the fov, so only the much smaller
 * `HERO_X_FRACTION * halfWidth` term varies with aspect. Worked through at the
 * three checked widths it spans 16.0° (390px) to 18.2° (1440px) — under two
 * degrees of spread, well inside what the idle clip's own body rotation moves
 * it by anyway, so tracking it live would cost a useFrame to buy nothing
 * visible.
 *
 * NOTE this is the model's *resting orientation*, not a gaze. The head follows
 * whatever the clip is doing and nothing else; there is deliberately no
 * per-frame bone override here any more.
 */
const FACING_YAW = THREE.MathUtils.degToRad(-17.5);

/**
 * How long a first tap waits to see whether a second one is coming, in ms.
 *
 * R3F forwards `onDoubleClick` from the browser's `dblclick`, which is never
 * synthesised for touch — so on a phone the double-tap simply would not exist.
 * Counting taps here works on every input, at the cost of holding the
 * single-tap action for one window. 300 ms is the platform's own double-click
 * threshold; shorter and a deliberate double-tap gets read as two singles.
 *
 * This is a `setTimeout` and it is not choreography (rule 2): it measures a
 * gesture the *visitor* is making, not the progress of an animation, and
 * nothing sequences off it.
 */
const TAP_WINDOW = 300;

/**
 * The invisible tap target, as a multiple of the character's own bounding
 * sphere. A finger is about 9 mm across and the character is a thin figure at
 * the far side of the viewport; asking someone to hit the mesh itself twice in
 * 300 ms would be asking them to fail.
 */
const HIT_SCALE = 1.35;

/**
 * Whether this pointer event also landed on something small and precise.
 *
 * The target above is deliberately imprecise: the bounding sphere is taken
 * from the model's arm-span bind pose, so at 1.35x it is a bubble roughly
 * twice the character's height — and the skill satellites orbit *inside* it,
 * a few units from the chest. Being nearer the camera, that bubble is sorted
 * ahead of them, so without this the character silently swallowed every hover
 * and click meant for a satellite.
 *
 * The rule is precision beats generosity: an object that opted into being a
 * small, exact target means what the visitor pointed at, and this large vague
 * one yields to it. The other side of the rule is one line too — objects mark
 * themselves with `userData.precisePick` — so neither component has to know
 * what the other is.
 */
function yieldsToPrecisePick(event) {
  return !!event?.intersections?.some((hit) => hit.object?.userData?.precisePick);
}

/**
 * The hero character. Plain R3F — it renders into the site's single canvas
 * through the hero's <View>.
 *
 * The scroll-driven exit is not set up here: HeroView scrubs this object's
 * position from the shared scroll progress through the forwarded ref. This
 * component owns the fly-in and the animation state.
 *
 * Nothing here runs on a wall-clock timer. The idle gesture starts when the
 * fly-in timeline reports it has landed, and the dance ends when the mixer
 * says the clip has finished its repeats.
 */
const Astronaut = React.forwardRef(({
  scale,
  reducedMotion,
  onArrived,
  onTalk,
  interactive = true,
}, ref) => {
  let deviationY = 0;
  switch (scale) {
    case 0.8:
      deviationY = -1;
      break;
    case 0.9:
      deviationY = -0.5;
      break;
    default:
      break;
  }

  const character = useGLTF('/character.glb');
  // useGLTF caches per URL, so this takes its own clone rather than mounting
  // the cached scene — anything else that ever loads the character gets an
  // untouched original (SkeletonUtils, not Object3D.clone, to rebind the
  // skeleton). The contact panel's call-me pose used to be that other
  // consumer; it went with the contact rebuild.
  const scene = useMemo(() => cloneSkinned(character.scene), [character.scene]);
  const { actions } = useAnimations(character.animations, scene);
  const [dancing, setDancing] = useState(false);
  const localRef = useRef();

  const setRefs = useCallback(
    (node) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  // Fly-in, and the idle gesture it hands off to. One timeline: the gesture
  // starts because the arrival finished, not because 2200 ms elapsed.
  useEffect(() => {
    const idle = actions[IDLE_CLIP];
    const node = localRef.current;
    if (!node || !idle) return undefined;

    idle.setLoop(THREE.LoopOnce);
    idle.clampWhenFinished = true;
    idle.play();
    idle.paused = true;

    // The path IS the rest pose — its last point is where the flight lands.
    // Built once here so reduced motion can read that last point directly
    // instead of carrying its own separately-typed copy of it, which is what
    // let the two drift: the animated landing moved (this array is what's
    // being reworked) while the reduced-motion fallback stayed at the old
    // numbers. Tune the array; reduced motion follows automatically.
    //
    // ARRIVAL_Y_OFFSET is added to every point, not just the last — a uniform
    // shift keeps the flight's shape exactly as authored above, just raised;
    // offsetting only the landing point would have bent the final approach
    // instead of raising the whole thing.
    const path = [
      { x: -10, y: -2.4 + deviationY, z: -100 },
      { x: -5, y: -1.4 + deviationY, z: -12 },
      { x: 5, y: -0.4 + deviationY, z: -10 },
      { x: 8, y: 2.5 + deviationY, z: 0 },
    ].map((p) => ({ ...p, y: p.y + ARRIVAL_Y_OFFSET }));

    if (reducedMotion) {
      // Rest pose, no arrival flight and no gesture — the visitor can still
      // trigger the dance deliberately by clicking.
      const rest = path[path.length - 1];
      node.position.set(rest.x, rest.y, rest.z);
      // Already where the flight would have put it, so step 4 is complete the
      // moment it mounts.
      onArrived?.();
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.timeline().to(node.position, {
        motionPath: {
          path,
          type: 'cubic',
        },
        duration: FLY_IN_DURATION,
        ease: 'sine.inOut',
        onComplete: () => {
          // The end of step 4 of the entrance: the character has settled, so
          // the hero is interactive. Reported from the timeline rather than
          // from a timer, which is the whole reason the sequence can be
          // trusted to be finished when it says it is.
          onArrived?.();
          // Beat after landing, then the gesture — the old 2200 ms setTimeout.
          gsap.delayedCall(0.4, () => {
            idle.paused = false;
            idle.play();
          });
        },
      });
    });

    return () => ctx.revert();
  }, [actions, deviationY, reducedMotion, onArrived]);

  // TODO: the dance used to play a commercial backing track, which was removed
  // for licensing reasons. A royalty-free track can be swapped back in here,
  // but only behind an explicit user-initiated play (a visible unmute/play
  // control) — never auto-started on model click, and never preloaded.
  /** Single tap: toggle the dance. */
  const toggleDance = useCallback(
    () => {
      const idle = actions[IDLE_CLIP];
      const dance = actions[DANCE_CLIP];
      if (!idle || !dance) return;

      // Stop dancing and hold the first frame of the idle clip.
      const rest = () => {
        dance.stop();
        idle.reset();
        idle.play();
        idle.paused = true;
      };

      if (dancing) {
        setDancing(false);
        rest();
        return;
      }

      if (!idle.paused) {
        // Still mid-gesture: hold it, as it did before.
        idle.paused = true;
        return;
      }

      // The dance ends when it has finished its repeats — LoopRepeat plus
      // clampWhenFinished makes the mixer emit 'finished', which is what the
      // 30 s setTimeout used to approximate.
      setDancing(true);
      idle.stop();
      dance.reset();
      dance.setLoop(THREE.LoopRepeat, DANCE_REPEATS);
      dance.clampWhenFinished = true;
      dance.paused = false;
      dance.play();
    },
    [dancing, actions]
  );

  // --- tap counting --------------------------------------------------------
  const tap = useRef({ last: 0, timer: null });
  useEffect(() => () => {
    if (tap.current.timer) clearTimeout(tap.current.timer);
  }, []);

  const handleTap = useCallback(
    (event) => {
      // Everything in the root scene is raycast from the shared app root (see
      // ViewEventBridge), so a click on any DOM control lands here too. A
      // control that was pressed on purpose must never also poke the character
      // standing behind it — this is the root-scene form of the `hitArea`
      // guard rule 1 asks for.
      const target = event?.nativeEvent?.target;
      if (target?.closest?.('button, a, input, textarea, select, [role="button"]')) return;
      if (!interactive) return;
      // A tap on a satellite is a tap on the satellite, not on the person it
      // is orbiting. Return without stopping propagation so the event carries
      // on to whatever asked for it.
      if (yieldsToPrecisePick(event)) return;

      event.stopPropagation();

      // Classify by the *event's own* timestamp, not by when this handler got
      // to run. The two are not the same number: a frame that takes 400 ms
      // delivers both taps of a fast double-tap late, and measuring from
      // handler-entry would read them as two singles. `timeStamp` is when the
      // input actually happened, so the gesture survives a stuttering frame
      // rate — which is exactly the situation a heavy 3D hero can produce.
      const now = event?.nativeEvent?.timeStamp ?? performance.now();
      const s = tap.current;
      const isDouble = s.timer !== null && now - s.last <= TAP_WINDOW;
      s.last = now;

      if (isDouble) {
        clearTimeout(s.timer);
        s.timer = null;
        onTalk?.();
        return;
      }

      if (s.timer) clearTimeout(s.timer);
      s.timer = setTimeout(() => {
        s.timer = null;
        toggleDance();
      }, TAP_WINDOW);
    },
    [interactive, onTalk, toggleDance]
  );

  // The canvas is pointer-events:none, so the cursor has to be set on the
  // document — the same reason ProjectPlanets does it this way. It reads as
  // interactive before the hint ever appears.
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!hovered || !interactive) return undefined;
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = previous;
    };
  }, [hovered, interactive]);

  /**
   * A generous invisible sphere around the character, sized from the model's
   * own bounds so it survives a re-export. It is a *child* of the character, so
   * it follows the arrival flight and the departure without anything having to
   * keep two transforms in step.
   */
  const hit = useMemo(() => {
    const sphere = new THREE.Box3().setFromObject(scene).getBoundingSphere(new THREE.Sphere());
    return { center: sphere.center.toArray(), radius: sphere.radius * HIT_SCALE };
  }, [scene]);

  // Return to rest whenever the dance reports it is done.
  useEffect(() => {
    const dance = actions[DANCE_CLIP];
    const idle = actions[IDLE_CLIP];
    if (!dance || !idle) return undefined;

    const mixer = dance.getMixer();
    const onFinished = (event) => {
      if (event.action === dance) {
        setDancing(false);
        dance.stop();
        idle.reset();
        idle.play();
        idle.paused = true;
      } else if (event.action === idle) {
        idle.paused = true;
      }
    };

    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [actions]);

  return (
    <primitive
      object={scene}
      ref={setRefs}
      scale={5 * scale}
      position={[2, deviationY, -0.3]}
      // Turned to face the camera rather than the world's +Z axis — see
      // FACING_YAW. Set once here, not per frame: nothing else writes this
      // object's rotation (GSAP's arrival and the departure both animate
      // `position` and `scale` only), so it survives the flight untouched.
      rotation={[0, FACING_YAW, 0]}
    >
      {/* The tap target. `userData.hitProxy` keeps HeroScene.ownMaterials()
          away from it — that pass clones and fades every material under the
          character for the departure, and fading this one to opacity 1 would
          paint a black sphere over the hero. */}
      <mesh
        position={hit.center}
        onClick={handleTap}
        // Deliberately does NOT stopPropagation, where the tap handler above
        // does. r3f books a hovered object *and the event object it stopped
        // with* into `internal.hovered`, and on the next pointermove it
        // replays that flag: `else if (hoveredItem.stopped) data.stopPropagation()`.
        // So one stop, made while the pointer happened to be over empty
        // space, went on suppressing every later move — including the ones
        // that did land on a satellite. A hover handler that stops
        // propagation is a latch, not a filter.
        onPointerOver={(e) => {
          if (!interactive || yieldsToPrecisePick(e)) return;
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        userData={{ hitProxy: true }}
      >
        <sphereGeometry args={[hit.radius, 12, 8]} />
        {/* Not `visible={false}`: an invisible object is skipped by the
            raycaster, which is the one thing this mesh exists to be hit by. */}
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </primitive>
  );
});

Astronaut.displayName = 'Astronaut';

export default Astronaut;
