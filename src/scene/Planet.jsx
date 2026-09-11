import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A procedurally shaded planet. One sphere, one shader, no texture and no GLB.
 *
 * Surface: four octaves of value-noise fbm, warped by a second fbm sample so
 * the bands break up into continents rather than reading as clean stripes, then
 * ramped through the project's four-colour palette.
 *
 * Atmosphere: a fresnel term (how edge-on the surface is to the viewer) added
 * on top in the palette's glow colour. That rim is deliberately the brightest
 * thing on the planet — it is what the Bloom pass latches onto, so the planet
 * carries a halo without any extra geometry.
 *
 * Every animated quantity is a uniform driven from the parent, so a planet is
 * cheap to drive from scroll progress and costs nothing when it is idle.
 */

const vertexShader = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vPos;

  void main() {
    vPos = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vPos;

  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform vec3 uGlow;
  uniform float uSeed;
  uniform float uGlowStrength;   // hover bumps this
  uniform float uOpacity;

  // 3D value noise. Cheap, and at this scale indistinguishable from simplex.
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float total = 0.0;
    float amp = 0.5;
    // GLSL ES 1.0 needs a constant loop bound, so the octave count arrives as
    // a #define and each value compiles its own program.
    for (int i = 0; i < FBM_OCTAVES; i++) {
      total += noise(p) * amp;
      p *= 2.03;
      amp *= 0.5;
    }
    return total;
  }

  void main() {
    vec3 p = normalize(vPos) * 2.4 + uSeed;

    // Domain warp: sample once, then displace the second sample by it. This is
    // what turns latitude bands into landmasses.
    float warp = fbm(p * 1.7);
    float n = fbm(p + warp * 0.9);

    // Squash toward the equator so the noise reads as banded, like a gas giant.
    float bands = n + 0.18 * sin(normalize(vPos).y * 7.0 + warp * 2.0);

    vec3 surface = mix(uDeep, uMid, smoothstep(0.30, 0.58, bands));
    surface = mix(surface, uHigh, smoothstep(0.58, 0.78, bands));

    // Cheap directional shading so the sphere reads as a sphere.
    float lambert = clamp(dot(vNormalW, normalize(vec3(-0.4, 0.6, 0.7))), 0.0, 1.0);
    surface *= 0.35 + 0.65 * lambert;

    // Fresnel atmosphere: strongest where the surface turns away from us.
    float fresnel = pow(1.0 - clamp(dot(vNormalW, vViewDir), 0.0, 1.0), 2.6);
    vec3 color = surface + uGlow * fresnel * uGlowStrength;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

/**
 * @param palette      { deep, mid, high, glow } hex strings
 * @param seed         shifts the noise field
 * @param radius       sphere radius in world units
 * @param spin         radians/second of self-rotation (0 under reduced motion)
 * @param hovered      bumps the atmosphere glow
 * @param onPointerOver/onPointerOut/onClick  forwarded to the mesh
 */
const Planet = ({
  palette,
  seed = 0,
  radius = 1,
  spin = 0.05,
  hovered = false,
  opacity = 1,
  octaves = 4,
  segments = [48, 32],
  ...handlers
}) => {
  const mesh = useRef();
  const material = useRef();

  const uniforms = useMemo(
    () => ({
      uDeep: { value: new THREE.Color(palette.deep) },
      uMid: { value: new THREE.Color(palette.mid) },
      uHigh: { value: new THREE.Color(palette.high) },
      uGlow: { value: new THREE.Color(palette.glow) },
      uSeed: { value: seed },
      uGlowStrength: { value: 1 },
      uOpacity: { value: 1 },
    }),
    // Colours are static per project; live values are pushed in useFrame.
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((state, delta) => {
    const m = material.current;
    if (m) {
      m.uniforms.uOpacity.value = opacity;
      // Ease toward the hover target rather than snapping.
      const target = hovered ? 2.1 : 1;
      m.uniforms.uGlowStrength.value +=
        (target - m.uniforms.uGlowStrength.value) * Math.min(1, delta * 8);
    }
    if (mesh.current && spin !== 0) mesh.current.rotation.y += delta * spin;
  });

  return (
    <mesh ref={mesh} {...handlers}>
      <sphereGeometry args={[radius, segments[0], segments[1]]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        defines={{ FBM_OCTAVES: octaves }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        // Blend only while actually translucent. A planet is fully opaque for
        // most of the time it is on screen, and `transparent: true` there costs
        // a read-modify-write per fragment and forfeits early-z, for an alpha
        // that is 1. Measurement put the planets' cost in per-fragment work
        // rather than in the fbm — reducing the octave count changed nothing —
        // so this is the lever that matches where the time actually goes.
        transparent={opacity < 0.98}
        depthWrite={opacity >= 0.98}
      />
    </mesh>
  );
};

export default Planet;
