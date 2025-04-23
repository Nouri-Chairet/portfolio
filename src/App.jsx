import React, { useEffect, Suspense, lazy, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './App.css';
import Loader from './components/Loader';
import { ReactLenis } from "@studio-freight/react-lenis";


gsap.registerPlugin(ScrollTrigger);

const Hero = lazy(() => import('./sections/Hero'));
const Journey = lazy(() => import('./sections/journey'));
const Projects = lazy(() => import('./sections/Projects'));

function App() {
  const pan1 = useRef();
  const pan2 = useRef();

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
