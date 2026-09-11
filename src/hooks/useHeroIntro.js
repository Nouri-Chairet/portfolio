import { useMemo, useRef } from 'react';
import useHandwriting, { strokeMeta } from './useHandwriting';
import { HERO_NAME, HERO_WELCOME } from '../generated/handwriting';

export { HERO_NAME, HERO_WELCOME };

/**
 * The writing's share of the entrance budget, in seconds.
 *
 * Steps 1-4 of the entrance have to land inside five seconds:
 *
 *   writing        WRITING_BUDGET
 *   navbar morph   MORPH_DURATION   (components/SiteNav.jsx)
 *   character      FLY_IN_DURATION  (scene/Astronaut.jsx, scene/Ufo.jsx)
 *
 * Held here as a named constant rather than buried in a speed multiplier so
 * the three add up somewhere a reader can check them.
 */
export const WRITING_BUDGET = 2.1;

/**
 * Relative pace of the two lines. The welcome line is nearly twice as long as
 * the name, so at an equal rate it would take twice as long to write and the
 * entrance would feel back-heavy. Only the ratio matters — the absolute rate
 * is set by WRITING_BUDGET, which the sequencer time-scales the finished
 * timeline to fit.
 */
const NAME_PACE = 1;
const WELCOME_PACE = 1.9;

/**
 * Writes the hero's two lines by hand, then reports completion.
 *
 * This used to type the text with GSAP's TextPlugin. It now animates a
 * centreline mask over baked glyph outlines — see useHandwriting.js and
 * components/ui/Handwriting.jsx.
 *
 * Both lines share ONE timeline, so "Welcome to my portfolio!" starts because
 * "Hi, I'm Nouri" finished, not on a delay that has to be kept in sync. The
 * navbar morph begins off this hook's `onComplete`, so the panel collapses
 * when the writing genuinely ends.
 *
 * Returns the refs the markup must attach:
 *   nameRefs / welcomeRefs  arrays of mask stroke paths, in writing order
 *   namePen / welcomePen    the star sprite riding each line's pen head
 *
 * @param active        run the animation (state === intro_locked)
 * @param written       land fully written without animating (the entrance was
 *                      skipped, possibly before the writing ever started)
 * @param reducedMotion render the finished writing instantly
 * @param onComplete    called exactly once when the last stroke lands
 */
export default function useHeroIntro({ active, written, reducedMotion, onComplete }) {
  const nameRefs = useRef([]);
  const welcomeRefs = useRef([]);
  const namePen = useRef(null);
  const welcomePen = useRef(null);

  // `refs.current` arrays are mutated in place by the ref callbacks, never
  // reassigned, so this identity is stable and the sequencer does not re-run.
  const groups = useMemo(
    () => [
      {
        paths: nameRefs.current,
        meta: strokeMeta(HERO_NAME),
        pen: namePen,
        speedMultiplier: NAME_PACE,
      },
      {
        paths: welcomeRefs.current,
        meta: strokeMeta(HERO_WELCOME),
        pen: welcomePen,
        speedMultiplier: WELCOME_PACE,
      },
    ],
    []
  );

  useHandwriting({
    groups,
    active,
    written,
    reducedMotion,
    onComplete,
    maxDuration: WRITING_BUDGET,
  });

  return { nameRefs, welcomeRefs, namePen, welcomePen };
}
