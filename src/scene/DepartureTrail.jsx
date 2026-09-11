import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import getStarSprite from './starSprite';

/**
 * The wake the UFO leaves as it departs.
 *
 * Each particle rides the same curve the group flies along, offset backwards
 * in progress, so the trail is literally the path already travelled rather
 * than a simulation. That makes it exactly as reversible as the departure
 * itself — scrolling back up rewinds it with no state to unwind and nothing
 * allocated per frame.
 *
 * It uses the star sprite and additive blending on purpose: by the tail end
 * the particles are indistinguishable from the near star layer, which is the
 * whole point — the UFO is absorbed into the starlight rather than just
 * fading out.
 *
 * The curve here must stay in step with the motionPath in HeroScene.
 */

const COUNT = 90;
/** How far behind the leader each successive particle lags, in progress units. */
const LAG = 0.006;

const DEPARTURE_PATH = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(3.5, 2.4, -22),
  new THREE.Vector3(8.5, 5.2, -58),
  new THREE.Vector3(12, 7.4, -104),
];

const CURVE = new THREE.CatmullRomCurve3(DEPARTURE_PATH, false, 'catmullrom', 0.5);

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = color;
    vAlpha = aAlpha;
    gl_PointSize = aSize * uPixelRatio * (320.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uSprite;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 s = texture2D(uSprite, gl_PointCoord);
    if (s.a < 0.01 || vAlpha < 0.002) discard;
    gl_FragColor = vec4(vColor * s.rgb, 1.0) * s.a * vAlpha;
  }
`;

const DepartureTrail = ({ state }) => {
  const points = useRef();
  const gl = useThree((s) => s.gl);
  // Keyed on the renderer, not module-scope: see scene/starSprite.js.
  const sprite = useMemo(() => getStarSprite(gl), [gl]);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const alphas = new Float32Array(COUNT);

    const warm = new THREE.Color('#cfe0ff');
    const violet = new THREE.Color('#9b40fc');
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      const t = i / (COUNT - 1);
      c.copy(warm).lerp(violet, t * 0.75);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      // Big and bright at the head, tapering to star-sized motes.
      sizes[i] = 3.2 * (1 - t) + 0.5;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(6, 4, -52), 140);
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({ uSprite: { value: sprite }, uPixelRatio: { value: dpr } }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const node = points.current;
    if (!node) return;
    const p = state?.current?.progress ?? 0;

    // Off at both ends. At p = 1 every particle's alpha is already zero, and
    // with the character no longer travelling the voyage sits at p = 1 for its
    // whole length — ninety invisible sprites for the rest of the page.
    node.visible = p > 0.02 && p < 0.999;
    if (!node.visible) return;

    const position = node.geometry.attributes.position;
    const alpha = node.geometry.attributes.aAlpha;

    for (let i = 0; i < COUNT; i++) {
      const t = THREE.MathUtils.clamp(p - i * LAG, 0, 1);
      CURVE.getPoint(t, scratch);
      position.setXYZ(i, scratch.x, scratch.y, scratch.z);
      // Taper along the tail, ease in at the start, and clear out entirely by
      // the end so nothing lingers once the UFO is gone.
      const taper = 1 - i / COUNT;
      alpha.setX(
        i,
        taper * Math.min(1, p * 3) * (1 - THREE.MathUtils.smoothstep(p, 0.85, 1))
      );
    }

    position.needsUpdate = true;
    alpha.needsUpdate = true;
    if (node.material) node.material.uniforms.uPixelRatio.value = dpr;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false} visible={false}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default DepartureTrail;
