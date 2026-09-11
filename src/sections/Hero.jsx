import { useCallback, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import '../styles/hero.css';
import { PROJECTS_HASH } from '../data/projects';
import Handwriting from '../components/ui/Handwriting';
import { HERO_WELCOME } from '../generated/handwriting';
import star from '/star.svg';
import {
  HERO_EVENTS,
  dispatchHero,
  hasCharacter,
  isIntroSequence,
  isSettled,
  resetHeroState,
  useHeroState,
} from '../state/heroMachine';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { useDeviceTier } from '../state/deviceTier';
import HeroDialogue from '../components/HeroDialogue';
import SkillsPanel from '../components/SkillsPanel';
import { resetDialogue, useDialogue } from '../state/dialogue';
import { resetSkills } from '../state/skills';
import useHeroScrollFx, { useHeroDeparture } from '../hooks/useHeroScrollFx';
import { useHeroScrollTrigger } from '../hooks/useScrollProgress';

/**
 * The hero section: everything that sits *behind* the header.
 *
 * The handwritten name and welcome line used to live here, on a cream panel
 * filling the left third. They are the entrance now — components/SiteNav.jsx
 * writes them full-viewport and collapses the panel into the navbar, and the
 * name goes on being the logo. With its only content gone the cream panel went
 * with it, so the hero is the space scene: the character, the speech bubble,
 * the spinning star and the scroll cue.
 *
 * Composition only — every piece of behaviour lives in a hook:
 *
 *   heroMachine            what state we are in and which events are legal
 *   HeroDialogue           the opt-in speech bubble, its hint and its button
 *   useHeroScrollFx        DOM parallax, scrubbed from shared scroll progress
 *   useHeroScrollTrigger   the site's one ScrollTrigger
 */
gsap.registerPlugin(ScrollToPlugin);

export default function Hero() {
  const state = useHeroState();
  const reducedMotion = usePrefersReducedMotion();
  const { index: dialogueIndex } = useDialogue();
  const starRef = useRef(null);

  const has3D = useDeviceTier() !== 'low';
  const settled = isSettled(state);
  // The skills panel is content, so it is not gated on the hero being
  // *interactive* — only on the entrance being over, by whichever route. Skip,
  // Escape, the failsafe and reduced motion all leave the sequence, so there
  // is no path on which someone reaches the hero and never sees it.
  const introRunning = isIntroSequence(state);

  // Route change unmounts the hero; next visit starts from loading.
  useEffect(() => {
    return () => {
      resetHeroState();
      resetDialogue();
      resetSkills();
    };
  }, []);

  // Opening the dialogue is the visitor engaging with the hero — the one thing
  // ENGAGE ever meant. It used to fire when they clicked through the first
  // line of a script that had started without them.
  useEffect(() => {
    if (dialogueIndex !== null) dispatchHero(HERO_EVENTS.ENGAGE);
  }, [dialogueIndex]);

  useHeroScrollTrigger({ enabled: true });
  useHeroScrollFx({ enabled: settled, reducedMotion, starRef });
  // Enabled one state early: scroll is already unlocked while the character is
  // still flying in, so a fast scroller has to be able to depart from there.
  useHeroDeparture({ enabled: hasCharacter(state) });

  // Projects is a section on this page now, not a route. Scroll to it and set
  // the hash so the position is shareable and Back still works.
  const handleProjects = useCallback(() => {
    const target = document.getElementById('projects');
    if (!target) return;
    if (reducedMotion) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else {
      gsap.to(window, { duration: 1.1, ease: 'power2.inOut', scrollTo: { y: target } });
    }
    if (window.location.hash !== PROJECTS_HASH) {
      window.history.replaceState(null, '', PROJECTS_HASH);
    }
  }, [reducedMotion]);

  return (
    <section className="hero">
      {/* Reduced motion never sees the intro panel, so the welcome line would
          be lost with it. It is rendered here instead — written, still, and
          out of the way of the character. */}
      {reducedMotion && (
        <p className="hero-welcome-static">
          <Handwriting data={HERO_WELCOME} reducedMotion />
        </p>
      )}

      <div className="hero-stage">
        {/* The accessible half of the orbiting satellites, and the only half
            that exists on a device with no WebGL. */}
        <SkillsPanel visible={!introRunning} has3D={has3D} />

        <button onClick={handleProjects} className="hero-cue" type="button">
          <span className="hero-cue-label">View Projects</span>
          <span className="hero-cue-arrow" aria-hidden="true" />
        </button>
        <div ref={starRef} className="hero-img">
          <img src={star} alt="" />
        </div>

        {/* Opt-in, and nothing plays until it is asked to. */}
        <HeroDialogue enabled={settled} has3D={has3D} reducedMotion={reducedMotion} />
      </div>
    </section>
  );
}
