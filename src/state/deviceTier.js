import { useEffect, useState } from 'react';

/**
 * What this device can afford to render.
 *
 *   high    full star counts, bloom, every model
 *   medium  thinned stars, no bloom, models still present
 *   low     no WebGL at all — App does not mount the canvas, and the sections
 *           render static styled fallbacks instead
 *
 * `low` is not only a performance decision: it is also what a machine with
 * WebGL blocked or unavailable gets, so the site has to be complete without
 * the canvas. Every project's title, tagline, description, tech list, link and
 * screenshots are DOM either way; the 3D is decoration on top.
 *
 * Probed once, lazily, and cached. The probe creates a throwaway WebGL context
 * and explicitly loses it again — browsers cap live contexts, and the site's
 * real one must not be competing with a leaked probe.
 */

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;
/** GPUs old enough that the star field and bloom are not worth attempting. */
const WEAK_GPU = /mali-4|mali-t6|adreno \(tm\) [123]|powervr sgx|videocore|intel\(r\) gma/i;

let cached = null;

function probeWebGL() {
  if (typeof document === 'undefined') return { ok: false, renderer: '' };
  let gl = null;
  try {
    const canvas = document.createElement('canvas');
    gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) return { ok: false, renderer: '' };

    let renderer = '';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '');
    if (!renderer) renderer = String(gl.getParameter(gl.RENDERER) || '');
    return { ok: true, renderer };
  } catch {
    return { ok: false, renderer: '' };
  } finally {
    // Give the context back immediately; we only wanted to read the string.
    try {
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* nothing to do */
    }
  }
}

export function detectDeviceTier() {
  if (cached) return cached;
  if (typeof window === 'undefined') return (cached = { tier: 'low', reason: 'no window' });

  const { ok, renderer } = probeWebGL();
  if (!ok) return (cached = { tier: 'low', reason: 'no WebGL context', renderer });
  if (SOFTWARE_RENDERER.test(renderer)) {
    return (cached = { tier: 'low', reason: 'software renderer', renderer });
  }
  if (WEAK_GPU.test(renderer)) {
    return (cached = { tier: 'low', reason: 'known weak GPU', renderer });
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  const dpr = window.devicePixelRatio || 1;
  const shortEdge = Math.min(window.screen?.width ?? 1920, window.screen?.height ?? 1080);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  if (cores <= 2) return (cached = { tier: 'low', reason: 'few cores', renderer, cores });

  // A phone-sized screen, a coarse pointer, a modest core count, or a very
  // high pixel ratio (which multiplies every fragment) all mean: no bloom.
  if (coarse || shortEdge <= 820 || cores <= 4 || dpr >= 3) {
    return (cached = {
      tier: 'medium',
      reason: coarse || shortEdge <= 820 ? 'handheld' : cores <= 4 ? 'few cores' : 'high dpr',
      renderer,
      cores,
      dpr,
    });
  }

  return (cached = { tier: 'high', reason: 'desktop GPU', renderer, cores, dpr });
}

/**
 * URL override for testing, e.g. `?tier=low` to see the no-WebGL fallback on a
 * machine that has WebGL. Read once.
 */
function tierOverride() {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('tier');
  return ['high', 'medium', 'low'].includes(value) ? value : null;
}

export function useDeviceTier() {
  const [tier, setTier] = useState(() => tierOverride() ?? detectDeviceTier().tier);

  // The probe is stable for the life of the page, but a viewport that grows
  // past the handheld threshold (tablet rotated, window dragged wider) can
  // move medium -> high.
  useEffect(() => {
    if (tierOverride()) return undefined;
    const mq = window.matchMedia('(min-width: 821px) and (pointer: fine)');
    const onChange = () => {
      cached = null;
      setTier(detectDeviceTier().tier);
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return tier;
}

/** For the perf overlay / diagnostics. */
export function deviceTierDetail() {
  return { ...detectDeviceTier(), override: tierOverride() };
}
