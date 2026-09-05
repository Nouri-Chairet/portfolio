import React, { Suspense, lazy, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './App.css';
import Loader from './components/Loader';
import SceneRoot from './scene/SceneRoot';

gsap.registerPlugin(ScrollTrigger);

const Hero = lazy(() => import('./sections/Hero'));
const Journey = lazy(() => import('./sections/journey'));

function App() {
  // The shared canvas takes no pointer events itself; R3F listens on this
  // element and drei's <View>s claim the events that land on their own boxes.
  const appRef = useRef(null);

  return (
    <div className="app" ref={appRef}>
      {/* One WebGL context for the whole site, mounted once and never torn
          down. Sections contribute 3D through <View>, not through a Canvas. */}
      <SceneRoot eventSource={appRef} />
      <Suspense fallback={<Loader />}>
        <div className="panel">
          <Hero />
        </div>
        <div className="panel">
          <Journey />
        </div>
      </Suspense>
    </div>
  );
}

export default App;
