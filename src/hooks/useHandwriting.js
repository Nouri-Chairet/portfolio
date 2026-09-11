import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import DrawSVGPlugin from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin);

/**
 * Shared handwriting sequencer.
 *
 * Strokes are drawn strictly in reading order — left to right, one after the
 * next — because that is the only order that reads as writing. The previous
 * implementation paired stroke `i` with stroke `n-1-i` and grew the word
 * inwards from both ends at once, which looks like a wipe, not a pen.
 *
 * Timing rules:
 *   - a stroke's duration scales with its own path length, so a long sweep
 *     takes longer than a dot
 *   - ±15% deterministic jitter per stroke, so repeated letters do not tick
 *     along at machine-identical speed (seeded from the character, so it is
 *     stable across renders and reloads)
 *   - each stroke starts slightly before the previous one ends (OVERLAP), the
 *     way a hand is already moving into the next letter
 *   - a longer beat at word boundaries, where a hand actually pauses
 *   - 'power1.inOut' per stroke: accelerate off the mark, ease into the end
 */

const SPEED = 620; // user units per second
const MIN_DURATION = 0.09;
const MAX_DURATION = 0.5;
const OVERLAP = 0.35; // fraction of the previous stroke's duration
const MARK_GAP = 0.05; // before the dot on an i, the bar on a t
const WORD_PAUSE = 0.22;
const JITTER = 0.15;

/** Per-stroke metadata the sequencer needs, from the generated data. */
export function strokeMeta(data) {
  return data.strokes.map((s) => ({
    char: s.char,
    wordIndex: s.wordIndex,
    isMark: s.isMark,
  }));
}

/** Deterministic pseudo-random in [-1, 1] from a string+index seed. */
function jitterFor(char, index) {
  const seed = (char?.charCodeAt(0) ?? 0) * 31 + index * 17;
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

/**
 * Append one line's strokes to a timeline.
 *
 * @param timeline  gsap timeline to write into
 * @param paths     SVGPathElement[] in writing order
 * @param meta      [{ char, wordIndex, isMark }] parallel to `paths`
 * @param startAt   absolute position on the timeline
 * @param pen       optional element to ride the stroke head
 * @param fillColor optional colour to flood each glyph with once its outline
 *                  is drawn (the "My Projects" title works this way — it
 *                  strokes outlines rather than masking a filled layer)
 * @param speedMultiplier scales this line's writing speed and pauses
 * @returns the absolute time the line finishes
 */
export function appendHandwriting(
  timeline,
  paths,
  meta,
  startAt = 0,
  pen = null,
  fillColor = null,
  speedMultiplier = 1
) {
  let at = startAt;
  let previousWord = meta[0]?.wordIndex ?? 0;
  let previousDuration = 0;

  paths.forEach((path, i) => {
    if (!path) return;
    const info = meta[i] ?? {};
    const length = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 120;
    const base = gsap.utils.clamp(MIN_DURATION, MAX_DURATION, length / SPEED);
    const duration = (base * (1 + JITTER * jitterFor(info.char, i))) / speedMultiplier;

    if (i > 0) {
      // Carry the hand into the next stroke, then add the pauses a writer makes.
      at -= previousDuration * OVERLAP;
      if (info.wordIndex !== previousWord) at += WORD_PAUSE / speedMultiplier;
      if (info.isMark) at += MARK_GAP / speedMultiplier;
    }

    timeline.fromTo(
      path,
      { drawSVG: '0% 0%' },
      { drawSVG: '0% 100%', duration, ease: 'power1.inOut' },
      at
    );

    if (pen) {
      timeline.to(
        pen,
        {
          motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
          duration,
          ease: 'power1.inOut',
        },
        at
      );
    }

    if (fillColor) {
      timeline.to(
        path,
        { fill: fillColor, duration: 0.22 / speedMultiplier, ease: 'circ.in' },
        at + duration
      );
    }

    previousWord = info.wordIndex;
    previousDuration = duration;
    at += duration;
  });

  return at;
}

/**
 * Drives one or more lines of handwriting.
 *
 * Each group carries its own optional pen, because MotionPathPlugin needs the
 * sprite and the path to share a coordinate space and every line is its own
 * <svg> with its own viewBox.
 *
 * @param groups        [{ paths, meta, pen }] in the order they are written
 * @param active        run the animation
 * @param written       land fully written even if the animation never ran.
 *                      Needed because the entrance can be skipped before the
 *                      writing starts at all: without it the `!active` branch
 *                      below wound every stroke back to 0% and the navbar logo
 *                      came up blank.
 * @param reducedMotion render fully written, instantly, with no animation
 * @param onComplete    called once the last stroke lands
 * @param maxDuration   hard ceiling in seconds. The per-stroke rules above
 *                      produce whatever duration the glyphs happen to need —
 *                      "Hi, I'm Nouri" plus "Welcome to my portfolio!" comes
 *                      to about eight seconds at a natural pace, which is far
 *                      too long to hold someone at the door. Rather than
 *                      hand-tuning a speed constant that silently drifts the
 *                      next time the copy changes, the built timeline is
 *                      measured and time-scaled to fit. The rhythm — overlaps,
 *                      word pauses, per-stroke jitter — is preserved exactly;
 *                      only the clock rate changes.
 */
export default function useHandwriting({
  groups,
  active,
  written = false,
  reducedMotion,
  onComplete,
  fillColor = null,
  maxDuration = null,
}) {
  const doneRef = useRef(false);

  useEffect(() => {
    const resolved = groups.filter((g) => g?.paths?.length);
    if (!resolved.length) return undefined;
    const allPaths = resolved.flatMap((g) => g.paths).filter(Boolean);

    const pens = resolved.map((g) => g.pen?.current).filter(Boolean);

    if (reducedMotion) {
      // Final written state, no movement.
      gsap.set(allPaths, { drawSVG: '0% 100%' });
      if (fillColor) gsap.set(allPaths, { fill: fillColor });
      if (pens.length) gsap.set(pens, { autoAlpha: 0 });
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete?.();
      }
      return undefined;
    }

    if (!active) {
      // Once the writing has finished (or been skipped straight to the end),
      // leave it on screen. Resetting here is what blanked the hero after
      // "Skip intro": the cleanup below completes the timeline, then this
      // branch ran and wound every stroke back to 0%.
      const isWritten = written || doneRef.current;
      gsap.set(allPaths, { drawSVG: isWritten ? '0% 100%' : '0% 0%' });
      if (fillColor) gsap.set(allPaths, { fill: isWritten ? fillColor : 'none' });
      return undefined;
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        doneRef.current = true;
        onComplete?.();
      },
    });

    if (pens.length) gsap.set(pens, { autoAlpha: 0 });

    let at = 0;
    for (const group of resolved) {
      const pen = group.pen?.current ?? null;
      if (pen) timeline.set(pen, { autoAlpha: 1 }, at);
      const end = appendHandwriting(
        timeline,
        group.paths,
        group.meta,
        at,
        pen,
        fillColor,
        group.speedMultiplier
      );
      // The pen lifts off the page when its line is finished.
      if (pen) {
        timeline.to(pen, { autoAlpha: 0, duration: 0.2 / (group.speedMultiplier ?? 1) }, end);
      }
      at = end;
    }

    if (maxDuration) {
      const natural = timeline.duration();
      if (natural > maxDuration) timeline.timeScale(natural / maxDuration);
    }

    return () => {
      // Land on the finished text rather than reverting — a revert would erase
      // the writing the moment the intro is skipped.
      timeline.progress(1);
      timeline.kill();
    };
  }, [groups, active, written, reducedMotion, onComplete, fillColor, maxDuration]);
}
