/**
 * The single source of truth for the hero's skills.
 *
 * Read by two things that must never disagree: `components/SkillsPanel.jsx`,
 * which is the real, accessible content, and `scene/SkillSatellites.jsx`,
 * which is decoration on top of it. Adding a sixth skill means adding an entry
 * here and nothing else — a panel row and a satellite both appear.
 *
 * The panel is the content and the satellites are the enhancement, not the
 * other way round. Everything a visitor needs to know is in `title` and
 * `blurb`; `label` is only what fits on a 30-pixel-tall node sailing past the
 * character's shoulder, and a device with no WebGL loses nothing but the
 * animation.
 *
 * ---------------------------------------------------------------- orbits
 *
 * Every orbit quantity is a FRACTION of the character's own measured height,
 * not a world coordinate, for the same reason HeroScene places the character
 * as a fraction of the visible half-extent: the composition then survives a
 * resize and a re-exported model. `scene/SkillSatellites.jsx` measures the
 * character once and multiplies.
 *
 *   a, b        the ellipse's two semi-axes in its own plane. a !== b on every
 *               orbit — a circle read as a clock face.
 *   inclination tilt of the orbit plane about X, radians. This is what lifts
 *               satellites above and drops them below the character.
 *   node        rotation of the plane about Y, radians. Different per orbit so
 *               the five ellipses do not stack into one band.
 *   phase       starting angle, radians. NOT arbitrary: under reduced motion
 *               the orbits never advance, so these five numbers are the whole
 *               composition a visitor sees. They were solved for rather than
 *               eyeballed — maximise the smallest distance between the five
 *               PROJECTED positions (perspective moves a satellite at the back
 *               of its orbit toward the character), keep every node and its
 *               label off the character's silhouette, and require at least two
 *               satellites in front of the character's plane and two behind it,
 *               so the still shows the depth the motion exists to show.
 *   speed       radians/second. Signs differ: two orbits run retrograde, which
 *               is the cheapest way to stop five moving dots reading as one
 *               rotating ring.
 *
 * No two orbits share a radius, an inclination or a period. That is the whole
 * defence against the thing this is supposed to avoid — a flat ring of beads.
 *
 * ---------------------------------------------------------------- palette
 *
 * Single colours from the site's cosmic family (CLAUDE.md "Visual identity"),
 * used as small glowing nodes. Deliberately NOT the four-stop deep/mid/high/
 * glow palettes the project planets use: a satellite is a lit bead, a planet is
 * a shaded world, and a visitor should never have to work out which is which.
 */

export const SKILLS = [
  {
    id: 'frontend',
    label: 'Front-end',
    title: 'Front-end',
    blurb: 'React.js, React Native, Next.js, Redux and Electron.js — web, mobile and desktop.',
    color: '#8fc7ff',
    orbit: { a: 0.44, b: 0.60, inclination: 0.28, node: 0.35, phase: 4.21, speed: 0.36 },
  },
  {
    id: 'backend',
    label: 'Back-end',
    title: 'Back-end',
    blurb: 'Node.js, Express.js and Django. REST APIs, with JWT and email OTP auth.',
    color: '#9b40fc',
    orbit: { a: 0.62, b: 0.47, inclination: -0.42, node: 1.15, phase: 1.87, speed: -0.27 },
  },
  {
    id: 'databases',
    label: 'Databases',
    title: 'Databases',
    blurb: 'PostgreSQL, MongoDB, SQLite, SQL Server and Supabase.',
    color: '#c340da',
    orbit: { a: 0.52, b: 0.66, inclination: 0.55, node: -0.60, phase: 0.32, speed: 0.31 },
  },
  {
    id: 'devops',
    label: 'DevOps',
    title: 'DevOps',
    blurb: 'Linux, Docker, CI/CD with GitHub Actions, Cloudflare and Vercel.',
    color: '#F3F3E0',
    orbit: { a: 0.70, b: 0.55, inclination: -0.20, node: 2.05, phase: 2.49, speed: -0.22 },
  },
  {
    // Was '3D / WebGL'. Not a skill on the CV; its real-time category is,
    // so this satellite took it over — same orbit, same colour.
    id: 'realtime',
    label: 'Real-time',
    title: 'Real-time',
    blurb: 'WebRTC, WebSocket, Django Channels and Supabase Realtime.',
    color: '#608BC1',
    orbit: { a: 0.40, b: 0.52, inclination: 0.68, node: -1.40, phase: 2.07, speed: 0.42 },
  },
];

/**
 * The introduction above the list. Kept short on purpose — the headline says
 * the role, this says the person, and the five rows below say the work.
 *
 * `headline` is sentence case here and uppercased in CSS (`text-transform`),
 * not typed in capitals: screen readers announce a capitalised string as an
 * initialism, letter by letter.
 */
export const SKILLS_INTRO = {
  headline: 'Software engineer',
  // The CV's profile, verbatim.
  body:
    'Software engineering student building fullstack web, mobile, and desktop ' +
    'applications with React, React Native, Next.js, Electron, and Django. ' +
    'Hands-on with offline-first architectures, real-time systems, and Linux, ' +
    'Docker, and CI/CD workflows. Seeking a Fullstack Development & DevOps ' +
    'internship to contribute to high-impact technical projects.',
};

/** Hash for the skills reference — a rest position on the projects voyage. */
export const SKILLS_HASH = '#skills';

/**
 * The skills REFERENCE — the scannable list between the projects and contact
 * (components/SkillsReference.jsx).
 *
 * Deliberately separate from SKILLS above. That list is narrative: five
 * sentences about how I work, each with a satellite orbiting the character.
 * This one is a plain inventory someone skims for a keyword, so it has no
 * colours, no orbits and no interaction — just groups of names.
 *
 * The CV's SKILLS section, verbatim: its seven categories in its order, with
 * its item names. The last group is the CV's separate LANGUAGES section,
 * renamed so it is not confused with the first. Adding a group or an item is
 * an edit here and nothing else.
 */
export const SKILL_GROUPS = [
  {
    id: 'languages',
    title: 'Languages',
    items: ['JavaScript', 'TypeScript', 'Python'],
  },
  {
    id: 'frameworks',
    title: 'Frameworks & Libraries',
    items: [
      'React.js',
      'React Native',
      'Next.js',
      'Redux',
      'Node.js',
      'Express.js',
      'Django',
      'Electron.js',
      'REST APIs',
    ],
  },
  {
    id: 'databases',
    title: 'Databases',
    items: ['PostgreSQL', 'MongoDB', 'SQLite', 'SQL Server', 'Supabase'],
  },
  {
    id: 'devops',
    title: 'DevOps & Cloud',
    items: [
      'Linux',
      'Docker',
      'CI/CD (GitHub Actions)',
      'Cloudflare',
      'Vercel',
      'Google Cloud Storage',
    ],
  },
  {
    id: 'realtime',
    title: 'Real-Time & Protocols',
    items: ['WebRTC', 'WebSocket', 'Django Channels', 'Supabase Realtime'],
  },
  {
    id: 'auth',
    title: 'Authentication & Security',
    items: ['JWT', 'OTP', 'NodeMailer'],
  },
  {
    id: 'methods',
    title: 'Methods & Tools',
    items: ['Agile/Scrum', 'Git', 'GitHub', 'Figma', 'Canva', 'Adobe Photoshop'],
  },
  {
    id: 'spoken',
    title: 'Spoken languages',
    items: ['Arabic — Native', 'French — Fluent', 'English — B2+'],
  },
];
