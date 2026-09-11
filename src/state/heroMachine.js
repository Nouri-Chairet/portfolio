import { useSyncExternalStore } from 'react';

/**
 * The hero's explicit state machine.
 *
 * Every transition is caused by something real: an asset finishing, a GSAP
 * timeline calling onComplete, a scroll threshold being crossed, or a user
 * click. Nothing here advances on a wall-clock timer. Before this existed the
 * hero ran on four bare setTimeouts (6000 / 8100 / 15400 / 700 ms) that
 * assumed the models had finished downloading by second eight.
 *
 * The entrance is staged, and each stage ends because the previous one
 * genuinely finished:
 *
 *   loading            assets in flight, Loader on screen, scroll free
 *   intro_locked       full-viewport intro panel, SCROLL LOCKED, the two lines
 *                      write themselves out
 *   navbar_morphing    the panel collapses upward into the top navbar and the
 *                      handwritten "Nouri" flies into the logo slot. Still
 *                      locked — the page must not move under a morph that is
 *                      measuring DOM boxes.
 *   character_entering scroll is UNLOCKED (the navbar has landed), and the UFO
 *                      and character fly in along their motion paths
 *   hero_ready         the character has settled; the hero is interactive
 *   exploring          visitor has opened the character's dialogue
 *   departing          hero has scrolled far enough to be on its way out
 *   projects           visitor left for the projects section
 *
 * `intro_locked` and `navbar_morphing` replace the old `intro_writing`, and
 * `hero_ready` replaces `intro_settled`. There is no parallel "is the intro
 * done" boolean anywhere — every consumer reads this table through one of the
 * predicates below.
 *
 * Read the current state anywhere with `useHeroState()`.
 */

export const HERO_STATES = {
  LOADING: 'loading',
  INTRO_LOCKED: 'intro_locked',
  NAVBAR_MORPHING: 'navbar_morphing',
  CHARACTER_ENTERING: 'character_entering',
  HERO_READY: 'hero_ready',
  EXPLORING: 'exploring',
  DEPARTING: 'departing',
  PROJECTS: 'projects',
};

export const HERO_EVENTS = {
  /** Critical assets are decoded and the minimum Loader time has elapsed. */
  ASSETS_READY: 'ASSETS_READY',
  /** The handwriting timeline reached its end (onComplete). */
  WRITING_COMPLETE: 'WRITING_COMPLETE',
  /** The collapse-into-navbar timeline reached its end (onComplete). */
  NAVBAR_LANDED: 'NAVBAR_LANDED',
  /** The character's fly-in motion path reached its end (onComplete). */
  CHARACTER_SETTLED: 'CHARACTER_SETTLED',
  /** "Skip", Escape, prefers-reduced-motion, or a deep link into a project. */
  SKIP: 'SKIP',
  /**
   * The bounded-lock ceiling expired. Same destination as SKIP; a separate
   * event so the reason a visitor was released is legible in a trace rather
   * than being indistinguishable from a click they never made.
   */
  FAILSAFE: 'FAILSAFE',
  /** Visitor opened the character's dialogue — the hero has been engaged. */
  ENGAGE: 'ENGAGE',
  /** Scroll progress crossed the departure threshold. */
  SCROLL_AWAY: 'SCROLL_AWAY',
  /** Scrolled back up above the threshold. */
  SCROLL_BACK: 'SCROLL_BACK',
  OPEN_PROJECTS: 'OPEN_PROJECTS',
  RESET: 'RESET',
};

const {
  LOADING,
  INTRO_LOCKED,
  NAVBAR_MORPHING,
  CHARACTER_ENTERING,
  HERO_READY,
  EXPLORING,
  DEPARTING,
  PROJECTS,
} = HERO_STATES;

/**
 * Every stage of the entrance accepts SKIP and FAILSAFE and lands on the same
 * place: hero_ready, which is exactly "state 4 complete". Nothing in the
 * sequence can be entered from which there is no way out.
 */
const ESCAPES = { SKIP: HERO_READY, FAILSAFE: HERO_READY, OPEN_PROJECTS: PROJECTS };

const TRANSITIONS = {
  [LOADING]: {
    ...ESCAPES,
    ASSETS_READY: INTRO_LOCKED,
  },
  [INTRO_LOCKED]: {
    ...ESCAPES,
    WRITING_COMPLETE: NAVBAR_MORPHING,
  },
  [NAVBAR_MORPHING]: {
    ...ESCAPES,
    NAVBAR_LANDED: CHARACTER_ENTERING,
  },
  [CHARACTER_ENTERING]: {
    ...ESCAPES,
    CHARACTER_SETTLED: HERO_READY,
    // Scroll is already free here, so a fast scroller can leave before the
    // character lands. The hero has to be allowed to depart mid-arrival.
    SCROLL_AWAY: DEPARTING,
  },
  [HERO_READY]: {
    ENGAGE: EXPLORING,
    SKIP: HERO_READY,
    SCROLL_AWAY: DEPARTING,
    OPEN_PROJECTS: PROJECTS,
  },
  [EXPLORING]: {
    SCROLL_AWAY: DEPARTING,
    OPEN_PROJECTS: PROJECTS,
  },
  [DEPARTING]: {
    SCROLL_BACK: EXPLORING,
    OPEN_PROJECTS: PROJECTS,
  },
  [PROJECTS]: {
    RESET: LOADING,
  },
};

/** States in which the hero is past its entrance and fully usable. */
export const SETTLED_STATES = new Set([HERO_READY, EXPLORING, DEPARTING]);

/** True once the entrance is over and the hero is interactive. */
export function isSettled(state) {
  return SETTLED_STATES.has(state);
}

/**
 * The two stages during which the page must not move: the writing, and the
 * morph that measures DOM boxes to fly the logo into place.
 *
 * The lock is released the moment the navbar lands, not when the character
 * settles — the visitor should be free to scroll away while the UFO is still
 * on its way in.
 */
const LOCKED_STATES = new Set([INTRO_LOCKED, NAVBAR_MORPHING]);

export function isScrollLocked(state) {
  return LOCKED_STATES.has(state);
}

/** The staged entrance is still running (steps 1-4 of the sequence). */
const SEQUENCE_STATES = new Set([LOADING, INTRO_LOCKED, NAVBAR_MORPHING, CHARACTER_ENTERING]);

export function isIntroSequence(state) {
  return SEQUENCE_STATES.has(state);
}

/**
 * Whether the hero's 3D belongs on screen. One state earlier than `isSettled`:
 * the character has to be mounted in order to fly in.
 */
export function hasCharacter(state) {
  return state === CHARACTER_ENTERING || SETTLED_STATES.has(state);
}

/**
 * Whether the navbar is in its landed, bar-shaped form. True for every state
 * from character_entering onwards, and false while the intro panel is still
 * full-viewport or mid-collapse.
 */
export function isNavbarLanded(state) {
  return state === CHARACTER_ENTERING || SETTLED_STATES.has(state) || state === PROJECTS;
}

let current = LOADING;
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

export function getHeroState() {
  return current;
}

export function subscribeHeroState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Apply an event. Returns the resulting state. Events that are not legal for
 * the current state are ignored — that is the point of a table-driven machine:
 * a stray SCROLL_AWAY while still loading cannot skip the intro, and a late
 * CHARACTER_SETTLED arriving after the failsafe already released the visitor
 * cannot drag them back into the sequence.
 */
export function dispatchHero(event) {
  const next = TRANSITIONS[current]?.[event];
  if (!next || next === current) return current;
  current = next;
  emit();
  return current;
}

/** Hero unmounted (route change); start over. */
export function resetHeroState() {
  if (current === LOADING) return;
  current = LOADING;
  emit();
}

export function useHeroState() {
  return useSyncExternalStore(subscribeHeroState, getHeroState, getHeroState);
}
