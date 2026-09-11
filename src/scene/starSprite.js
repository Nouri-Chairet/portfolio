import * as THREE from 'three';

/**
 * The round, glowing point sprite, drawn procedurally into a CanvasTexture.
 *
 * Generated rather than shipped as an image: it is a few hundred bytes of
 * gradient stops instead of another request in `public/`, and the falloff can
 * be tuned here in one place.
 *
 * The profile is a bright core plus a wide, faint halo. Under additive
 * blending that halo is what makes bright stars bleed into their neighbours —
 * it carries the "shiny" look on its own when the Bloom pass is switched off
 * for a weak GPU.
 *
 * ------------------------------------------------------------- the cache
 *
 * Cached PER RENDERER, in a WeakMap, rather than once at module scope.
 *
 * A module-scope cache outlives the WebGL context it was first uploaded
 * against, and there is more than one context over a page's life: React
 * StrictMode mounts the Canvas twice in development, so the second renderer
 * inherited a texture belonging to a renderer that had already been disposed.
 * three tracks upload state per texture, so a texture disposed by the first
 * context carries stale bookkeeping into the second.
 *
 * Keying on the renderer fixes both halves at once. Each context gets its own
 * texture, and because the map holds the renderer weakly, the entry becomes
 * collectable the moment that renderer does — no unmount hook to remember, and
 * nothing for a caller to have to release.
 */

const perRenderer = new WeakMap();

function build() {
  const SIZE = 128;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext('2d');
  const c = SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.26, 'rgba(255,255,255,0.42)');
  gradient.addColorStop(0.48, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(0.74, 'rgba(255,255,255,0.03)');
  gradient.addColorStop(1.0, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * @param renderer the WebGLRenderer this sprite will be drawn with
 *   (`useThree((s) => s.gl)`). Required — the cache is keyed on it.
 */
export default function getStarSprite(renderer) {
  if (!renderer) return build();
  let texture = perRenderer.get(renderer);
  if (!texture) {
    texture = build();
    perRenderer.set(renderer, texture);
  }
  return texture;
}
