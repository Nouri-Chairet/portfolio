import { useCallback, useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import '../styles/projects-section.css';
import { PROJECTS, projectIdFromHash } from '../data/projects';
import { openProject } from '../state/projectDetail';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { useDeviceTier } from '../state/deviceTier';
import {
  useVoyageScrollTrigger,
  scrollToVoyageProgress,
} from '../hooks/useScrollProgress';
import SkillsReference from '../components/SkillsReference';
import { SKILLS_HASH } from '../data/skills';
import {
  CAM_HOME,
  LABEL_TIMES,
  LEG_COUNT,
  LEG_VH,
  REST_COUNT,
  SKILLS_STOP,
  cameraAtExit,
  cameraAtSkills,
  cameraAtStop,
  resetVoyage,
  stopSide,
  stopTime,
  voyage,
} from '../state/voyage';

/**
 * The projects section: one continuous flight past a world per project, then
 * the skills reference as one last rest position before contact.
 *
 * It used to be one pinned panel per project, each with its own ScrollTrigger.
 * Those were sequential by construction, and the seam showed: measured on that
 * build, **360 px of scroll with no planet drawn at all** at every boundary —
 * panel A's exit finished at its progress 0.79 and panel B's entrance did not
 * begin until its progress 0.06, with nothing on screen in between.
 *
 * Now there is ONE master timeline, scrubbed by ONE ScrollTrigger, pinning one
 * stage. The planets are at fixed world positions and the camera flies down
 * the line (state/voyage.js). Overlap is no longer scheduled — it is a
 * consequence of the model, because the next world is genuinely ahead of you
 * while the last one is genuinely still going past.
 *
 * What the master timeline drives:
 *
 *   camera      x/y/z through the stops, at a constant rate along z so the
 *               travel never stops and starts
 *   copy        each panel crossfading with its neighbour on the same
 *               schedule and the same easing family as its planet
 *   skills      the reference card, arriving once the last project's copy
 *               has cleared
 *
 * That is the whole list. The character and its UFO used to be on it too,
 * fading in over the first leg and swinging to the planet's side at every
 * stop; they now leave at the end of the hero and do not come back, and every
 * track that existed only to move them went with them.
 *
 * The planets read the camera and their own world position; nothing about
 * their entrance or exit is authored here.
 *
 * ------------------------------------------------------ why the sides alternate
 *
 * The copy alternating sides was first explained by the character — it rode on
 * the planet's side, so the words took the other. With the character gone that
 * reason is gone, and a consistent side was considered. Alternation stays,
 * because two things the character never had anything to do with still need
 * it:
 *
 *   - the PLANETS alternate so that the world you are leaving and the world
 *     you are approaching are on opposite edges during the crossover. That
 *     crossover is the no-empty-frame guarantee, and on one side the nearer
 *     planet would sit on top of the further one. Copy has to take whichever
 *     side its planet is not on, so if the planets alternate, so does the copy.
 *   - the COPY crossfades overlap in time: late in every leg the outgoing
 *     panel is still partly opaque while the incoming one is already past
 *     half. On a single side that is two paragraphs superimposed on the same
 *     pixels for a good part of every leg.
 *
 * The skills card is the exception: it is wide and centred, so it does not
 * overlap the last project's copy at all — it waits for it to clear.
 */

/** Copy fade timings, in master-timeline time units (1 unit = one leg). */
const COPY_IN = 0.55;
const COPY_HOLD_OUT = 0.28;
const COPY_OUT = 0.36;
/**
 * The skills card's fade-in. Shorter than COPY_IN and started later, so it
 * begins only after the last project's copy has finished leaving
 * (stopTime + COPY_HOLD_OUT + COPY_OUT = 0.64 into the leg). The card is
 * centred and overlaps that copy's column; a crossfade would superimpose them.
 */
const SKILLS_IN = 0.34;

function ProjectCopy({ project, index, innerRef }) {
  const side = stopSide(index);
  return (
    <article
      className="voyage-panel"
      id={project.id}
      ref={innerRef}
      data-side={side > 0 ? 'left' : 'right'}
      aria-label={project.title}
    >
      {/* The card is the element the master timeline fades and slides — not
          the article around it. The article carries the layout (rule 20: a
          thing GSAP animates cannot also carry layout), and the card carries
          the backdrop-filter, which has to be on the SAME element as the
          opacity: an ancestor at opacity < 1 becomes the blur's backdrop root,
          and the glass would go clear for the whole of every fade. */}
      <div className="voyage-copy glass">
        {/* Laid out the way the CV lays the entry out: the role and date,
            the name, the one-line context, then the bullets. */}
        <p className="project-meta">
          {project.kind && `${project.kind} · `}
          {/* A date range is one thing: it may move to the next line, but
              "Jun 2025 –" must not end one line with "Jul 2025" starting the
              next. */}
          <span className="project-period">{project.period}</span>
        </p>
        <h2 className="project-title">{project.title}</h2>
        {project.tagline && <p className="project-tagline">{project.tagline}</p>}
        <ul className="project-highlights">
          {project.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ul className="project-tech">
          {project.tech.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {/* The planet is clickable, but a 3D object cannot take keyboard
            focus — this button is the accessible equivalent, and the element
            focus returns to when the detail panel closes. */}
        <button
          type="button"
          id={`details-${project.id}`}
          className="project-link"
          onClick={(e) => openProject(project.id, e.currentTarget)}
        >
          {/* The title is in the accessible name, not the visible label: some
              CV titles run to five words and wrapped the button to two lines. */}
          Explore<span className="visually-hidden"> {project.title}</span>
        </button>
      </div>
    </article>
  );
}

/**
 * The flat fallback: reduced motion, or no WebGL.
 *
 * Not a degraded version of the voyage — a different, simpler thing. Every
 * panel is present and readable at once, nothing is pinned, nothing scrubs,
 * and there is no snapping to fight the visitor's scroll. Reduced motion is a
 * different path, not a faster one (rule 4).
 */
function FlatProjects({ has3D }) {
  return (
    <div className="voyage-flat">
      {PROJECTS.map((project, index) => (
        <section className="voyage-flat-panel" id={project.id} key={project.id}>
          {!has3D && (
            <div
              className="project-orb"
              aria-hidden="true"
              style={{
                '--orb-deep': project.planet.palette.deep,
                '--orb-mid': project.planet.palette.mid,
                '--orb-high': project.planet.palette.high,
                '--orb-glow': project.planet.palette.glow,
              }}
            />
          )}
          <ProjectCopy project={project} index={index} />
        </section>
      ))}
    </div>
  );
}

const ProjectsSection = () => {
  const reducedMotion = usePrefersReducedMotion();
  const has3D = useDeviceTier() !== 'low';
  const track = useRef(null);
  const stage = useRef(null);
  const panels = useRef([]);

  // The voyage needs a camera to fly and planets to fly past. Without a canvas
  // there are neither, so the flat stack is the whole section.
  const flying = has3D && !reducedMotion;

  /**
   * `?snap=0` turns panel snapping off while leaving the scrubbed timeline
   * running. The two are separate claims — "every intermediate frame animates"
   * and "it comes to rest on a panel" — and verifying the first with the
   * second live means the page moves out from under the measurement between
   * arriving at a scroll position and sampling it.
   */
  const snapping = useMemo(() => {
    if (typeof window === 'undefined') return true;
    return new URLSearchParams(window.location.search).get('snap') !== '0';
  }, []);

  const setPanel = useCallback((index) => (node) => {
    panels.current[index] = node;
  }, []);

  /**
   * The master timeline. Paused and unscrubbed here — useVoyageScrollTrigger
   * attaches it to the trigger, which owns its playhead.
   */
  const buildTimeline = useCallback(() => {
    const tl = gsap.timeline({ paused: true });
    /** The animated card inside a rest position's panel. */
    const cardOf = (index) => panels.current[index]?.querySelector('.voyage-copy') ?? null;

    // --- the camera ------------------------------------------------------
    // One leg per stop, plus one out to the contact section. `ease: 'none'` on
    // z: the visitor is travelling at a steady rate and should feel that. The
    // lateral sway eases, so the frame settles at each stop without the
    // forward motion ever pausing.
    voyage.camX = CAM_HOME.x;
    voyage.camY = CAM_HOME.y;
    voyage.camZ = CAM_HOME.z;

    // fromTo, not to. The trigger runs with `invalidateOnRefresh`, and an
    // invalidated `to` re-records its start from whatever the value happens to
    // be at that moment — which, on a refresh triggered mid-flight by a resize
    // or an AdaptiveDpr step, is a camera position halfway down the line. The
    // waypoints would then drift a little further from the planets on every
    // refresh. Stating both ends makes invalidation a no-op.
    const waypoints = [
      CAM_HOME,
      ...PROJECTS.map((_, i) => cameraAtStop(i)),
      cameraAtSkills(),
      cameraAtExit(),
    ];
    for (let i = 0; i < waypoints.length - 1; i += 1) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      tl.fromTo(
        voyage,
        { camZ: a.z },
        { camZ: b.z, ease: 'none', duration: 1 },
        i
      );
      tl.fromTo(
        voyage,
        { camX: a.x, camY: a.y },
        { camX: b.x, camY: b.y, ease: 'power1.inOut', duration: 1 },
        i
      );
    }

    // --- the copy --------------------------------------------------------
    // Same schedule and the same easing family as the planet it belongs to:
    // panel A starts leaving while panel B is already arriving, so the two
    // overlap in exactly the frames the planets do.
    PROJECTS.forEach((project, i) => {
      const card = cardOf(i);
      if (!card) return;
      const at = stopTime(i);
      const side = stopSide(i);
      tl.fromTo(
        card,
        { opacity: 0, x: side * 46, y: 12 },
        { opacity: 1, x: 0, y: 0, ease: 'power2.out', duration: COPY_IN },
        at - COPY_IN
      );
      tl.to(
        card,
        { opacity: 0, x: -side * 46, y: -12, ease: 'power2.in', duration: COPY_OUT },
        at + COPY_HOLD_OUT
      );
    });

    // --- the skills reference -------------------------------------------
    // Rises into place rather than sliding in from a side: it is centred, and
    // a lateral entrance would imply a side it does not have.
    const skills = cardOf(SKILLS_STOP);
    if (skills) {
      const at = stopTime(SKILLS_STOP);
      tl.fromTo(
        skills,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, ease: 'power2.out', duration: SKILLS_IN },
        at - SKILLS_IN
      );
      tl.to(
        skills,
        { opacity: 0, y: -28, ease: 'power2.in', duration: COPY_OUT },
        at + COPY_HOLD_OUT
      );
    }

    return tl;
  }, []);

  /**
   * Which rest points may be snapped to, measured at snap time.
   *
   * A panel taller than the viewport must not be snapped to: resting a
   * visitor at a position where the bottom of the copy is off-screen traps it,
   * because the next scroll gesture snaps them away from it rather than
   * revealing it. Measured live rather than assumed, since it depends on the
   * viewport, the font size and the text itself.
   */
  const restPoints = useCallback((allPoints) => {
    // The room BELOW the fixed navbar, not the whole viewport: a card that
    // fits the viewport but not that room rests with its first lines hidden
    // under the bar, which traps them exactly as a too-tall card traps its
    // last lines.
    const nav = document.querySelector('.site-nav')?.getBoundingClientRect().height ?? 0;
    const vh = window.innerHeight - nav;
    return allPoints.filter((point, index) => {
      // index 0 is the hero side and the last is the contact side; both are
      // section boundaries rather than panels, and always safe to rest at.
      if (index === 0 || index === allPoints.length - 1) return true;
      const node = panels.current[index - 1];
      // The panel is a full-height flex box; its COPY is the thing that can be
      // too tall to rest in front of.
      const copy = node?.querySelector('.voyage-copy');
      if (!copy) return true;
      return copy.scrollHeight <= vh;
    });
  }, []);

  /**
   * Which rest position is on screen, published as `data-current` on its
   * panel. Only that panel's controls take pointer events.
   *
   * Every panel is always in the DOM at its own spot, most of them at opacity
   * 0, and opacity does not stop a click. Panels on the same side share a box,
   * so without this the invisible Explore button of the project two stops
   * away could sit on top of the visible one and take its click.
   */
  const currentRest = useRef(-1);
  const handleUpdate = useCallback((progress) => {
    voyage.progress = progress;
    const t = progress * LEG_COUNT;
    let next = -1;
    for (let i = 0; i < REST_COUNT; i += 1) {
      if (Math.abs(t - stopTime(i)) < 0.5) next = i;
    }
    if (next === currentRest.current) return;
    panels.current[currentRest.current]?.removeAttribute('data-current');
    panels.current[next]?.setAttribute('data-current', '');
    currentRest.current = next;
  }, []);

  useEffect(() => {
    voyage.active = flying;
    if (!flying) resetVoyage();
    return () => resetVoyage();
  }, [flying]);

  useVoyageScrollTrigger({
    trackRef: track,
    stageRef: stage,
    buildTimeline,
    labelTimes: LABEL_TIMES,
    enabled: flying,
    snap: flying && snapping,
    restPoints,
    onUpdate: handleUpdate,
  });

  // Deep links and the navbar's anchors land ON a rest point, not mid-flight.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash;
      const id = projectIdFromHash(hash);
      let rest = -1;
      if (id) rest = PROJECTS.findIndex((p) => p.id === id);
      else if (hash === '#projects') rest = 0;
      else if (hash === SKILLS_HASH) rest = SKILLS_STOP;
      if (rest < 0) return;

      if (!flying) {
        const target = rest === SKILLS_STOP ? 'skills' : PROJECTS[rest].id;
        document.getElementById(target)?.scrollIntoView({ behavior: 'auto', block: 'start' });
        return;
      }
      // LABEL_TIMES[0] is the hero side, so rest i is at index i + 1.
      const progress = LABEL_TIMES[rest + 1] / LEG_COUNT;
      scrollToVoyageProgress(progress, { smooth: !reducedMotion });
    };

    // Pins measure on refresh; let layout settle before jumping.
    const initial = requestAnimationFrame(() => requestAnimationFrame(applyHash));
    window.addEventListener('hashchange', applyHash);
    return () => {
      cancelAnimationFrame(initial);
      window.removeEventListener('hashchange', applyHash);
    };
  }, [flying, reducedMotion]);

  const trackStyle = useMemo(
    () => ({ height: `${100 + LEG_COUNT * LEG_VH * 100}vh` }),
    []
  );

  if (!flying) {
    // The skills reference follows the projects as a plain section, the same
    // way every flat panel does: present, readable, nothing pinned.
    return (
      <>
        <section className="projects-section projects-section--flat" id="projects">
          <FlatProjects has3D={has3D} />
        </section>
        <div className="skills-flat">
          <SkillsReference />
        </div>
      </>
    );
  }

  return (
    <section className="projects-section" id="projects">
      <div className="voyage-track" ref={track} style={trackStyle}>
        <div className="voyage-stage" ref={stage}>
          {PROJECTS.map((project, index) => (
            <ProjectCopy
              key={project.id}
              project={project}
              index={index}
              innerRef={setPanel(index)}
            />
          ))}
          {/* The last rest position. Centred, so it has no side. */}
          <div
            className="voyage-panel voyage-panel--skills"
            ref={setPanel(SKILLS_STOP)}
            data-side="center"
          >
            <SkillsReference className="voyage-copy" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProjectsSection;
