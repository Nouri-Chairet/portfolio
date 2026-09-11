import { useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

// ScrollToPlugin is registered here because scrollToVoyageProgress() below
// uses it, and this module is imported by every scroll consumer on the site.
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/**
 * The single scroll-progress source of truth for the whole site.
 *
 * Exactly one ScrollTrigger exists against `.hero`. It is created here by
 * `useHeroScrollTrigger`, which `sections/Hero.jsx` mounts once. Everything
 * else — the 3D exit in HeroView, the hero's DOM parallax, and the state
 * machine's departure threshold — *reads* from this module. Do not create
 * another ScrollTrigger against `.hero`.
 *
 * Two values are published because the original animations used two different
 * scrub settings and they look meaningfully different:
 *
 *   hero     scrub-smoothed (≈1s catch-up). Drives the astronaut, the UFO and
 *            the spinning star — motion that should feel weighty.
 *   heroRaw  the trigger's immediate progress, no smoothing. Drives the text
 *            parallax, which was authored with `scrub: 0` and looks laggy if
 *            smoothed.
 *
 * The trigger only ever *measures*. It applies no motion of its own, so it is
 * created even under prefers-reduced-motion — that keeps the state machine's
 * scroll thresholds working. Consumers are responsible for not moving anything
 * when reduced motion is set.
 *
 * Progress lives on a module-level mutable object rather than React state
 * because it changes every scroll frame. Read it from `useFrame` or an
 * imperative subscription; only use the reactive hook for DOM UI.
 */

/**
 * With ?perf=1, `window.__gsap()` lists every live ScrollTrigger and every
 * tween GSAP is holding, with what each one animates.
 *
 * Rule 6 says there are exactly three triggers and that nothing else may add
 * one; when a feature is removed, its tweens and triggers have to go with it.
 * Both claims are about what is alive at runtime, so they should be checkable
 * at runtime — this is the answer to "are there any orphans?".
 */
if (typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('perf') === '1') {
  const describe = (target) => {
    if (!target) return String(target);
    if (target.nodeType === 1) {
      return `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${
        target.classList.length ? `.${[...target.classList].join('.')}` : ''}`;
    }
    return Object.keys(target).slice(0, 6).join(',');
  };
  window.__gsap = () => {
    const triggers = ScrollTrigger.getAll().map((t) => ({
      trigger: describe(t.trigger),
      pin: Boolean(t.pin),
      snap: Boolean(t.vars.snap),
      animation: Boolean(t.animation),
    }));
    // Nested too: the voyage's master timeline is paused and attached to its
    // trigger, and its children are where a leftover track would hide.
    const tweens = gsap.globalTimeline
      .getChildren(true, true, false)
      .map((tw) => ({
        targets: tw.targets().map(describe),
        props: Object.keys(tw.vars).filter((k) => !/^(ease|duration|delay|onUpdate|onComplete|immediateRender|lazy|stagger|overwrite|data|parent|runBackwards|startAt|motionPath)$/.test(k)),
      }));
    return { triggers, tweens };
  };
}

const scrollState = {
  hero: 0,
  heroRaw: 0,
  /** Master progress of the projects voyage, 0..1. */
  voyage: 0,
  /** Per-section progress, keyed by id. Populated by useSectionProgress. */
  sections: Object.create(null),
};

/**
 * Scratch list used by useVoyageScrollTrigger to carry listener teardowns out
 * of the gsap.context() callback, which reverts animations but knows nothing
 * about DOM listeners.
 */
const ctxCleanups = [];

/** Called on every update — for rAF/useFrame consumers. No React involved. */
const imperativeSubscribers = new Set();
/** Called at most once per frame — for components that must re-render. */
const reactSubscribers = new Set();
let flushQueued = false;

function publish() {
  for (const fn of imperativeSubscribers) fn(scrollState);
  if (reactSubscribers.size === 0 || flushQueued) return;
  flushQueued = true;
  requestAnimationFrame(() => {
    flushQueued = false;
    for (const fn of reactSubscribers) fn(scrollState.heroRaw);
  });
}

/**
 * Creates the one ScrollTrigger. Mount from exactly one component.
 * `enabled` false (e.g. hero not on screen) parks progress at 0.
 */
export function useHeroScrollTrigger({ enabled = true, trigger = '.hero' } = {}) {
  useEffect(() => {
    if (!enabled) {
      scrollState.hero = 0;
      scrollState.heroRaw = 0;
      publish();
      return undefined;
    }

    const ctx = gsap.context(() => {
      // A tween over a throwaway object, scrubbed with a 1s catch-up. Reading
      // its progress gives the smoothed value; ScrollTrigger's own onUpdate
      // gives the raw one.
      const proxy = { p: 0 };
      const smoothed = gsap.timeline();
      smoothed.to(proxy, {
        p: 1,
        duration: 1,
        ease: 'none',
        onUpdate: () => {
          scrollState.hero = proxy.p;
          publish();
        },
      });

      ScrollTrigger.create({
        trigger,
        start: 'top top',
        end: 'bottom',
        scrub: 1,
        animation: smoothed,
        onUpdate: (self) => {
          scrollState.heroRaw = self.progress;
          publish();
        },
      });
    });

    return () => ctx.revert();
  }, [enabled, trigger]);
}

/**
 * How far into a scroll segment counts as committing to its next rest point.
 *
 * Five percent: a single wheel notch or a short trackpad flick is enough to
 * commit, rather than the third of a panel's distance the first version of
 * this asked for. This is the number to raise if snapping ever feels
 * trigger-happy, or lower further if it should feel even more like paging.
 */
const SNAP_THRESHOLD = 0.05;

/**
 * Suppress snapping for this long after a keyboard or focus event.
 *
 * Tab moves focus and the browser scrolls to reveal it. Snapping on top of
 * that would drag the visitor away from the thing they just focused, which is
 * the difference between a control being reachable and being usable.
 */
const KEY_SUPPRESS_MS = 1400;

const SUPPRESS_KEYS = new Set([
  'Tab', 'PageUp', 'PageDown', 'Home', 'End',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar',
]);

/**
 * Registers one more measured section — the contact panel is the one
 * remaining caller — and publishes its progress under `scrollState.sections[id]`.
 *
 * Same contract as the hero trigger: the ScrollTrigger measures (and
 * optionally pins) but applies no motion and never snaps, so the 3D reads a
 * number rather than owning an animation.
 *
 * This used to also offer a `snap` option, briefly wired up on the contact
 * panel to make arriving at it feel like a destination. It came back as a
 * complaint, not a feature: two independent snap systems on one scroll meant
 * that finishing the voyage and drifting on toward Contact could get caught
 * and completed for you a second time, right where the visitor expected the
 * page to simply let go. The voyage is the one thing on this site allowed to
 * snap (`useVoyageScrollTrigger` below, and rule 20) — Contact is reached, not
 * snapped to.
 *
 * @param id      key to publish under
 * @param ref     ref to the panel element
 * @param pin     hold the panel while its scroll span plays out
 * @param enabled false parks progress at 0 (e.g. before the section mounts)
 */
export function useSectionProgress(
  id,
  ref,
  { pin = false, enabled = true, start = 'top top', end = '+=100%' } = {}
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) {
      scrollState.sections[id] = 0;
      publish();
      return undefined;
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start,
        end,
        pin,
        pinSpacing: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          scrollState.sections[id] = self.progress;
          publish();
        },
        onRefresh: (self) => {
          scrollState.sections[id] = self.progress;
          publish();
        },
      });
    });

    return () => {
      ctx.revert();
      delete scrollState.sections[id];
      publish();
    };
  }, [id, ref, pin, enabled, start, end]);
}


/**
 * The projects voyage: one master timeline, one ScrollTrigger, panel snapping.
 *
 * This is the second and last ScrollTrigger on the site. It replaces the three
 * that `useSectionProgress(project.id, …, { pin: true })` used to create — one
 * per project, strictly sequential, which is what produced the measured 360 px
 * of empty sky between planets. Rule 6's contract is unchanged: the trigger
 * lives here, and everything else reads numbers from it.
 *
 * `scrub: true` (not a number) is deliberate. The snap has to travel THROUGH
 * the transition rather than cut to it, so the timeline must track the scroll
 * position exactly while the snap tween moves it — a smoothed scrub would lag
 * behind its own snap and land late.
 *
 * ------------------------------------------------------------------ snapping
 *
 * `snapTo` is custom rather than 'labels' or 'labelsDirectional', because
 * nearest-label snapping has no notion of a threshold: release the scroll 49%
 * of the way to the next panel and it drags you back, which reads as the page
 * refusing to move. Instead the value is placed inside the segment between two
 * rest points and judged on how far through it is:
 *
 *   scrolling down: past THRESHOLD of the way to the next -> go on to it
 *   scrolling up:   the mirror image, so up always means back
 *
 * Because the decision is made inside whichever segment the scroll ENDED in, a
 * fast flick that crosses three panels is tidied to the nearest rest point
 * once, not caught at each one on the way.
 *
 * ScrollTrigger already declines to snap while `Math.abs(getVelocity()) >= 10`
 * or a pointer is down, so the delay below only has to cover the gap between
 * "stopped moving" and "meant to stop".
 */

export function useVoyageScrollTrigger({
  trackRef,
  stageRef,
  buildTimeline,
  labelTimes,
  enabled = true,
  pin = true,
  snap = true,
  /** () => number[] of progress values it is safe to rest at, measured live. */
  restPoints,
  onUpdate,
}) {
  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !enabled) return undefined;

    let trigger;
    let suppressUntil = 0;
    const ctx = gsap.context(() => {
      const timeline = buildTimeline();
      const duration = timeline.duration() || 1;
      /** Rest points as progress, in ascending order. */
      const allPoints = labelTimes.map((t) => t / duration);

      const usable = () => {
        const allowed = restPoints ? restPoints(allPoints) : allPoints;
        return allowed.length >= 2 ? allowed : null;
      };

    /**
     * With ?perf=1, record what the last snap decided and why. Snapping is a
     * single number returned from a closure that runs once, after the visitor
     * has stopped moving — which makes "why did it go forward" almost
     * impossible to answer from the outside.
     */
    const PERF = new URLSearchParams(window.location.search).get('perf') === '1';

      const snapTo = (value, self) => {
        const log = (result, why) => {
          if (PERF) {
            window.__snap = { value: +value.toFixed(4), result: +result.toFixed(4),
              dir: self?.direction, why, at: Math.round(performance.now()) };
          }
          return result;
        };
        if (!snap) return log(value, 'disabled');
        if (performance.now() < suppressUntil) return log(value, 'suppressed');
        const points = usable();
        if (!points) return log(value, 'no-rest-points');

        // Which segment did the scroll end in?
        let k = 0;
        while (k < points.length - 2 && value >= points[k + 1]) k += 1;
        const a = points[k];
        const b = points[k + 1];
        if (!(b > a)) return log(value, 'degenerate-segment');
        const t = (value - a) / (b - a);
        if (t <= 0) return log(a, 'at-a');
        if (t >= 1) return log(b, 'at-b');

        // `self.direction` is 1 while scrolling down, -1 while scrolling up.
        // Judging from the end of the segment the visitor came FROM is what
        // makes "up past the threshold" mean back a panel rather than on.
        const result = self.direction < 0
          ? (t < 1 - SNAP_THRESHOLD ? a : b)
          : (t > SNAP_THRESHOLD ? b : a);
        return log(result, `seg ${k} t=${t.toFixed(3)} dir=${self.direction} n=${points.length}`);
      };

      trigger = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        pin: pin ? stage : false,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        animation: timeline,
        invalidateOnRefresh: true,
        snap: snap
          ? {
              snapTo,
              duration: { min: 0.2, max: 0.5 },
              delay: 0.1,
              ease: 'power1.inOut',
              directional: true,
            }
          : undefined,
        onUpdate: (self) => {
          scrollState.voyage = self.progress;
          onUpdate?.(self.progress, self);
          publish();
        },
        onRefresh: (self) => {
          scrollState.voyage = self.progress;
          onUpdate?.(self.progress, self);
          publish();
        },
      });

      // --- escape hatches ------------------------------------------------
      // Kill any in-flight snap the moment the visitor scrolls again.
      // `tweenTo.tween` is the scroller's active scroll tween — the same
      // handle ScrollTrigger itself kills on refresh. A page that keeps
      // pulling against live input is the worst failure this feature has, and
      // it is worth being explicit about rather than trusting a default.
      const killSnap = () => {
        const tween = trigger?.tweenTo?.tween;
        if (tween) {
          tween.kill();
          trigger.tweenTo.tween = 0;
        }
      };
      const onWheel = () => killSnap();
      const onTouch = () => killSnap();
      const onKey = (event) => {
        if (!SUPPRESS_KEYS.has(event.key)) return;
        suppressUntil = performance.now() + KEY_SUPPRESS_MS;
        killSnap();
      };
      // Focus moving into the pinned stage (Tab, or a script focusing a
      // control) must not be undone by a snap.
      const onFocusIn = () => {
        suppressUntil = performance.now() + KEY_SUPPRESS_MS;
        killSnap();
      };

      window.addEventListener('wheel', onWheel, { passive: true });
      window.addEventListener('touchstart', onTouch, { passive: true });
      window.addEventListener('touchmove', onTouch, { passive: true });
      window.addEventListener('keydown', onKey);
      stage?.addEventListener('focusin', onFocusIn);

      // gsap.context() reverts tweens and ScrollTriggers, not listeners.
      ctxCleanups.push(() => {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('touchstart', onTouch);
        window.removeEventListener('touchmove', onTouch);
        window.removeEventListener('keydown', onKey);
        stage?.removeEventListener('focusin', onFocusIn);
      });
    }, track);

    const cleanups = ctxCleanups.splice(0);
    return () => {
      for (const fn of cleanups) fn();
      ctx.revert();
      scrollState.voyage = 0;
      publish();
    };
  }, [trackRef, stageRef, enabled, pin, snap, buildTimeline, labelTimes, restPoints, onUpdate]);
}

/**
 * Scroll to a voyage label and settle there rather than mid-transition.
 * Used by the navbar's anchors and by a deep link into a project.
 */
export function scrollToVoyageProgress(progress, { smooth = true } = {}) {
  const trigger = ScrollTrigger.getAll().find((t) => t.vars.trigger?.classList?.contains('voyage-track'));
  if (!trigger) return false;
  const y = trigger.start + (trigger.end - trigger.start) * progress;
  if (smooth) gsap.to(window, { duration: 0.9, ease: 'power2.inOut', scrollTo: { y } });
  else window.scrollTo(0, y);
  return true;
}

/** Progress of one registered section, 0 when unknown. */
export function sectionProgress(id) {
  return scrollState.sections[id] ?? 0;
}

/**
 * Non-reactive read handle. Returns a stable object whose fields are mutated
 * in place — safe to read from `useFrame` without causing renders.
 */
export function useScrollProgressRef() {
  return scrollState;
}

/** Subscribe imperatively; called on every scroll update. Returns unsubscribe. */
export function subscribeScroll(fn) {
  imperativeSubscribers.add(fn);
  fn(scrollState);
  return () => imperativeSubscribers.delete(fn);
}

/** Reactive read of the raw progress. Re-renders at most once per frame. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(scrollState.heroRaw);
  useEffect(() => {
    reactSubscribers.add(setProgress);
    setProgress(scrollState.heroRaw);
    return () => reactSubscribers.delete(setProgress);
  }, []);
  return progress;
}
