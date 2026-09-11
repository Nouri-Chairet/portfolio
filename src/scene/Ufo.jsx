import React, { useCallback, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ARRIVAL_Y_OFFSET, FLY_IN_DURATION } from './Astronaut';

gsap.registerPlugin(MotionPathPlugin);

/**
 * The UFO the astronaut rides in on. Plain R3F, rendered into the site's
 * single canvas through the hero's <View>.
 *
 * As with Astronaut, the scroll-driven exit lives in HeroView — this component
 * only owns its mount fly-in and its idle spin.
 */
const Ufo = React.forwardRef(({ scale, reducedMotion }, ref) => {
  const { scene } = useGLTF('/ufo.glb', true);
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
    if (!localRef.current) return undefined;

    // Same path/reduced-motion pairing as Astronaut.jsx, for the same reason:
    // the last point of the path IS the rest pose, read directly rather than
    // duplicated as a separately-typed number that can drift from it.
    // ARRIVAL_Y_OFFSET (imported from there) is folded into every point, not
    // applied as a parent-group wrapper — see that file's comment on the
    // constant for why: a wrapper here would put the UFO one parent deeper
    // than its own ref expects, for anything that reads it directly.
    const path = [
      { x: -10, y: -7, z: -100 },
      { x: -5, y: -6, z: -12 },
      { x: 5, y: -5, z: -10 },
      { x: 8, y: -1.79, z: 0 },
    ].map((p) => ({ ...p, y: p.y + ARRIVAL_Y_OFFSET }));

    if (reducedMotion) {
      const rest = path[path.length - 1];
      localRef.current.position.set(rest.x, rest.y, rest.z);
      return undefined;
    }
    const ctx = gsap.context(() => {
      gsap.to(localRef.current.position, {
        motionPath: { path, type: 'cubic' },
        duration: FLY_IN_DURATION,
        ease: 'sine.inOut',
      });
    });
    return () => ctx.revert();
  }, [reducedMotion]);

  // The idle spin is continuous motion; hold it still for reduced motion.
  useFrame(() => {
    if (!reducedMotion && localRef.current) localRef.current.rotation.y += 0.001;
  });

  return <primitive object={scene} ref={setRefs} scale={1.8 * scale} position={[1, 0.3, 0]} />;
});

Ufo.displayName = 'Ufo';

export default Ufo;
