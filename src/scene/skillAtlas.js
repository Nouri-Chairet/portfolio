import * as THREE from 'three';
import { SKILLS } from '../data/skills';

/**
 * Every satellite label, baked once into a single CanvasTexture.
 *
 * This is the "texture atlas on the satellite itself" route rather than
 * drei's <Text>, and rather than one <Html> per satellite. The reasons are in
 * that order of importance:
 *
 *   1. One texture and one draw call for all five labels. <Html> would
 *      position five DOM nodes from the render loop every frame and composite
 *      them *outside* the depth buffer, so a label would sit on top of the
 *      character it is supposed to be orbiting behind.
 *   2. No webfont. drei's <Text> is troika, which fetches Roboto from a Google
 *      CDN unless you ship a font file — and this site deliberately ships no
 *      webfont at all (the handwriting is baked to paths at build time). A
 *      canvas draws in a font the machine already has.
 *   3. It is generated, not an asset, for the same reason scene/starSprite.js
 *      is: a few lines of drawing code instead of another request in public/,
 *      tunable in one place.
 *
 * These labels are DECORATION. The accessible, selectable, searchable copy of
 * every one of these words is `components/SkillsPanel.jsx`, which renders with
 * or without WebGL. That is the same position CLAUDE.md rule 11 takes on the
 * speech bubble — a picture of words is never the content — and it is why a
 * picture of words is acceptable here and was not there.
 *
 * ------------------------------------------------------------- the channels
 *
 * The glyphs are drawn twice: a fat navy stroke, then a white fill. The
 * fragment shader reads them as two separate signals:
 *
 *   alpha  coverage — outline *and* fill, so the antialiasing is the canvas's
 *   red    0 in the outline, 1 in the fill body
 *
 * so `mix(outlineColour, tint, red)` gives a real outlined glyph that can be
 * tinted per satellite at runtime, and stays correct whether or not the
 * browser hands three a premultiplied canvas: premultiplication scales red by
 * alpha, which only ever pushes half-covered edge pixels further toward the
 * outline colour, where they already were.
 */

/** Cap height of the baked glyphs, in texels. Labels render ~30px tall. */
const FONT_PX = 48;
/** Row pitch, and the horizontal padding that keeps the stroke off the edge. */
const ROW_PX = Math.round(FONT_PX * 1.5);
const PAD_PX = Math.round(FONT_PX * 0.5);
/** Outline width. Wide enough to read over a star field, not a bubble. */
const STROKE_PX = Math.round(FONT_PX * 0.18);

/**
 * Bold uppercase sans, lightly letter-spaced, so a satellite reads as a tag
 * rather than as prose.
 *
 * Monospace was the first choice — it is what the projects section uses for
 * tech chips — and it was wrong here for a reason worth recording: at a fixed
 * cap height, "BACK-END" set in monospace is about 40% wider than the same
 * word in a proportional face, and the label ended up wider than the character
 * it orbits. A tag hanging off a thirty-pixel bead has a width budget, and
 * monospace spends it on the letter I.
 *
 * `letterSpacing` is a recent canvas property; where it is missing the text
 * simply sets tighter, which is a cosmetic loss and not a broken atlas.
 */
const FONT = `700 ${FONT_PX}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
/** Tracking, as a fraction of the font size. */
const TRACKING = 0.05;

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

let cached = null;

/**
 * @returns {{ texture: THREE.CanvasTexture, rects: Map<string, {u0,v0,u1,v1,aspect}> }}
 *   `rects` is keyed by skill id; `aspect` is the label's width/height so a
 *   quad can be sized from a single world-space height without stretching.
 */
export default function getSkillAtlas() {
  if (cached) return cached;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = FONT;
  measure.letterSpacing = `${Math.round(FONT_PX * TRACKING)}px`;

  const entries = SKILLS.map((skill) => {
    const text = skill.label.toUpperCase();
    return { id: skill.id, text, width: Math.ceil(measure.measureText(text).width) };
  });

  const widest = entries.reduce((max, e) => Math.max(max, e.width), 0);
  const width = nextPowerOfTwo(widest + PAD_PX * 2);
  const height = nextPowerOfTwo(ROW_PX * entries.length);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.font = FONT;
  ctx.letterSpacing = `${Math.round(FONT_PX * TRACKING)}px`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const rects = new Map();

  entries.forEach((entry, row) => {
    const cx = width / 2;
    const cy = row * ROW_PX + ROW_PX / 2;

    // Stroke first, fill over it: red is 0 in the halo and 1 in the letter.
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    ctx.lineWidth = STROKE_PX;
    ctx.strokeText(entry.text, cx, cy);
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillText(entry.text, cx, cy);

    // The used box, not the whole row: a quad sized to the row would carry
    // the empty margin either side and every label would come out the same
    // width, which is exactly the "typed into a fixed grid" look to avoid.
    const halfW = entry.width / 2 + STROKE_PX;
    const halfH = ROW_PX / 2;
    rects.set(entry.id, {
      u0: (cx - halfW) / width,
      // Canvas y runs down, texture v runs up.
      v0: 1 - (cy + halfH) / height,
      u1: (cx + halfW) / width,
      v1: 1 - (cy - halfH) / height,
      aspect: (halfW * 2) / (halfH * 2),
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  // Labels are read at a glancing range of depths (the near side of an orbit
  // is 1.6x the size of the far side), so mipmaps are doing real work here.
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  // The atlas is a coverage/selector pair, not colour. Leaving it in sRGB
  // would run the red channel through a transfer curve and soften the
  // outline/fill split that `mix` depends on.
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  cached = { texture, rects, size: [width, height] };
  return cached;
}
