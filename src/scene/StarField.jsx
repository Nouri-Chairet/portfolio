import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import getStarSprite from './starSprite';
import { useScrollProgressRef } from '../hooks/useScrollProgress';

/**
 * The star field: three point clouds at different depths.
 *
 * Depth comes from differential motion, not from perspective alone — the far
 * layer is dense, tiny and nearly still; the near layer is sparse, large and
 * rotates several times faster. Everything else (glow, colour, twinkle) is
 * dressing on top of that parallax.
 *
 * Each layer is one draw call: a single BufferGeometry of points with
 * per-star attributes fed to a ShaderMaterial.
 */

/**
 * Layer counts. Exposed as named constants because they are the first dial to
 * turn for performance: measured on software rasterisation the star count
 * moved frame time only ~12% (bloom dominated), but that measurement inflates
 * bloom's fill cost, so on real hardware the count's share is larger. Tune the
 * far layer first — it is by far the biggest and the least missed.
 */
export const FAR_COUNT = 10800;
export const MID_COUNT = 4060;
export const NEAR_COUNT = 1080;

/** Fraction of each count kept on the handheld / low tier. */
export const LOW_TIER_FRACTION = 0.4;

/**
 * Stellar colour ramp, cool through warm.
 *
 * Real star colour tracks surface temperature: hot O/B stars are blue-white,
 * G stars like the sun are near-white, K/M stars are amber. Sampled with a
 * bias toward the middle so the field reads as white at a glance and the
 * tinted ones are the exception, which is what the eye actually sees.
 */
const TEMPERATURE_RAMP = [
  [0.62, 0.74, 1.0], // hot blue-white
  [0.80, 0.87, 1.0],
  [0.95, 0.97, 1.0],
  [1.0, 1.0, 1.0], // white
  [1.0, 0.97, 0.90],
  [1.0, 0.89, 0.74], // warm amber
  [1.0, 0.78, 0.58],
];

function sampleTemperature(t) {
  const x = t * (TEMPERATURE_RAMP.length - 1);
  const i = Math.min(TEMPERATURE_RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = TEMPERATURE_RAMP[i];
  const b = TEMPERATURE_RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uTwinkle;   // 0 disables scintillation (reduced motion)
  uniform float uScale;     // global size multiplier
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Each star scintillates on its own phase and its own rate, so the field
    // shimmers instead of pulsing in unison.
    //
    // The rate is decorrelated from the phase offset with a hash rather than
    // derived from aPhase directly: sharing one attribute between "when in the
    // cycle" and "how fast" made the two track each other, so stars at similar
    // phases also breathed at similar speeds and the field organised itself
    // into visible bands. 5-12 Hz is scintillation; the old 1.1-3.4 rad/s
    // (periods of 1.85-5.7 s) read as objects breathing.
    float rate = 5.0 + fract(aPhase * 97.13) * 7.0;
    float wave = sin(uTime * rate + aPhase * 6.2831853);

    // Big stars barely twinkle. Real scintillation is an atmospheric effect on
    // a point source, and the brightest things in this sky are the ones the
    // eye tracks — a 28% swing on those is the "breathing" read again, one
    // layer down.
    float damp = 1.0 - smoothstep(2.0, 6.0, aSize) * 0.6;
    float twinkle = mix(1.0, 0.72 + 0.28 * wave * damp, uTwinkle);

    vColor = aColor;
    vAlpha = uOpacity * mix(1.0, 0.65 + 0.35 * wave * damp, uTwinkle);

    // Perspective-correct point size: attenuate with distance.
    //
    // Both guards here are load-bearing. Negated view-space z is unbounded
    // below, so a star crossing the camera plane sends the size to infinity and
    // every driver clamps that differently. And the near layer's largest stars
    // evaluated to ~129 CSS px — 259 device px at dpr 2 — a single additive
    // sprite covering a large part of the viewport and then being fed through
    // bloom. A handful of those is enough fill to trip a performance monitor,
    // which is what started the flicker this shader was blamed for.
    float depth = max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(
      aSize * uScale * uPixelRatio * twinkle * (320.0 / depth),
      1.0,
      48.0 * uPixelRatio
    );
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uSprite;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 sprite = texture2D(uSprite, gl_PointCoord);
    if (sprite.a < 0.01) discard;
    gl_FragColor = vec4(vColor * sprite.rgb, 1.0) * sprite.a * vAlpha;
  }
`;

/**
 * One depth layer.
 *
 * `count` is the FULL star count and never changes. `thin` is the fraction
 * actually drawn. The two are separate because the geometry must not be
 * rebuilt to change quality: reallocating four Float32Arrays for ~16k stars on
 * the main thread stalls a frame, that stall is itself a frame-rate drop, and
 * the drop is what the quality switch was reacting to. Shedding work by
 * doing expensive work is how an oscillation sustains itself.
 *
 * Thinning by draw range is exact rather than approximate: the generator below
 * is a seeded LCG walked once per star, so the first N stars are an
 * independent sample of the same shell, not a biased corner of it.
 */
function StarLayer({
  count,
  thin,
  radius,
  sizeMin,
  sizeMax,
  speed,
  opacity,
  reducedMotion,
  seed,
}) {
  const points = useRef();
  const material = useRef();
  const dpr = useThree((s) => s.viewport.dpr);
  const gl = useThree((s) => s.gl);
  const sprite = useMemo(() => getStarSprite(gl), [gl]);
  const scroll = useScrollProgressRef();

  const geometry = useMemo(() => {
    // Deterministic per layer so a remount does not reshuffle the sky.
    let s = seed;
    const random = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Even distribution over a spherical shell around the camera.
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const r = radius * (0.72 + random() * 0.28);
      const sxy = Math.sqrt(1 - u * u);
      positions[i * 3] = r * sxy * Math.cos(theta);
      positions[i * 3 + 1] = r * sxy * Math.sin(theta);
      positions[i * 3 + 2] = r * u;

      // Power law: pow(uniform, 4) piles most stars at the faint end and
      // leaves a handful of bright ones, which is what a real sky looks like.
      sizes[i] = sizeMin + (sizeMax - sizeMin) * Math.pow(random(), 4);
      phases[i] = random();

      const [cr, cg, cb] = sampleTemperature(Math.pow(random(), 1.6) * 0.5 + random() * 0.5);
      colors[i * 3] = cr;
      colors[i * 3 + 1] = cg;
      colors[i * 3 + 2] = cb;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    // Points are all around the camera; skip the per-frame frustum test.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.2);
    return g;
  }, [count, radius, sizeMin, sizeMax, seed]);

  // Quality changes are a draw-range change and nothing else: no allocation,
  // no upload, no stall, and identical pixels to a rebuilt geometry.
  useEffect(() => {
    geometry.setDrawRange(0, Math.max(1, Math.round(count * thin)));
  }, [geometry, count, thin]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uTwinkle: { value: reducedMotion ? 0 : 1 },
      uScale: { value: 1 },
      uOpacity: { value: opacity },
      uSprite: { value: sprite },
    }),
    // Only built once; live values are pushed in useFrame below.
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((state, delta) => {
    const m = material.current;
    if (m) {
      // The canvas is full-viewport and fixed, so the stars would otherwise sit
      // over the journey panel's opaque gradient. They fade as the journey
      // arrives — NOT on hero progress, which reaches 1 before the projects
      // section even starts and would leave the planets in an empty void.
      // `?? 0` guards undefined but not NaN, and a NaN here does not degrade
      // gracefully: it survives smoothstep, reaches uOpacity, and multiplies
      // out every fragment of the layer — the whole sky vanishes with nothing
      // in the console to say why.
      const journey = scroll.sections.journey;
      const progress = Number.isFinite(journey) ? journey : 0;
      const fade = 1 - THREE.MathUtils.smoothstep(progress, 0.25, 0.85);
      m.uniforms.uPixelRatio.value = dpr;
      m.uniforms.uTwinkle.value = reducedMotion ? 0 : 1;
      m.uniforms.uOpacity.value = opacity * fade;
      if (!reducedMotion) m.uniforms.uTime.value += delta;
    }
    // Differential rotation is the parallax: this is the depth cue.
    if (points.current && !reducedMotion) {
      points.current.rotation.y += delta * speed;
      points.current.rotation.z += delta * speed * 0.35;
    }
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        // Depth-tested since the hero characters moved into this same scene:
        // with the test off, stars drew straight through the astronaut.
        depthTest
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * @param quality       'high' | 'low' — 'low' thins every layer
 * @param reducedMotion hold the sky still: no rotation, no twinkle
 * @param opacity       faded out as the hero scrolls away
 */
const StarField = ({ quality = 'high', reducedMotion = false, opacity = 1 }) => {
  // Passed down, never folded into `count`: the geometry is built once at full
  // size and thinned with setDrawRange. See StarLayer.
  const thin = quality === 'low' ? LOW_TIER_FRACTION : 1;

  return (
    <group>
      <StarLayer
        seed={1013}
        count={FAR_COUNT}
        thin={thin}
        radius={62}
        sizeMin={0.5}
        sizeMax={2.2}
        speed={0.004}
        opacity={opacity * 0.85}
        reducedMotion={reducedMotion}
      />
      <StarLayer
        seed={7717}
        count={MID_COUNT}
        thin={thin}
        radius={40}
        sizeMin={1.0}
        sizeMax={4.0}
        speed={0.011}
        opacity={opacity * 0.95}
        reducedMotion={reducedMotion}
      />
      {/* The near layer used to run sizeMax 7 on a radius-24 shell, whose
          inner edge sits ~17 units from the camera: 320/17.3 * 7 = ~129 CSS px
          per sprite, additive, through bloom. Pushing the shell out to 32 and
          the cap down to 3 takes the largest near star to ~42 px. The depth
          cue here is differential rotation, not size, so this costs nothing
          the eye was using. */}
      <StarLayer
        seed={4241}
        count={NEAR_COUNT}
        thin={thin}
        radius={32}
        sizeMin={2.0}
        sizeMax={3.0}
        speed={0.024}
        opacity={opacity}
        reducedMotion={reducedMotion}
      />
    </group>
  );
};

export default StarField;
