# CLAUDE.md

Personal portfolio site for Nouri Chairet. Single-page-ish React app with a
3D hero (WebGL) and a scroll-driven, space-themed presentation.

## Stack

| Concern | Choice |
| --- | --- |
| UI | **React 18** (`react` / `react-dom` 18.3, JSX, no TypeScript) |
| Build | **Vite 5** (`@vitejs/plugin-react`, esbuild dev / rollup prod) |
| 3D | **@react-three/fiber 8** + **@react-three/drei 9** on **three 0.170** |
| Animation | **GSAP 3.13** (`ScrollTrigger`, `MotionPathPlugin`, `TextPlugin`, `DrawSVGPlugin`) |
| Routing | **react-router-dom 7** (`BrowserRouter`) |
| Styling | Plain CSS in `src/styles/*.css` + **styled-components 6** for two self-contained widgets |
| Misc | `lottie-react` (projects background), `@vercel/speed-insights` |
| Lint | ESLint 9 flat config (`eslint.config.js`) |

Node 24 / npm 11 locally. `npm run dev` · `npm run build` · `npm run lint` · `npm run preview`.
`ANALYZE=1 npm run build` additionally emits `dist/stats.html` (rollup-plugin-visualizer treemap).

## Layout of the code

```
src/
  main.jsx            createRoot + BrowserRouter. "/" -> App, "/projects" -> lazy(Projects)
  App.jsx             registers ScrollTrigger; lazy Hero + Journey inside .panel wrappers
  sections/
    Hero.jsx          typed-text intro, star ScrollTrigger, mounts <Model />
    journey.jsx       ContactMe (center) + CallMe (right)
    Projects.jsx      lazy route; Lottie background + SpaceCard grid
  components/
    Model.jsx         WebGL canvas #1 - avatar + dance model + UFO base
    CallMe.jsx        WebGL canvas #2 - "call me" model  (see Rule 1)
    StarField.jsx     pure-CSS parallax starfield (no WebGL) - replaced the old Three.js Stars
    CanvasErrorBoundary.jsx  degrades a failed WebGL context instead of white-screening
    Loader.jsx        styled-components Suspense fallback
    ui/HandWriting.jsx, ui/SpaceCard.jsx
  hooks/useInView.js  latching IntersectionObserver; gates Canvas mounts until scrolled into view
  styles/*.css
```

Heavy assets live in `public/` and are referenced by absolute URL: the two
`.glb` models (`useGLTF('/character.glb')`, `useGLTF('/ufo.glb')`), the `.webp`
project shots, and `star.svg`. They are **not** bundled - do not import them
through Vite.

`public/` holds *build output*, not sources. The uncompressed model exports
live in `assets-src/` (tracked, never served) and are processed into `public/`
by `npm run assets`:

| script | does |
| --- | --- |
| `npm run assets` | all three steps below |
| `npm run assets:character` | merges the 3 character exports into `public/character.glb` |
| `npm run assets:ufo` | resizes UFO textures to 1024 and re-Dracos into `public/ufo.glb` |
| `npm run assets:images` | `assets-src/images/*.png` -> `public/*.webp` |
| `npm run assets:inspect` | prints the glTF-Transform report for both models |

Never hand-edit anything in `public/` that a script generates - change the
script, or the source in `assets-src/`, and re-run.

`vite.config.js` hand-splits three long-cacheable vendor chunks
(`three-vendor`, `react-vendor`, `gsap-vendor`). If a library moves in or out
of `package.json`, keep `manualChunks` in sync or the build warns.

## Hard rules

These are project invariants. Breaking one is a bug even if the build passes.

### 1. ONE WebGL canvas for the whole site

Never add a second `<Canvas>`. Browsers cap live WebGL contexts (~8-16); every
extra context also costs its own render loop, its own GPU memory, and its own
`three` scene graph. Reuse the existing canvas and add a scene/group to it
instead of mounting a new one.

> **Current state: violated.** `Model.jsx` and `CallMe.jsx` each own a
> `<Canvas>`. Both are gated behind `useInView` (so they mount lazily) and
> wrapped in `CanvasErrorBoundary`, which contains the damage - but it is still
> two contexts. Consolidating them into a single site-level canvas is the
> intended direction. Until that lands: **do not add a third.**

### 2. No `setTimeout`-based animation choreography

All sequencing is driven by explicit state-machine transitions or by GSAP
timelines / ScrollTrigger. `setTimeout` chains drift under load, cannot be
scrubbed, seeked, paused, or reversed, and leak when a component unmounts
mid-sequence. Use `gsap.timeline()` with position parameters, `delay`, and
`onComplete` - or a reducer with named states - not wall-clock guesses.

> **Current state: violated** in `sections/Hero.jsx` (the 6000/8100/15400 ms
> reveal cascade and the 700 ms text swap) and `components/Model.jsx` (the
> 2200 ms animation kickoff and the 30 s dance cutoff). Port these to timelines
> when touching that code; do not add new ones.

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

> **Current state: violated.** `components/CallMe.jsx` calls
> `ScrollTrigger.killAll()` in its cleanup, which silently kills the Hero's and
> Model's scroll triggers too. No file currently uses `gsap.context()`.

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

> **Current state: partial.** Only `styles/starfield.css` honours it. GSAP
> timelines, the Lottie background, and the `useFrame` UFO rotation do not.

### 5. CSS custom properties live in one global file

Design tokens belong in a single global stylesheet (currently the `:root` block
sits in `src/styles/hero.css` - it should move to a dedicated global file
imported once from `App.jsx`). Never declare a `:root` block in a
per-component stylesheet or inside a styled-component: duplicated `:root` rules
resolve by load order, which changes with lazy-loading and code-splitting, so
the same token can mean different things on different routes.

Per-component CSS may *consume* tokens (`var(--color-primary)`) freely; it may
not *define* them.

## Visual identity

Deep-navy space with cream typography and violet/magenta glow. Cosmic
atmosphere throughout - starfields, drifting models, UFO, orbit motion.

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
- Anything that mounts a `<Canvas>` goes behind `useInView` so the GLB download
  and the GL context are deferred until it is actually near the viewport, and
  inside `<CanvasErrorBoundary>` so a missing GPU degrades instead of crashing.
- `useInView` latches: once true it stays true and the observer disconnects. A
  canvas must never be torn down and re-created on scroll.
- GLB models are Draco-compressed with WebP textures, produced by
  `npm run assets`. Both extensions are **required** in the output - a pass that
  reads a `.glb` decodes them, so any pipeline step must re-apply them before
  writing. No texture may exceed 1024x1024 (a 4096 map costs ~89 MB of VRAM).
- `public/character.glb` is one skinned mesh on a 52-joint skeleton carrying
  three clips: `Energic_conductor_Clean` (idle), `Brag_n_Claps_Clean` (dance),
  `Call_Me_Clean`. Address clips **by name**, never by index.
- The clips share one mixer per canvas, so only one action may be active at a
  time - two running actions blend into each other.
- `Model.jsx` and `CallMe.jsx` load the same cached GLTF into two different
  canvases, so each clones it with `SkeletonUtils.clone` (not `Object3D.clone`,
  which does not rebind the skeleton).
- Images are `.webp` with `loading="lazy"`.
- No audio ships with the site. The dance had a commercial backing track; it was
  removed for licensing reasons. Any replacement must be royalty-free and gated
  behind an explicit user-initiated play control - never autoplay, never
  preload.
