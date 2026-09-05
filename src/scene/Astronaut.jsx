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

/**
 * The hero character. Plain R3F — it renders into the site's single canvas
 * through the hero's <View>.
 *
 * The scroll-driven exit is NOT set up here: HeroView owns the one
 * ScrollTrigger and tweens this object's position through the forwarded ref.
 * Only the mount-time fly-in lives here.
 */
const Astronaut = React.forwardRef(({ scale, hitArea }, ref) => {
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
  // useGLTF caches per URL and CallMePose loads the same file, so each needs
  // its own clone (SkeletonUtils, not Object3D.clone, to rebind the skeleton).
  const scene = useMemo(() => cloneSkinned(character.scene), [character.scene]);
  const { actions } = useAnimations(character.animations, scene);
  const [active, setActive] = useState(false);
  const danceTimeoutRef = useRef(null);
  const localRef = useRef();

  const setRefs = useCallback(
    (node) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    // The idle and dance clips share one mixer, so only one may be active at
    // a time — two running actions would blend into each other.
    const idle = actions[IDLE_CLIP];
    if (!idle) return undefined;

    idle.play();
    idle.paused = true;
    idle.setLoop(THREE.LoopOnce);
    idle.clampWhenFinished = true;
    const onFinished = () => {
      idle.paused = true;
    };
    const kickoff = setTimeout(() => {
      idle.paused = false;
      idle.play();
      idle.getMixer().addEventListener('finished', onFinished);
    }, 2200);

    return () => {
      clearTimeout(kickoff);
      idle.getMixer().removeEventListener('finished', onFinished);
    };
  }, [actions]);

  // Mount fly-in. Scoped so it reverts cleanly with the component.
  useEffect(() => {
    if (!localRef.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.to(localRef.current.position, {
        motionPath: {
          path: [
            { x: -10, y: -2.4 + deviationY, z: -100 },
            { x: -5, y: -1.4 + deviationY, z: -12 },
            { x: 5, y: -0.4 + deviationY, z: -10 },
            { x: 0, y: -0 + deviationY, z: 0 },
          ],
          type: 'cubic',
        },
        duration: 1.8,
        ease: 'sine.inOut',
      });
    });
    return () => ctx.revert();
  }, [deviationY]);

  // TODO: the dance used to play a commercial backing track, which was removed
  // for licensing reasons. A royalty-free track can be swapped back in here,
  // but only behind an explicit user-initiated play (a visible unmute/play
  // control) — never auto-started on model click, and never preloaded.
  const handleClick = useCallback(
    (event) => {
      // The canvas is pointer-events:none and the event layer is attached to a
      // shared ancestor, so confirm this click really landed on our own <View>
      // box before acting on it.
      if (hitArea?.current && event?.nativeEvent?.target !== hitArea.current) return;

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

      if (active) {
        clearTimeout(danceTimeoutRef.current);
        setActive(false);
        rest();
        return;
      }

      if (!idle.paused) {
        idle.paused = true;
      } else {
        // Ends the dance and returns to the idle pose after one run.
        danceTimeoutRef.current = setTimeout(() => {
          setActive(false);
          rest();
        }, 30000);

        setActive(true);
        idle.stop();
        dance.reset();
        dance.paused = false;
        dance.play();
      }
    },
    [active, actions, hitArea]
  );

  useEffect(() => () => clearTimeout(danceTimeoutRef.current), []);

  return (
    <primitive
      object={scene}
      ref={setRefs}
      scale={5 * scale}
      position={[0, deviationY, 0]}
      onClick={handleClick}
    />
  );
});

Astronaut.displayName = 'Astronaut';

export default Astronaut;
