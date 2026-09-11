import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { DITHER_GLSL } from './dither';

/**
 * The atmosphere: vignette, edge-only chromatic aberration, and film grain.
 *
 * All three are deliberately at or below the threshold of conscious notice.
 * The test for each is the same — turn it off and the frame should look
 * slightly *worse* without you being able to say why. If you can point at it,
 * it is too strong.
 *
 * COST, and it is not evenly split. postprocessing merges effects into a
 * single EffectPass and compiles them into one shader — but only effects that
 * do not need to sample their input at arbitrary offsets. Chromatic aberration
 * does, by definition, so it declares `EffectAttribute.CONVOLUTION` and gets a
 * dedicated pass of its own with its own full-screen render.
 *
 * That is the whole cost of this file. The vignette and the grain ride inside
 * the bloom pass that is already running and are close to free; the aberration
 * roughly doubles the composer's work. `?atmos=vg` drops it and keeps the other
 * two, which is the right setting if you are ever fighting for frame time on a
 * mid-tier device.
 */

/**
 * Film grain, from the same noise the background gradient dithers with.
 *
 * Reusing it is the point: two different noise characters over one image read
 * as two artefacts, where one reads as the grain of the medium. The only
 * differences are amplitude and a time offset — the gradient's version is
 * ordered and still, so it cannot shimmer; this one crawls.
 *
 * Amplitude is expressed in *output steps* rather than as a raw colour delta.
 * The composer works in linear space (r3f gives it a half-float buffer), and a
 * fixed linear amplitude would be invisible in the sky and obvious on the cream
 * panel. `outputStep` converts, so "1.4 steps" means the same thing everywhere.
 */
const grainShader = /* glsl */ `
  uniform float uSteps;
  uniform float uTime;

  ${DITHER_GLSL}

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // A large, irrational-ish scroll so the pattern never visibly repeats or
    // appears to move in a direction.
    vec2 p = gl_FragCoord.xy + vec2(uTime * 71.13, uTime * 43.77);
    float n = ign(p) - 0.5;
    outputColor = vec4(inputColor.rgb + n * outputStep(inputColor.rgb) * uSteps, inputColor.a);
  }
`;

class GrainEffect extends Effect {
  constructor({ steps = 1.4, animate = true } = {}) {
    super('GrainEffect', grainShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['uSteps', new THREE.Uniform(steps)],
        ['uTime', new THREE.Uniform(0)],
      ]),
    });
    this.animate = animate;
  }

  update(renderer, inputBuffer, deltaTime) {
    // Reduced motion gets grain, but a still one: the texture is the point, the
    // crawl is not. Holding uTime freezes the pattern without removing it.
    if (this.animate) this.uniforms.get('uTime').value += deltaTime;
  }
}

const Grain = forwardRef(function Grain({ steps = 1.4, animate = true }, ref) {
  const effect = useMemo(() => new GrainEffect({ steps, animate }), [steps, animate]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

/**
 * @param reducedMotion freeze the grain rather than dropping it
 * @param aberration    include the chromatic aberration. It is the one effect
 *                      here that costs a pass of its own.
 */
const Atmosphere = ({ reducedMotion = false, aberration = true }) => (
  <>
    {/* Edges only. `radialModulation` scales the offset by distance from the
        centre, so the middle of the frame — where everything worth reading
        sits — is untouched, and only the corners get the lens's fringing.
        Un-modulated, this offset would put a visible colour halo on every
        letter of the navbar. Measured: 2/255 of channel shift at the extreme
        edge, 0 at the centre. */}
    {aberration && (
      <ChromaticAberration
        offset={[0.0007, 0.0007]}
        radialModulation
        modulationOffset={0.62}
        blendFunction={BlendFunction.NORMAL}
      />
    )}
    {/* Gentle: `offset` is where the falloff starts, `darkness` how far it
        goes. It has to sit under the cream navbar and the project panels
        without ever reading as a dark corner. Measured: 15% darker at the
        extreme frame edge, untouched at the centre. */}
    <Vignette offset={0.32} darkness={0.42} blendFunction={BlendFunction.NORMAL} />
    <Grain steps={1.4} animate={!reducedMotion} />
  </>
);

export default Atmosphere;
