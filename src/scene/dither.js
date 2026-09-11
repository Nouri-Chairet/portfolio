/**
 * The one piece of noise this scene uses, as a GLSL chunk.
 *
 * Two shaders include it verbatim — the background gradient, where it is a
 * dither that kills banding, and the atmosphere's film grain, where the same
 * function is turned up and given a time offset. They are the same noise on
 * purpose: two different noise characters over one image read as two separate
 * artefacts, where one reads as the grain of the medium.
 */

export const DITHER_GLSL = /* glsl */ `
  /**
   * Interleaved gradient noise (Jorge Jimenez, "Next Generation Post
   * Processing in Call of Duty: Advanced Warfare").
   *
   * One dot and two fracts. Chosen over a hash because its distribution over
   * any small neighbourhood is far more even: a clumpy dither is not a fix for
   * banding, it is a second artefact laid over the first.
   */
  float ign(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
  }

  /**
   * One 8-bit output step, expressed in the LINEAR space these shaders write in.
   *
   * This matters more than it looks. The renderer encodes to sRGB after the
   * shader runs, and sRGB is by far steepest in the darks — which is precisely
   * where a deep-space gradient lives. A fixed linear amplitude would be
   * invisible at the top of the ramp and coarse grain at the bottom. Scaling by
   * the local slope of the transfer function makes "half a step" mean the same
   * thing everywhere on the ramp.
   *
   * Approximated with gamma 2.0 rather than the real sRGB curve: d(sqrt(L))/dL
   * is 0.5/sqrt(L), so one output step is 2*sqrt(L)/255. One sqrt instead of
   * a pow, which is worth caring about because this runs once per pixel in
   * the background shader AND again per pixel in the composer's merged effect
   * pass. Measured on a software renderer, dropping the pow cut the
   * atmosphere's frame cost by more than half.
   *
   * The max() reproduces sRGB's linear toe: below about L=0.0015 the real
   * curve is a flat 12.92 slope, and the approximation would otherwise keep
   * shrinking the step toward zero and leave the darkest part of the sky —
   * where banding is worst — effectively undithered. The clamped value is
   * 1/(255*12.92), which is exactly the toe's step size.
   *
   * Accuracy against true sRGB is within about 30% across the range this
   * scene occupies. For deciding the amplitude of a dither that is meant to be
   * half a step, that is well inside the margin that matters.
   */
  float outputStep(vec3 c) {
    float l = max(max(c.r, c.g), max(c.b, 0.0));
    return max(2.0 * sqrt(l), 1.0 / 12.92) / 255.0;
  }
`;
