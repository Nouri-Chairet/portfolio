import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Planet from './Planet';
import { PROJECTS } from '../data/projects';
import { openProject, useOpenProjectId } from '../state/projectDetail';
import { useScrollProgressRef } from '../hooks/useScrollProgress';
import {
  CAM_HOME,
  PLANET_RADIUS,
  PLANET_SCALE_PORTRAIT,
  PLANET_X_FRACTION,
  PLANET_X_FRACTION_SHORT,
  PLANET_Y,
  PLANET_Y_PORTRAIT,
  PORTRAIT_ASPECT,
  SHORT_VIEWPORT,
  VIEW_DIST,
  cameraAtStop,
  planetZ,
  stopSide,
} from '../state/voyage';

/**
 * One procedural planet per project, standing at a fixed place in the world.
 *
 * These used to be parented to the camera and positioned in screen terms, each
 * driven by its own panel's scroll progress. That is what made the seam: a
 * planet could only move while its own panel was pinned, so planet A had
 * finished leaving before planet B was allowed to start arriving, and there
 * was a measured 360 px of scroll with neither on screen.
 *
 * Now they are world-space objects on a line, and the camera flies down it
 * (state/voyage.js). Nothing here schedules an entrance or an exit: a planet is
 * visible because it is in front of you and near enough, which is the same
 * reason a real thing is visible. Overlap is not arranged — it is what happens
 * when the next world is ahead of you while the last is still going past.
 *
 * The only thing left to fade is the far end of the range, so a planet does not
 * pop into existence at the camera's far plane.
 */

/** How far ahead a planet starts to be worth drawing, in world units. */
const FADE_FAR = 260;
const FADE_NEAR = 90;
/**
 * A planet is behind you once it passes this. Slightly negative rather than 0
 * so it fades out as it sweeps past the edge of the frame rather than blinking
 * off the instant its centre crosses the camera plane.
 */
const PASSED = -14;
const PASSING = 14;

/**
 * Where the planet goes while its detail panel is open: nearer, larger, and
 * moved to the middle-left so it sits beside the panel instead of behind it.
 * Expressed relative to the CAMERA, since the camera is moving.
 */
const FOCUS_DIST = 17;
const FOCUS_X_FRACTION = -0.34;
const FOCUS_SCALE = 1.3;
const FOCUS_EASE = 3.2;

/**
 * Where the first world sits as seen FROM THE HERO, nudged in screen pixels.
 *
 * The first planet is the one visible in the hero — far off, a small purple
 * world beside the character — and it read slightly too far right of the
 * composition there. Its position is not an orbit: it is a static rest
 * position that the frame loop below RECOMPUTES AND WRITES every frame, so
 * setting the mesh's own position would be overwritten on the next frame. The
 * nudge is therefore folded into that computation, as an x offset on the rest
 * pose.
 *
 * Two constraints shape it:
 *
 *   - it is in PIXELS at whatever distance the planet currently is, not world
 *     units. A world offset that moves it 90 px from the hero (150 units away)
 *     would move it ~330 px at its own stop (41 units away), straight into the
 *     copy column the voyage composition keeps clear.
 *   - it fades out over the first leg, so by the time the camera arrives at
 *     the planet it is exactly where the voyage places it. From the hero to
 *     the stop it drifts the 90 px back as it grows, which reads as parallax.
 */
const HERO_NUDGE_PX = -90;
const HERO_NUDGE_INDEX = 0;

function numberOverride(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = new URLSearchParams(window.location.search).get(key);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * With ?perf=1, publish each planet's live alpha as window.__planets.
 *
 * The claim this section exists to make is "there is never a frame without a
 * world on screen". That should be checkable on the machine in front of you
 * rather than inferred from draw-call arithmetic, which is what the old build
 * had to be measured with — and which needed a second browser run at
 * ?planets=0 to establish a baseline before it meant anything.
 */
const PERF = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('perf') === '1';

/**
 * Smoothstep over a real range.
 *
 * The version this replaced clamped `x` to 0..1 before the smoothstep, which
 * was correct while the input was a panel's 0..1 progress and silently wrong
 * the moment it became a distance in world units: every planet's alpha pinned
 * at smoothstep(1, -14, 14) = 0.553 no matter where the camera was, so all
 * three were permanently half-visible and none of them ever arrived.
 * MathUtils.smoothstep already clamps against its own edges.
 */
function smooth(edge0, edge1, x) {
  return THREE.MathUtils.smoothstep(x, edge0, edge1);
}

function ProjectPlanet({ project, index, reducedMotion, onActivate, forced, scaleMul, octaves }) {
  const holder = useRef();
  const [hovered, setHovered] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const { size } = useThree();
  const openId = useOpenProjectId();
  const scroll = useScrollProgressRef();
  const focused = openId === project.id;
  const focus = useRef(0);
  // While any panel is open the backdrop covers the page, but r3f still
  // raycasts from the shared event source — without this, a backdrop click
  // would land on the planet behind it and immediately reopen the panel.
  const interactive = opacity > 0.35 && !openId;

  useFrame(({ camera }, delta) => {
    const node = holder.current;
    if (!node) return;

    const halfHeight = VIEW_DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = size.width / size.height;
    const halfWidth = halfHeight * aspect;
    // Lateral offset is a fraction of the visible half-width, so a portrait
    // viewport brings the planet toward the centre rather than off the edge.
    // On a narrow screen there is no room beside the copy, so it centres.
    const side = stopSide(index);
    const portrait = aspect < PORTRAIT_ASPECT;
    // A short landscape screen (a phone on its side) gives the copy card most
    // of the width, so the world moves further toward the edge.
    const short = !portrait && size.height <= SHORT_VIEWPORT;
    const xFraction = short ? PLANET_X_FRACTION_SHORT : PLANET_X_FRACTION;
    const restX = portrait ? CAM_HOME.x : CAM_HOME.x + side * xFraction * halfWidth;
    const restY = CAM_HOME.y + (portrait ? PLANET_Y_PORTRAIT : PLANET_Y);
    const restZ = planetZ(index);
    const radius = PLANET_RADIUS * scaleMul * (portrait ? PLANET_SCALE_PORTRAIT : 1);

    // Measurement mode: park every planet in front of the camera, opaque.
    if (forced) {
      node.position.set(
        camera.position.x + (index - 1) * halfWidth * 0.8,
        camera.position.y,
        camera.position.z - VIEW_DIST
      );
      node.scale.setScalar(radius);
      node.visible = true;
      if (opacity !== 1) setOpacity(1);
      return;
    }

    // How far ahead of the camera this planet is. Travel is along -Z, so a
    // positive value means "still in front of you".
    const ahead = camera.position.z - restZ;
    let alpha = smooth(PASSED, PASSING, ahead) * (1 - smooth(FADE_NEAR, FADE_FAR, ahead));

    // Gone before the contact section, on the same curve the star field uses.
    // The last world is deliberately still in frame when the voyage's pin
    // releases (state/voyage.js, cameraAtExit), and without this it would sit
    // in the corner of the contact beam — or, on a portrait screen where
    // planets centre, directly under it. Contact's progress is 0 for the whole
    // voyage, so none of the voyage's own frames are affected.
    const journey = scroll.sections.journey;
    alpha *= 1 - smooth(0.25, 0.85, Number.isFinite(journey) ? journey : 0);

    let restXNudged = restX;
    if (index === HERO_NUDGE_INDEX) {
      const homeZ = CAM_HOME.z;
      const stopZ = cameraAtStop(index).z;
      const travelled = (homeZ - camera.position.z) / (homeZ - stopZ);
      const weight = 1 - smooth(0, 1, travelled);
      if (weight > 0 && ahead > 0) {
        const worldPerPx =
          (2 * ahead * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / size.height;
        restXNudged += HERO_NUDGE_PX * worldPerPx * weight;
      }
    }

    // Ease toward / away from the focused pose. Reduced motion snaps.
    const target = focused ? 1 : 0;
    focus.current +=
      (target - focus.current) * Math.min(1, delta * (reducedMotion ? 60 : FOCUS_EASE));
    const f = focus.current;

    let x = restXNudged;
    let y = restY;
    let z = restZ;

    if (f > 0.001) {
      // Relative to the camera, because the camera is moving: the focused
      // planet has to stay beside the open panel, not beside where the panel
      // was when it opened.
      const fHalfHeight = FOCUS_DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fx = camera.position.x + FOCUS_X_FRACTION * fHalfHeight * aspect;
      x = THREE.MathUtils.lerp(x, fx, f);
      y = THREE.MathUtils.lerp(y, camera.position.y, f);
      z = THREE.MathUtils.lerp(z, camera.position.z - FOCUS_DIST, f);
      // A shared #project/<id> link can open the panel before the flight has
      // reached this stop, so focus alone is enough to make it visible.
      alpha = Math.max(alpha, f);
    }

    node.position.set(x, y, z);
    const bump = hovered && !reducedMotion ? 1.05 : 1;
    node.scale.setScalar(radius * bump * THREE.MathUtils.lerp(1, FOCUS_SCALE, f));
    node.visible = alpha > 0.01;
    if (PERF) {
      if (!window.__planets) window.__planets = [];
      window.__planets[index] = Math.round(alpha * 1000) / 1000;
    }

    if (Math.abs(alpha - opacity) > 0.01) setOpacity(alpha);
  });

  // Cursor feedback has to go on the document: the canvas is pointer-events:none.
  useEffect(() => {
    if (!hovered) return undefined;
    const previous = document.body.style.cursor;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = previous;
    };
  }, [hovered]);

  const handleOver = useCallback(
    (e) => {
      if (!interactive) return;
      e.stopPropagation();
      setHovered(true);
    },
    [interactive]
  );
  const handleOut = useCallback(() => setHovered(false), []);
  const handleClick = useCallback(
    (e) => {
      if (!interactive) return;
      e.stopPropagation();
      onActivate(project, index);
    },
    [interactive, onActivate, project, index]
  );

  return (
    <group ref={holder} visible={false}>
      <Planet
        palette={project.planet.palette}
        seed={project.planet.seed}
        radius={1}
        octaves={octaves}
        spin={reducedMotion ? 0 : 0.055}
        hovered={hovered}
        opacity={opacity}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      />
    </group>
  );
}

const ProjectPlanets = ({ reducedMotion }) => {
  const forcedCount = useMemo(() => numberOverride('planets', null), []);
  const scaleMul = useMemo(() => numberOverride('planetscale', 1), []);
  const octaves = useMemo(() => Math.max(1, Math.round(numberOverride('octaves', 4))), []);

  const handleActivate = useCallback((project) => {
    // Focus returns to the panel's own "Explore" button on close — a 3D object
    // cannot hold DOM focus, so that button is the planet's stand-in.
    openProject(project.id, document.getElementById(`details-${project.id}`));
  }, []);

  return (
    <group>
      {PROJECTS.map((project, index) => {
        if (forcedCount !== null && index >= forcedCount) return null;
        return (
          <ProjectPlanet
            key={project.id}
            project={project}
            index={index}
            reducedMotion={reducedMotion}
            onActivate={handleActivate}
            forced={forcedCount !== null}
            scaleMul={scaleMul}
            octaves={octaves}
          />
        );
      })}
    </group>
  );
};

export default ProjectPlanets;
