# CLAUDE.md

Personal portfolio site for Nouri Chairet. Single-page-ish React app with a
3D hero (WebGL) and a scroll-driven, space-themed presentation.

## Stack

| Concern | Choice |
| --- | --- |
| UI | **React 18** (`react` / `react-dom` 18.3, JSX, no TypeScript) |
| Build | **Vite 5** (`@vitejs/plugin-react`, esbuild dev / rollup prod) |
| 3D | **@react-three/fiber 8** + **@react-three/drei 9** on **three 0.170** |
| Animation | **GSAP 3.13** (`ScrollTrigger`, `MotionPathPlugin`, `ScrollToPlugin`, `DrawSVGPlugin`) |
| Routing | **react-router-dom 7** (`BrowserRouter`) |
| Styling | Plain CSS in `src/styles/*.css` + **styled-components 6** for two self-contained widgets |
| Type | **Montserrat** 400/600/800, self-hosted via `@fontsource/montserrat` (latin subset) |
| Type as art | **Caveat** (SIL OFL), baked to SVG paths at build time - no *handwriting* webfont ships |
| Post | **@react-three/postprocessing 2** (Bloom + atmosphere), quality-gated |
| Misc | `lottie-react` (projects background), `@vercel/speed-insights` |
| Lint | ESLint 9 flat config (`eslint.config.js`) |

Node 24 / npm 11 locally. `npm run dev` · `npm run build` · `npm run lint` · `npm run preview`.
`ANALYZE=1 npm run build` additionally emits `dist/stats.html` (rollup-plugin-visualizer treemap).

## Layout of the code

```
src/
  main.jsx            createRoot + BrowserRouter. "/" -> App. There is no
                      /projects route; projects are a section, deep-linked by hash
  App.jsx             registers ScrollTrigger; imports styles/tokens.css once;
                      SiteNav (eager) -> Hero -> ProjectsSection -> Journey
  data/projects.js    SINGLE SOURCE OF TRUTH for the projects section
  data/skills.js      SINGLE SOURCE OF TRUTH for skills: the hero panel's copy
                      and every orbit parameter (SKILLS), and the grouped
                      reference list between projects and contact
                      (SKILL_GROUPS)
  data/contact.js     email, location, LinkedIn, GitHub, résumé path — all as
                      the CV lists them
  data/dialogue.js    what the character says. Four or five short lines
  generated/screenshots.js  GENERATED - screenshot widths + intrinsic sizes
  state/projectDetail.js    which project's detail panel is open (= the hash)
  components/SiteNav.jsx    THE INTRO PANEL AND THE NAVBAR - one element
  components/HeroDialogue.jsx  the opt-in speech bubble, its hint and its
                      keyboard control
  components/SkillsPanel.jsx   who I am and what I work on. THE CONTENT the
                      orbiting satellites decorate; complete without WebGL
  components/SkillsReference.jsx  the flat, grouped skills list. The voyage's
                      last rest position; a plain section when flat
  components/ContactMe.jsx     the contact content: heading, CV, LinkedIn,
                      GitHub, email. Real <a>s, no dependence on the canvas
  state/dialogue.js   is the character talking, and on which line
  state/skills.js     which skill is called out, and by which side
  state/voyage.js     the projects flight: where every world stands, where the
                      camera rests, and the live camera/character pose
  components/ProjectDetail.jsx        the detail modal
  components/gallery/ScreenshotGallery.jsx  LAZY chunk: grid + lightbox
  sections/
    Hero.jsx          the space stage behind the header. Composition + markup
                      only; behaviour lives in hooks. It no longer carries the
                      handwriting - that is the entrance now (SiteNav)
    ProjectsSection.jsx  ONE pinned stage, one master timeline, panel snapping.
                      Projects, then the skills reference, as rest positions
    journey.jsx       the contact panel (ContactMe) and its measured trigger
  scene/              ALL 3D lives here
    SceneRoot.jsx     the site's one <Canvas>; mounted by App, never unmounted
    renderOrder.js    useFrame priorities: camera 1/3, draw 1, perf read 2
    StarField.jsx     three parallax point layers, custom ShaderMaterial
    starSprite.js     the round glow sprite, drawn into a CanvasTexture
    Nebula.jsx        one faint fbm-noise plane behind the stars
    BackgroundGradient.jsx  the sky: a dithered vertical ramp, full-screen quad
    Atmosphere.jsx    vignette + edge-only chromatic aberration + film grain
    dither.js         the shared noise chunk both of those include
    PerfOverlay.jsx   fps readout, only with ?perf=1
    HeroScene.jsx     Astronaut + Ufo in the ROOT scene, and the departure
    DepartureTrail.jsx  the wake the UFO leaves as it dissolves
    Planet.jsx        one procedural planet: fbm surface + fresnel atmosphere
    ProjectPlanets.jsx  a planet per project, standing at a fixed place in the
                      world. The camera flies past them
    SkillSatellites.jsx  small glowing nodes on close elliptical orbits around
                      the character. Four draw calls for all five
    skillAtlas.js     every satellite label, baked into one CanvasTexture
    ContactBeam.jsx   the contact section's UFO and its cone of light, placed
                      every frame over two DOM boxes in ContactMe
    Astronaut.jsx     hero character (idle + dance clips)
    Ufo.jsx           the UFO the astronaut rides in on
  generated/handwriting.js  GENERATED - baked glyph outlines + centrelines
  components/
    ui/Handwriting.jsx  two-layer handwriting: filled text + centreline mask
    ui/handwritingGeometry.js  wordViewBox(): the box around one word, which is
                        how the navbar logo is a *crop* of the hero's line
                        rather than a second copy of the artwork
    ui/HandWriting.jsx  the "My Projects" title (older outline-stroke artwork)
    CanvasErrorBoundary.jsx  degrades a failed WebGL context instead of white-screening
    Loader.jsx        styled-components Suspense fallback
    ui/HandWriting.jsx, ui/SpaceCard.jsx
  state/heroMachine.js        the hero's state machine + useHeroState()
  hooks/useInView.js          latching IntersectionObserver. Currently unused:
                              its last caller was the contact panel's <View>
  hooks/useScrollProgress.js  the single scroll-progress source of truth,
                              and the site's only ScrollTrigger
  hooks/useAssetGate.js       holds the intro until the models are decoded
  hooks/useIntroSequence.js   the staged entrance, and every way out of it:
                              the bounded lock, Skip, Escape, reduced motion
  hooks/useScrollLock.js      position:fixed body lock, with the offset restored
  hooks/useHeroIntro.js       drives the two handwritten lines + WRITING_BUDGET
  hooks/useHandwriting.js     the shared left-to-right stroke sequencer
  hooks/useIntroScript.js     the click-through speech bubble
  hooks/useHeroScrollFx.js    hero DOM parallax + departure thresholds
  hooks/usePrefersReducedMotion.js
  styles/tokens.css           THE design tokens. Imported once, from App.jsx
  styles/site-nav.css         the header in its three states
  styles/hero-dialogue.css    the bubble, the hint and the talk control
  styles/skills-panel.css     the hero's skills panel, in its three widths
  styles/skills-reference.css the skills reference card and its flat section
  styles/contact.css          the contact composition: the UFO and beam boxes
                              the 3D reads, the stack, and the no-WebGL beam
  styles/*.css
```

Heavy assets live in `public/` and are referenced by absolute URL: the two
`.glb` models (`useGLTF('/character.glb')`, `useGLTF('/ufo.glb')`), the `.webp`
project shots, and `star.svg`. They are **not** bundled - do not import them
through Vite.

`public/` holds *build output*, not sources. The uncompressed model exports
live in `assets-src/` (tracked, never served) and are processed into `public/`
by `npm run assets`:

The UFO is the one asset with two source files. `ufo-raw.glb` is the untouched
Sketchfab export and is what you edit *from*; `ufo.glb` is the decimated
uncompressed export that `assets:ufo` consumes, and is itself generated — by
`assets:ufo:decimate`, whose parameters all live in `scripts/decimate-ufo.py`.
Do not hand-edit either one.

| script | does |
| --- | --- |
| `npm run assets` | all three steps below |
| `npm run assets:character` | merges the 3 character exports into `public/character.glb` |
| `npm run assets:ufo` | resizes UFO textures to 512, dedups/prunes and re-Dracos into `public/ufo.glb` |
| `npm run assets:ufo:decimate` | **needs Blender.** `assets-src/ufo-raw.glb` -> `assets-src/ufo.glb`; only when re-tuning UFO geometry |
| `npm run assets:images` | `assets-src/images/*.png` -> `public/*.webp` |
| `npm run assets:handwriting` | Caveat -> `src/generated/handwriting.js` |
| `npm run assets:screenshots` | `assets-src/images/*.png` -> `public/shots/*.{avif,webp}` |
| `npm run assets:inspect` | prints the glTF-Transform report for both models |

Never hand-edit anything in `public/` that a script generates - change the
script, or the source in `assets-src/`, and re-run.

The baked handwriting (`src/generated/handwriting.js`, ~29 kB gzipped) is in the
**entry** chunk, not the Hero chunk, because `SiteNav` is eager. That is the
right place for it now: it is the first thing painted, so putting it behind a
second round trip would delay the only content on screen.

`vite.config.js` hand-splits three long-cacheable vendor chunks
(`three-vendor`, `react-vendor`, `gsap-vendor`). If a library moves in or out
of `package.json`, keep `manualChunks` in sync or the build warns.

## Hard rules

These are project invariants. Breaking one is a bug even if the build passes.

### 0. data/projects.js is the source of truth for projects

Kind, period, title, tagline, highlights, link, tech list, screenshots, and the
planet's palette and noise seed all live in one array. The DOM panels, the hash
routes and the procedural planets all read from it. **Adding a project means
adding one entry and nothing else** — a panel, a planet, a leg of the flight
and a snap point appear on their own. Do not hard-code a project anywhere else.

**The copy is the CV's.** The seven entries are the CV's professional
experience and academic/personal projects, in the CV's order and in its words:
`kind` + `period` are its role/date line, `highlights` are its bullets
verbatim. The hero intro is its profile, the skills reference is its SKILLS
section, the contact details are its header. When the CV changes, the site
changes to match; it does not keep a second version of the story. ids are URLs
and never change with a title (the chess game is still `#project/chessiworld`).

The first entry's planet is the one seen from the hero and keeps the purple
palette and seed the hero composition was tuned around, whatever project it
belongs to.

Projects are a section on `/`, not a route.

**`#project/<id>` IS the open detail panel.** There is no separate boolean —
`state/projectDetail.js` derives everything from the hash, which makes a
project shareable and makes Back close the panel for free (opening pushes an
entry). `#projects` still means "the section", and scrolling to it is all it
does.

This reassigned the hash. It previously tracked scroll position, rewritten by
`ProjectsSection` as each panel passed; that had to stop, or scrolling would
pop a modal open. Arriving at `#project/<id>` still scrolls to the right panel,
it just also opens the detail — which is the more useful landing for a link you
send someone.

A 3D planet cannot hold DOM focus, so each panel carries an `#details-<id>`
button as the planet's keyboard-reachable stand-in. It is also the element
focus returns to when the panel closes. Any new way to open the panel should
pass an origin element to `openProject(id, origin)`.

### 1. ONE WebGL canvas for the whole site

Never add a second `<Canvas>`. Browsers cap live WebGL contexts (~8-16); every
extra context also costs its own render loop, its own GPU memory, and its own
`three` scene graph. Reuse the existing canvas and add a scene/group to it
instead of mounting a new one.

**How to add 3D.** The one canvas is `scene/SceneRoot.jsx`, mounted by `App`
and never torn down. Add a group to its root scene. There are no drei `<View>`s
any more (see below), and a new one would bring back the viewport and event
workarounds that were deleted with the last one.

If the 3D has to sit over a particular piece of a section, do what
`scene/ContactBeam.jsx` does: lay the composition out in CSS with empty,
`aria-hidden` boxes, and each frame read their `getBoundingClientRect()` and
place the object at a fixed depth in front of the camera. That is what a
`<View>` does internally, minus the scissor — and without the scissor, Bloom
reaches it. Gate the rect reads on the section's measured progress so a
section three screens away costs no layout reads.

The canvas is `position: fixed`, full-viewport, `z-index: 1`,
`pointer-events: none`. Those values are set through the Canvas `style` prop,
not the stylesheet - R3F writes `position: relative; width: 100%; height: 100%`
inline on its wrapper and inline styles win. See `styles/scene.css` for why
z-index 1 is the correct layer.

Events reach 3D objects through the shared app root, which `App` passes as
the canvas's `eventSource`. Interactive objects additionally take a `hitArea`
ref and ignore events whose target is not that element, so a click on
unrelated DOM cannot re-fire a stale raycast. **Any new clickable 3D object
needs that guard.**

**All 3D lives in the root scene.** The star field, the nebula, the hero's
character and UFO, the project planets and the contact UFO and beam share one
camera (`[4, 6, 23]`, **fov 42**) and one depth buffer. That is what makes the
hero departure possible at all: a scissor box cannot be left, so an object
inside one can never fly out of its section. It also means Bloom reaches all of
them, which it cannot do for anything inside a view.

The fov was 50. It dropped to 42 to cut the off-axis perspective distortion on
the UFO near the bottom of the frame — a wide fov shears anything away from
screen centre. **`HERO_DEPTH` (HeroScene.jsx, 23 → 27.94) and `VIEW_DIST`
(state/voyage.js, 34 → 41.3) both grew by the same ratio, `tan(25°)/tan(21°) ≈
1.2148`.** That exact ratio holds `depth × tan(fov/2)` — and therefore
`halfHeight`, every screen-fraction placement, and the apparent on-screen size
of the character, the UFO and the planets — unchanged. Narrower lens, camera
proportionally further from its subjects, identical framing. If the fov changes
again, both of those distances move with it by the same rule or the whole
composition drifts.

`CallMeView` was the last `<View>`, and it went with the contact rebuild along
with its character. `ViewportReset` and `ViewEventBridge` existed only for
views and were deleted with it. **`BackgroundPass` was not, and must not be**:
this file used to say all three could go together, and that was wrong — see
rule 9.

Placement in the root scene is expressed as a *fraction of the visible
half-extent* at a given depth (see `HERO_X_FRACTION`, `SETTLE_X`), not as raw
world coordinates, so compositions survive a resize.

> **Current state: satisfied.** One `<Canvas>`, one WebGL context (verified in
> a headless browser). `CanvasErrorBoundary` still wraps it so a machine
> without WebGL degrades instead of white-screening.

### 2. No `setTimeout`-based animation choreography

All sequencing is driven by explicit state-machine transitions or by GSAP
timelines / ScrollTrigger. `setTimeout` chains drift under load, cannot be
scrubbed, seeked, paused, or reversed, and leak when a component unmounts
mid-sequence. Use `gsap.timeline()` with position parameters, `delay`, and
`onComplete` - or a reducer with named states - not wall-clock guesses.

**What replaced the timers.** The hero used to run on 6000 / 8100 / 15400 /
700 / 2200 / 30000 ms setTimeouts that assumed the models had downloaded by
second eight. Now:

| was | is |
| --- | --- |
| 6000 ms → split the layout | the intro timeline's `onComplete` |
| 8100 ms → show the 3D | `isSettled(state)` |
| 15400 ms → show the bubble | same |
| 700 ms → blank between lines | one GSAP timeline (clear → beat → type) |
| 2200 ms → start the idle gesture | the fly-in tween's `onComplete` |
| 30000 ms → end the dance | `LoopRepeat` × 3 + the mixer's `finished` event |

> **Current state: satisfied.** Three `setTimeout`s remain, none of which
> sequences anything. Two are in `useAssetGate` — a minimum Loader display time
> so it cannot flash, and a failsafe so a 404'd model still yields a usable
> site. The third is `LOCK_CEILING_MS` in `useIntroSequence`: the hard bound on
> how long the entrance may hold the page still. In a healthy run it is cleared
> without ever firing, and nothing downstream reads it.
>
> That last one earns its place. The entrance advances on animation callbacks,
> and a callback is a promise, not a guarantee: a browser that throttles rAF in
> a backgrounded tab, or a frame rate low enough for GSAP's `lagSmoothing` to
> engage, stretches every timeline far past its authored duration. Measured
> here: under a software renderer at ~1 fps the 2.1s writing had not finished
> after six seconds, and the ceiling was the only thing that freed the page. Do
> not reintroduce wall-clock *choreography* — but a bounded escape from a
> sequence that can hold the visitor is not choreography, it is the promise
> that the sequence cannot trap anyone.

### 3. Scope every GSAP context, and never `killAll()`

Wrap component animations in `gsap.context()` (or `useGSAP` from `@gsap/react`)
scoped to a ref, and `revert()` it in the effect cleanup:

```jsx
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to('.thing', { x: 100, scrollTrigger: { trigger: '.thing' } });
  }, rootRef);          // selectors resolve inside rootRef only
  return () => ctx.revert();   // kills tweens AND their ScrollTriggers
}, []);
```

**Never call `ScrollTrigger.killAll()`.** It is global: it destroys triggers
owned by every other component on the page, not just yours. A component that
unmounts must only tear down what it created.

> **Current state: satisfied.** Nothing in `src/` calls `killAll()`; the
> `CallMe.jsx` that did is long gone. Every GSAP consumer scopes a
> `gsap.context()`. Under `?perf=1`, `window.__gsap()` lists every live
> ScrollTrigger and every tween with its targets, which is how "no orphans" is
> checked after removing a feature.

### 4. All animation must respect `prefers-reduced-motion`

Every motion path - CSS keyframes, GSAP timelines, `useFrame` loops, autoplaying
Lottie - needs a reduced-motion branch that lands on the final visual state
without the movement.

```css
@media (prefers-reduced-motion: reduce) { .stars { animation: none; } }
```

```js
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) { gsap.set(el, { x: 100 }); } else { gsap.to(el, { x: 100 }); }
```

**Reduced motion is a different path, not a faster one.** `usePrefersReducedMotion`
is live (no reload needed). When set, the entrance does not run at all: the
machine goes straight to `hero_ready`. **The page is never locked** — there is
no intro panel to hold it for, so `useScrollLock` is never engaged. The navbar
is already a navbar with the logo already cropped to "Nouri", the handwriting
renders fully written with the mask omitted entirely, the astronaut and UFO are
placed at their resting positions instead of flying in, the UFO's idle spin
stops, and `useHeroScrollFx` applies no transforms at all.

The welcome line would otherwise be lost with the intro panel, so the hero
renders it statically instead (`.hero-welcome-static`). Reduced motion must not
cost anyone a sentence of content.

> **Current state: satisfied.** The entrance, the hero, the 3D scene, the
> starfield, the voyage (not mounted — a flat stack instead) and the contact
> beam (held still: no bob, spin or ripple) all honour it. The two outstanding
> items this note used to list are gone from the code: nothing imports Lottie,
> and `CallMePose` was deleted with the contact rebuild.
>
> The character used to stay in the fixed canvas behind the whole page under
> reduced motion, because there was no departure to take it away. It is now
> cut at raw hero progress 0.5 — the departure's end state, without the
> movement.
>
> Verified under `--force-prefers-reduced-motion`: `document.body` never
> `position: fixed`, no `.voyage-track`, sections in order projects → skills →
> contact, two ScrollTriggers (no voyage), and the character absent from the
> projects, skills and contact frames and back on return to the top.

### 5. CSS custom properties live in one global file

Design tokens live in `src/styles/tokens.css`, imported once from `App.jsx`.
Never declare a `:root` block in a per-component stylesheet or inside a
styled-component: duplicated `:root` rules resolve by load order, which changes
with lazy-loading and code-splitting, so the same token can mean different
things on different routes.

> **Current state: satisfied.** The block used to sit in `hero.css`, and moving
> it was forced rather than tidy-minded: `SiteNav` is eager because it *is* the
> first paint, while `hero.css` arrives with the lazy `Hero` chunk — so the
> navbar would have rendered its opening frames with every `var()` unresolved.

Per-component CSS may *consume* tokens (`var(--color-primary)`) freely; it may
not *define* them.

**The typeface is a token too, for the same reason the colours are.** The site
is set in **Montserrat**, declared once as `--font-sans` in `tokens.css` and
applied once, to `body`, in `App.css`. No stylesheet and no styled-component
names the family — `SpaceCard.jsx` used to hardcode `font-family: Montserrat`
and that is exactly the second source of truth this rule exists to stop.
`--font-mono` is the other half: the small uppercase letterspaced labels
(eyebrows, the loading readout, project meta) are a distinct *role*, not a
competing body font, so they are tokenised rather than deleted.

It is **self-hosted** through `@fontsource/montserrat`, imported from `App.jsx`
as `latin-400/600/800.css` — the **latin subset specifically**, because the
unsuffixed entry points bundle cyrillic, cyrillic-ext, latin-ext and vietnamese
as well, which is five woff2 files per weight to render none of. Three files,
~19 kB each. `font-display: swap` comes from the package. Self-hosting over
Google Fonts buys no third-party connection on the critical path and no extra
DNS+TLS round trip before any text can swap in; the system stack behind it in
the token is what renders during the swap, so it is a real fallback.

**The handwritten name is not affected and must not be "converted".** It is
baked SVG outlines (rule 8), not text in a font, so no `font-family` reaches it
— which is what lets the intro morph keep working. Verified: 22 `<path>`, zero
`<text>`.

### 6. One scroll-progress source of truth

`hooks/useScrollProgress.js` owns **every** ScrollTrigger on the site. There
are three, and no component may create a fourth of its own:

| created by | trigger | does |
| --- | --- | --- |
| `useHeroScrollTrigger()` | `.hero` | measures only |
| `useVoyageScrollTrigger()` | `.voyage-track` | pins the voyage stage, scrubs the master timeline, snaps to panels |
| `useSectionProgress('journey')` | the contact panel | measures only, so the star field knows to fade |

The project panels used to add one pinned trigger **each**. Rule 20 is about
why that had to stop.

The hero's is created by `useHeroScrollTrigger()`, which `Hero` mounts once. It applies no motion itself —
it only measures, so it is created even under reduced motion, which keeps the
machine's departure threshold working.

It publishes two values because the original animations used two scrub settings
that look different:

- `hero` — scrub-smoothed (≈1s catch-up). The astronaut, UFO and spinning star.
- `heroRaw` — immediate. The text parallax, authored with `scrub: 0`.

Consumers build **paused** timelines and scrub them from these values:
`subscribeScroll()` for imperative consumers, `useScrollProgressRef()` inside
`useFrame`, `useScrollProgress()` only when DOM UI must re-render.

Sections other than the hero register through `useSectionProgress(id, ref)`,
which publishes to `scrollState.sections[id]`. The contact panel uses it. Same
contract: the trigger measures, consumers move.

The voyage is the one exception, and deliberately so: `useVoyageScrollTrigger()`
hands its ScrollTrigger an `animation`, because ScrollTrigger's `snap` has to
own the same playhead it is snapping (rule 20). It still publishes its progress
to `scrollState.voyage` like everything else.

The star field fades on `sections.journey`, **not** on hero progress — hero
progress reaches 1 before the projects section even begins, which would leave
the planets floating in an empty void.

Do not register another ScrollTrigger against `.hero`. Before this, `Astronaut`
and `Ufo` each had one, `Hero` had four more, and `CallMe` killed all of them
on unmount.

### 7. The hero runs on a state machine

`state/heroMachine.js` is a table-driven machine:

```
loading → intro_locked → navbar_morphing → character_entering → hero_ready
                                                    → exploring → departing → projects
```

Read it anywhere with `useHeroState()`. The predicates, not the raw string, are
what consumers should branch on: `isSettled` (past the entrance and usable),
`isScrollLocked`, `isIntroSequence`, `hasCharacter` (mount the 3D — one state
earlier than settled, because the character has to exist in order to fly in)
and `isNavbarLanded`.

**The entrance is staged, and each stage ends because the previous one finished.**

| stage | scroll | ends on |
| --- | --- | --- |
| `intro_locked` | **locked** | the handwriting timeline's `onComplete` |
| `navbar_morphing` | **locked** | the collapse timeline's `onComplete` |
| `character_entering` | free | the fly-in motion path's `onComplete` |
| `hero_ready` | free | — |

The lock lifts when the navbar *lands*, not when the character settles: there
is no reason to hold someone while a UFO finishes flying in behind them.

**The lock is bounded and every stage is escapable.** `LOCK_CEILING_MS` (6s)
releases the page whatever happens; `SKIP` and `FAILSAFE` are legal from every
stage of the sequence and all land on `hero_ready`. Because the table ignores
illegal events, a `CHARACTER_SETTLED` that arrives *after* the failsafe already
released the visitor is discarded rather than dragging them back — no call site
needs a guard for it.

**Timing budget.** Steps 1-4 must land inside five seconds. The three durations
that add up to it are named constants, not magic numbers scattered across
files: `WRITING_BUDGET` (2.1s, `useHeroIntro`), `MORPH_DURATION` (0.72s,
`useIntroSequence`) and `FLY_IN_DURATION` (1.8s, `Astronaut`, shared with
`Ufo` so the two land together). The writing's *authored* duration is whatever
the glyphs need — about eight seconds at a natural pace — so `useHandwriting`
measures the built timeline and `timeScale`s it to fit the budget. That keeps
the rhythm (overlaps, word pauses, per-stroke jitter) and changes only the
clock rate, and it does not silently drift the next time the copy changes.

Transitions fire on real causes only — an asset finishing, a GSAP `onComplete`,
a scroll threshold, a click. Illegal events are ignored by the table rather than
guarded at each call site, so a stray `SCROLL_AWAY` while still loading cannot
skip the intro. Add a state by extending `TRANSITIONS`, not by adding a boolean.

**Every entry path must stay escapable.** `.hero-skip` is rendered from the
first paint — above the loading overlay and the intro panel, and styled from
`site-nav.css` rather than the lazy `hero.css`, because an unstyled skip button
is not a skip button. Escape does the same thing. Both land on `hero_ready`
with the writing fully written, and the machine records that the entrance was
skipped so the speech bubble opens on its closing line: someone who asked to
skip the introduction did not ask for ten paragraphs to click through instead.

A deep link (`#project/<id>` or `#projects`) skips the entrance for the same
reason — holding someone at an intro they did not ask for, on the way to a page
they did, is indefensible.

If you add another gated sequence, give it the same three escapes: a visible
control, a key, and a bound.

### 8. Handwriting is a mask, never a stroked outline

The hero's two lines are written by hand, not typed. Two layers, both baked by
`npm run assets:handwriting` into `src/generated/handwriting.js`:

- **fill** — the text as filled Caveat outlines. Baked to paths, so no webfont
  is downloaded and there is no FOUT.
- **strokes** — one path per pen stroke along the *centreline* (medial axis) of
  each glyph, wide enough to cover the letterform, used as an SVG `<mask>`.

DrawSVG animates 0%->100% along the mask strokes, so the filled letter is
revealed in the direction a pen travels. **Do not stroke the letter outlines
directly** — that traces a wobbly border around each glyph and never reads as
writing. `ui/HandWriting.jsx` (the "My Projects" title) is the one remaining
outline-stroke component; it shares the sequencer but not the mask technique,
and would want regenerating through the pipeline to match.

**The navbar logo is the same `<path>`, seen through a smaller window.** When
the intro panel collapses, the handwritten name flies into the logo slot and
the svg's `viewBox` animates from the full line's box to the box around the
word "Nouri" (`wordViewBox` in `ui/handwritingGeometry.js`, measured
analytically from the stroke data so it also works under reduced motion, where
no mask is rendered to call `getBBox` on). Do not swap in a separate logo
element: the continuity between what was written and what stays on screen is
the entire point of the entrance.

The morph is a FLIP — measure the logo where the intro put it, let React render
the navbar layout, measure again, animate the difference — so it lands
correctly at any viewport width with no table of breakpoint offsets. Two things
about it are load-bearing:

- **Its cleanup lands, it never reverts.** `gsap.context().revert()` restores
  every tweened value to what it was *before* the timeline ran, including the
  viewBox via its `onUpdate`, so skipping mid-collapse put the full-viewport
  intro framing back on a logo already sitting in the navbar. `progress(1)`
  first, then `ctx.kill()`.
- **The box's height and its viewBox are tweened together, and the width is
  derived from both**, so the element's aspect always equals the viewBox's and
  `preserveAspectRatio="meet"` never has anything to letterbox. Tweening width
  independently letterboxes through the middle of the flight.

Sequencing lives in `hooks/useHandwriting.js` and is shared by both. Strokes run
**strictly in reading order, left to right** — the old title component paired
stroke `i` with `n-1-i` and grew the word inwards from both ends, which reads as
a wipe. Duration scales with each stroke's own length, jittered ±15%
deterministically per character, with a small overlap between strokes and a
longer beat at word boundaries. Ease is `power1.inOut`.

**Two traps worth knowing, both of which silently render *most* of the text:**

1. A `<mask>`'s region defaults to `-10%,-10%,120%,120%`, and under
   `maskUnits="userSpaceOnUse"` those percentages resolve against the viewport
   while ignoring the viewBox origin. The text sits above the baseline
   (y from about -169), so the default region clipped everything above y≈-21 and
   revealed only a horizontal band through each letter. Always set the mask's
   `x/y/width/height` from the viewBox.
2. `opentype.js`'s `toPathData` emits literal `NaN` tokens for a glyph
   translated past roughly x=700 — 206 of them in "Welcome to my portfolio!".
   resvg ignores them, so offline previews looked perfect, but a browser stops
   parsing a `d` at the first bad token: the line truncated to "Welcome t".
   The generator serialises glyph commands itself and offsets them numerically;
   it also throws if any non-finite coordinate reaches the output.

### 9. The whole frame is one draw, and `BackgroundPass` is load-bearing

Everything is in the root scene and is drawn full-canvas at
`BACKGROUND_PRIORITY` (1), by the bloom composer or, without it, by
`BackgroundPass`. `renderOrder.js` orders the rest around that: the camera
moves at 1/3, and `?perf=1` resets the renderer's counters before it and reads
them after.

This used to be a background pass followed by two scissored `<View>`s at 2 and
3 with `autoClear` off, plus a `ViewportReset` because drei's `<View>` never
restores the viewport it sets — the star field once drew every frame into an
off-screen box, and it looked exactly like "the stars are not rendering". Both
views are gone and so is the reset. Should a `<View>` ever come back, so does
that bug.

Bloom cannot simply be wrapped around a view: `<EffectComposer>` renders
full-canvas to its own targets, and scissoring it would clip the mip chain to
the wrong rect. It applies to the full-canvas background pass only, which is
also why the star field is faded out on hero scroll progress rather than
clipped — see `StarField`. The cream panel is raised to `z-index: 2` so it
occludes the stars in the DOM instead.

When bloom is off, `BackgroundPass` draws the scene instead:
`<EffectComposer enabled={false}>` drops its priority to 0, but r3f's automatic
render only runs when NO `useFrame` subscriber has a positive priority —
`VoyageCamera` holds 1/3 — so without it nothing would draw at all. That is
true with or without views, which is why deleting the last view did not free
this component.

### 10. The navbar is the intro panel, and scroll is locked by fixing the body

The header (`components/SiteNav.jsx`) is one element in three states — the
full-viewport intro panel, the collapsing transition, and the landed bar. It is
mounted **eagerly** by `App`, not lazily: it is the first paint.

**Lock the page by fixing the body, never by `preventDefault`.** `useScrollLock`
captures `scrollY`, sets `position: fixed` with a negative `top`, and restores
both on release. Cancelling `wheel` and `touchmove` instead is worse three ways:
it only blocks the two gestures you thought of (space, PageDown, arrows,
Home/End, find-in-page and a screen reader's own scrolling all still move the
document); those events are passive by default, so the handler is ignored with a
console warning unless every listener opts out, and it fights the scroller
rather than stopping it, which is what produces the iOS rubber-band stutter; and
it does nothing about programmatic scrolling.

Two consequences to keep:

- **`html { overflow-y: scroll }`** in `App.css` holds the scrollbar gutter open
  permanently. Without it, taking the body out of flow reflows the page by the
  scrollbar's width — and resizes the fixed WebGL canvas underneath it, for one
  frame, in the middle of the morph.
- **Release ends with `ScrollTrigger.refresh()`.** The document's height
  collapses while the body is fixed, so any measurement taken during the lock is
  wrong — and the project panels create their pins as their section mounts,
  which can happen mid-lock.

> **Current state: satisfied.** Verified in a headless browser: `scrollTo(800)`
> and PageDown both leave `scrollY` at 0 while locked; on release the body's
> inline `position`, `top` and `width` are all cleared, the offset is restored,
> `clientWidth` is unchanged across the transition (1425px either side), and
> three `.pin-spacer`s exist afterwards.

### 11. The character's dialogue is opt-in, and its gesture is hand-rolled

Nothing the character says plays on its own. It used to: ten paragraphs
auto-started on load and typed themselves out one character at a time through
GSAP's TextPlugin, at 2.2s a line. Two things were wrong with that — nobody
asked for it, and it buried the thing people came to look at. The character is
the subject of the hero; the text is a caption on it.

What replaced it:

- a hint near the character (`Want to talk? Click me twice.`) that fades in
  after **2s of inactivity** — the timer restarts on any input, so it waits for
  a gap rather than talking over someone mid-scroll — and is gone for good once
  the dialogue has been opened even once
- **double-tap** the character to open, one short line at a time, click or tap
  to advance, a visible close control, and a ~250ms fade-and-rise reveal. No
  per-character typing.
- copy lives in `data/dialogue.js`: four or five short lines, never ten

**`onDoubleClick` is not an option, so the taps are counted by hand.** R3F
forwards the browser's `dblclick`, which is never synthesised for touch — on a
phone the gesture simply would not exist. `scene/Astronaut.jsx` counts taps
itself inside a 300ms window. Three details are load-bearing:

1. **Classify by `event.timeStamp`, not by when the handler ran.** A 400ms
   frame delivers both taps of a genuinely fast double-tap late, and measuring
   from handler entry reads them as two singles. `timeStamp` is when the input
   happened, so the gesture survives a stuttering frame rate — which a heavy 3D
   hero is perfectly capable of producing.
2. **`body { touch-action: manipulation }`** (App.css). Without it the browser
   reserves double-tap for zoom and either delays the second click ~300ms or
   swallows it, which is enough on its own to break the gesture.
3. **A generous invisible target.** An untextured sphere at 1.35x the model's
   own bounding sphere, sized from `Box3.setFromObject` so it survives a
   re-export, and parented to the character so it follows the arrival flight
   and the departure with nothing to keep in step. Being generous, it is also
   imprecise — about twice the character's height — so it **yields to anything
   marked `userData.precisePick`** (rule 19) and must not be used to measure
   the character's own size. It is `opacity: 0`, **not**
   `visible={false}` — an invisible object is skipped by the raycaster, which
   is the one thing it exists to be hit by. It carries
   `userData.hitProxy` so `HeroScene.ownMaterials()` skips it; fading it with
   the rest of the character would paint a black sphere over the hero.

Single tap still toggles the dance, which is why the single action waits out the
300ms window before firing. That `setTimeout` is not choreography (rule 2): it
measures a gesture the visitor is making, not the progress of an animation.

**The head is not steered. It does whatever the clip does.** There was a
cursor head-tracking feature here — a clamped yaw/pitch offset multiplied onto
the animated `Head` / `Neck` quaternions every frame — and it was removed
wholesale: the `useFrame`, the window `pointermove` listener, the NDC
conversion, the touch and reduced-motion gates that existed only to switch it
off, and the `?headtrack=1` override. Do not reintroduce it piecemeal.

What replaced it is one constant. **`FACING_YAW` in `Astronaut.jsx` turns the
model to face the camera** instead of standing square to the world axes. The
model's bind pose faces +Z and the camera does not sit on that axis — it is at
`(4, 6, 23)` looking down -Z while the character lands at the arrival path's
local x, a good eight world units to the right of the camera's line — so
unrotated it looks past the camera's shoulder. The correction is
`atan2(camX - charX, camZ - charZ)`, and it is a **constant, not a per-frame
`lookAt`**: `halfHeight` is pinned by `HERO_DEPTH` and the fov, so only the much
smaller `HERO_X_FRACTION * halfWidth` term moves with aspect, and across 390px
to 1440px the angle spans 16.0° to 18.2°. Under two degrees is well inside what
the idle clip's own body rotation swings it by, so tracking it live would spend
a `useFrame` to buy nothing anyone can see.

Note it is set on the `<primitive>`'s `rotation` and nothing else writes it —
GSAP's arrival and the departure both animate `position` and `scale` only — so
it survives the flight without being re-applied.

One thing worth keeping from the removed feature: **removing a `useFrame`
changes r3f's subscription order**, and this scene's rendering depends on that
order (`BackgroundPass` and the `EffectComposer` at `BACKGROUND_PRIORITY`, the
views above them). Verified after the removal, on the built app: 49 draw calls,
103,505 triangles, 15,945 star points, bloom accounting for 19 of those calls
against `?bloom=0`, and all three clips playing.

**Click-only is not accessible, so there is a real control.** `.hero-talk` is a
focusable button positioned over the character, opening the same bubble on
Enter or Space, with Escape to close and focus returned to it afterwards. It is
visible while the hint is up and whenever it is focused, and stays focusable
after the hint fades — the affordance outlives its label. On the no-WebGL tier
there is no character to tap, so the label is permanent: it is the only
affordance there is.

**The bubble is DOM, never 3D text.** Drei's `<Text>` would be a picture of
words — unselectable, invisible to a screen reader, unsearchable, and blurry at
readable sizes. A `<p>` is all of those things for free.

> **Current state: satisfied.** Verified in a headless browser: nothing opens on
> load, a single click does not open it, mouse double-click and touch double-tap
> both do, Tab reaches the control with a visible ring, Enter opens, Escape
> closes and returns focus, and the reveal is a 250ms animation rather than a
> typing timeline.

### 12. The gallery costs nothing until it is opened

The screenshot gallery is behind `React.lazy` + `Suspense`, so its component,
its stylesheet and the screenshot manifest are a separate chunk fetched only
when someone presses "Screenshots".

**Never `import` a screenshot.** They are referenced by URL from
`public/shots/`, built by `npm run assets:screenshots` from the PNGs in
`assets-src/images/`. The moment one is imported it enters the module graph and
ships in a bundle. Verified after each build: `/shots/` appears only in the
gallery chunk, and the entry chunk references no image extension at all.

Each screenshot ships as AVIF + WebP at up to three widths, clamped so nothing
upscales (`edu` is only 600px wide, so it gets 480 and 600). `srcSet` + `sizes`
let the browser fetch exactly one file — a 1600px viewport pulls
`chess-960.avif` and nothing else. `width`/`height` plus a CSS `aspect-ratio`
frame reserve the box, so the grid never reflows as images decode.

The placeholder is a CSS skeleton, not a blurred base64 LQIP: an LQIP has to
live in a JS module, which would put image bytes back in a bundle.

**The lightbox is portalled to `<body>`.** The detail panel animates in with a
transform and `animation-fill-mode: both`, so it keeps a transform after the
animation ends and becomes the containing block for any `position: fixed`
descendant — rendered in place, the "full-screen" lightbox was clipped to the
panel's box.

Escape is layered: the lightbox listens on the **capture** phase and stops
propagation, so while it is up the panel's own Escape handler never runs. Do
not add a "is the gallery showing" guard to the panel instead — that swallowed
Escape for the whole panel once the grid had been opened.

### 13. The sky is a dithered WebGL gradient, and the atmosphere is one pass

The background is a vertical ramp — near-black violet overhead, easing into the
site's `#051443` navy, with a warm lift hugging the bottom edge as if something
were lit below the horizon. `scene/BackgroundGradient.jsx`.

**It is WebGL, not CSS, and that is not a stylistic preference.** A CSS
gradient behind the canvas sits outside the composer, so bloom and the
atmosphere cannot touch it; and the browser gives you no way to dither it. A
large flat ramp is the worst case for 8-bit output — this one crosses about
twenty quantisation steps over the height of the viewport, which is a visible
Mach band every fifty pixels.

**The dither is the difference between "cheap gradient" and "clean".** Each
pixel is offset by up to half an output step before the hardware rounds, which
turns the hard edge of every band into noise the eye integrates away. Measured
on a sky column: **longest identical run 16px without it, 2px with it**, and
the per-pixel change rate goes from 0.16 to 0.99.

Two things about that dither are easy to get wrong and were both got wrong first:

1. **A custom `ShaderMaterial` does not get three's output colour-space
   conversion.** three appends it for its own materials; a hand-written
   fragment shader has to `#include <colorspace_fragment>`. Without it the
   shader's linear values are written out as though they were already sRGB and
   the whole ramp renders about three times too dark — `#0a0518` came out as
   `rgb(1, 0, 3)`. It is also what keeps the shader correct in both render
   paths: the conversion three generates is derived from whatever target is
   bound, so it encodes to sRGB drawing straight to the canvas and is the
   identity drawing into the composer's linear buffer.
2. **The dither amplitude has to be measured in the space the output is
   quantised in.** The shader writes linear; sRGB is steepest in the darks,
   which is exactly where a space gradient lives. `outputStep` in `dither.js`
   scales by the local slope of the transfer function — *including its linear
   toe below 0.0031308*, which the top of this ramp sits in. Using the power
   law there overestimates the slope about two to one and leaves the dither
   half as strong precisely where banding is worst.

It renders as a full-screen quad in clip space — no camera maths to keep in
step and nothing that can move it out of frame — with `depthTest` and
`depthWrite` both off and `renderOrder` -100, so it draws before the nebula
(-1) and the nebula composites over it untouched.

**The atmosphere is vignette + edge-only chromatic aberration + film grain**
(`scene/Atmosphere.jsx`), all three below the threshold of conscious notice: the
test is that turning them off makes the frame look slightly worse without your
being able to say why.

- the aberration uses `radialModulation`, so the middle of the frame — where
  everything worth reading sits — is untouched. Un-modulated, this offset puts
  a colour halo on every letter in the navbar.
- the grain is the **same noise function** as the gradient's dither, with a time
  offset and a larger amplitude. Two different noise characters over one image
  read as two artefacts; one reads as the grain of the medium. Under reduced
  motion the pattern is frozen rather than dropped.

**They do not cost the same, and the difference is structural.**
postprocessing merges effects into a single `EffectPass` and compiles them into
one shader — but only effects that do not need to sample their input at
arbitrary offsets. Chromatic aberration does by definition, so it declares
`EffectAttribute.CONVOLUTION` and gets a dedicated pass of its own. The
vignette and the grain ride inside the bloom pass that is already running; the
aberration adds a whole second full-screen pass. `?atmos=vg` keeps the first
two and drops the third, which is the setting to reach for on a device that is
short of frame time.

Measured at 1280x800 (1.02 MP) on a software renderer, median of 55 frames —
absolute numbers are meaningless off a GPU, the *proportions* are the point:

| pass | delta | per megapixel |
| --- | --- | --- |
| bloom (mipmapped) | +140.3 ms | 137 ms/MP |
| vignette + grain (merged into the bloom pass) | +33.3 ms | 33 ms/MP |
| chromatic aberration (its own pass) | +575.5 ms | 562 ms/MP |
| **atmosphere total** | **+608.8 ms** | **595 ms/MP** |

So 95% of the atmosphere's cost is one effect, and that effect is the one you
can least see — 2/255 of channel shift at the extreme frame edge. It is kept
because it is asked for and because it is gated to the top tier, but it is the
first thing to cut, and `?atmos=vg` is how.

The atmosphere cannot exist without the composer at all: with bloom off,
`BackgroundPass` draws the scene directly and there is nowhere to hang a
screen-space effect. Both are gated on the same `capable` tier, so they are
demoted together by the PerformanceMonitor.

Overrides: `?atmos=0|1|vg`, `?dither=0|1`. The second is worth keeping — "it
bands without this" is a claim that should be checkable on the machine in front
of you rather than taken on trust from a commit message.

**Do not touch the nebula to make room for this.** It was tuned separately and
works; the gradient was adjusted to sit under it, not the other way round.

### 14. The planets are not the bottleneck — do not bake them

A recurring proposal is to bake each planet's fbm surface into an offscreen
equirectangular texture at load, so rotation becomes a transform instead of
shader work. It was measured, and it does not help. Keep the live shader.

Measured at 1280x800 on a software renderer (no GPU on the dev machine, so
these are ratios and shares, never GPU absolutes), 3 interleaved repetitions,
compared as **paired within-rep differences** because the between-rep drift on
an identical configuration was 51 ms:

| change | per-rep deltas | median | verdict |
| --- | --- | --- | --- |
| 3 planets vs none | +19.3, +66.6, +31.3 | **+31.3 ms (6.2%)** | real |
| planet area x9 (one planet, x3 radius) | +35.6, +67.7, +23.5 | **+35.6 ms** | real |
| 4 octaves vs 3 | -2.6, -1.2, -13.9 | -2.6 ms | **no effect** |
| 4 octaves vs 2 | -6.3, -20.8, -11.7 | -11.7 ms | **no effect** |

The paired-noise floor, taken from the octave controls, is +/-20.8 ms.

**The conclusion is in the last two rows.** Halving the octave count — which is
the entire thing a baked texture removes — does not make the frame faster. The
planets' cost scales with the *area they cover*, not with the noise maths
inside them: it is per-fragment overhead and per-draw setup. A bake would
remove the one component measured at zero and keep every component that costs,
while adding three render targets, an equirect projection to keep in sync with
the sphere's uv layout, and a load-time step.

The rest of the usual list fails for the same reason:

- **InstancedMesh**: saves 2 draw calls out of 27. Per-planet fixed cost is
  real but small, and only worth revisiting if the planet count grows by an
  order of magnitude.
- **Segment LOD**: 2,976 triangles per planet against 714,378 drawn per frame —
  0.4%. Reducing it buys nothing and risks a visibly faceted silhouette.
- **Shader pre-warm**: the planet program's link stall is **0.3 ms**, in line
  with the other 16 programs (0.2-3.4 ms). There is a ~850 ms frame spike when
  the projects section is first scrolled into view, but it is *not* the
  planets — removing them entirely (`?planets=0`) made it slightly worse.

**Where the geometry actually is.** `window.__dump()` under `?perf=1`:

| object | triangles |
| --- | --- |
| UFO (5 meshes) | 324,507 -> **17,167** |
| character (avaturn_*) | ~32,000 |
| all three planets | 8,928 |

The UFO *was* 36x all three planets combined, for a prop that renders about
120 px wide — ~11 triangles per rendered pixel, and ~90% of every triangle in
the frame. It is now 17,167 triangles and 8.51 MB of VRAM (was ~50 MB), which
puts it below the character it flies in with. The reduction is 20% free (hidden
interior geometry and welded doubles that no view angle could ever see) and 80%
Decimate; the silhouette differs in 4 of 14,400 pixels at 120 px. See
`scripts/decimate-ufo.py` for every parameter and why it has the value it has.

The method matters more than the numbers: **judge a prop at the size it
renders, not zoomed in.** Decimation that looks brutal at full zoom was
invisible at 120 px, and the variants rejected here were rejected on a 120 px
render and an alpha-channel silhouette diff, not on how they looked in the
viewport.

**One change did come out of the measurement**: the planets were
`transparent: true` at all times, which costs a blend per fragment and forfeits
early-z for an alpha that is 1 for most of the time a planet is on screen. They
now blend only while actually fading (`transparent={opacity < 0.98}`). It is
the right thing to do — the measured cost lives in per-fragment work — but be
honest about it: the improvement (+31.3 -> +28.0 ms for three planets) is
inside the noise floor and cannot be claimed as a win.

> **Note on method.** The first pass at these numbers was wrong, and wrong in a
> way worth recording: the measurement harness killed only the browser's parent
> process, so every run leaked its renderer children. Thirty-odd live Chrome
> processes later the machine was at load average 29 and frame times had
> doubled. Any harness that launches browsers must kill the process *group*
> (`spawn(..., { detached: true })` then `process.kill(-pid)`), and any
> measurement run should record the machine load it ran under.

### 15. The departure is scrubbed, never triggered

The UFO's exit is a paused GSAP timeline whose `progress()` is driven straight
off scroll progress. That is the only reason it reverses exactly on scroll-up.
Never rebuild it with `toggleActions` or a play-on-enter trigger.

It combines four things on one timeline: a curved motionPath receding into -Z,
a scale-down, an opacity fade, and an emissive ramp toward starlight. The
emissive ramp is why the craft gets *brighter* before it disappears — it should
read as absorbed into the star field, not merely shrinking.

`HeroScene.ownMaterials()` clones the character's and UFO's materials before
fading them, and assigns the clones onto the **cached** GLTF scene. So anything
else built from `ufo.glb` must take its materials from `gltf.materials` (the
map captured at load, before anyone touched them) rather than cloning whatever
is on the scene — `ContactBeam` does exactly this. A plain `scene.clone()` taken
after the departure shares the faded clones and renders invisible.

**The departure is the character's last appearance.** It used to fade back in
during the projects voyage and travel beside the planets; it does not any more.
Once the voyage has started the timeline is held at 1, so a smoothed hero
progress still climbing from 0 — a deep link, or a fast flick — cannot replay
it in front of a planet. At fade 0 the whole `inner` group is `visible = false`:
fully transparent is not gone, and the tap proxy would stay hittable. Under
reduced motion there is no departure to scrub, so it is cut at raw hero
progress 0.5 instead — the end state, without the movement.

`DepartureTrail`'s curve must stay in step with that motionPath; the particles
ride the same path, lagged, which is what keeps the trail reversible with no
state to unwind.

### 16. The star field is quality-gated, and reduced motion holds it still

Three layers (4000 far / 1500 mid / 400 near), one draw call each, differential
rotation for parallax. Per-star size (power law), colour (stellar temperature
ramp) and twinkle phase are vertex attributes; the round glow is a procedural
CanvasTexture, additive, `depthWrite` off. **Do not add a sprite image asset** —
the texture is generated.

Quality steps down on `(max-width: 820px), (pointer: coarse)` or a
PerformanceMonitor decline: counts drop to 40%. **Bloom and the nebula no
longer go with them** — see rule 18 for why that grouping was a bug.

**Thinning is a draw-range change, never a rebuild.** Each layer's geometry is
built once at its full count and `setDrawRange(0, count * thin)` selects a
prefix. The generator is a seeded LCG walked once per star, so the first N are
an independent sample of the same shell rather than a biased corner of it, and
the result is pixel-identical to a rebuilt geometry. Rebuilding was actively
harmful: reallocating four Float32Arrays for ~16k stars stalls a frame, that
stall is itself a frame-rate drop, and the drop is what the quality switch was
reacting to.

**`gl_PointSize` is clamped, and the depth divisor is floored.** Both matter:

- `-mvPosition.z` is unbounded below, so a star crossing the camera plane sends
  the size to infinity and every driver clamps it somewhere different.
- the near layer used to run `sizeMax` 7 on a radius-24 shell whose inner edge
  sits ~17 units out: `320/17.3 * 7` is ~129 CSS px, ~259 device px at dpr 2 —
  one additive sprite over a large part of the viewport, then fed through
  bloom. A few of those is enough fill to trip the performance monitor, which
  is how the star field got the blame for a flicker it was not causing.

The near layer is now `sizeMax` 3 on radius 32, and the shader clamps to 48 CSS
px whatever the maths says. The depth cue here is differential rotation, not
size, so none of that is visible.

**Twinkle is scintillation, not breathing.** `rate` is hashed off `aPhase`
rather than derived from it — sharing one attribute between "where in the
cycle" and "how fast" correlated the two, so stars at similar phases also
pulsed at similar speeds and the field organised itself into bands. 5–12 Hz,
and the swing is damped on large stars, which are the ones the eye tracks.

Bloom is no longer the dominant cost in that group. Measured on a software
renderer at 1280x800, the atmosphere's chromatic aberration costs about four
times what the mipmapped bloom does (562 vs 137 ms/megapixel) — bloom does most
of its work on small mip levels, while the aberration is a full-resolution pass
of its own. If you are cutting one thing, cut `?atmos=vg` before you cut bloom.

Under reduced motion the sky is completely still — no rotation, no twinkle,
no nebula drift.

Overrides for measuring, read once from the query string:

| flag | does |
| --- | --- |
| `?perf=1` | fps overlay, plus `window.__glinfo` (draw calls, triangles, programs) and `window.__dump()` (triangle ownership per object) |
| `?stars=low\|high` | force the star count tier |
| `?bloom=0\|1` | force the bloom pass |
| `?atmos=0\|1\|vg` | atmosphere; `vg` drops the chromatic aberration |
| `?dither=0\|1` | the background gradient's dither |
| `?tier=low\|medium\|high` | device tier |
| `?planets=0..3` | force exactly N planets on screen, parked and opaque |
| `?planetscale=<f>` | multiply planet radius; isolates fill from per-object cost |
| `?skills=0\|1` | the hero's orbiting skill satellites |
| `?skillscale=<f>` | multiply satellite size without moving the orbits |
| `?snap=0` | projects voyage: scrubbed timeline on, panel snapping off |
| `?octaves=<n>` | fbm octaves in the planet surface shader |
| `?intro=stall` | suppress the writing's completion dispatch, so the entrance hangs at step 1 and the bounded lock has to release it (rule 7) |

The planet ones exist because only one planet is ever visible during normal
scrolling, so "three at once" cannot be measured without forcing it.

### 17. DPR is capped and adaptive

The canvas runs `<PerformanceMonitor>` (drops DPR from 2 to 1 once, and never
raises it again — see rule 18) plus `<AdaptiveDpr pixelated />` (drops
resolution during momentary stalls and restores it when idle, which is
idle-driven and so cannot oscillate with frame rate). Never set a fixed `dpr`
above 2 - the UFO and character are already the heaviest thing on the page.

`preserveDrawingBuffer` is **off**. Nothing reads the canvas back; turning it on
forces a full-buffer copy every frame. Only re-enable it alongside an actual
`toDataURL`/screenshot feature.

### 18. Adaptive quality is a one-way ratchet, and bloom is not the knob

`<PerformanceMonitor>` may only ever make the scene cheaper. `onDecline` sets a
`degraded` ref once and drops DPR and the runtime tier; `onIncline` is empty,
and is written out rather than omitted so the absence of a recovery path reads
as a decision.

**Symmetric adaptation is a feedback loop by construction.** It used to be
`onIncline: high, onDecline: low`, feeding one `capable` boolean that gated
bloom, the atmosphere, the nebula and the star counts together. So: bloom on →
frame time up → decline → bloom off → frame time down → incline → bloom on, on
a two-to-six second cycle, with the whole sky stepping between glowing and flat
each time. There is no threshold that fixes that. The two states genuinely have
different frame times — that is the entire reason for switching between them —
so the fix is not a better threshold, it is refusing to go back.

**What may be switched at runtime is ranked by cost over visibility.** Measured
in draw calls at 1280x800:

| pass | calls | runtime knob? |
| --- | --- | --- |
| bloom | 17 | **no** — decided once, from capability |
| chromatic aberration | 2 | yes, and it is the first to go |
| vignette + grain | 0 (merged into the bloom pass) | n/a |
| nebula | 1 | no — a full-screen fbm plane vanishing is a visible cut |
| star counts | 0 (draw range) | yes |
| DPR | 0 | yes |

The aberration is the right knob for the same reason rule 13 gives: it is 562
ms/MP against bloom's 137, for 2/255 of channel shift at the extreme frame
edge. It is the most expensive thing on the page and the least visible. Bloom
is the opposite on both counts, which is exactly what disqualifies it — an
automatic knob must not be the loudest one available.

Two things decide quality, and keeping them apart is the point.
`startupCapable` is a **capability** answer (the device probe plus the handheld
media query); both only change when a person does something, so neither can
enter a loop with the frame rate. `runtimeTier` is an **observation**, and it
ratchets.

> **Current state: satisfied.** Verified in a headless browser on a software
> renderer — slow enough that the monitor genuinely declines. Over 65 s the
> scene showed one DPR step (2560 → 1280 px buffer, from `AdaptiveDpr`, which
> is idle-driven and cannot oscillate with frame rate) and one ratchet firing:
> 48 → 45 draw calls, stars 15,945 → 6,381. Bloom costs 17 calls, so the count
> never approaching 29 is the proof it stayed on throughout. No further change
> in the remaining 30 s.

Also: `?stars=low` no longer takes the nebula with it. The override is
documented as forcing the star-count tier, and anyone measuring the star
field's cost with it was measuring a full-screen fbm plane too.

### 19. Skills are satellites; projects are planets. Never the same vocabulary

The projects section teaches the visitor what a planet means — large, distant,
fully shaded, one per project, something you travel toward. If the hero used
the same shape for skills they would read as three more projects. Every axis is
deliberately opposite:

| | project planet | skill satellite |
| --- | --- | --- |
| size | 0.34 of the viewport | 0.045 of the character |
| distance | 26–78 units, receding | inside the character's own reach |
| surface | domain-warped fbm, four colours, fresnel atmosphere | flat-shaded facets, one colour, a rim and a halo |
| behaviour | drifts in on section progress and parks | orbits continuously, crossing in front and behind |
| on screen | one | five |

**The size relation is structural, not tuned.** `CORE_RADIUS` and every orbit
radius in `data/skills.js` are fractions of the character's *measured* height,
so a satellite cannot become larger than the character whatever the model is
re-exported at. Measure with the character's tap proxy excluded — it is
`userData.hitProxy`, 1.35x the arm-span bounding sphere, and including it made
the measured "height" 18.4 units against the figure's real 9.4, which is how
the first version came out at twice its intended size and read as planets.

**Depth is the effect.** The satellites are in the shared root scene, in the
same depth buffer as the character, so behind and in front are resolved by the
z-buffer rather than a painter's trick. Orbits are inclined and their planes
rotated so each genuinely crosses the character's depth twice a revolution. One
that only ever drew on top would read as a decal.

**The DOM panel is the content; the satellites are decoration.**
`components/SkillsPanel.jsx` carries every word, and a device with no WebGL
loses only the animation. That is what makes a *picture* of words acceptable
here when rule 11 forbids it for the speech bubble — a baked label atlas is
fine precisely because it is not the only copy.

**Labels are one baked atlas, not `<Html>` and not drei `<Text>`.** `<Html>`
would position five DOM nodes from the render loop and composite them outside
the depth buffer, so a label would sit on top of the character it is meant to
be orbiting behind. drei's `<Text>` is troika, which fetches Roboto from a CDN
unless a font file ships. The site does self-host Montserrat now (rule 5),
but adding a troika dependency on a CDN-fetched Roboto is a different thing
entirely, and the atlas is still the right call for the reasons above.
`scene/skillAtlas.js` draws them into one CanvasTexture, the same way
`starSprite.js` generates its sprite. Glyphs are stroked navy then filled
white, so alpha carries coverage and red selects outline-vs-fill — which is
what lets one texture be tinted per satellite at runtime.

Five satellites x three parts would be fifteen draw calls; it is four —
instanced cores, one `Points` of halos sharing the star sprite, one mesh of
five billboarded label quads, and one invisible instanced hit proxy. The label
quads are sorted back-to-front by rewriting thirty indices a frame, because a
single draw call cannot be sorted by the renderer.

**Two pointer traps, both load-bearing:**

1. **The character's tap proxy swallows them.** It is 1.35x an arm-span
   bounding sphere — a bubble about twice the character's height — and the
   satellites orbit *inside* it, so it is always the nearer hit. Objects that
   want precision mark themselves `userData.precisePick`, and `Astronaut`
   yields to any event that also hit one. Precision beats generosity.
2. **`stopPropagation()` in a hover handler is a latch, not a filter.** r3f
   books the hovered object *and the event it stopped with* into
   `internal.hovered`, then replays that flag on the next pointermove
   (`else if (hoveredItem.stopped) data.stopPropagation()`). One stop made
   while the pointer was over empty space went on suppressing every later move,
   including the ones that did land on a satellite. Discrete events may stop;
   hover may not.

The highlight is bidirectional and goes through `state/skills.js`, a module
store for the same reason `state/dialogue.js` is one: the two halves sit on
opposite sides of the tree. Hover is transient, a press **pins** — which is the
only route a touch screen (no hover) or a keyboard (no pointer) has, and the
reason each panel row is a real button rather than a decorated `<li>`.

**What carries the colour link is load-bearing, and it is no longer a dot.**
The panel used to put a small coloured disc before each heading and draw a
filled, rounded, bordered box around the active row. Both are gone — the panel
is flat and square throughout, with **no `border-radius` on any element in it**
(verified computed, not asserted). Deleting them would have silently killed the
correspondence with the satellites, so it moved rather than going with them:

- a **solid 3px left rule** in the skill's colour, declared at full width and
  merely *transparent* at rest — added-on-hover would reflow the text sideways
  every time the pointer crossed a row
- the **heading tinted to that same colour** when active, lifted 18% toward
  white. Not decoration: `#9b40fc` on the navy scrim is 3.8:1, which passes only
  because the heading is large and bold, and the lift takes it to 5.0:1 —
  ordinary-body-text AA with the hue untouched. It also matches the scene
  better, since the satellites are bloomed and read brighter than their swatch.

Spacing, not boxes, separates the rows now — it has to, five 21px/800 headings
with nothing between them read as one paragraph.

**The type is sized for a primary column, and that makes height the constraint.**
Headings 21px/800, blurbs 15.5px, intro 17.5px puts the panel at **856px tall**
with the CV's profile as the intro (it was 748px with the shorter one before),
which only fits a 1080p screen. Two things follow, both measured rather than
guessed: it is centred in the space **below the navbar**
(`top: calc(50% + var(--nav-h) / 2)`) rather than in the hero as a whole, and
two short-viewport tiers trim **spacing, never the type sizes** — ≤960px tall
drops the note and tightens the gaps (856 → 716px at 1440x900), ≤780px tall
also drops the blurbs. Both thresholds moved up (from 860 and 660) when the
intro became the CV's profile: at 1440x900 the old ones left the headline under
the navbar. Checked clear of the navbar and the fold at 1920x1080, 1440x900,
1366x768, 1280x800, 1280x720, 1024x768, 820x1180, 390x844 and 360x740.

**Measured cost.** 1280x800 CSS at dpr 2 (2560x1426 = 3.65 MP), software
renderer, reduced motion, 40 frames per arm, 5 interleaved reps, compared as
paired within-rep differences. Every rep also measured an **off-vs-off control
pair**, because a delta means nothing without knowing what two measurements of
the same configuration differ by:

| arm | median paired delta | share of a ~588 ms frame |
| --- | --- | --- |
| satellites on vs off | **+6.3 ms** (range 0.4 .. 9.5) | **+1.1%** |
| control: off vs off | 2.6 ms (range -4.5 .. 3.2 after rep 1) | — |
| `?skillscale=4` — 16x the covered area | +14.2 ms (range 6.8 .. 17.5) | +2.4% |

**The last row is the interesting one, and it is the opposite of the planets.**
Sixteen times the fill roughly *doubles* the cost rather than multiplying it.
Solving `F + A = 6.3`, `F + 16A = 14.2` puts ~5.8 ms in fixed per-object and
per-draw-call overhead and ~0.5 ms in fill — so about **92% of what the
satellites cost is fixed, and 8% is the pixels they cover.** Rule 14 found
exactly the reverse for the planets, whose cost tracked area and not the noise
maths inside them. The difference is size: a planet is a third of the viewport,
a satellite is thirty pixels.

Which means the lever here is the *number of objects*, not their size or their
shaders — and it is why all five share four draw calls rather than fifteen. A
sixth skill is nearly free; a sixth fixture would not be.

For scale, rule 14 reports three project planets at +6.2% of a frame. Five
satellites are +1.1%.

Under reduced motion the orbits never advance, so the five `phase` values *are*
the composition. They were solved for, not eyeballed: maximise the smallest
distance between the five **projected** positions, keep every node and label
off the character's silhouette, and require at least two satellites in front of
the character's plane and two behind, so the still shows the depth the motion
exists to show.


**The skills reference is a third thing, and neither of these.** Between the
projects and contact there is a grouped, scannable list
(`components/SkillsReference.jsx`, data in `SKILL_GROUPS`). It is an inventory,
not a narrative: no colours, no orbits, no hover, no pinning. It must not grow
the satellites' interaction — the hero panel already is that, and a second copy
of it would make the reference something to play with instead of something to
scan.

### 20. The projects section is one continuous flight, not N pinned panels

Each project used to be its own pinned ScrollTrigger with a self-contained
enter and exit. Those triggers are sequential by construction — panel B's
cannot start until panel A's has ended — so planet A finished leaving before
planet B was allowed to begin arriving.

**Measured on that build, at 1280x800:** panel 1's pin ran y=713..2139, and
there was a **360 px range of scroll, y≈1839..2199, with no planet drawn at
all** — half a viewport of empty sky at every boundary. It began at panel A's
progress 0.79 (its `OUT_START` of 0.76) and ended at panel B's progress 0.06
(its `smooth(0.02, 0.2, p)` fade-in). No amount of retuning those two numbers
fixes it, because the two panels never own the scroll at the same time.

**The fix is a different model of the scene, not better fade timing.** The
planets stand at fixed world positions on one axis and the camera flies down it
(`state/voyage.js`, `VoyageCamera` in SceneRoot). Overlap stops being something
to schedule and becomes something that cannot fail to happen: the next world is
already ahead of you while the last is still going past your shoulder, because
that is what moving through a place means.

Consequences worth knowing:

- **The planets are no longer parented to the camera.** They were, and that is
  precisely what forced each one to be driven by its own panel's progress —
  parented to the camera you can only express a position in screen terms. The
  star field, nebula and gradient are still parented to it: that is the sky,
  and the sky travels with you.
- **Stops alternate sides, and the copy with them.** A planet you are leaving
  slides out of one edge as the next grows in from the other; copy takes the
  opposite side from its planet. This was first justified by the character,
  which rode on the planet's side — the character no longer travels, and the
  alternation stayed for two reasons that never involved it. The *planets* must
  alternate so the arriving and departing worlds are on opposite edges during
  the crossover (on one side the nearer would cover the further, and that
  crossover is the no-empty-frame guarantee). And the *copy* crossfades overlap
  in time, so on a single side two paragraphs would sit on the same pixels for
  a good part of every leg.
- **The character does not travel.** It used to fade back in over the first
  leg and swing to the planet's side at each stop. Its last appearance is now
  the hero's departure (rule 15), and every timeline track that existed only to
  move it was removed with it — `voyage.charX`, `voyage.charOpacity`,
  `CHARACTER_X_FRACTION` and the `VOYAGE_*` pose in `HeroScene`. Check with
  `window.__gsap()` under `?perf=1`: no tween targets anything but the camera
  (`camX`/`camY`/`camZ`, one pair per leg) and the cards.
- **The skills reference is the last rest position.** `LABELS` is `depart`,
  one `stop-<id>` per project, `skills`, `arrive`. The skills card is centred
  and wide, so unlike the project copy it does not crossfade: it rises in only
  after the last project's copy has cleared (`SKILLS_IN`). The camera rests
  where the exit used to be (`cameraAtSkills`, already verified to keep the
  last world in frame), and the leg out rises further and eases back 5 units
  (`cameraAtExit`) so that world is still on screen at progress 1. From there
  it fades on the contact section's progress, like the star field.
- **The glass card is what animates, not the panel.** The timeline tweens
  `.voyage-copy`; the article around it only carries layout. See rule 21 on
  why the opacity and the backdrop-filter must be on the same element.
- **The first planet is nudged 90 px left as seen from the hero**
  (`HERO_NUDGE_PX` in `ProjectPlanets`). Its rest position is recomputed and
  written every frame, so the offset lives in that computation, not on the
  mesh. It is in pixels at the planet's current distance, not world units — a
  world offset that moves it 90 px from the hero would move it ~330 px at its
  own stop — and it fades out over the first leg, so the stop composition is
  untouched.
- **Only the current panel takes clicks.** Every panel stays in the DOM at its
  own spot, most at opacity 0, and opacity does not stop a click — panels on
  one side share a box. `handleUpdate` marks the rest position on screen with
  `data-current`, and only its Explore button has pointer events.
- **`?snap=0`** keeps the scrubbed timeline and turns snapping off. The two are
  separate claims and verifying the first with the second live means the page
  moves out from under the measurement.
- **`?perf=1` publishes `window.__planets`** — every planet's live opacity — so
  "no frame without a world on screen" is checkable rather than inferred.

> **Current state: satisfied.** With the seven CV entries (nine legs, ten
> labels): scrubbed at 37 evenly spaced points across the whole voyage at
> 1440x900, 1024x768 and 390x844, 0 frames with no planet at every width, and
> none whose brightest planet was under 0.70. At each label the matching card
> is at exactly 1.00 and every other at 0, `data-current` names the right
> panel, and the card fits below the navbar. Camera z 23 → -1004 at the skills
> stop, -999 at `arrive`, where the last world is still at 1.00. Three
> ScrollTriggers (`.hero`, `.voyage-track`, `#contact`) and 42 tweens: two per
> camera leg, two per card, and eight belonging to the hero.
>
> Snapping verified with real wheel input: from the first project, eight
> single notches landed on the next eight labels at +0 px each, and one notch
> up returned to the previous. **Harness trap:** GSAP writes
> `scroll-behavior: auto` inline on `<html>` when snapping is on, because the
> stylesheet's `smooth` makes the browser animate the snap tween's own writes
> and GSAP then reads them as the visitor interrupting. A test that "jumps
> instantly" by setting that style and then clearing it removes GSAP's value
> and breaks snapping — it looked exactly like a snapping bug.

#### Snapping, and the six ways it becomes hostile

Snapping rides the **same** master timeline via ScrollTrigger's `snap`. It is
not a second, discrete mode — `scrub: true` keeps every intermediate frame
animating while the snap tween moves the page, so the glide travels *through*
the transition instead of cutting to it.

`snapTo` is a custom function, not `'labels'` or `'labelsDirectional'`. Nearest-
label snapping has no threshold: release 49% of the way to the next panel and
it drags you back, which reads as the page refusing to move. Instead the scroll
position is placed inside the segment between two rest points and judged on how
far through it is — past `SNAP_THRESHOLD` going down commits to the next, and
the mirror image going up, so up always means back. Because the decision is
made inside whichever segment the scroll *ended* in, a flick across three
panels is tidied once rather than caught at each one.

`SNAP_THRESHOLD` lives in `hooks/useScrollProgress.js`, currently **5%** — a
single wheel notch or a short trackpad flick is enough to commit. It started
at 30%, went to 8%, and is 5% now, each drop a direct response to "it doesn't
feel sensitive enough." It is the one number to change first for a more or
less paginated feel; there is nothing else gating how far a visitor has to
scroll to commit.

**Only the voyage snaps.** `useSectionProgress` — used by the contact panel —
briefly grew its own `snap` option so arriving at Contact felt like reaching a
destination. That was reverted: two independent snap systems on one scroll
meant drifting past the last project stop could get caught and completed a
second time, right where a visitor expected the page to simply let go.
`useSectionProgress` measures only, never snaps; `useVoyageScrollTrigger` is
the one trigger on the site allowed to. Contact is reached, not snapped to.

Every one of these is load-bearing; without them snapping is worse than none:

1. **Never fight live input.** Any wheel, touch or key event kills the in-flight
   snap tween — `trigger.tweenTo.tween`, the same handle ScrollTrigger itself
   kills on refresh. Verified: scrolling mid-snap produced 0 direction
   reversals and the second gesture won.
2. **Momentum is not fought.** ScrollTrigger already declines to snap while
   velocity ≥ 10 or a pointer is down; `delay: 0.1` covers the gap between
   "stopped moving" and "meant to stop".
3. **Reduced motion disables it entirely** — and in fact the voyage is not
   mounted at all; reduced motion gets a plain readable stack, not a
   snap-free version of the flight.
4. **Keyboard is never hijacked.** Tab, PageUp/Down, Home/End, arrows and space
   suppress snapping for 1.4 s, as does focus entering the stage. Snapping a
   visitor away from the control they just focused is the difference between a
   control being reachable and being usable.
5. **A panel taller than the room below the navbar is not a rest point.**
   Resting someone where the bottom of the copy is off-screen traps it — their
   next gesture snaps them away instead of revealing it — and the same is true
   of copy whose first lines are under the fixed bar. Measured live from
   `.voyage-copy` against `innerHeight` minus the navbar's height, not
   assumed: at a 293 px viewport every panel was excluded and only the two
   section boundaries remained. With the CV's longer entries this is the
   constraint the card spacing tiers exist to satisfy; every card fits from
   1920x1080 down to 360x740.
6. **Anchors land on labels.** `#projects`, `#skills` and `#project/<id>` tween to the
   rest point's scroll position, so a shared link settles on a panel instead of
   mid-transition.

Do NOT use CSS `scroll-snap-type` for any of this. It fights ScrollTrigger's
pinning and gives up all threshold control.

> **Current state: satisfied.** Verified with real gestures — 14 checks across
> mouse wheel, trackpad (a burst of small deltas plus a decaying momentum tail)
> and touch. Two harness notes worth keeping: CDP's
> `synthesizeScrollGesture` has no trackpad source, and its `touch` source
> scrolls nothing at all in this build (0 px against 385 px for the same drag
> dispatched as explicit touch events) — a test that cannot move the page is
> not a test of snapping.

#### Two layout traps, both of which hid the copy

1. **Pinning creates a stacking context.** ScrollTrigger pins by setting
   `position: fixed`, and a fixed element opens a stacking context — so the
   panels' `z-index: 2` stopped being compared against the canvas's `z-index: 1`
   in the root context and became a private ordering inside a context whose own
   z-index was `auto`. Every panel reported opacity 1 and not one was visible.
   `.voyage-stage` carries an explicit `z-index: 2` for this and no other
   reason.
2. **Anything GSAP animates cannot also carry layout.** The panels were centred
   with `top: 50%; transform: translateY(-50%)`, and the master timeline
   animates their `x`/`y` — which GSAP writes as `transform: translate(...)`,
   replacing the centring outright. The copy dropped half its height down the
   frame and the Explore button fell off the bottom edge. They are centred with
   flex now.


### 21. Cards are glass, and glass does not make white text legible

Every card is the one `.glass` recipe in `App.css`, built from tokens in
`tokens.css`: `backdrop-filter: blur(12px) saturate(180%)` (with the `-webkit-`
prefix), a 6% white fill, a 1px 12% white hairline, square corners. The hero
skills panel, the project copy, the skills reference and the contact buttons
all use it; none restates it.

Three things about it are load-bearing:

1. **The opacity and the backdrop-filter must be on the same element.** An
   ancestor with `opacity < 1` becomes the filter's *backdrop root*, so glass
   inside a fading parent sees nothing behind it and goes clear for the whole
   fade. That is why the voyage timeline animates `.voyage-copy` (the card)
   and not the `.voyage-panel` around it.
2. **The white fill is a sheen, not a ground.** Raising a white fill's alpha
   *brightens* what white text stands on. Where contrast needed help, the fix
   was `glass--scrim`: a translucent navy (`--glass-scrim`) laid under the
   sheen. It is on the skills reference, the contact buttons, and the project
   cards in portrait only — the one layout where the card sits over its planet.
3. **The `@supports not (backdrop-filter)` fallback paints a solid ground**
   (`--glass-fallback`) and is `!important`, because it must beat any
   per-component variant. Without it, text sits on 6% white over bare sky.

Contrast is measured, not eyeballed: hide the text, screenshot the live scene,
and composite the text colour over every sampled pixel behind each line box.
The 1st-percentile ratio is what has to clear AA (4.5, or 3 for large text) —
the minimum is one star.

## Visual identity

Deep-navy space with cream typography and violet/magenta glow. Cosmic
atmosphere throughout - starfields, drifting models, UFO, orbit motion.

Set in **Montserrat** (`--font-sans`, weights 400/600/800), with `--font-mono`
for small uppercase letterspaced labels and the handwritten Caveat outlines for
the name itself. Both families are tokens; nothing names a family locally — see
rule 5.

Surfaces are frosted glass (rule 21; `--glass-*` tokens), square-cornered.
Project copy is told apart by weight and size only — title 800 white, tagline
600 at 0.75 white, description 400 at 0.65 white — with no colour-coding. The
contact beam's warm yellow-orange (`#ffd98c` → `#ff9440`) is the one large
warm area on the site, and it is light, not a fill.

| Token | Value | Used for |
| --- | --- | --- |
| Space base | `#051443` | hero background, journey + projects gradients |
| Cream | `#F3F3E0` (`--color-primary`) | primary text, dashed button borders, hero-left panel |
| Deep blue | `#133E87` (`--color-secondary`) | headings on cream |
| Sky blue | `#608BC1` (`--color-accent`) | accents |
| Pale blue | `#CBDCEB` (`--color-text`) | body copy on navy |
| Violet | `#9b40fc` | primary card glow / highlight |
| Magenta | `#c340da` | secondary highlight, SpaceCard radial sweep |

Backgrounds are gradients *away* from `#051443` (toward near-black at the
bottom of Projects, toward `rgb(69,65,107)` in Journey) - keep new surfaces in
that family. Stars are plain white at low opacity; the violet/magenta pair is
for emphasis only, never for large fills.

## Conventions

- Route-level and heavy components are `lazy()` + `<Suspense fallback={<Loader />}>`.
- The canvas sits inside `<CanvasErrorBoundary>` so a missing GPU degrades
  instead of crashing. `useInView` (latching: once true it stays true) used to
  gate the contact panel's `<View>`; it has no caller now.
- GLB models are Draco-compressed with WebP textures, produced by
  `npm run assets`. Both extensions are **required** in the output - a pass that
  reads a `.glb` decodes them, so any pipeline step must re-apply them before
  writing. No texture may exceed 1024x1024 (a 4096 map costs ~89 MB of VRAM);
  the UFO's are 512 (1.4 MB each), because at 120 px they are indistinguishable
  from 1024 and a background prop does not get to spend 5.59 MB a map.
- `public/character.glb` is one skinned mesh on a 52-joint skeleton carrying
  three clips: `Energic_conductor_Clean` (idle), `Brag_n_Claps_Clean` (dance),
  `Call_Me_Clean`. Address clips **by name**, never by index. Bones are `Head`,
  `Neck`, `Spine`, `Hips`, … — no `mixamorig` prefix.
- The Astronaut's and Ufo's arrival `motionPath` array is built once per effect
  run, and its **last point is the rest pose** — the reduced-motion branch
  reads `path[path.length - 1]` rather than carrying its own copy, so the two
  cannot drift when the flight is retuned. `ARRIVAL_Y_OFFSET` (exported from
  `Astronaut.jsx`, imported by `Ufo.jsx`) is folded into every point's `y`, not
  applied as a parent group: `SkillSatellites` reads the character ref's
  `.position` as being relative to `inner`, and a wrapper group would put it a
  level deeper.
- The clips share one mixer per canvas, so only one action may be active at a
  time - two running actions blend into each other.
- Never mount a cached GLTF scene twice — an Object3D has one parent, and the
  second mount silently steals it. `Astronaut` clones the character with
  `SkeletonUtils.clone` (not `Object3D.clone`, which does not rebind the
  skeleton); `ContactBeam` clones the UFO and takes its materials from
  `gltf.materials`, because the hero's departure has replaced the ones on the
  cached scene with faded clones (rule 15).
- `public/cv_nour_eddine_chairet_en-2.pdf` is the CV both "Download CV" and
  the navbar's Résumé link serve (`RESUME_HREF` in `data/contact.js`; a
  visitor saves it as `Nour_Eddine_Chairet_CV.pdf`). It is the source every
  word of project, skills and profile copy was transcribed from — checked
  verbatim, all 23 strings. Replace the CV and the copy is out of date.
- Adding screenshots: `assets-src/images/<shot-id>.png`, then
  `npm run assets:screenshots`, then list `{ id, alt }` in the project's
  `screenshots` in `data/projects.js`. The file name is the id; a project can
  have several (`gaya-coffee-1`, `gaya-coffee-2`, …).
- Images are `.webp` with `loading="lazy"`.
- No audio ships with the site. The dance had a commercial backing track; it was
  removed for licensing reasons. Any replacement must be royalty-free and gated
  behind an explicit user-initiated play control - never autoplay, never
  preload.
