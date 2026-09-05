import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter } from 'react-router-dom';
import { Routes,Route } from 'react-router-dom';
import Loader from './components/Loader.jsx'

import App from './App.jsx'

// Projects pulls in lottie-react + its JSON + images; lazy-load it so none
// of that ships in the entry chunk for visitors landing on "/".
const Projects = lazy(() => import('./sections/Projects.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/projects" element={<Projects />} />
        </Routes>
      </Suspense>
      <SpeedInsights />
    </BrowserRouter>
  </StrictMode>,
)
