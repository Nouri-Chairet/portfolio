import React, { useEffect, Suspense, lazy, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './App.css';
import Loader from './components/Loader';

gsap.registerPlugin(ScrollTrigger);

const Hero = lazy(() => import('./components/Hero'));
const Journey = lazy(() => import('./components/journey'));

function App() {
  const pan1 = useRef();
  const pan2 = useRef();

  useEffect(() => {
    const panels = gsap.utils.toArray('.panel');
    panels.forEach((panel) => {
      ScrollTrigger.create({
        trigger: panel,
        start: 'top top',
        pin: true,
        pinSpacing: false,
        snap: 1,
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      <div ref={pan1} className="panel">
        <Hero />
      </div>
      <div ref={pan2} className="panel">
        <Journey />
      </div>
    </Suspense>
  );
}

export default App;
