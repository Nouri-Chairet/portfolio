import { useMemo } from 'react';
import * as THREE from 'three';
import { DITHER_GLSL } from './dither';

/**
 * The sky the whole site sits on: a vertical ramp from near-black violet at the
 * top to the site's deep navy, with a warm lift hugging the very bottom edge as
 * if something were lit below the horizon.
 *
 * **In WebGL, not CSS.** A CSS gradient behind the canvas is the obvious
 * cheaper option and it is wrong here for three separate reasons: it sits
 * behind the canvas so bloom and the atmosphere pass cannot touch it, the
 * browser gives you no way to dither it, and a large flat ramp is the single
 * worst case for 8-bit output — this one crosses roughly 20 quantisation steps
 * over the height of the viewport, which puts a visible Mach band every fifty
 * pixels on a decent monitor and every twenty on a cheap one.
 *
 * The dither is what makes it clean rather than cheap: each pixel is nudged by
 * up to half an output step before the hardware rounds, which converts the hard
 * edge of each band into noise the eye integrates back into a smooth ramp. It
 * is ordered (a function of screen position, not of time), so it does not
 * shimmer — the animated version of this is the atmosphere's film grain, which
 * shares the same noise function on purpose. See dither.js.
 *
 * It renders as a full-screen quad in clip space rather than as geometry in the
 * world: no camera maths to keep in step, no far-plane clipping to worry about,
 * and it cannot be moved out of frame by anything the hero does. Depth is
 * neither tested nor written, and `renderOrder` puts it before everything —
 * including the nebula at -1, which composites over it untouched.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    // Straight to clip space. This is the frame, not an object in the scene,
    // so the camera's matrices are deliberately ignored. z = 1 parks it on the
    // far plane for anything that does read depth.
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;

  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uWarm;
  uniform float uWarmStrength;
  uniform float uDither;

  ${DITHER_GLSL}

  void main() {
    float t = clamp(vUv.y, 0.0, 1.0);

    // Eased, not linear. A linear ramp reads as a gradient — as a graphic
    // effect. Smoothstepping it holds the two ends flatter and puts the
    // transition in the middle, which reads as distance.
    float e = t * t * (3.0 - 2.0 * t);
    vec3 col = mix(uBottom, uTop, e);

    // Something lit, below the horizon. Raised to a high power so it is
    // confined to the last few percent of the frame: spread wider it stops
    // being a suggestion and becomes a sunset.
    col += uWarm * pow(1.0 - t, 7.0) * uWarmStrength;

    col += (ign(gl_FragCoord.xy) - 0.5) * outputStep(col) * uDither;

    gl_FragColor = vec4(col, 1.0);

    // REQUIRED. three appends the working-space -> output conversion for its
    // own materials, but a ShaderMaterial with a custom fragment shader has to
    // ask for it. Without this the shader's linear values are written out as
    // if they were already sRGB, and the whole ramp renders roughly a factor
    // of three too dark — #0a0518 came out as rgb(1, 0, 3).
    //
    // It is also what makes this correct in both render paths: the conversion
    // three generates is derived from whatever target is bound, so it encodes
    // to sRGB when drawing straight to the canvas and is the identity when
    // drawing into the composer's linear half-float buffer. No double
    // conversion either way.
    #include <colorspace_fragment>
  }
`;

/** Near-black violet overhead, easing into the site's navy below. */
const TOP = '#0a0518';
const BOTTOM = '#051443';
/** The warm lift. Magenta-leaning rather than amber, to stay in the palette. */
const WARM = '#7e2f63';

const BackgroundGradient = ({ warmStrength = 0.1, dither = 1 }) => {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(TOP) },
      uBottom: { value: new THREE.Color(BOTTOM) },
      uWarm: { value: new THREE.Color(WARM) },
      uWarmStrength: { value: warmStrength },
      uDither: { value: dither },
    }),
    // Static for the life of the page; there is nothing here to animate.
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

export default BackgroundGradient;
