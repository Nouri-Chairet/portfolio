import { useEffect, useSyncExternalStore } from 'react';
import { PROJECTS, projectHash, projectIdFromHash } from '../data/projects';

/**
 * Which project's detail panel is open, driven entirely by the URL hash.
 *
 * `#project/<id>` IS the open state — there is no separate boolean. That makes
 * a detail view shareable (send a recruiter straight to one project) and makes
 * the Back button close it for free, because opening pushes a history entry.
 *
 * NOTE this reassigns the hash's meaning. In the previous phase the projects
 * section wrote `#project/<id>` as you scrolled past each panel; that now has
 * to stop, or scrolling would pop a modal open. Arriving at that URL still
 * scrolls to the right panel — it just also opens the panel's detail, which is
 * the more useful landing anyway.
 */

let openId = null;
/** The element to hand focus back to when the panel closes. */
let origin = null;
/** True when *we* pushed the history entry, so close() can just go back. */
let pushed = false;

const listeners = new Set();
const emit = () => {
  for (const fn of listeners) fn();
};

export function getOpenProjectId() {
  return openId;
}

export function getDetailOrigin() {
  return origin;
}

export function subscribeProjectDetail(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOpenProjectId() {
  return useSyncExternalStore(subscribeProjectDetail, getOpenProjectId, () => null);
}

function setOpen(id) {
  if (id === openId) return;
  openId = id;
  emit();
}

/**
 * @param id            project to open
 * @param originElement focus returns here on close
 */
export function openProject(id, originElement = null) {
  if (!PROJECTS.some((p) => p.id === id) || openId === id) return;
  origin = originElement;
  // pushState so Back pops straight back out of the panel. It fires neither
  // popstate nor hashchange, so this does not re-enter through the listener.
  window.history.pushState({ projectDetail: id }, '', projectHash(id));
  pushed = true;
  setOpen(id);
}

export function closeProject() {
  if (!openId) return;
  if (pushed) {
    pushed = false;
    // Let history drive it: popstate lands in syncFromLocation below.
    window.history.back();
    return;
  }
  // Arrived directly on a #project/<id> URL — there is nothing to go back to,
  // so drop the hash in place rather than leaving the browser on a dead entry.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  setOpen(null);
}

function syncFromLocation() {
  setOpen(projectIdFromHash(window.location.hash));
}

/** Mount once, at the app root. */
export function useProjectDetailRouting() {
  useEffect(() => {
    syncFromLocation();
    const onNavigate = () => {
      pushed = false;
      syncFromLocation();
    };
    window.addEventListener('popstate', onNavigate);
    window.addEventListener('hashchange', onNavigate);
    return () => {
      window.removeEventListener('popstate', onNavigate);
      window.removeEventListener('hashchange', onNavigate);
    };
  }, []);
}
