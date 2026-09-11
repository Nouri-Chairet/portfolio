/**
 * The single source of truth for the projects section.
 *
 * The DOM copy, the hash routes, and the procedural planets in the shared
 * canvas all read from here — nothing about a project is defined anywhere
 * else. Adding a project means adding an entry to this array and nothing
 * more: the section renders one panel and one planet per entry.
 *
 * ------------------------------------------------------------ the copy
 *
 * Every word is taken from the CV (cv_nour_eddine_chairet_en, September 2026),
 * in the CV's order: professional experience first, then academic and
 * personal projects. Internships and freelance work are planets too, same as
 * the projects. Keep it that way — if the CV changes, this changes to match,
 * rather than the site growing its own version of the story.
 *
 *   kind        the CV's role or project type ("Software Engineering Intern",
 *               "Freelance project", "Academic project"), or '' where the CV
 *               gives none
 *   period      the CV's date, as written there
 *   title       the bold name on the CV line
 *   tagline     the CV's one-line context, where it has one; optional
 *   highlights  the CV's bullets, verbatim
 *   tech        the stack the CV lists (or bolds) for the entry
 *   link        a public URL, or '' — client and internal work has none
 *
 * ids are URLs (`#project/<id>`), so an existing one never changes when its
 * title does: the chess game is still `chessiworld`.
 *
 * ------------------------------------------------------------ the planet
 *
 * planet.palette feeds the fbm shader in scene/Planet.jsx:
 *   deep   the low ground / ocean colour
 *   mid    the dominant band colour
 *   high   the peaks / continents, brightest
 *   glow   the fresnel atmosphere rim, which is what Bloom picks up
 * planet.seed shifts the noise field so no two planets share a surface.
 *
 * The FIRST planet is also the one visible from the hero, small and far off
 * beside the character, and the hero's composition was tuned around it being
 * purple (ProjectPlanets, HERO_NUDGE_PX). Whatever project is first keeps that
 * palette and seed.
 *
 * screenshots hold only the semantic half — which image, and its alt text. The
 * technical half (available widths, intrinsic dimensions) is build output in
 * src/generated/screenshots.js, produced by `npm run assets:screenshots` and
 * imported ONLY by the lazily-loaded gallery, so no image data reaches the
 * main bundle. An empty list simply hides the Screenshots button.
 *
 * Palettes stay in the site's cosmic family (see CLAUDE.md "Visual identity"):
 * each one is keyed to its project but none of them is a large flat fill of
 * the violet/magenta accents.
 */

export const PROJECTS = [
  {
    id: 'digilife',
    kind: 'Software Engineering Intern · Startup',
    period: 'Jun 2026 – Jul 2026 (2 months)',
    title: 'Digilife',
    tagline:
      'Point-of-sale system for a retail store: Electron desktop app paired with a synced mobile barcode scanner.',
    highlights: [
      'Built the desktop POS with Electron.js, a local SQLite database, and 80 mm thermal receipt printing.',
      'Delivered a React Native scanner app; catalogued 112 products through barcode scanning.',
      'Architected offline-first synchronization between both clients through Supabase.',
      'Secured sensitive actions with email OTP validation and 6-digit backup admin keys.',
    ],
    tech: ['Electron.js', 'SQLite', 'React Native', 'Supabase'],
    link: '',
    screenshots: [],
    planet: {
      // The hero's purple world: first in line, so it is the one seen from
      // the hero. Palette and seed unchanged from when it was the chess game.
      seed: 11.3,
      palette: {
        deep: '#1b1147',
        mid: '#4b2ea8',
        high: '#9b40fc',
        glow: '#c340da',
      },
    },
  },
  {
    id: 'cafe-pos',
    kind: 'Freelance project',
    period: '2026',
    title: 'Café POS Extension',
    tagline: 'Mobile Ordering Bridge',
    highlights: [
      'Reverse-engineered a closed Delphi POS to extend it without vendor support or a public API.',
      'Built a React Native app letting 3 waiters take orders simultaneously from their phones instead of queuing at the POS PC, improving service during rush hours.',
      'Bridged the POS to a Supabase socket through a Windows service, using a commands table as a queue.',
    ],
    tech: ['React Native', 'Supabase Realtime', 'Windows Service', 'SQL Server'],
    link: '',
    screenshots: [],
    planet: {
      seed: 47.9,
      // Roast — copper bands over a dark coffee ground.
      palette: {
        deep: '#2a1206',
        mid: '#8a3f14',
        high: '#ffab5e',
        glow: '#ff8a3d',
      },
    },
  },
  {
    id: 'gaya-coffee',
    kind: 'Freelance project',
    period: '2026',
    title: 'Gaya Coffee',
    tagline: 'Menu Website with Admin Panel',
    highlights: [
      'Built a mobile-first menu site with category navigation and item detail views.',
      'Delivered an admin interface for staff to edit the menu; deployed on Vercel with Supabase as data source.',
    ],
    tech: ['Next.js', 'TypeScript', 'Supabase', 'Vercel'],
    link: 'https://gaya-menu.vercel.app/',
    screenshots: [],
    planet: {
      seed: 23.6,
      // Leaf green — the coffee plant, not the cup.
      palette: {
        deep: '#0c2112',
        mid: '#2c6a38',
        high: '#9fdc7c',
        glow: '#7dffa8',
      },
    },
  },
  {
    id: 'smooth-algo',
    kind: 'Software Engineering Intern · Startup',
    period: 'Jun 2025 – Jul 2025 (7 weeks)',
    title: 'Smooth Algo',
    tagline:
      'Internal company communication app, delivered as a React web app and a React Native mobile app.',
    highlights: [
      'Built real-time audio/video calls, screen and media sharing with WebRTC and WebSocket.',
      'Designed meeting administrator roles and privileges.',
      'Delivered email OTP authentication (NodeMailer) and media storage on Google Cloud Storage.',
      'Optimized APK size from 248 MB to 153 MB (-38%) to improve mobile distribution.',
    ],
    tech: ['React', 'React Native', 'WebRTC', 'WebSocket', 'NodeMailer', 'Google Cloud Storage'],
    link: '',
    screenshots: [],
    planet: {
      seed: 64.2,
      // Signal blue — a live call.
      palette: {
        deep: '#06163d',
        mid: '#1c4fb0',
        high: '#6fb6ff',
        glow: '#4fd2ff',
      },
    },
  },
  {
    id: 'chessiworld',
    kind: '',
    period: '2024',
    title: 'Fullstack Chess Game',
    tagline: '',
    highlights: [
      'Built the game logic from scratch after studying move-generation algorithms: legal moves, check, checkmate, castling, en passant.',
      'Delivered real-time matches over WebSocket with JWT authentication and Three.js 3D models.',
    ],
    tech: ['React', 'Express.js', 'MongoDB', 'Three.js', 'WebSocket', 'JWT'],
    link: 'https://www.chessiworld.com',
    screenshots: [{ id: 'chess', alt: 'The chess game mid-game, rendered in 3D' }],
    planet: {
      seed: 5.7,
      // Marble — the board's black and white, lit cold.
      palette: {
        deep: '#111427',
        mid: '#4b5275',
        high: '#e9edf7',
        glow: '#aebeff',
      },
    },
  },
  {
    id: 'fyp-manager',
    kind: 'Academic project',
    period: '2026',
    title: 'Final-Year Project Management Application',
    tagline: '',
    highlights: [
      'Built role-based interfaces and REST APIs for students, teachers, and administrators.',
      'Designed defense-scheduling algorithms and a responsive management frontend.',
    ],
    tech: ['Django', 'TypeScript', 'React'],
    link: '',
    screenshots: [],
    planet: {
      seed: 31.4,
      // Rose — warm, and far enough from the violet to never be mistaken
      // for the hero's world.
      palette: {
        deep: '#2a0716',
        mid: '#8c1d4a',
        high: '#ff7aa8',
        glow: '#ff5c8a',
      },
    },
  },
  {
    id: 'school-manager',
    kind: '',
    period: '2025',
    title: 'School Management System',
    tagline: '',
    highlights: [
      'Delivered attendance tracking, announcement publishing, and secure PDF upload.',
    ],
    tech: ['Django', 'React', 'PostgreSQL', 'Google Cloud Storage'],
    link: '',
    screenshots: [{ id: 'edu', alt: 'The School Management attendance dashboard' }],
    planet: {
      seed: 88.1,
      // Cool teal — the calmest, and the last world before the skills stop.
      palette: {
        deep: '#04262b',
        mid: '#0e6d6b',
        high: '#5fe3c8',
        glow: '#3ef3ff',
      },
    },
  },
];

/** The CV's date line for a project: "Freelance project · 2026". */
export function projectMeta(project) {
  return [project.kind, project.period].filter(Boolean).join(' · ');
}

/** Hash for the section as a whole. */
export const PROJECTS_HASH = '#projects';

/** Hash for one project, e.g. `#project/chessiworld`. */
export function projectHash(id) {
  return `#project/${id}`;
}

/** Parse a location hash back to a project id, or null. */
export function projectIdFromHash(hash) {
  const match = /^#project\/(.+)$/.exec(hash || '');
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  return PROJECTS.some((p) => p.id === id) ? id : null;
}

export function projectById(id) {
  return PROJECTS.find((p) => p.id === id) ?? null;
}

export default PROJECTS;
