import React, { Suspense, lazy, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
// Montserrat, self-hosted. Latin subset only — the site is English, and the
// unsuffixed entry points bundle cyrillic, cyrillic-ext, latin-ext and
// vietnamese too, which is five woff2 files per weight to render none of.
// Imported here rather than in a lazy chunk: SiteNav is eager and is the first
// paint (rule 5's reasoning for tokens.css, applied to the face it renders in).
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-800.css';
import './styles/tokens.css';
import './App.css';
import Loader from './components/Loader';
import SiteNav from './components/SiteNav';
import ProjectDetail from './components/ProjectDetail';
import StaticSky from './components/StaticSky';
import { useProjectDetailRouting } from './state/projectDetail';
import { useDeviceTier } from './state/deviceTier';

gsap.registerPlugin(ScrollTrigger);

// Lazy so three.js stays out of the critical path entirely. A `low`-tier
// device never mounts this, so it never downloads the renderer.
const SceneRoot = lazy(() => import('./scene/SceneRoot'));
const Hero = lazy(() => import('./sections/Hero'));
const ProjectsSection = lazy(() => import('./sections/ProjectsSection'));
const Journey = lazy(() => import('./sections/journey'));

function App() {
  // The shared canvas takes no pointer events itself; R3F listens on this
  // element, and each interactive 3D object filters the events it receives.
  const appRef = useRef(null);
  const tier = useDeviceTier();
  // `low` means no WebGL at all — either the device cannot afford it or the
  // browser will not give us a context. The canvas is not mounted, and the
  // sections fall back to styled DOM. Everything remains reachable.
  const has3D = tier !== 'low';

  // `#project/<id>` in the URL *is* the open detail panel. Mounted once here so
  // a shared link opens straight into a project and Back closes it.
  useProjectDetailRouting();

  return (
    <div className="app" ref={appRef}>
      {/* One WebGL context for the whole site, mounted once and never torn
          down. The hero characters, the star field and the project planets all
          live in its root scene, as do the contact section's UFO and beam. */}
      {has3D ? (
        <Suspense fallback={null}>
          <SceneRoot eventSource={appRef} tier={tier} />
        </Suspense>
      ) : (
        <StaticSky />
      )}
      {/* Eager, not lazy: the header IS the first paint. It is the intro
          panel that collapses into the navbar, and the skip control it
          carries has to exist before anything else is decided. */}
      <SiteNav />
      <Suspense fallback={<Loader />}>
        <div className="panel">
          <Hero />
        </div>
        <ProjectsSection />
        <div className="panel">
          <Journey />
        </div>
      </Suspense>
      <ProjectDetail />
    </div>
  );
}

export default App;
