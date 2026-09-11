import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/hero-dialogue.css';
import { HINT } from '../data/dialogue';
import {
  advanceDialogue,
  closeDialogue,
  linesFor,
  openDialogue,
  useDialogue,
} from '../state/dialogue';

/**
 * The character's speech bubble, its hint, and its keyboard equivalent.
 *
 * All three are DOM, positioned over the character's place in the shared
 * canvas. Nothing here types anything out: a line appears with a 250 ms fade
 * and a small rise, and that is the whole animation. The previous version ran
 * GSAP's TextPlugin at one character at a time over 2.2 s per line, which meant
 * the visitor spent most of the interaction waiting for a machine to finish
 * spelling — and made the text unselectable mid-animation for anyone who
 * wanted to read ahead.
 *
 * Three ways in, and they are not redundant:
 *
 *   double-tap the character   the discoverable one, taught by the hint
 *   the "talk" button          the accessible one — focusable, Enter/Space
 *   (Escape closes either)
 *
 * The button is a real control rather than an `aria-label` bolted onto the
 * canvas, because a canvas cannot hold focus and a keyboard user has no
 * pointer to double-tap with. It sits where the character is so that a screen
 * reader meets it in context rather than as a stray control at the end of the
 * page.
 */

/** Quiet time before the hint offers itself, in ms. */
const HINT_DELAY = 2000;

/** Events that count as the visitor being busy with something else. */
const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

const HeroDialogue = ({ enabled, has3D, reducedMotion }) => {
  const { index, engaged } = useDialogue();
  const lines = useMemo(() => linesFor(has3D), [has3D]);
  const [hintVisible, setHintVisible] = useState(false);
  const bubbleRef = useRef(null);
  const talkRef = useRef(null);
  const open = index !== null;

  const coarse = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
    []
  );
  const hintText = has3D ? (coarse ? HINT.coarse : HINT.fine) : HINT.flat;

  // --- the hint ------------------------------------------------------------
  // "After ~2s of inactivity" is taken literally: the timer restarts whenever
  // the visitor does anything, so the hint waits for a gap rather than talking
  // over someone who is already reading or scrolling. Once they have opened the
  // dialogue even once, it is gone for good — an affordance that keeps
  // re-offering itself after you have used it is nagging, not helping.
  useEffect(() => {
    if (!enabled || engaged || open) {
      setHintVisible(false);
      return undefined;
    }
    // With no character to point at, the label is the only affordance there is,
    // so it is not transient.
    if (!has3D) {
      setHintVisible(true);
      return undefined;
    }

    let timer = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setHintVisible(true), HINT_DELAY);
    };
    const onActivity = () => {
      setHintVisible(false);
      arm();
    };

    arm();
    for (const type of ACTIVITY) {
      window.addEventListener(type, onActivity, { passive: true });
    }
    return () => {
      if (timer) clearTimeout(timer);
      for (const type of ACTIVITY) window.removeEventListener(type, onActivity);
    };
  }, [enabled, engaged, open, has3D]);

  // --- open / close --------------------------------------------------------
  const handleTalk = useCallback(() => openDialogue(), []);
  const handleAdvance = useCallback(() => advanceDialogue(lines.length), [lines.length]);

  /**
   * Advance on a click anywhere in the bubble — except one that finished a text
   * selection. Releasing the mouse after dragging across a sentence fires a
   * click, and swapping the line out from under someone who was mid-highlight
   * is the opposite of "selectable".
   */
  const handleBubbleClick = useCallback(
    (event) => {
      if (event.target.closest('button')) return;
      if (!window.getSelection()?.isCollapsed) return;
      handleAdvance();
    },
    [handleAdvance]
  );

  const handleClose = useCallback(() => {
    closeDialogue();
    // Give focus somewhere sensible rather than dropping it on <body>, which
    // would send the next Tab back to the top of the page.
    talkRef.current?.focus();
  }, []);

  // Escape closes. Bound only while open, so it never competes with the
  // entrance's Escape-to-skip or the project panel's own handler.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  // Move focus into the bubble when it opens so a keyboard visitor is reading
  // what they just asked for, not still parked on the button behind it.
  useEffect(() => {
    if (open) bubbleRef.current?.focus();
  }, [open]);

  if (!enabled) return null;

  return (
    <div className="hero-talk-anchor">
      {/* Pointer users double-tap the character itself; this is the keyboard
          and assistive-technology route to the same conversation. It stays
          focusable after the hint fades — the affordance outlives its label. */}
      <button
        type="button"
        ref={talkRef}
        className={`hero-talk${hintVisible ? ' is-hinting' : ''}${open ? ' is-open' : ''}`}
        onClick={handleTalk}
        aria-expanded={open}
        aria-label="Talk to Nouri"
      >
        <span className="hero-talk-hint" aria-hidden={!hintVisible}>
          {hintText}
        </span>
      </button>

      {open && (
        <div
          className={`hero-bubble${reducedMotion ? ' is-still' : ''}`}
          role="dialog"
          aria-label="Nouri says"
          ref={bubbleRef}
          tabIndex={-1}
          onClick={handleBubbleClick}
        >
          {/* The line is keyed by index so React replaces the node, which
              restarts the CSS animation. Re-using one node would show the new
              text with the old animation already finished. */}
          <p className="hero-bubble-line" key={index} aria-live="polite">
            {lines[index]}
          </p>

          <div className="hero-bubble-foot">
            <button type="button" className="hero-bubble-next" onClick={handleAdvance}>
              {index >= lines.length - 1 ? 'Done' : 'Next'}
            </button>
            <span className="hero-bubble-count" aria-hidden="true">
              {index + 1}/{lines.length}
            </span>
            <button
              type="button"
              className="hero-bubble-close"
              onClick={handleClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroDialogue;
