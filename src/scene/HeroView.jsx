import { Suspense, useEffect, useState } from 'react';
import { View, PerspectiveCamera } from '@react-three/drei';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Astronaut from './Astronaut';
import Ufo from './Ufo';
import useInView from '../hooks/useInView';
import { setHeroProgress } from '../hooks/useScrollProgress';

gsap.registerPlugin(ScrollTrigger);

/**
 * The hero's slice of the shared canvas.
 *
 * Renders the `.model` div that used to hold a <Canvas>; drei's <View>
 * scissors the site-wide canvas to that box, so the astronaut and UFO stay
 * clipped to exactly the region they occupied before the refactor.
 *
 * This component is the ONLY owner of a ScrollTrigger against `.hero`. It
 * drives one timeline containing both the astronaut's and the UFO's exit
 * tweens, and publishes the trigger's progress to useScrollProgress for any
 * other consumer. Previously Astronaut and Ufo each registered their own.
 */
const HeroView = ({ finish }) => {
  const [viewRef, inView] = useInView();
  const [astronaut, setAstronaut] = useState(null);
  const [ufo, setUfo] = useState(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 600) setScale(0.9);
      else if (window.innerWidth < 1024) setScale(0.8);
      else setScale(1);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!astronaut || !ufo) return undefined;
    // gsap.context() scopes everything created inside it; revert() kills the
    // tweens *and* the ScrollTrigger, so nothing else on the page is touched.
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline();
      timeline
        .fromTo(
          astronaut.position,
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 9.6, z: -60, duration: 2 },
          0
        )
        .fromTo(ufo.position, { x: 0, y: -4.4, z: 0 }, { x: 10, y: 6.8, z: -60, duration: 2 }, 0);

      ScrollTrigger.create({
        trigger: '.hero',
        start: 'top top',
        end: 'bottom',
        scrub: 1,
        animation: timeline,
        onUpdate: (self) => setHeroProgress(self.progress),
      });
    });
    return () => ctx.revert();
  }, [astronaut, ufo]);

  // `finish` is true for the hero's opening seconds; the 3D holds off until the
  // intro text has played, exactly as before.
  const show = inView && !finish;

  return (
    <View className="model" ref={viewRef} index={1}>
      <PerspectiveCamera makeDefault position={[4, 6, 23]} fov={50} />
      <directionalLight position={[0, 26, 0]} intensity={1.3} castShadow />
      <ambientLight intensity={1} />
      {show && (
        <>
          <Suspense fallback={null}>
            <Astronaut ref={setAstronaut} scale={scale} hitArea={viewRef} />
          </Suspense>
          <Suspense fallback={null}>
            <Ufo ref={setUfo} scale={scale} />
          </Suspense>
        </>
      )}
    </View>
  );
};

export default HeroView;
