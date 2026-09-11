/**
 * Build-time handwriting generator.
 *
 * Produces, for each configured string, the two layers the handwriting effect
 * needs — see src/components/ui/Handwriting.jsx:
 *
 *   fill    one SVG path: the text as filled glyph outlines in Caveat.
 *           Baked to paths here so the site ships no webfont and cannot FOUT.
 *   strokes one path per pen stroke, following the *centerline* (medial axis)
 *           of each glyph, in writing order. Used as a mask over the fill, so
 *           animating DrawSVG along them reveals the letterform the way a pen
 *           lays it down.
 *
 * The centerlines are derived from the glyph shapes rather than hand-drawn:
 *
 *   1. rasterise each glyph on its own (sharp/resvg)
 *   2. distance transform -> the largest inscribed radius, which is how thick
 *      the mask stroke has to be to cover the letter
 *   3. Zhang-Suen thinning -> a 1px skeleton, i.e. the medial axis
 *   4. prune hairline spurs the thinning leaves at stroke ends
 *   5. walk the skeleton as a graph, preferring to carry straight on through
 *      junctions, so a crossing does not derail the stroke
 *   6. simplify (Ramer-Douglas-Peucker) and smooth (Catmull-Rom -> cubic)
 *
 * Usage: node scripts/generate-handwriting.mjs
 */
import opentype from 'opentype.js';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const FONT = 'assets-src/fonts/Caveat-Bold.ttf';
const OUT = 'src/generated/handwriting.js';

/** Font size, in SVG user units, that the emitted geometry is baked at. */
const FONT_SIZE = 200;
/** Raster pixels per SVG user unit. Higher = smoother centreline, slower. */
const RASTER = 2;
/** Skeleton branches shorter than this (raster px) are thinning noise. */
const MIN_SPUR = 10;
/** A side branch shorter than this is dropped rather than drawn as a stroke. */
const MIN_BRANCH = 14;
/** Ramer-Douglas-Peucker tolerance, raster px. */
const RDP_EPSILON = 1.1;
/** Safety margin on the mask stroke width. */
const STROKE_MARGIN = 1.26;

const TARGETS = [
  { key: 'HERO_NAME', text: "Hi, I'm Nouri" },
  { key: 'HERO_WELCOME', text: 'Welcome to my portfolio!' },
];

// ---------------------------------------------------------------- raster

async function rasterise(pathData, box) {
  const w = Math.ceil(box.width * RASTER);
  const h = Math.ceil(box.height * RASTER);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#000"/>` +
    `<g transform="scale(${RASTER}) translate(${-box.x},${-box.y})">` +
    `<path d="${pathData}" fill="#fff"/></g></svg>`;
  const { data } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({
    resolveWithObject: true,
  });
  const bits = new Uint8Array(w * h);
  for (let i = 0; i < bits.length; i++) bits[i] = data[i] > 127 ? 1 : 0;
  return { bits, w, h };
}

// ------------------------------------------------- distance transform

/** Chamfer 3-4 distance to the nearest background pixel, in raster px. */
function distanceTransform({ bits, w, h }) {
  const INF = 1e9;
  const d = new Float64Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = bits[i] ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? INF : d[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bits[i]) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!bits[i]) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  let max = 0;
  for (let i = 0; i < d.length; i++) if (d[i] < INF && d[i] > max) max = d[i];
  return max / 3; // chamfer units -> px
}

// ------------------------------------------------------------ thinning

const N8 = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/** Zhang-Suen thinning, in place on a copy. Returns the 1px skeleton. */
function thin({ bits, w, h }) {
  const img = Uint8Array.from(bits);
  const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of [0, 1]) {
      const doomed = [];
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          if (!get(x, y)) continue;
          const p = N8.map(([dx, dy]) => get(x + dx, y + dy));
          const b = p.reduce((a, v) => a + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (p[k] === 0 && p[(k + 1) % 8] === 1) a++;
          if (a !== 1) continue;
          // p = [N, NE, E, SE, S, SW, W, NW]
          const [N, NE, E, SE, S, SW, W, NW] = p;
          void NE; void SE; void SW; void NW;
          if (step === 0) {
            if (N * E * S !== 0) continue;
            if (E * S * W !== 0) continue;
          } else {
            if (N * E * W !== 0) continue;
            if (N * S * W !== 0) continue;
          }
          doomed.push(y * w + x);
        }
      if (doomed.length) {
        for (const i of doomed) img[i] = 0;
        changed = true;
      }
    }
  }
  return { bits: img, w, h };
}

// --------------------------------------------------------- skeleton graph

function neighbours(bits, w, h, x, y) {
  const out = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (bits[ny * w + nx]) out.push([nx, ny]);
  }
  return out;
}

/** Delete short dead-end branches left behind by thinning. */
function pruneSpurs({ bits, w, h }) {
  const img = Uint8Array.from(bits);
  let again = true;
  while (again) {
    again = false;
    const ends = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (img[y * w + x] && neighbours(img, w, h, x, y).length === 1) ends.push([x, y]);

    for (const [sx, sy] of ends) {
      if (!img[sy * w + sx]) continue;
      const branch = [];
      let [cx, cy] = [sx, sy];
      let prev = null;
      while (branch.length <= MIN_SPUR) {
        branch.push([cx, cy]);
        const next = neighbours(img, w, h, cx, cy).filter(
          ([nx, ny]) => !prev || nx !== prev[0] || ny !== prev[1]
        );
        if (next.length !== 1) break; // endpoint or junction
        prev = [cx, cy];
        [cx, cy] = next[0];
      }
      const hitJunction = neighbours(img, w, h, cx, cy).length > 2;
      if (hitJunction && branch.length < MIN_SPUR) {
        for (const [x, y] of branch) img[y * w + x] = 0;
        again = true;
      }
    }
  }
  return { bits: img, w, h };
}

function components({ bits, w, h }) {
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bits[i] || seen[i]) continue;
      const stack = [[x, y]];
      const px = [];
      seen[i] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        px.push([cx, cy]);
        for (const [nx, ny] of neighbours(bits, w, h, cx, cy)) {
          const ni = ny * w + nx;
          if (!seen[ni]) {
            seen[ni] = 1;
            stack.push([nx, ny]);
          }
        }
      }
      out.push(px);
    }
  return out;
}

/**
 * Walk one skeleton component into an ordered polyline. At a junction, carry
 * straight on (largest dot product with the incoming direction) so a crossing
 * such as the waist of an 'e' does not send the pen down a side branch.
 */
function walk(pixels, w, h) {
  const set = new Uint8Array(w * h);
  for (const [x, y] of pixels) set[y * w + x] = 1;

  const ends = pixels.filter(([x, y]) => neighbours(set, w, h, x, y).length === 1);
  // Pen entry: the leftmost endpoint, lowest one first on a tie. Closed shapes
  // ('o', the bowl of a 'd') have no endpoint — start at the leftmost pixel.
  const pool = ends.length ? ends : pixels;
  const start = pool.reduce((best, p) =>
    p[0] < best[0] || (p[0] === best[0] && p[1] > best[1]) ? p : best
  );

  const visited = new Uint8Array(w * h);
  const strokes = [];
  let queue = [start];

  while (queue.length) {
    const from = queue.shift();
    if (visited[from[1] * w + from[0]]) continue;
    const line = [];
    let cur = from;
    let dir = null;
    while (cur) {
      visited[cur[1] * w + cur[0]] = 1;
      line.push(cur);
      const next = neighbours(set, w, h, cur[0], cur[1]).filter(
        ([nx, ny]) => !visited[ny * w + nx]
      );
      if (!next.length) break;
      let pick = next[0];
      if (dir && next.length > 1) {
        let bestScore = -Infinity;
        for (const n of next) {
          const vx = n[0] - cur[0];
          const vy = n[1] - cur[1];
          const len = Math.hypot(vx, vy) || 1;
          const score = (vx / len) * dir[0] + (vy / len) * dir[1];
          if (score > bestScore) {
            bestScore = score;
            pick = n;
          }
        }
        for (const n of next) if (n !== pick) queue.push(n);
      } else if (next.length > 1) {
        for (const n of next.slice(1)) queue.push(n);
      }
      const dx = pick[0] - cur[0];
      const dy = pick[1] - cur[1];
      const dl = Math.hypot(dx, dy) || 1;
      dir = [dx / dl, dy / dl];
      cur = pick;
    }
    if (line.length > 1) strokes.push(line);
    queue = queue.filter(([x, y]) => !visited[y * w + x]);
  }
  return strokes;
}

// --------------------------------------------------------- path building

/**
 * Thinning eats the last few pixels at each stroke end, so the skeleton stops
 * short of the letter's tip and a sliver of the fill is never revealed.
 * Extrapolate both ends along the local tangent by the stroke's own radius,
 * which is exactly the distance from the medial axis to the outline.
 */
function extendEnds(points, amount) {
  if (points.length < 3 || amount <= 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  // A closed loop ('o', the bowl of a 'd') has no ends to extend.
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 3) return points;

  const look = Math.min(4, points.length - 1);
  const lead = (from, to) => {
    const dx = from[0] - to[0];
    const dy = from[1] - to[1];
    const len = Math.hypot(dx, dy) || 1;
    return [from[0] + (dx / len) * amount, from[1] + (dy / len) * amount];
  };
  return [
    lead(first, points[look]),
    ...points,
    lead(last, points[points.length - 1 - look]),
  ];
}

function rdp(points, epsilon) {
  if (points.length < 3) return points;
  let maxD = 0;
  let idx = 0;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const norm = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / norm;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= epsilon) return [points[0], points[points.length - 1]];
  return [
    ...rdp(points.slice(0, idx + 1), epsilon).slice(0, -1),
    ...rdp(points.slice(idx), epsilon),
  ];
}

/** Catmull-Rom through the points, emitted as cubic beziers. */
function toPath(points, project, precision = 1) {
  const p = points.map(project);
  const r = (n) => Number(n.toFixed(precision));
  if (p.length < 2) return '';
  let d = `M${r(p[0][0])} ${r(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r(c1[0])} ${r(c1[1])},${r(c2[0])} ${r(c2[1])},${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

// ------------------------------------------------------------- per glyph

/**
 * Serialise a glyph outline, offset by `dx`, without going through
 * opentype.js's own toPathData.
 *
 * Asking opentype for an already-translated path (`glyph.getPath(penX, ...)`)
 * emits literal `NaN` tokens once penX gets past roughly 700 — 206 of them for
 * "Welcome to my portfolio!", at every precision setting. resvg shrugs those
 * off, which is why the offline previews looked perfect, but a browser stops
 * parsing a `d` at the first bad token and renders only what came before it:
 * the second line silently truncated to "Welcome t". Glyph outlines at the
 * origin are clean, so translate the commands here instead.
 */
function serialiseGlyph(glyph, dx, baselineY, size, precision = 1) {
  const path = glyph.getPath(0, baselineY, size);
  const r = (n) => Number(n.toFixed(precision));
  let d = '';
  for (const c of path.commands) {
    switch (c.type) {
      case 'M':
        d += `M${r(c.x + dx)} ${r(c.y)}`;
        break;
      case 'L':
        d += `L${r(c.x + dx)} ${r(c.y)}`;
        break;
      case 'Q':
        d += `Q${r(c.x1 + dx)} ${r(c.y1)} ${r(c.x + dx)} ${r(c.y)}`;
        break;
      case 'C':
        d += `C${r(c.x1 + dx)} ${r(c.y1)} ${r(c.x2 + dx)} ${r(c.y2)} ${r(c.x + dx)} ${r(c.y)}`;
        break;
      case 'Z':
        d += 'Z';
        break;
      default:
        break;
    }
  }
  const bb = path.getBoundingBox();
  return { d, bbox: { x1: bb.x1 + dx, y1: bb.y1, x2: bb.x2 + dx, y2: bb.y2 } };
}

async function glyphStrokes(font, glyph, penX, baselineY) {
  // Rasterise with the glyph at the origin, not at its position in the line.
  // resvg drops the path entirely once the transform offset gets into the
  // thousands, which silently produced blank bitmaps for every glyph past
  // "portfolio". penX is re-applied when the skeleton is projected back out.
  const path = glyph.getPath(0, baselineY, FONT_SIZE);
  const d = path.toPathData(3);
  if (!d) return null;
  const bb = path.getBoundingBox();
  if (!Number.isFinite(bb.x1) || bb.x2 - bb.x1 <= 0) return null;

  const pad = 3;
  const box = {
    x: bb.x1 - pad,
    y: bb.y1 - pad,
    width: bb.x2 - bb.x1 + pad * 2,
    height: bb.y2 - bb.y1 + pad * 2,
  };

  const raster = await rasterise(d, box);
  const radius = distanceTransform(raster);
  const skeleton = pruneSpurs(thin(raster));

  const project = ([px, py]) => [penX + box.x + px / RASTER, box.y + py / RASTER];

  const parts = components(skeleton)
    .filter((c) => c.length > 2)
    // Body of the letter first, then the marks that finish it (the dot on an
    // 'i', the bar on a 't') — the order a hand actually writes them.
    .sort((a, b) => b.length - a.length);

  const strokes = [];
  for (const part of parts) {
    const lines = walk(part, skeleton.w, skeleton.h);
    // The first line out of a component is its main pen path; anything else is
    // a side branch. Keep only branches long enough to be a real mark, or the
    // letter shatters into a dozen twitchy fragments.
    lines.forEach((line, i) => {
      if (i > 0 && line.length < MIN_BRANCH) return;
      const dd = toPath(extendEnds(rdp(line, RDP_EPSILON), radius), project);
      if (dd) strokes.push(dd);
    });
  }

  return {
    strokes,
    // The glyph's own outline, positioned at penX. Built from the same origin
    // geometry the centrelines came from, so fill and mask cannot drift apart.
    ...(() => {
      const { d: fill, bbox } = serialiseGlyph(glyph, penX, baselineY, FONT_SIZE);
      return { fill, bbox };
    })(),
    // Diameter of the largest inscribed circle: the width the mask needs.
    strokeWidth: Number(((radius * 2 * STROKE_MARGIN) / RASTER).toFixed(2)),
  };
}

// ------------------------------------------------------------------ main

async function build(font, text) {
  const baselineY = 0;
  const glyphs = font.stringToGlyphs(text);
  const scale = FONT_SIZE / font.unitsPerEm;

  const out = [];
  let penX = 0;
  let wordIndex = 0;

  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const char = text[i];
    const advance = glyph.advanceWidth * scale;

    if (char === ' ') {
      wordIndex++;
      penX += advance;
      continue;
    }

    const built = await glyphStrokes(font, glyph, penX, baselineY);
    if (built?.strokes.length) {
      out.push({ char, wordIndex, ...built });
    } else if (built) {
      console.warn(`  ! no centreline for "${char}" (index ${i})`);
    }

    const kern = glyphs[i + 1] ? font.getKerningValue(glyph, glyphs[i + 1]) * scale : 0;
    penX += advance + kern;
  }

  // Concatenate the per-glyph outlines rather than calling
  // font.getPath(text, ...). opentype.js emits NaN coordinates when it
  // accumulates this particular run (206 of them for "Welcome to my
  // portfolio!", at every precision) — resvg tolerates that, but a browser
  // stops parsing the `d` at the first bad token and silently renders only
  // the part before it, which truncated the line to "Welcome t". Per-glyph
  // paths are clean, and reusing them guarantees fill and mask share one
  // coordinate system.
  const fillData = out.map((g) => g.fill).join('');
  const bb = out.reduce(
    (acc, g) => ({
      x1: Math.min(acc.x1, g.bbox.x1),
      y1: Math.min(acc.y1, g.bbox.y1),
      x2: Math.max(acc.x2, g.bbox.x2),
      y2: Math.max(acc.y2, g.bbox.y2),
    }),
    { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  );
  if (/NaN|Infinity/.test(fillData)) {
    throw new Error(`fill path for "${text}" contains non-finite coordinates`);
  }
  const maxStroke = Math.max(...out.map((g) => g.strokeWidth), 0);
  const pad = maxStroke / 2 + 4;
  const viewBox = [
    Number((bb.x1 - pad).toFixed(2)),
    Number((bb.y1 - pad).toFixed(2)),
    Number((bb.x2 - bb.x1 + pad * 2).toFixed(2)),
    Number((bb.y2 - bb.y1 + pad * 2).toFixed(2)),
  ];

  const strokes = [];
  out.forEach((g, glyphIndex) => {
    g.strokes.forEach((d, k) => {
      strokes.push({
        d,
        char: g.char,
        glyphIndex,
        wordIndex: g.wordIndex,
        strokeWidth: g.strokeWidth,
        // Marks (the dot of an 'i') come after the body of the same glyph.
        isMark: k > 0,
      });
    });
  });

  return {
    text,
    viewBox: viewBox.join(' '),
    fill: fillData,
    strokes,
  };
}

const font = opentype.parse(readFileSync(FONT).buffer);
const result = {};
for (const { key, text } of TARGETS) {
  process.stdout.write(`building ${key} "${text}" ... `);
  result[key] = await build(font, text);
  console.log(`${result[key].strokes.length} strokes`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `// GENERATED by scripts/generate-handwriting.mjs — do not edit by hand.\n` +
    `// Source font: ${FONT} (Caveat, SIL OFL 1.1). Run \`npm run assets:handwriting\`.\n` +
    Object.entries(result)
      .map(([k, v]) => `export const ${k} = ${JSON.stringify(v, null, 2)};\n`)
      .join('\n') +
    `\nexport default { ${Object.keys(result).join(', ')} };\n`
);
console.log(`\nwrote ${OUT}`);
