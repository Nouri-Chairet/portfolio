import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { UFO_URL } from './assets';
import { DITHER_GLSL } from './dither';
import { useScrollProgressRef } from '../hooks/useScrollProgress';

/**
 * The contact section's UFO and the cone of light it casts.
 *
 * Decoration only. Everything a visitor can read or press is DOM in
 * components/ContactMe.jsx and works with no canvas at all; this draws the
 * craft and its beam behind it.
 *
 * ------------------------------------------------------------- why here
 *
 * In the shared ROOT scene, not in a drei <View>. The beam's whole character
 * is a light source, and bloom only reaches the root scene (rule 9) — inside a
 * scissored view it could not glow at all. The cost of leaving the view is
 * that nothing scissors this to the section any more, so it is placed by hand:
 * every frame it reads two empty boxes out of the contact section's layout
 * (`[data-contact-ufo]`, `[data-contact-beam]`) and stands the UFO and the
 * cone exactly over them, at a fixed depth in front of the camera. That is
 * what drei's <View> does internally, minus the scissor; it also means the CSS
 * decides the composition at every width and this file never needs a
 * breakpoint.
 *
 * ------------------------------------------------------------- the beam
 *
 * An open cone, apex hidden in the craft's underside, base on the bottom edge
 * of the beam box. Additive, writes no depth, and shaded by FACING RATIO: a
 * fragment whose surface looks straight at the camera is bright, one seen
 * edge-on fades to nothing. On a cone seen from the side that is a soft-edged
 * wedge brightest down its middle, with no texture and no hard silhouette.
 * The facing ratio is also, near enough, the length of the chord a sight line
 * cuts through the cone — which is why it reads as a volume.
 *
 * FRONT FACES ONLY, and that is load-bearing. Drawing both walls looked right
 * with bloom on and far too bright with it off, because the two render paths
 * blend in different spaces: the composer adds light in a linear buffer and
 * encodes once, while straight to the canvas each fragment is sRGB-encoded
 * BEFORE it is added. sRGB is concave, so two walls of 0.1 came out as
 * enc(0.1) + enc(0.1) = 0.70 instead of enc(0.2) = 0.48. One fragment per
 * pixel makes the two paths agree over a dark sky.
 *
 * Brightness falls off steeply from the apex toward the base, and the base
 * itself dissolves rather than ending on a line.
 *
 * Calibrated against the composer's Bloom (threshold 0.6): roughly the top
 * fifth of the cone clears it, so the craft's underside gets a halo, and the
 * lower half — where the heading and the buttons stand — stays well under it
 * and dim enough for white text (measured, see contact.css). Checked with
 * ?bloom=0 and ?bloom=1.
 */

/** World units between the camera and the plane the UFO and beam stand in. */
const DEPTH = 24;

/** Apex radius as a fraction of the base radius. Not 0: a true point pinches. */
const APEX_RATIO = 0.08;

/** Peak brightness of the beam, linear. See the bloom note above. */
const INTENSITY = 1.5;

const CORE = new THREE.Color('#ffd98c');
const EDGE = new THREE.Color('#ff9440');

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uEdge;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDir;

  ${DITHER_GLSL}

  void main() {
    // CylinderGeometry's v is 1 at the top: t runs 0 at the apex to 1 at the
    // base.
    float t = 1.0 - vUv.y;

    // Facing ratio: 1 down the middle of the cone, 0 at its silhouette.
    float facing = max(dot(normalize(vNormalV), normalize(vViewDir)), 0.0);
    float soft = facing * facing;

    // Brightest at the apex, falling away steeply toward the base. The
    // exponent is what keeps the lower half — where the heading and the
    // buttons stand — dim enough for white text. At 1.7 the buttons measured
    // 3.9:1 at 1440, and the heading 1.6:1 on a phone.
    float along = mix(0.06, 1.0, pow(1.0 - t, 3.2));
    // No hard line at either end: the apex is inside the craft, the base
    // dissolves over the last quarter.
    float ends = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.72, 1.0, t));

    // A slow ripple travelling down the light. Held still under reduced motion.
    float ripple = 1.0 + 0.07 * uMotion * sin(t * 16.0 - uTime * 1.8);

    float a = soft * along * ends * ripple * uIntensity;
    // Whiter in the core, warmer toward the edges and the base.
    vec3 col = mix(uEdge, uCore, clamp(facing * (1.0 - 0.6 * t), 0.0, 1.0)) * a;

    // Dither the light we add: a soft ramp over near-black navy is the worst
    // case for 8-bit banding (rule 13), and this is exactly that.
    col += (ign(gl_FragCoord.xy) - 0.5) * outputStep(col);

    // Additive, so this is light added to what is behind. Never negative: on
    // the composer's float target a negative value would subtract.
    gl_FragColor = vec4(max(col, 0.0), 1.0);

    // Required for a custom ShaderMaterial — see BackgroundGradient.
    #include <colorspace_fragment>
  }
`;

/**
 * The craft. Built from the cached ufo.glb the hero rides in on, so it costs
 * no download — but it has to be a CLONE, and its materials have to be the
 * originals rather than whatever is on the cached scene right now.
 *
 *   - One Object3D can only have one parent. Mounting the cached scene here
 *     too would silently steal it out of the hero.
 *   - HeroScene's departure replaces the cached scene's materials with its own
 *     clones and fades them to nothing. A plain clone of the scene taken after
 *     that would share them, and this UFO would be invisible. `gltf.materials`
 *     is the map built at load time, before anything touched them.
 */
function ContactUfo({ onReady }) {
  const gltf = useGLTF(UFO_URL, true);

  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    // The cached root carries the hero's transform (its scale, its fly-in
    // position, its idle spin). This one is placed from scratch.
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      const own = (m) => {
        const c = (gltf.materials?.[m.name] ?? m).clone();
        c.transparent = false;
        c.opacity = 1;
        c.depthWrite = true;
        return c;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map(own)
        : own(child.material);
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Centre it on its own origin so the holder's position IS the craft's
    // middle, which is what the DOM box describes.
    clone.position.sub(center);
    return { clone, width: Math.max(size.x, size.z), height: size.y };
  }, [gltf]);

  useEffect(() => {
    onReady(model);
    return () => {
      onReady(null);
      model.clone.traverse((child) => {
        if (!child.isMesh) return;
        const list = Array.isArray(child.material) ? child.material : [child.material];
        list.forEach((m) => m.dispose());
      });
    };
  }, [model, onReady]);

  return <primitive object={model.clone} />;
}

/** Look an element up once, and again only if it has left the document. */
function useElement(selector) {
  const ref = useRef(null);
  return () => {
    if (!ref.current || !ref.current.isConnected) ref.current = document.querySelector(selector);
    return ref.current;
  };
}

const ContactBeam = ({ reducedMotion }) => {
  const root = useRef();
  const craft = useRef();
  const spin = useRef();
  const beam = useRef();
  const model = useRef(null);
  const scroll = useScrollProgressRef();
  const ufoBox = useElement('[data-contact-ufo]');
  const beamBox = useElement('[data-contact-beam]');

  // The key light's target rides with the craft, so the light's direction is
  // fixed relative to it rather than aimed at the world origin, which is
  // hundreds of units behind the camera by the time anyone reaches contact.
  const target = useMemo(() => new THREE.Object3D(), []);

  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(APEX_RATIO, 1, 1, 64, 1, true);
    // Hang it from its apex: y = 0 at the top, -1 at the base.
    g.translate(0, -0.5, 0);
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uCore: { value: CORE },
      uEdge: { value: EDGE },
      uIntensity: { value: INTENSITY },
      uTime: { value: 0 },
      uMotion: { value: 1 },
    }),
    []
  );

  const scratch = useMemo(
    () => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }),
    []
  );

  const handleReady = useCallback((m) => {
    model.current = m;
  }, []);

  useFrame(({ camera, size, clock }, delta) => {
    const node = root.current;
    if (!node) return;

    // Nothing to do until the contact section has started to come into view.
    // Reading layout every frame for a section three screens away would be a
    // forced reflow per frame for nothing.
    const journey = scroll.sections.journey;
    if (!(journey > 0)) {
      node.visible = false;
      return;
    }
    const ufoEl = ufoBox();
    const beamEl = beamBox();
    if (!ufoEl || !beamEl) {
      node.visible = false;
      return;
    }
    const u = ufoEl.getBoundingClientRect();
    const b = beamEl.getBoundingClientRect();
    const onScreen = b.bottom > 0 && u.top < size.height;
    node.visible = onScreen;
    if (!onScreen) return;

    // CSS pixels -> the plane DEPTH in front of the camera. The camera is never
    // rotated on this site (VoyageCamera only moves it), so this is a scale
    // and an offset.
    const halfH = DEPTH * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * (size.width / size.height);
    const perPx = (2 * halfH) / size.height;
    const toWorld = (px, py, out) =>
      out.set(
        camera.position.x + ((px / size.width) * 2 - 1) * halfW,
        camera.position.y + (1 - (py / size.height) * 2) * halfH,
        camera.position.z - DEPTH
      );

    const time = clock.elapsedTime;
    const bob = reducedMotion ? 0 : Math.sin(time * 1.1) * u.height * 0.05 * perPx;

    // --- the craft
    const m = model.current;
    if (m && craft.current) {
      toWorld(u.left + u.width / 2, u.top + u.height / 2, scratch.a);
      craft.current.position.set(scratch.a.x, scratch.a.y + bob, scratch.a.z);
      craft.current.scale.setScalar((u.width * perPx) / m.width);
      if (!reducedMotion && spin.current) spin.current.rotation.y += delta * 0.22;
    }

    // --- the beam
    if (beam.current) {
      toWorld(b.left + b.width / 2, b.top, scratch.a);
      toWorld(b.left + b.width / 2, b.bottom, scratch.b);
      const length = Math.max(0.001, scratch.a.y + bob - scratch.b.y);
      const radius = (b.width / 2) * perPx;
      beam.current.position.set(scratch.a.x, scratch.a.y + bob, scratch.a.z);
      beam.current.scale.set(radius, length, radius);
    }

    uniforms.uMotion.value = reducedMotion ? 0 : 1;
    if (!reducedMotion) uniforms.uTime.value += delta;
  });

  return (
    <group ref={root} visible={false}>
      {/* Lights live inside the group, so they exist only while it is
          visible: a light hidden with its parent is not counted, and the
          character and satellites far up the page are never lit by it. */}
      <ambientLight intensity={0.35} />
      <group ref={craft}>
        <primitive object={target} position={[0, -1, 0]} />
        <directionalLight target={target} position={[1.2, 3, 4]} intensity={1.8} />
        {/* A slight nod toward the camera, so the dome and the rim both read
            rather than a flat side-on disc. */}
        <group ref={spin} rotation={[0.18, 0, 0]}>
          <Suspense fallback={null}>
            <ContactUfo onReady={handleReady} />
          </Suspense>
        </group>
      </group>
      <mesh ref={beam} geometry={geometry} renderOrder={2} frustumCulled={false}>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

export default ContactBeam;
