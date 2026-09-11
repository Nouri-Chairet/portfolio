import { useSyncExternalStore } from 'react';

/**
 * Which skill is currently called out, and by whom.
 *
 * A module store for the same reason `state/dialogue.js` and
 * `state/projectDetail.js` are: the two halves of this interaction sit on
 * opposite sides of the React tree. The satellite is a 3D object inside the
 * shared canvas (mounted by SceneRoot -> HeroScene); the list row is DOM inside
 * the hero section. Threading a callback between them would couple App,
 * SceneRoot and HeroScene to a highlight none of them are part of.
 *
 * Two inputs, deliberately kept apart:
 *
 *   hovered  transient. A pointer over a satellite, or over a list row.
 *   pinned   sticky. A click or a keypress on either. Survives the pointer
 *            leaving, which is the only thing that makes this usable on a
 *            touch screen (no hover) or from a keyboard (no pointer).
 *
 * `activeSkill()` resolves them: a pin wins, otherwise the hover. Everything
 * downstream reads that one value, so neither side has to know which input the
 * other used.
 */

const state = {
  hovered: null,
  pinned: null,
};

const listeners = new Set();

/** Immutable snapshot so useSyncExternalStore can compare by identity. */
let snapshot = { ...state, active: null };

function publish() {
  snapshot = { ...state, active: state.pinned ?? state.hovered };
  for (const fn of listeners) fn();
}

export function subscribeSkills(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSkills() {
  return snapshot;
}

/**
 * Non-reactive read, for useFrame. The satellites run at frame rate and must
 * not re-render React to find out what is highlighted.
 */
export function activeSkill() {
  return snapshot.active;
}

export function useSkillHighlight() {
  return useSyncExternalStore(subscribeSkills, getSkills, getSkills);
}

export function hoverSkill(id) {
  if (state.hovered === id) return;
  state.hovered = id;
  publish();
}

/** Click/Enter on either representation. Clicking the pinned one releases it. */
export function toggleSkillPin(id) {
  state.pinned = state.pinned === id ? null : id;
  publish();
}

export function clearSkillPin() {
  if (state.pinned === null) return;
  state.pinned = null;
  publish();
}

/** Hero unmounted. */
export function resetSkills() {
  state.hovered = null;
  state.pinned = null;
  publish();
}
