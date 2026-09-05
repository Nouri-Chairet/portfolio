import React, { useCallback, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(MotionPathPlugin);

/**
 * The UFO the astronaut rides in on. Plain R3F, rendered into the site's
 * single canvas through the hero's <View>.
 *
 * As with Astronaut, the scroll-driven exit lives in HeroView — this component
 * only owns its mount fly-in and its idle spin.
 */
const Ufo = React.forwardRef(({ scale }, ref) => {
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
    const ctx = gsap.context(() => {
      gsap.to(localRef.current.position, {
        motionPath: {
          path: [
            { x: -10, y: -7, z: -100 },
            { x: -5, y: -6, z: -12 },
            { x: 5, y: -5, z: -10 },
            { x: 0, y: -4.39, z: 0 },
          ],
          type: 'cubic',
        },
        duration: 1.8,
        ease: 'sine.inOut',
      });
    });
    return () => ctx.revert();
  }, []);

  useFrame(() => {
    if (localRef.current) localRef.current.rotation.y += 0.001;
  });

  return <primitive object={scene} ref={setRefs} scale={1.8 * scale} position={[0, -4.3, -100]} />;
});

Ufo.displayName = 'Ufo';

export default Ufo;
