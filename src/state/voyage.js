import { PROJECTS } from '../data/projects';

/**
 * The projects voyage: one continuous flight past a line of worlds.
 *
 * ------------------------------------------------------------------ why
 *
 * This replaces one pinned ScrollTrigger per project. Those were sequential by
 * construction — panel B's trigger could not start until panel A's had ended —
 * so planet A's exit finished before planet B's entrance began. Measured on
 * the old build: a **360 px scroll range with no planet drawn at all** at each
 * boundary, half a viewport of empty sky, starting at panel A progress 0.79
 * (its `OUT_START`) and ending at panel B progress 0.06 (its fade-in). There
 * is no scheduling fix for that while each panel owns its own trigger.
 *
 * ------------------------------------------------------------ the geometry
 *
 * The fix is not better fade timing, it is a different model of the scene. The
 * planets are placed at FIXED WORLD POSITIONS along one axis and the camera
 * flies down it. Overlap then stops being something to schedule and becomes
 * something that cannot fail to happen: the next world is already ahead of you
 * while the last one is still going past your shoulder, because that is what
 * being in a place and moving through it means.
 *
 *   camera home ---- planet 0 ---- planet 1 ---- planet 2 ---- out
 *                      (+x)          (-x)          (+x)
 *
 * Stops alternate sides, so a planet you are leaving slides out of one edge
 * while the next grows in from the other. The text panel takes the opposite
 * side from its planet.
 *
 * After the last world there is one more rest position, the skills reference,
 * and then the leg out to contact:
 *
 *   ... planet 2 ---- skills ---- out
 *                   (rising)   (rising further)
 *
 * The character used to ride along too, swinging to the planet's side at each
 * stop. It no longer travels: it departs at the end of the hero and that is
 * the last of it (scene/HeroScene.jsx).
 *
 * Everything here is a pure function of a stop index, so the timeline
 * (sections/ProjectsSection.jsx), the planets (scene/ProjectPlanets.jsx) and
 * the camera driver (scene/SceneRoot.jsx) all derive the same layout instead
 * of three of them agreeing by hand.
 *
 * ------------------------------------------------------------------ naming
 *
 * "voyage", not "journey": `sections/journey.jsx` is the contact panel, and
 * `scrollState.sections.journey` is what the star field fades on. Reusing the
 * word would have made two unrelated things share a key.
 */

/** World units between one stop and the next. The length of a leg. */
export const LEG = 150;

/**
 * How far in front of its planet the camera rests at a stop.
 *
 * Was 34. Grown by the same tan(25°)/tan(21°) ≈ 1.2148 ratio as
 * HeroScene's HERO_DEPTH, for the same reason: the shared camera's fov
 * dropped from 50 to 42 to fix the UFO's edge distortion, and this exact
 * ratio is what keeps every planet's apparent size and PLANET_X_FRACTION
 * placement unchanged despite the narrower lens.
 */
export const VIEW_DIST = 41.3;

/** The camera's home, matching SceneRoot's <PerspectiveCamera position>. */
export const CAM_HOME = { x: 4, y: 6, z: 23 };

/** Planet radius, world units. Fixed now that planets are world-space. */
export const PLANET_RADIUS = 5.6;

/**
 * A planet's lateral offset, as a fraction of the visible half-width at
 * VIEW_DIST. A fraction rather than a world x so a portrait viewport brings
 * the planet toward the centre instead of pushing it off the edge — the same
 * reasoning as HERO_X_FRACTION in HeroScene.
 */
export const PLANET_X_FRACTION = 0.56;
/** Vertical offset of a planet from the camera's eye line. */
export const PLANET_Y = 1.2;

/** How far the camera leans away from the planet it is looking at. */
export const CAM_SWAY = 3.2;

/** Scroll length of one leg, in viewport heights. */
export const LEG_VH = 1.25;

/** Project stops — one per entry in data/projects.js. */
export const STOP_COUNT = PROJECTS.length;
/**
 * Every rest position between the two ends: the projects, then the skills
 * reference. The skills stop is a rest point on the same master timeline, not
 * a section of its own, so snapping and the navbar's anchor treat it exactly
 * like a project.
 */
export const REST_COUNT = STOP_COUNT + 1;
/** Index of the skills stop among the rest positions. */
export const SKILLS_STOP = STOP_COUNT;
/** Legs = one into each rest position, plus one out to the contact section. */
export const LEG_COUNT = REST_COUNT + 1;

/** Which side of the frame stop `i` occupies: +1 right, -1 left. */
export function stopSide(i) {
  return i % 2 === 0 ? 1 : -1;
}

/** World z of stop `i`'s planet. */
export function planetZ(i) {
  return CAM_HOME.z - (i + 1) * LEG;
}

/** Where the camera rests to look at stop `i`. */
export function cameraAtStop(i) {
  return {
    x: CAM_HOME.x - stopSide(i) * CAM_SWAY,
    y: CAM_HOME.y,
    z: planetZ(i) + VIEW_DIST,
  };
}

/**
 * Where the camera rests for the skills reference, after the last planet.
 *
 * It lifts and closes in rather than flying on past. Continuing down the line
 * was the obvious thing and it was wrong: past the last planet there is
 * nothing left to see, and the final leg measured as two sampled frames with
 * an empty scene — the exact failure this rebuild exists to remove, just moved
 * to the end. Rising away with the last world still ahead and below reads as
 * leaving, and keeps something on screen behind the skills card.
 *
 * This pose used to be the exit. It became the skills stop unchanged when the
 * skills reference was added, because it was already verified to keep the
 * last world in frame.
 */
export function cameraAtSkills() {
  return {
    x: CAM_HOME.x + stopSide(STOP_COUNT - 1) * CAM_SWAY * 0.5,
    y: CAM_HOME.y + 9,
    z: planetZ(STOP_COUNT - 1) + VIEW_DIST * 0.55,
  };
}

/**
 * Where the camera ends up on its way to contact: the skills pose, risen
 * further and eased back. The last world sinks toward the bottom edge but is
 * still in frame when the pin releases — the no-empty-frame guarantee holds to
 * progress 1 — and from there it fades on the contact section's own progress
 * (scene/ProjectPlanets.jsx), so the contact beam has the frame to itself.
 */
export function cameraAtExit() {
  const skills = cameraAtSkills();
  return { x: skills.x, y: skills.y + 5, z: skills.z + 5 };
}

/**
 * Master-timeline time of each rest position. Rest `i` sits at `i + 1`, so
 * time 0 is the hero side and LEG_COUNT is the contact side. Projects are
 * rests 0..STOP_COUNT-1; the skills reference is rest SKILLS_STOP.
 */
export function stopTime(i) {
  return i + 1;
}

/** Label names, in order, including the two ends. */
export const LABELS = [
  'depart',
  ...PROJECTS.map((p) => `stop-${p.id}`),
  'skills',
  'arrive',
];

/** Master-timeline time of each label, in the same order as LABELS. */
export const LABEL_TIMES = [
  0,
  ...Array.from({ length: REST_COUNT }, (_, i) => stopTime(i)),
  LEG_COUNT,
];

/**
 * Live pose, mutated by the master timeline and read from useFrame.
 *
 * A module object rather than React state for the same reason
 * hooks/useScrollProgress.js uses one: these change every scroll frame, and
 * the readers are all inside the render loop.
 */
export const voyage = {
  /** True while the master timeline is driving the camera. */
  active: false,
  /** Master progress, 0..1. */
  progress: 0,
  /** Camera world position. */
  camX: CAM_HOME.x,
  camY: CAM_HOME.y,
  camZ: CAM_HOME.z,
};

/** Put the camera back where the hero left it, and stand down. */
export function resetVoyage() {
  voyage.active = false;
  voyage.progress = 0;
  voyage.camX = CAM_HOME.x;
  voyage.camY = CAM_HOME.y;
  voyage.camZ = CAM_HOME.z;
}
