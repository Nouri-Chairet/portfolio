import React, { useEffect, Suspense, lazy, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './App.css';
import Loader from './components/Loader';

gsap.registerPlugin(ScrollTrigger);

const Hero = lazy(() => import('./sections/Hero'));
const Journey = lazy(() => import('./sections/journey'));

function App() {

  return (
    <Suspense fallback={<Loader />}>
      <div className='app' >
        <div className="panel" >
          <Hero />
        </div>
      <div className="panel" >
        <Journey />
      </div>
      </div>
    </Suspense>
  );
}

export default App;
