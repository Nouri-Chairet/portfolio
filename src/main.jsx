import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from './App.jsx'

// Projects used to be its own route. It is now a section on "/", so the only
// route left is the site itself; deep links into a project are hashes
// (#projects, #project/<id>) handled by sections/ProjectsSection.jsx.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
      </Routes>
      <SpeedInsights />
    </BrowserRouter>
  </StrictMode>,
)
