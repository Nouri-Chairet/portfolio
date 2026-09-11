import { useCallback, useEffect, useMemo } from 'react';
import {
  HERO_EVENTS,
  HERO_STATES,
  dispatchHero,
  isIntroSequence,
  isNavbarLanded,
  isScrollLocked,
  useHeroState,
} from '../state/heroMachine';
import useAssetGate from './useAssetGate';
import usePrefersReducedMotion from './usePrefersReducedMotion';
import useScrollLock from './useScrollLock';
import { useDeviceTier } from '../state/deviceTier';
import { projectIdFromHash } from '../data/projects';
import { SKILLS_HASH } from '../data/skills';
import { WRITING_BUDGET } from './useHeroIntro';

/**
 * The staged entrance, and the rules that stop it from becoming a trap.
 *
 *   1. intro_locked        full-viewport panel, scroll locked, handwriting
 *   2. navbar_morphing     panel collapses into the navbar, still locked
 *   3. character_entering  scroll UNLOCKED, UFO and character fly in
 *   4. hero_ready          character settled, hero interactive
 *
 * Each step ends because the previous one reported completion — a GSAP
 * `onComplete`, not an elapsed time. What this hook adds is every way *out*.
 */

/** The collapse-into-navbar timeline's duration, in seconds. */
export const MORPH_DURATION = 0.72;

/**
 * Hard ceiling on the locked stages, in milliseconds.
 *
 * The sequence is driven by animation callbacks, and a callback is a promise
 * that something will happen — not a guarantee. A model that 404s, a
 * `getBoundingClientRect` that returns zeros in a backgrounded tab, a GSAP
 * context reverted by a hot reload mid-flight, a browser that throttles rAF
 * because the tab lost focus: any of these ends with a visitor looking at a
 * panel that will never leave, on a page that will not scroll.
 *
 * So the lock is bounded, and the bound is not negotiable by anything inside
 * the sequence. Budget for steps 1-4 is ~4.6s (writing 2.1 + morph 0.72 +
 * fly-in 1.8); six seconds is that plus enough slack to absorb a slow frame
 * without ever being long enough to feel like the site is broken.
 *
 * This is a `setTimeout`, and it is not choreography — nothing sequences off
 * it, and in a healthy run it is cleared without ever firing. It is the same
 * kind of guarantee as `maxWaitMs` in useAssetGate: a promise that the site is
 * usable even when a step it depends on never reports back.
 */
const LOCK_CEILING_MS = 6000;

/**
 * `?intro=stall` suppresses the writing's completion dispatch, so the sequence
 * hangs at step 1 exactly as it would if the timeline's onComplete never
 * fired. It exists to make LOCK_CEILING_MS testable without editing source —
 * the failsafe is the one path here that must never be taken on trust.
 */
function stallOverride() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('intro') === 'stall';
}

/**
 * A link straight into a project — or to the skills reference, the voyage's
 * other kind of rest position — should land there, not on the intro.
 */
function arrivedDeepLinked() {
  if (typeof window === 'undefined') return false;
  const { hash } = window.location;
  return Boolean(projectIdFromHash(hash)) || hash === '#projects' || hash === SKILLS_HASH;
}

export default function useIntroSequence() {
  const state = useHeroState();
  const reducedMotion = usePrefersReducedMotion();
  const has3D = useDeviceTier() !== 'low';
  const { ready, progress } = useAssetGate({ enabled: has3D });

  const stalled = useMemo(stallOverride, []);
  const deepLinked = useMemo(arrivedDeepLinked, []);

  const locked = isScrollLocked(state);
  useScrollLock(locked);

  const skip = useCallback(() => dispatchHero(HERO_EVENTS.SKIP), []);

  // Assets are in → begin.
  //
  // Reduced motion is a different path, not a faster one: there is no lock, no
  // collapse and no fly-in. The navbar is simply already a navbar, the writing
  // is already written and the character is already at rest. Same for someone
  // who followed a link into a project — holding them at an intro they did not
  // ask for, on the way to a page they did, would be indefensible.
  useEffect(() => {
    if (!ready) return;
    const straightThrough = reducedMotion || deepLinked;
    dispatchHero(straightThrough ? HERO_EVENTS.SKIP : HERO_EVENTS.ASSETS_READY);
  }, [ready, reducedMotion, deepLinked]);

  // The bounded lock. Armed when the lock engages, cleared the moment the
  // sequence finishes by any route.
  useEffect(() => {
    if (!locked) return undefined;
    const id = setTimeout(() => dispatchHero(HERO_EVENTS.FAILSAFE), LOCK_CEILING_MS);
    return () => clearTimeout(id);
  }, [locked]);

  // Escape skips, at every stage of the entrance. Bound while the sequence is
  // running and removed after, so it can never shadow the detail panel's own
  // Escape handler.
  useEffect(() => {
    if (!isIntroSequence(state)) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dispatchHero(HERO_EVENTS.SKIP);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state]);

  // Publish the machine's state on <html>. It costs one attribute write per
  // transition and buys three things: CSS can key off the entrance without
  // prop-drilling, anything debugging a stuck entrance can read the stage
  // straight from the elements panel, and a browser test can timestamp the
  // stages with a MutationObserver instead of the site having to grow a
  // test-only global.
  useEffect(() => {
    document.documentElement.dataset.heroState = state;
    return () => {
      delete document.documentElement.dataset.heroState;
    };
  }, [state]);

  // On the no-WebGL tier there is no character to wait for, so step 4 has
  // nothing to report. Close it here rather than letting the failsafe do it
  // three seconds later — this is a known-empty stage, not a failure.
  useEffect(() => {
    if (state === HERO_STATES.CHARACTER_ENTERING && !has3D) {
      dispatchHero(HERO_EVENTS.CHARACTER_SETTLED);
    }
  }, [state, has3D]);

  return {
    state,
    reducedMotion,
    has3D,
    progress,
    /** Waiting on the models; the Loader is up and the page still scrolls. */
    loading: state === HERO_STATES.LOADING,
    /** The handwriting is running. */
    writing: state === HERO_STATES.INTRO_LOCKED,
    /** The panel is collapsing into the navbar. */
    morphing: state === HERO_STATES.NAVBAR_MORPHING,
    /** The navbar is in its bar-shaped, landed form. */
    landed: isNavbarLanded(state),
    locked,
    stalled,
    skip,
    /** Nothing left to skip once the entrance is over. */
    skippable: isIntroSequence(state),
    writingBudget: WRITING_BUDGET,
  };
}
