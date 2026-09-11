/* Geometry helpers for the baked handwriting data.
 *
 * Their own module rather than named exports beside the component: a file that
 * exports both a component and plain functions loses React Fast Refresh, and
 * these are imported by SiteNav, which is the one component whose live-editing
 * loop matters most while tuning the entrance. */

/** Every number in a path `d`, in order. The generated strokes are absolute. */
const NUMBER = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

/**
 * The box around one word of a baked line, in the line's own user units.
 *
 * This is what lets the navbar logo be a *crop* of the hero's line rather than
 * a second copy of the artwork: "Hi, I'm Nouri" and "Nouri" are the same
 * `<path>` element, seen through two different viewBoxes, and the morph
 * animates between them. Swapping in a separate logo element would throw away
 * the continuity that is the whole point of the entrance.
 *
 * Measured from the mask strokes rather than the fill, because the fill is one
 * single path for the entire line and cannot be split by word. A stroke is a
 * centreline, so half its width is added back to reach the letterform's edge.
 * Bezier control points are included, which can only ever make the box
 * slightly generous — never tight enough to clip a glyph.
 *
 * Analytic, not `getBBox()`: under prefers-reduced-motion the mask is not
 * rendered at all, so there would be no elements to measure.
 *
 * @param data      a generated line (HERO_NAME / HERO_WELCOME)
 * @param wordIndex which word, in reading order
 * @param padding   extra margin, as a fraction of the box's height
 */
export function wordViewBox(data, wordIndex, padding = 0.06) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  for (const stroke of data.strokes) {
    if (wordIndex !== null && stroke.wordIndex !== wordIndex) continue;
    const numbers = (stroke.d.match(NUMBER) ?? []).map(Number);
    const half = (stroke.strokeWidth ?? 0) / 2;
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      x0 = Math.min(x0, numbers[i] - half);
      x1 = Math.max(x1, numbers[i] + half);
      y0 = Math.min(y0, numbers[i + 1] - half);
      y1 = Math.max(y1, numbers[i + 1] + half);
    }
  }

  if (!Number.isFinite(x0)) return data.viewBox;

  const pad = (y1 - y0) * padding;
  return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2]
    .map((n) => Number(n.toFixed(2)))
    .join(' ');
}

/** `"x y w h"` -> `{ x, y, w, h }`, for tweening between two of them. */
export function parseViewBox(viewBox) {
  const [x, y, w, h] = String(viewBox).split(/[\s,]+/).map(Number);
  return { x, y, w, h };
}
