import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SKILLS } from '../data/skills';
import getSkillAtlas from './skillAtlas';
import getStarSprite from './starSprite';
import { activeSkill, hoverSkill, toggleSkillPin } from '../state/skills';
import { voyage } from '../state/voyage';

/**
 * Small glowing satellites on close elliptical orbits around the hero
 * character, one per skill.
 *
 * ------------------------------------------------------ they are not planets
 *
 * The projects section already teaches the visitor what a planet means: a
 * large, distant, fully shaded world you travel toward, one per project. If
 * the hero used the same vocabulary these would be read as three more
 * projects. So every axis is deliberately opposite:
 *
 *                    project planet              skill satellite
 *   size             0.34 of the viewport        0.045 of the character
 *   distance         26-78 units, receding       inside the character's own
 *                                                bounding sphere's reach
 *   surface          domain-warped fbm, 4        flat-shaded facets, one
 *                    colours, fresnel atmosphere colour, a rim and a halo
 *   behaviour        drifts in on section        orbits continuously, passing
 *                    progress and parks          in front of and behind
 *   count on screen  one                         five
 *
 * The size relation is structural rather than tuned: CORE_RADIUS and every
 * orbit radius in data/skills.js are fractions of the character's own measured
 * height, so a satellite cannot become larger than the character no matter
 * what the model is re-exported at.
 *
 * ------------------------------------------------------------ depth is real
 *
 * These are in the shared root scene, in the same depth buffer as the
 * character, so "behind" and "in front" are resolved by the z-buffer rather
 * than by a painter's trick. The orbits are inclined and their planes rotated
 * (see data/skills.js) so each one genuinely crosses the character's depth
 * twice per revolution. That crossing is the entire effect: a satellite that
 * only ever drew on top would read as a decal stuck to the screen.
 *
 * ----------------------------------------------------------- three fixtures
 *
 * Five satellites x three parts would be fifteen draw calls. Instead each part
 * is one object for all five, in the spirit of the pipeline the planets were
 * measured against (CLAUDE.md rule 14):
 *
 *   cores   one InstancedMesh, per-instance tint and highlight
 *   halos   one Points, reusing the same baked star sprite the departure trail
 *           uses — the glow around a satellite and the glow around a star are
 *           the same object, which is why they sit together in one frame
 *   labels  one Mesh of five quads, reading one baked CanvasTexture atlas
 *           (scene/skillAtlas.js)
 *
 * plus one invisible InstancedMesh that exists only to be hit by the
 * raycaster. Four draw calls and ~500 triangles for the whole system.
 */

/** Where the orbits are centred, as a fraction of the character's height. */
const CENTER_FRACTION = 0.56;

/** Core radius, as a fraction of the character's height. */
const CORE_RADIUS = 0.045;
/**
 * Halo sprite size, and the label's box height — same units.
 *
 * The label box is the atlas row, which is 1.5x the font size, so the glyphs
 * themselves stand about 0.47 of this. At the character's own depth that is
 * roughly fifteen screen pixels: a tag on a bead, not a headline. Larger than
 * this and the words become the subject, which is precisely what a decorative
 * label must not be — the readable copy is the DOM panel.
 */
const HALO_SIZE = 0.30;
const LABEL_HEIGHT = 0.068;
/** Gap between a node and the top of its label. */
const LABEL_GAP = 0.05;

/**
 * The pointer target, as a multiple of the core. Same reasoning as the
 * character's own tap proxy: the visible node is about thirty screen pixels
 * across, and asking someone to land on that while it is moving would be
 * asking them to fail.
 */
const HIT_SCALE = 3.4;

/** How far a highlighted satellite slows, and how fast it gets there. */
const SLOW_FACTOR = 0.15;
const SLOW_EASE = 3.2;
/** Approach rate of the brightness lift. */
const GLOW_EASE = 7;
/** Approach rate of the whole system fading in once the character lands. */
const APPEAR_EASE = 2.4;

/** How much a label dims on the far side of its orbit. */
const LABEL_BACK_ALPHA = 0.22;

const CREAM = new THREE.Color('#F3F3E0');
/** The navy the label outline is drawn in — the site's own space base. */
const OUTLINE = new THREE.Color('#051443');

const coreVertexShader = /* glsl */ `
  attribute vec3 aTint;
  attribute float aHi;

  varying vec3 vTint;
  varying float vHi;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vTint = aTint;
    vHi = aHi;

    vec4 local = instanceMatrix * vec4(position, 1.0);
    vec4 world = modelMatrix * local;
    // Uniform scale on every instance, so re-normalising is all the normal
    // transform needs.
    vNormalW = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * normal));
    vViewDir = normalize(cameraPosition - world.xyz);

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const coreFragmentShader = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vTint;
  varying float vHi;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    // Same key direction as the planets, so the hero and the projects section
    // are lit from the same imaginary star.
    float lambert = clamp(dot(vNormalW, normalize(vec3(-0.4, 0.6, 0.7))), 0.0, 1.0);
    float fresnel = pow(1.0 - clamp(dot(vNormalW, vViewDir), 0.0, 1.0), 2.0);

    // A lit bead: dim body, bright rim, and a core that lifts on highlight.
    // The rim is what Bloom latches onto, which is how a 30px object still
    // reads as glowing.
    vec3 color = vTint * (0.30 + 0.55 * lambert);
    color += vTint * fresnel * (0.55 + 1.30 * vHi);
    color += vTint * vHi * 0.45;

    gl_FragColor = vec4(color, uOpacity);

    // A hand-written fragment shader gets none of three's output conversion,
    // and the tints arrive already converted to linear by THREE.Color. Without
    // this the whole system renders about three times too dark — see CLAUDE.md
    // rule 13, where the same omission turned #0a0518 into rgb(1, 0, 3).
    #include <colorspace_fragment>
  }
`;

const haloVertexShader = /* glsl */ `
  attribute vec3 aTint;
  attribute float aSize;
  attribute float aAlpha;

  uniform float uPixelRatio;

  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vTint = aTint;
    vAlpha = aAlpha;
    gl_PointSize = aSize * uPixelRatio * (320.0 / -mv.z);
  }
`;

const haloFragmentShader = /* glsl */ `
  uniform sampler2D uSprite;

  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    vec4 s = texture2D(uSprite, gl_PointCoord);
    if (s.a < 0.01 || vAlpha < 0.002) discard;
    gl_FragColor = vec4(vTint * s.rgb, 1.0) * s.a * vAlpha;
    #include <colorspace_fragment>
  }
`;

const labelVertexShader = /* glsl */ `
  // The quad's corner as a VIEW-SPACE offset in world units, baked per vertex.
  // Adding it after the modelView transform is what billboards the label: it
  // faces the camera exactly, at the satellite's own depth, with no per-frame
  // matrix work and nothing that can end up mirrored or upside down.
  attribute vec2 aCorner;
  attribute vec2 aUv;
  attribute vec3 aTint;
  attribute float aAlpha;

  varying vec2 vUv;
  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mv.xy += aCorner;
    gl_Position = projectionMatrix * mv;
    vUv = aUv;
    vTint = aTint;
    vAlpha = aAlpha;
  }
`;

const labelFragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uOutline;

  varying vec2 vUv;
  varying vec3 vTint;
  varying float vAlpha;

  void main() {
    // alpha is coverage (outline AND fill); red selects between them.
    vec4 t = texture2D(uAtlas, vUv);
    float a = t.a * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(mix(uOutline, vTint, t.r), a);
    #include <colorspace_fragment>
  }
`;

/**
 * The character's own extent, ignoring the things attached to it that are not
 * the character.
 *
 * Box3.setFromObject() would be one line, but it has no way to skip a subtree,
 * and scene/Astronaut.jsx parents an invisible tap target to the character at
 * 1.35x its bounding sphere. Including that made the measured "height" 18.4
 * world units against the figure's real 9.4 — so every radius and every label
 * came out at twice its intended size, and five beads meant to orbit a person
 * read as a second set of planets. The proxy is marked `userData.hitProxy` for
 * exactly this kind of question; HeroScene.ownMaterials() skips it too.
 */
function measureCharacter(root, box, scratchBox) {
  box.makeEmpty();
  root.updateWorldMatrix(false, true);
  root.traverse((child) => {
    if (child.userData?.hitProxy) return;
    const geometry = child.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    scratchBox.copy(geometry.boundingBox).applyMatrix4(child.matrixWorld);
    box.union(scratchBox);
  });
  return box;
}

/** Rotation of one orbit's plane: about X to incline it, then about Y. */
function orbitBasis({ inclination, node }) {
  return new THREE.Matrix4()
    .makeRotationY(node)
    .multiply(new THREE.Matrix4().makeRotationX(inclination));
}

/**
 * How far this orbit reaches toward and away from the camera, per unit of
 * character height.
 *
 * Expanding the rotation analytically:
 *
 *   z(theta) = -a.cos(theta).sin(node) + b.sin(theta).cos(inclination).cos(node)
 *
 * which is a sinusoid whose amplitude is the root sum of squares below. It is
 * a constant of the orbit, so a satellite's front/back position can be read as
 * a fraction of its OWN travel rather than relative to wherever its four
 * neighbours happen to be this frame — otherwise the frontmost of five
 * satellites all standing in front of the character would still dim.
 */
function orbitDepthAmplitude({ a, b, inclination, node }) {
  return Math.hypot(a * Math.sin(node), b * Math.cos(inclination) * Math.cos(node));
}

/**
 * Measurement override, read once from the query string.
 *
 * `?skillscale=<f>` multiplies every satellite's core, halo and label size
 * without moving the orbits. It exists for the same reason `?planetscale` does
 * (CLAUDE.md rule 14): the honest answer to "what do these cost" turned out to
 * be "about the area they cover", and the only way to check that on the
 * machine in front of you is to change the area and nothing else. At x1 the
 * five satellites cover a few percent of the frame, which is under the noise
 * floor of a software renderer — so the claim has to be tested where it is
 * visible and then reasoned down, not asserted at a scale nothing can resolve.
 */
function scaleOverride() {
  if (typeof window === 'undefined') return 1;
  const v = new URLSearchParams(window.location.search).get('skillscale');
  if (v === null) return 1;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const SkillSatellites = ({
  character,
  departure,
  settled,
  interactive,
  reducedMotion,
  labels = true,
}) => {
  const rig = useRef();
  const cores = useRef();
  const hits = useRef();
  const halos = useRef();
  const labelMesh = useRef();
  const dpr = useThree((s) => s.viewport.dpr);

  const atlas = useMemo(() => (labels ? getSkillAtlas() : null), [labels]);
  const sizeMul = useMemo(() => scaleOverride(), []);
  const gl = useThree((s) => s.gl);
  // Keyed on the renderer, not module-scope: see scene/starSprite.js.
  const sprite = useMemo(() => getStarSprite(gl), [gl]);

  /** Per-satellite live state. Mutated in useFrame, never in React. */
  const sats = useMemo(
    () =>
      SKILLS.map((skill) => ({
        id: skill.id,
        basis: orbitBasis(skill.orbit),
        orbit: skill.orbit,
        depthAmplitude: orbitDepthAmplitude(skill.orbit),
        theta: skill.orbit.phase,
        tint: new THREE.Color(skill.color),
        /** 0..1 highlight, and 1..SLOW_FACTOR orbital rate. */
        hi: 0,
        rate: 1,
      })),
    []
  );

  // The character is measured rather than assumed, so a re-export at a
  // different height rescales the whole system instead of leaving satellites
  // orbiting someone's knees. Taken on the first frame the node is present:
  // world matrices are current then, and reading node.matrixWorld directly
  // (rather than getWorldPosition, which re-updates the ancestor chain) keeps
  // the box and the position in the same space.
  const metrics = useRef(null);
  useEffect(() => {
    metrics.current = null;
  }, [character]);

  const geometries = useMemo(() => {
    const count = SKILLS.length;

    // Non-indexed, so recomputing normals gives one normal per face. Faceted
    // is the point: a smooth-shaded ball is what a planet looks like.
    const core = new THREE.IcosahedronGeometry(1, 1);
    core.computeVertexNormals();
    core.setAttribute(
      'aTint',
      new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
    );
    core.setAttribute('aHi', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    sats.forEach((sat, i) => {
      core.attributes.aTint.setXYZ(i, sat.tint.r, sat.tint.g, sat.tint.b);
    });

    const halo = new THREE.BufferGeometry();
    halo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    halo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    halo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    halo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1));
    sats.forEach((sat, i) => {
      halo.attributes.aTint.setXYZ(i, sat.tint.r, sat.tint.g, sat.tint.b);
    });

    // Five quads in one buffer. `position` carries the satellite's centre
    // (four identical vertices); aCorner carries the billboard offsets.
    const label = new THREE.BufferGeometry();
    label.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
    label.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array(count * 8), 2));
    label.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(count * 8), 2));
    label.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
    label.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count * 4), 1));
    label.setIndex(new THREE.BufferAttribute(new Uint16Array(count * 6), 1));

    return { core, halo, label };
  }, [sats]);

  const coreUniforms = useMemo(() => ({ uOpacity: { value: 0 } }), []);
  const haloUniforms = useMemo(
    () => ({ uSprite: { value: sprite }, uPixelRatio: { value: dpr } }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const labelUniforms = useMemo(
    () => ({
      uAtlas: { value: atlas?.texture ?? null },
      uOutline: { value: OUTLINE.clone() },
    }),
    [atlas]
  );

  useEffect(() => {
    return () => {
      geometries.core.dispose();
      geometries.halo.dispose();
      geometries.label.dispose();
    };
  }, [geometries]);

  // --- scratch, allocated once ---------------------------------------------
  const scratch = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      world: new THREE.Vector3(),
      box: new THREE.Box3(),
      childBox: new THREE.Box3(),
      matrix: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      color: new THREE.Color(),
      order: SKILLS.map((_, i) => i),
      depth: new Float32Array(SKILLS.length),
      /** This frame's satellite positions, so the label pass need not re-derive them. */
      places: SKILLS.map(() => new THREE.Vector3()),
    }),
    []
  );

  const appear = useRef(0);

  useFrame((_, delta) => {
    const coreMesh = cores.current;
    const rigNode = rig.current;
    if (!coreMesh || !rigNode || !character) return;

    // --- character metrics, once ------------------------------------------
    if (!metrics.current) {
      measureCharacter(character, scratch.box, scratch.childBox);
      if (scratch.box.isEmpty()) return;
      const height = scratch.box.max.y - scratch.box.min.y;
      if (!(height > 0)) return;
      scratch.world.setFromMatrixPosition(character.matrixWorld);
      metrics.current = {
        height,
        centreY: scratch.box.min.y + height * CENTER_FRACTION - scratch.world.y,
      };
    }
    const { height, centreY } = metrics.current;

    // --- global fade -------------------------------------------------------
    // Two factors, and they are different in kind. `appear` is an ease: the
    // system arrives once the character has landed and leaves if it ever
    // un-lands. `fade` is the departure's own scrubbed value, read from the
    // ref HeroScene fills — so scrolling away dissolves the satellites on
    // exactly the curve that dissolves the character, and scrolling back up
    // rewinds both, frame for frame (CLAUDE.md rule 15).
    // The satellites belong to the hero. Once the projects voyage takes the
    // character on down the line they stand down: the machine parks at
    // `departing` for the whole flight, so `settled` alone stays true and
    // would carry five orbiting labels through a section about something else.
    const travelling = voyage.active && voyage.progress > 0.02;
    const appearTarget = settled && !travelling ? 1 : 0;
    appear.current = reducedMotion
      ? appearTarget
      : appear.current + (appearTarget - appear.current) * Math.min(1, delta * APPEAR_EASE);
    const alpha = appear.current * (departure?.current?.fade ?? 1);

    coreMesh.visible = alpha > 0.01;
    if (halos.current) halos.current.visible = coreMesh.visible;
    if (labelMesh.current) labelMesh.current.visible = coreMesh.visible;
    if (hits.current) hits.current.visible = coreMesh.visible && !!interactive;
    if (!coreMesh.visible) return;

    // --- follow the character ---------------------------------------------
    // The satellite rig is a sibling of the character inside HeroScene's
    // `inner` group, so copying the character's own local position is all that
    // is needed to stay centred on it — through the arrival flight and through
    // the departure, which moves and scales `inner` around both of them.
    rigNode.position.copy(character.position);
    rigNode.position.y += centreY;

    const active = activeSkill();
    const coreScale = CORE_RADIUS * height * sizeMul;

    const haloPos = geometries.halo.attributes.position;
    const haloSize = geometries.halo.attributes.aSize;
    const haloAlpha = geometries.halo.attributes.aAlpha;
    const hiAttr = geometries.core.attributes.aHi;

    for (let i = 0; i < sats.length; i++) {
      const sat = sats[i];

      // Highlight, and the slow-down that goes with it. Integrating theta
      // rather than deriving it from absolute time is what makes "slows" a
      // one-line change instead of a phase discontinuity.
      const hiTarget = active === sat.id ? 1 : 0;
      const rateTarget = hiTarget ? SLOW_FACTOR : 1;
      if (reducedMotion) {
        sat.hi = hiTarget;
        sat.rate = rateTarget;
      } else {
        sat.hi += (hiTarget - sat.hi) * Math.min(1, delta * GLOW_EASE);
        sat.rate += (rateTarget - sat.rate) * Math.min(1, delta * SLOW_EASE);
        sat.theta += sat.orbit.speed * sat.rate * delta;
      }

      const place = scratch.places[i]
        .set(
          sat.orbit.a * height * Math.cos(sat.theta),
          0,
          sat.orbit.b * height * Math.sin(sat.theta)
        )
        .applyMatrix4(sat.basis);

      // Cores: one instanced draw. Uniform scale, no rotation — a faceted
      // icosahedron needs no orientation of its own to read as a solid.
      scratch.matrix.compose(
        place,
        scratch.quat.identity(),
        scratch.scale.setScalar(coreScale * (1 + sat.hi * 0.18))
      );
      coreMesh.setMatrixAt(i, scratch.matrix);
      hiAttr.setX(i, sat.hi);

      if (hits.current) {
        scratch.matrix.compose(
          place,
          scratch.quat,
          scratch.scale.setScalar(coreScale * HIT_SCALE)
        );
        hits.current.setMatrixAt(i, scratch.matrix);
      }

      haloPos.setXYZ(i, place.x, place.y, place.z);
      haloSize.setX(i, HALO_SIZE * height * sizeMul * (1 + sat.hi * 0.5));
      haloAlpha.setX(i, alpha * (0.5 + sat.hi * 0.5));

      // Depth for the label pass, and for the front/back dimming below. The
      // rig carries no rotation, so a satellite's own z IS its view depth up
      // to a constant shared by all five — which is all the sort needs.
      scratch.depth[i] = place.z;
    }

    coreMesh.instanceMatrix.needsUpdate = true;
    hiAttr.needsUpdate = true;
    if (hits.current) {
      hits.current.instanceMatrix.needsUpdate = true;
      // InstancedMesh.raycast tests the bounding sphere first and caches it
      // forever after the first call. These instances move every frame, so a
      // cached sphere goes stale within a second and the satellites quietly
      // stop being hittable. Five unions is cheaper than that bug.
      hits.current.computeBoundingSphere();
    }
    haloPos.needsUpdate = true;
    haloSize.needsUpdate = true;
    haloAlpha.needsUpdate = true;
    coreUniforms.uOpacity.value = alpha;
    if (coreMesh.material) {
      // The Planet.jsx lever, for the same measured reason: blending costs a
      // read-modify-write per fragment and forfeits early-z, and these are
      // fully opaque for all but the second either side of the departure.
      coreMesh.material.transparent = alpha < 0.98;
      coreMesh.material.depthWrite = alpha >= 0.98;
    }
    if (halos.current?.material) halos.current.material.uniforms.uPixelRatio.value = dpr;

    // --- labels ------------------------------------------------------------
    if (!labelMesh.current || !atlas) return;

    const labelPos = geometries.label.attributes.position;
    const labelTint = geometries.label.attributes.aTint;
    const labelAlpha = geometries.label.attributes.aAlpha;

    for (let i = 0; i < sats.length; i++) {
      const sat = sats[i];
      const place = scratch.places[i];

      // Where this satellite is along its OWN near-far travel, 0 at the far
      // extreme and 1 at the near one. Front of the orbit reads at full
      // strength, back of it recedes: that is what stops five labels
      // competing for the same few hundred pixels, and it reinforces the
      // depth the z-buffer is already showing.
      const amplitude = sat.depthAmplitude * height;
      const front = THREE.MathUtils.clamp(0.5 + (0.5 * place.z) / amplitude, 0, 1);
      const a = alpha * THREE.MathUtils.lerp(LABEL_BACK_ALPHA, 1, front * front);
      scratch.color.copy(CREAM).lerp(sat.tint, sat.hi * 0.85);

      for (let v = 0; v < 4; v++) {
        const idx = i * 4 + v;
        labelPos.setXYZ(idx, place.x, place.y, place.z);
        labelTint.setXYZ(idx, scratch.color.r, scratch.color.g, scratch.color.b);
        // A highlighted satellite's label is always legible, but never
        // brighter than the system it belongs to.
        labelAlpha.setX(idx, Math.max(a, alpha * sat.hi));
      }
    }

    // Five quads in one draw call cannot be sorted by the renderer, so they
    // are sorted here: rewriting thirty indices back-to-front costs nothing
    // and is the difference between a far label sitting on top of a near one
    // and not.
    const order = scratch.order;
    order.sort((x, y) => scratch.depth[x] - scratch.depth[y]);
    const index = geometries.label.index;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const base = i * 4;
      index.array.set([base, base + 1, base + 2, base, base + 2, base + 3], k * 6);
    }

    labelPos.needsUpdate = true;
    labelTint.needsUpdate = true;
    labelAlpha.needsUpdate = true;
    index.needsUpdate = true;
  });

  // --- static label geometry, once the atlas and the height are known -------
  // Corner offsets need the character's height, which is only known at frame
  // time, so they are written on the first frame that has it rather than in a
  // memo that would have to guess.
  const cornersWritten = useRef(false);
  useEffect(() => {
    cornersWritten.current = false;
  }, [atlas, geometries, sizeMul]);

  useFrame(() => {
    if (cornersWritten.current || !atlas || !metrics.current) return;
    const { height } = metrics.current;
    const corner = geometries.label.attributes.aCorner;
    const uv = geometries.label.attributes.aUv;

    SKILLS.forEach((skill, i) => {
      const rect = atlas.rects.get(skill.id);
      if (!rect) return;
      const h = LABEL_HEIGHT * height * sizeMul;
      const w = h * rect.aspect;
      const top = -LABEL_GAP * height * sizeMul;
      const bottom = top - h;
      const base = i * 4;

      // 0 top-left, 1 bottom-left, 2 bottom-right, 3 top-right
      corner.setXY(base + 0, -w / 2, top);
      corner.setXY(base + 1, -w / 2, bottom);
      corner.setXY(base + 2, w / 2, bottom);
      corner.setXY(base + 3, w / 2, top);

      uv.setXY(base + 0, rect.u0, rect.v1);
      uv.setXY(base + 1, rect.u0, rect.v0);
      uv.setXY(base + 2, rect.u1, rect.v0);
      uv.setXY(base + 3, rect.u1, rect.v1);
    });

    corner.needsUpdate = true;
    uv.needsUpdate = true;
    cornersWritten.current = true;
  });

  // --- pointer -------------------------------------------------------------
  /**
   * Everything in the root scene is raycast from the shared app root (see
   * SceneRoot's ViewEventBridge), so a pointer move over any DOM element lands
   * here too. Rule 1's hit-area guard, in its root-scene form: a satellite
   * behind the skills panel must not steal the highlight from the row the
   * visitor is actually pointing at, and a press on a real control must not
   * also poke whatever happens to be behind it.
   */
  const fromChrome = useCallback((event) => {
    const target = event?.nativeEvent?.target;
    return !!target?.closest?.(
      'button, a, input, textarea, select, [role="button"], .hero-skills'
    );
  }, []);

  /**
   * Note the absence of stopPropagation, which every other pointer handler in
   * this scene has. r3f stores the event object alongside the hovered record
   * and replays its `stopped` flag on the next pointermove, so a stop made
   * here would latch: the first move that hit a satellite would suppress every
   * later one, including moves onto a different satellite. Discrete events
   * (below) may stop; hover may not.
   */
  const handleMove = useCallback(
    (event) => {
      if (!interactive || fromChrome(event)) return;
      const skill = SKILLS[event.instanceId];
      if (!skill) return;
      hoverSkill(skill.id);
    },
    [interactive, fromChrome]
  );

  const handleOut = useCallback(() => hoverSkill(null), []);

  const handleClick = useCallback(
    (event) => {
      if (!interactive || fromChrome(event)) return;
      const skill = SKILLS[event.instanceId];
      if (!skill) return;
      event.stopPropagation();
      // Pinning is the only route a touch screen has: there is no hover to
      // hold a label still with.
      toggleSkillPin(skill.id);
    },
    [interactive, fromChrome]
  );

  // Cursor feedback goes on the document — the canvas is pointer-events:none,
  // the same reason ProjectPlanets and Astronaut do it this way.
  const hoveredRef = useRef(false);
  const setCursor = useCallback((on) => {
    if (hoveredRef.current === on) return;
    hoveredRef.current = on;
    document.body.style.cursor = on ? 'pointer' : '';
  }, []);
  useEffect(() => () => setCursor(false), [setCursor]);

  if (!character) return null;

  return (
    <group ref={rig}>
      <instancedMesh
        ref={cores}
        args={[geometries.core, undefined, SKILLS.length]}
        frustumCulled={false}
        visible={false}
      >
        <shaderMaterial
          uniforms={coreUniforms}
          vertexShader={coreVertexShader}
          fragmentShader={coreFragmentShader}
        />
      </instancedMesh>

      <points ref={halos} geometry={geometries.halo} frustumCulled={false} visible={false}>
        <shaderMaterial
          uniforms={haloUniforms}
          vertexShader={haloVertexShader}
          fragmentShader={haloFragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {atlas && (
        <mesh ref={labelMesh} geometry={geometries.label} frustumCulled={false} visible={false}>
          <shaderMaterial
            uniforms={labelUniforms}
            vertexShader={labelVertexShader}
            fragmentShader={labelFragmentShader}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* The pointer target. Invisible but not `visible={false}`: an invisible
          object is skipped by the raycaster, which is the one thing this mesh
          exists to be hit by — the same trade the character's tap proxy makes.

          `precisePick` is what stops the character eating these events. Its
          own tap bubble is about twice its height and these orbit inside it,
          so it is always the nearer hit; the flag is how it knows to yield.
          See yieldsToPrecisePick in scene/Astronaut.jsx. */}
      <instancedMesh
        ref={hits}
        args={[undefined, undefined, SKILLS.length]}
        frustumCulled={false}
        visible={false}
        userData={{ hitProxy: true, precisePick: true }}
        onPointerMove={handleMove}
        onPointerOver={(event) => {
          if (!interactive || fromChrome(event)) return;
          setCursor(true);
        }}
        onPointerOut={() => {
          setCursor(false);
          handleOut();
        }}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </group>
  );
};

export default SkillSatellites;
