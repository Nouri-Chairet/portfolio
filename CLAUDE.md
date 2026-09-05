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
  scene/              ALL 3D lives here
    SceneRoot.jsx     the site's one <Canvas>; mounted by App, never unmounted
    HeroView.jsx      <View> tracking .model - camera, lights, Astronaut, Ufo
                      + the single ScrollTrigger against .hero
    CallMeView.jsx    <View> tracking .nouri - camera, lights, CallMePose
    Astronaut.jsx     hero character (idle + dance clips)
    Ufo.jsx           the UFO the astronaut rides in on
    CallMePose.jsx    journey-panel character (call-me clip)
  components/
    StarField.jsx     pure-CSS parallax starfield (no WebGL) - replaced the old Three.js Stars
    CanvasErrorBoundary.jsx  degrades a failed WebGL context instead of white-screening
    Loader.jsx        styled-components Suspense fallback
    ui/HandWriting.jsx, ui/SpaceCard.jsx
  hooks/useInView.js  latching IntersectionObserver; gates 3D content until scrolled into view
  hooks/useScrollProgress.js  the single scroll-progress source of truth
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

**How to add 3D.** The one canvas is `scene/SceneRoot.jsx`, mounted by `App`
and never torn down. A section contributes 3D by rendering a drei `<View>` that
tracks a DOM box; drei scissors the shared canvas to that box, so each region
keeps its own camera and lights and is clipped exactly to its element:

```jsx
<View className="model" ref={viewRef} index={1}>
  <PerspectiveCamera makeDefault position={[4, 6, 23]} fov={50} />
  <ambientLight intensity={1} />
  <Astronaut ref={setAstronaut} scale={scale} hitArea={viewRef} />
</View>
```

The canvas is `position: fixed`, full-viewport, `z-index: 1`,
`pointer-events: none`. Those values are set through the Canvas `style` prop,
not the stylesheet - R3F writes `position: relative; width: 100%; height: 100%`
inline on its wrapper and inline styles win. See `styles/scene.css` for why
z-index 1 is the correct layer.

Events reach 3D objects through the *tracked elements*, not the canvas. drei's
`<View>` re-points R3F's event layer at whichever tracked element mounted last,
which would silently break the other view, so `SceneRoot` re-points it at the
shared app root (`ViewEventBridge`) - each view's own `compute` still filters by
`event.target`. Interactive objects additionally take a `hitArea` ref and
ignore events whose target is not that element, so a click on unrelated DOM
cannot re-fire a stale raycast. **Any new clickable 3D object needs that
guard.**

> **Current state: satisfied.** One `<Canvas>`, one WebGL context (verified in
> a headless browser). `CanvasErrorBoundary` still wraps it so a machine
> without WebGL degrades instead of white-screening.

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

### 6. One scroll-progress source of truth

`hooks/useScrollProgress.js` owns hero scroll progress. Exactly one
ScrollTrigger exists against `.hero`; it lives in `scene/HeroView.jsx`, drives
one timeline holding both the astronaut's and the UFO's exit tweens, and
publishes progress via `setHeroProgress`. Read it with
`useScrollProgressRef()` inside `useFrame` (no re-render) or
`useScrollProgress()` when DOM UI genuinely needs to re-render.

Do not register another ScrollTrigger against `.hero` for scene content. Before
this existed, `Astronaut` and `Ufo` each registered their own and `CallMe`
killed all of them on unmount.

### 7. DPR is capped and adaptive

The canvas runs `<PerformanceMonitor>` (steps DPR between 1 and 2 on sustained
FPS changes) plus `<AdaptiveDpr pixelated />` (drops resolution during momentary
stalls). Never set a fixed `dpr` above 2 - the UFO and character are already the
heaviest thing on the page.

`preserveDrawingBuffer` is **off**. Nothing reads the canvas back; turning it on
forces a full-buffer copy every frame. Only re-enable it alongside an actual
`toDataURL`/screenshot feature.

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
