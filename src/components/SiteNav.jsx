import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import '../styles/site-nav.css';
import Handwriting from './ui/Handwriting';
import { parseViewBox, wordViewBox } from './ui/handwritingGeometry';
import Loader from './Loader';
import star from '/star.svg';
import { HERO_NAME, HERO_WELCOME } from '../generated/handwriting';
import useHeroIntro from '../hooks/useHeroIntro';
import useIntroSequence, { MORPH_DURATION } from '../hooks/useIntroSequence';
import { HERO_EVENTS, HERO_STATES, dispatchHero } from '../state/heroMachine';
import { RESUME_FILENAME, RESUME_HREF } from '../data/contact';

/**
 * The site's header — which is the same element as the intro panel.
 *
 * The entrance is one continuous object, not a hand-off between two of them.
 * A full-viewport cream panel writes "Hi, I'm Nouri" and "Welcome to my
 * portfolio!", then collapses upward; as it collapses, the handwritten name
 * flies into the logo slot and the viewBox closes in around the word "Nouri".
 * The `<path>` on screen at the end is byte-for-byte the one that was written
 * at the start — see `wordViewBox` in ui/handwritingGeometry.js for why a crop rather
 * than a second copy of the artwork. Swapping in a separate logo element would
 * throw away the only thing that makes the entrance worth its five seconds.
 *
 * Layout is expressed as three states on one element, so the morph has a
 * genuine destination to measure rather than a set of numbers to keep in sync:
 *
 *   .site-nav--intro   full-viewport panel, both lines absolutely placed
 *   .site-nav--bar     the landed navbar: logo left, links right
 *   .site-nav--morphing  transitional, added alongside --bar: the intro stack
 *                        is still painted so it can fade and be clipped by the
 *                        collapsing header
 *
 * The morph itself is a FLIP: measure the logo where the intro put it, let
 * React render the navbar layout, measure where that puts it, then animate the
 * difference. Nothing is hard-coded, so the landing is correct at any viewport
 * width without a table of breakpoint offsets.
 */

/** Which word of HERO_NAME becomes the logo. "Hi,"=0, "I'm"=1, "Nouri"=2. */
const LOGO_WORD = 2;

/**
 * Sections the navbar links to, in page order.
 *
 * Rendered only when the target id is actually in the document — a link that
 * scrolls nowhere is worse than a link that is not there.
 *
 * `#projects` and `#skills` are both rest positions on the projects voyage,
 * so ProjectsSection intercepts them and lands ON the rest point rather than
 * letting the browser jump into the middle of a pinned flight.
 */
const NAV_LINKS = [
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
];

const SiteNav = () => {
  const headerRef = useRef(null);
  const logoRef = useRef(null);
  const logoSvgRef = useRef(null);
  const introStackRef = useRef(null);
  const linksRef = useRef(null);
  /** Geometry captured the instant before the layout flips to the navbar. */
  const firstRef = useRef(null);

  const {
    state,
    reducedMotion,
    progress,
    loading,
    writing,
    morphing,
    landed,
    skip,
    skippable,
    stalled,
  } = useIntroSequence();

  const { nameRefs, welcomeRefs, namePen, welcomePen } = useHeroIntro({
    active: writing,
    // Skipping can land here from `loading`, before a single stroke has run.
    written: !writing && state !== HERO_STATES.LOADING,
    reducedMotion,
    onComplete: useCallback(() => {
      // Capturing here, in the callback that ends the writing, is what makes
      // the FLIP possible: this is the last moment at which the intro layout
      // is still on screen. One dispatch later React has already laid the
      // navbar out.
      const logo = logoRef.current;
      const header = headerRef.current;
      if (logo && header) {
        firstRef.current = {
          logo: logo.getBoundingClientRect(),
          headerHeight: header.getBoundingClientRect().height,
        };
      }
      // `?intro=stall` drops this dispatch to prove the bounded lock releases
      // on its own when a stage never reports completion. See useIntroSequence.
      if (!stalled) dispatchHero(HERO_EVENTS.WRITING_COMPLETE);
    }, [stalled]),
  });

  const introViewBox = HERO_NAME.viewBox;
  const logoViewBox = useMemo(() => wordViewBox(HERO_NAME, LOGO_WORD), []);

  // ------------------------------------------------------------ the morph
  useLayoutEffect(() => {
    if (!morphing) return undefined;

    const header = headerRef.current;
    const logo = logoRef.current;
    const svg = logoSvgRef.current;
    const stack = introStackRef.current;
    const links = linksRef.current;
    if (!header || !logo || !svg) return undefined;

    const first = firstRef.current?.logo ?? logo.getBoundingClientRect();
    const introHeight = firstRef.current?.headerHeight ?? window.innerHeight;

    // React has already applied `--bar`, so the navbar layout is live. Point
    // the svg at its final viewBox before measuring: the logo's box in the bar
    // is sized from the svg's aspect ratio, and the aspect is the viewBox's.
    svg.setAttribute('viewBox', logoViewBox);
    const last = logo.getBoundingClientRect();
    const navHeight = header.getBoundingClientRect().height;

    const from = parseViewBox(introViewBox);
    const to = parseViewBox(logoViewBox);
    const morph = { ...from, height: first.height };

    const sync = () => {
      svg.setAttribute('viewBox', `${morph.x} ${morph.y} ${morph.w} ${morph.h}`);
      // Width follows from the height and the *current* viewBox aspect, so the
      // element's box and its viewBox always agree and `meet` never has
      // anything to letterbox. Tweening width independently would letterbox
      // (or, with preserveAspectRatio="none", visibly stretch the glyphs)
      // through the middle of the flight.
      logo.style.height = `${morph.height}px`;
      logo.style.width = `${morph.height * (morph.w / morph.h)}px`;
    };

    let timeline;
    const ctx = gsap.context(() => {
      // Take the logo out of flow for the flight. It is `fixed`, and the
      // header has no transform, so the header's `overflow: hidden` does not
      // clip it: the logo stays visible the whole way down while everything
      // still in flow is progressively cut off by the collapsing header.
      gsap.set(logo, {
        position: 'fixed',
        left: 0,
        top: 0,
        margin: 0,
        zIndex: 2,
        transformOrigin: '0 0',
        width: first.width,
        height: first.height,
        x: first.left,
        y: first.top,
      });
      timeline = gsap.timeline({
        onComplete: () => {
          // Hand the logo back to the navbar's own layout. It lands on exactly
          // the box the FLIP measured, so there is nothing to snap.
          gsap.set(logo, {
            clearProps: 'position,left,top,margin,zIndex,transformOrigin,width,height,x,y',
          });
          gsap.set(header, { clearProps: 'height' });
          dispatchHero(HERO_EVENTS.NAVBAR_LANDED);
        },
      });

      const ease = 'power3.inOut';

      // The collapse. Same ease and duration as the logo's flight, which is
      // what keeps the logo inside the shrinking header for the whole trip:
      // both are then linear in the same eased parameter, and a linear
      // function that starts and ends inside another one never leaves it.
      timeline.fromTo(
        header,
        { height: introHeight },
        { height: navHeight, duration: MORPH_DURATION, ease },
        0
      );

      timeline.to(logo, { x: last.left, y: last.top, duration: MORPH_DURATION, ease }, 0);
      timeline.to(
        morph,
        {
          x: to.x,
          y: to.y,
          w: to.w,
          h: to.h,
          height: last.height,
          duration: MORPH_DURATION,
          ease,
          onUpdate: sync,
        },
        0
      );

      // The welcome line is not part of the logo; it leaves early enough that
      // the header edge never appears to cut through readable text.
      if (stack) {
        timeline.to(
          stack,
          { autoAlpha: 0, y: -24, duration: MORPH_DURATION * 0.45, ease: 'power2.in' },
          0
        );
      }

      // Cream panel out, blurred navbar in. Both are `fromTo`, not `to`: the
      // navbar class is already applied by the time this runs, so the
      // stylesheet has the skins at their *end* values and a bare `to` would
      // tween each of them to where it already is.
      timeline.fromTo(
        '.site-nav-skin--intro',
        { opacity: 1 },
        { opacity: 0, duration: MORPH_DURATION * 0.7, ease: 'power2.inOut' },
        MORPH_DURATION * 0.15
      );
      timeline.fromTo(
        '.site-nav-skin--bar',
        { opacity: 0 },
        { opacity: 1, duration: MORPH_DURATION * 0.7, ease: 'power2.inOut' },
        MORPH_DURATION * 0.15
      );

      // The links arrive last, once there is a bar for them to sit in.
      if (links) {
        timeline.fromTo(
          links,
          { autoAlpha: 0, y: -8 },
          { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' },
          MORPH_DURATION * 0.68
        );
      }
    }, headerRef);

    return () => {
      // Land on the finished navbar; never revert.
      //
      // `ctx.revert()` is the right cleanup for a decorative tween and exactly
      // the wrong one here. Revert restores every tweened value to what it was
      // before the timeline ran — including, through its onUpdate, the viewBox
      // — so skipping mid-collapse put the full-viewport intro framing back on
      // a logo that was already sitting in the navbar. `progress(1)` first
      // lands every property (and fires onComplete, which hands the logo back
      // to the bar's layout), then the context is killed without reverting.
      //
      // The NAVBAR_LANDED that onComplete dispatches is a no-op here: the
      // machine has already moved to hero_ready, and the transition table has
      // no entry for it there. Nothing has to guard the call site.
      timeline?.progress(1);
      ctx.kill();
    };
  }, [morphing, introViewBox, logoViewBox]);

  // ------------------------------------------------------- nav link targets
  const [targets, setTargets] = useState([]);
  useEffect(() => {
    // The sections are lazy, so probe once the entrance is over — by then
    // everything below the fold has mounted.
    setTargets(NAV_LINKS.filter((link) => document.getElementById(link.id)).map((l) => l.id));
  }, [state]);

  const goHome = useCallback(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [reducedMotion]);

  const introClass = landed || reducedMotion ? 'site-nav--bar' : 'site-nav--intro';
  const headerClass = [
    'site-nav',
    morphing ? 'site-nav--bar site-nav--morphing' : introClass,
  ].join(' ');

  return (
    <>
      {loading && (
        <div className="site-nav-loading" role="status" aria-live="polite">
          <Loader />
          <span className="site-nav-loading-progress">{Math.round(progress)}%</span>
        </div>
      )}

      {/* Present from the first paint, above the loading overlay and above the
          intro panel. Nothing in the entrance is reachable only by waiting. */}
      {skippable && (
        <button type="button" className="hero-skip" onClick={skip}>
          Skip intro
        </button>
      )}

      <header className={headerClass} ref={headerRef}>
        <div className="site-nav-skin site-nav-skin--intro" aria-hidden="true" />
        <div className="site-nav-skin site-nav-skin--bar" aria-hidden="true" />

        <div className="site-nav-inner">
          <button type="button" className="site-nav-logo" ref={logoRef} onClick={goHome}>
            <Handwriting
              data={HERO_NAME}
              strokeRefs={nameRefs}
              svgRef={logoSvgRef}
              viewBox={landed || reducedMotion ? logoViewBox : introViewBox}
              reducedMotion={reducedMotion}
              title={landed || reducedMotion ? 'Nouri — back to top' : HERO_NAME.text}
            >
              {!reducedMotion && (
                <image
                  ref={namePen}
                  href={star}
                  width="30"
                  height="30"
                  opacity="0"
                  aria-hidden="true"
                />
              )}
            </Handwriting>
          </button>

          <nav className="site-nav-links" ref={linksRef} aria-label="Main">
            <ul>
              {NAV_LINKS.filter((link) => targets.includes(link.id)).map((link) => (
                <li key={link.id}>
                  <a href={`#${link.id}`}>{link.label}</a>
                </li>
              ))}
              <li>
                <a
                  className="site-nav-resume"
                  href={RESUME_HREF}
                  download={RESUME_FILENAME}
                >
                  Résumé
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Intro only. Absolutely placed at a fixed 100dvh height so it holds
            still and is clipped by the collapsing header, rather than sliding
            up as a percentage of a shrinking box. */}
        {!landed && !reducedMotion && (
          <div className="site-nav-intro-stack" ref={introStackRef}>
            <p className="site-nav-welcome">
              <Handwriting
                data={HERO_WELCOME}
                strokeRefs={welcomeRefs}
                reducedMotion={reducedMotion}
              >
                <image
                  ref={welcomePen}
                  href={star}
                  width="24"
                  height="24"
                  opacity="0"
                  aria-hidden="true"
                />
              </Handwriting>
            </p>
          </div>
        )}
      </header>
    </>
  );
};

export default SiteNav;
