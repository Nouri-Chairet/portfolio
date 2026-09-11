import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Holds the page still by taking the body out of flow, and puts it back
 * exactly where it was.
 *
 * The technique is deliberate. The obvious alternative — `preventDefault` on
 * wheel and touchmove — is worse in three separate ways:
 *
 *   1. it only blocks the two gestures you thought of. Space, PageDown, arrow
 *      keys, Home/End, find-in-page and a screen reader's own scrolling all
 *      still move the document, so the "lock" leaks;
 *   2. modern browsers register wheel and touchmove as passive by default, so
 *      preventDefault on them is ignored with a console warning unless every
 *      listener is added with `{ passive: false }` — and it fights the
 *      scroller instead of stopping it, which is what produces the rubber-band
 *      stutter on iOS;
 *   3. it does nothing about the scroll position, so anything that scrolls
 *      programmatically (an autofocus, a hash) still moves the page.
 *
 * Fixing the body cannot leak: there is nothing left to scroll. The scroll
 * offset is captured, applied as a negative `top` so the page does not appear
 * to jump to zero, and restored on release.
 *
 * The document's height collapses while the body is fixed, so every
 * ScrollTrigger measurement taken during the lock is wrong. Release therefore
 * ends with `ScrollTrigger.refresh()` — the project panels' pins are created
 * as their section mounts, which can happen mid-lock.
 *
 * The scrollbar gutter is held open permanently by `html { overflow-y: scroll }`
 * in App.css, so taking the body out of flow does not reflow the page by the
 * scrollbar's width (and does not resize the fixed WebGL canvas underneath it).
 *
 * @param locked engage the lock
 */
export default function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;

    const { body } = document;
    const y = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      // `scroll-behavior: smooth` is on <html>; an instant restore must not be
      // animated or the page visibly slides back to where it already was.
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      ScrollTrigger.refresh();
    };
  }, [locked]);
}
