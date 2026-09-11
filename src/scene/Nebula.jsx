import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A very large, very faint cloud sitting behind every star.
 *
 * One plane, one fragment shader, four octaves of value noise — no texture and
 * no extra draw calls worth counting. Its whole job is to stop the background
 * reading as flat black between the stars, so it is deliberately near the
 * threshold of visibility. If you can clearly see it, it is turned up too far.
 *
 * Palette is the site's: #051443 navy through #9b40fc violet, with a touch of
 * #c340da magenta in the brightest wisps.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;

  // Cheap hash-based value noise. Good enough for a soft cloud, and far
  // cheaper than a simplex implementation for something this faint.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      total += noise(p) * amplitude;
      p *= 2.02;
      amplitude *= 0.5;
    }
    return total;
  }

  void main() {
    vec2 p = vUv * 3.0;
    // Two layers drifting against each other so the cloud breathes instead of
    // sliding as one sheet.
    float n = fbm(p + vec2(uTime * 0.008, uTime * -0.005));
    n = fbm(p + n * 1.4 + vec2(uTime * -0.004, 0.0));

    // Tight remap: only the densest part of the noise survives, so the cloud
    // stays wispy rather than washing the whole panel violet once Bloom
    // amplifies it.
    float cloud = smoothstep(0.52, 0.98, n);

    // Fade hard at the edges so the plane's rectangle never shows.
    vec2 d = abs(vUv - 0.5) * 2.0;
    float vignette = (1.0 - smoothstep(0.35, 1.0, d.x)) * (1.0 - smoothstep(0.35, 1.0, d.y));

    vec3 navy = vec3(0.020, 0.078, 0.263);
    vec3 violet = vec3(0.608, 0.251, 0.988);
    vec3 magenta = vec3(0.765, 0.251, 0.855);

    vec3 color = mix(navy, violet, cloud);
    color = mix(color, magenta, smoothstep(0.75, 1.0, n) * 0.5);

    gl_FragColor = vec4(color, cloud * vignette * uOpacity);
  }
`;

const Nebula = ({ opacity = 0.07, reducedMotion = false }) => {
  const material = useRef();
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: opacity } }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((state, delta) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uOpacity.value = opacity;
    if (!reducedMotion) m.uniforms.uTime.value += delta;
  });

  return (
    <mesh position={[0, 0, -70]} renderOrder={-1}>
      <planeGeometry args={[260, 160]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        // Behind everything, but still depth-tested so the hero characters
        // occlude it rather than it painting over them.
        depthTest
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

export default Nebula;
