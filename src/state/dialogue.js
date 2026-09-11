import { useSyncExternalStore } from 'react';
import { DIALOGUE, MODEL_DEPENDENT_LINES } from '../data/dialogue';

/**
 * Whether the character is talking, and which line it is on.
 *
 * A module store rather than props, for the same reason `state/projectDetail.js`
 * is one: the two halves of this interaction live on opposite sides of the
 * tree. The trigger is a 3D object inside the shared canvas
 * (`scene/Astronaut.jsx`, mounted by SceneRoot); the bubble is DOM inside the
 * hero section. Threading a callback from Hero through App, SceneRoot and
 * HeroScene to reach the character would couple four components to a
 * conversation none of them are part of.
 *
 * The bubble is deliberately NOT 3D text. Drei's <Text> would be an image of
 * words: unselectable, invisible to a screen reader, unsearchable, and blurry
 * at the scale this needs to be readable at. A `<p>` costs nothing and is all
 * of those things for free.
 */

const state = {
  /** null when closed; otherwise the index of the visible line. */
  index: null,
  /** True once the visitor has opened the dialogue, ever. Dismisses the hint. */
  engaged: false,
};

const listeners = new Set();
const emit = () => {
  for (const fn of listeners) fn();
};

/** Immutable snapshot, so useSyncExternalStore can compare by identity. */
let snapshot = { ...state };
const publish = () => {
  snapshot = { ...state };
  emit();
};

export function subscribeDialogue(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDialogue() {
  return snapshot;
}

export function useDialogue() {
  return useSyncExternalStore(subscribeDialogue, getDialogue, getDialogue);
}

/** The lines this device can honestly show. */
export function linesFor(has3D) {
  return has3D ? DIALOGUE : DIALOGUE.slice(0, -MODEL_DEPENDENT_LINES);
}

/**
 * Open on the first line. Idempotent: a double-tap that lands while the bubble
 * is already open must not restart the conversation from the top.
 */
export function openDialogue() {
  if (state.index !== null) return;
  state.index = 0;
  state.engaged = true;
  publish();
}

export function closeDialogue() {
  if (state.index === null) return;
  state.index = null;
  publish();
}

/** Next line, or close on the last one — the conversation ends by ending. */
export function advanceDialogue(total) {
  if (state.index === null) return;
  if (state.index >= total - 1) {
    state.index = null;
  } else {
    state.index += 1;
  }
  publish();
}

/** Hero unmounted; forget the conversation but not that it happened. */
export function resetDialogue() {
  state.index = null;
  state.engaged = false;
  publish();
}
