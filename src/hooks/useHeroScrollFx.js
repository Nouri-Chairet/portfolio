import { useEffect } from 'react';
import { gsap } from 'gsap';
import { subscribeScroll } from './useScrollProgress';
import { dispatchHero, HERO_EVENTS } from '../state/heroMachine';

/** Hysteresis so a scroll that hovers on the line does not flap the machine. */
const DEPART_AT = 0.35;
const RETURN_AT = 0.2;

/**
 * The hero's DOM parallax: the spinning star, and the text sliding down and
 * shrinking as the section leaves.
 *
 * These were four separate ScrollTriggers against `.hero`. They are now two
 * paused timelines scrubbed from the shared scroll progress, so the site has
 * one trigger total (see hooks/useScrollProgress.js).
 *
 * Under prefers-reduced-motion the hook does nothing at all: no transforms are
 * applied and the content simply sits where the stylesheet puts it, which
 * keeps it fully readable while scrolling.
 */
export default function useHeroScrollFx({ enabled, reducedMotion, starRef }) {
  useEffect(() => {
    if (!enabled || reducedMotion) return undefined;

    let smoothed;
    let immediate;

    const ctx = gsap.context(() => {
      // Weighty motion, scrub-smoothed. Was `scrub: 1`.
      smoothed = gsap.timeline({ paused: true });
      if (starRef?.current) {
        smoothed.fromTo(
          starRef.current,
          { y: 0, rotation: 0 },
          { rotation: 960, y: 920, duration: 1 },
          0
        );
      }

      // Dialogue parallax, tracking the scrollbar exactly. Was `scrub: 0`.
      // Offsets are viewport fractions, not the raw pixels this was authored
      // with (x: 390, y: 130 on a 1600x900 desktop). At 360px wide those threw
      // the speech bubble clean off the right-hand edge of the screen.
      immediate = gsap.timeline({ paused: true });
      immediate
        .fromTo(
          '.hero-talk-anchor',
          { x: 0, y: 0, scale: 1 },
          {
            x: () => window.innerWidth * 0.24,
            y: () => window.innerHeight * 0.14,
            scale: 0.4,
            duration: 1,
          },
          0
        );
      // `.hero-name` and `.hero-welcome` used to be tweened here too. They are
      // the navbar's logo now (components/SiteNav.jsx) and must not drift with
      // the hero: the header is fixed and outlives this section.
    });

    const unsubscribe = subscribeScroll((s) => {
      smoothed?.progress(s.hero);
      immediate?.progress(s.heroRaw);
    });

    return () => {
      unsubscribe();
      ctx.revert();
    };
  }, [enabled, reducedMotion, starRef]);
}

/**
 * Drives the machine's departure transitions from scroll position.
 *
 * Independent of the parallax above so it keeps working under reduced motion —
 * the visitor still scrolls, the hero still leaves, other components still need
 * to know.
 */
export function useHeroDeparture({ enabled }) {
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeScroll((s) => {
      if (s.heroRaw >= DEPART_AT) dispatchHero(HERO_EVENTS.SCROLL_AWAY);
      else if (s.heroRaw <= RETURN_AT) dispatchHero(HERO_EVENTS.SCROLL_BACK);
    });
  }, [enabled]);
}
