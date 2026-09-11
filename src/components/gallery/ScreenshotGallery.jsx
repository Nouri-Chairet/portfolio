import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './gallery.css';
import MANIFEST from '../../generated/screenshots';

/**
 * The screenshot gallery. Loaded via React.lazy, so this file, its stylesheet,
 * and the screenshot manifest all land in a separate chunk that is fetched
 * only when someone presses "Screenshots".
 *
 * The images themselves are never imported — they are referenced by URL from
 * `public/shots/`, built by `npm run assets:screenshots`. That is what keeps
 * them out of the initial payload: the bundler never sees them, and the
 * browser only requests the one width its viewport asks for.
 *
 * A skeleton shimmer covers each image while it decodes rather than a blurred
 * base64 placeholder — an LQIP would have to live in a JS module, and the
 * whole point of this split is that no image bytes ship until asked for.
 */

/** Widths the layout can occupy, so the browser can pick sensibly. */
const SIZES = '(max-width: 700px) 92vw, (max-width: 1100px) 70vw, 900px';

function sourceSet(entry, format) {
  return entry.widths.map((w) => `${entry.base}-${w}.${format} ${w}w`).join(', ');
}

/** One responsive screenshot with its own loading state. */
function Shot({ shot, onOpen, index }) {
  const entry = MANIFEST[shot.id];
  const [loaded, setLoaded] = useState(false);
  const img = useRef(null);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    if (img.current?.complete) setLoaded(true);
  }, []);

  if (!entry) return null;

  return (
    <button
      type="button"
      className="shot"
      onClick={() => onOpen(index)}
      aria-label={`Open ${shot.alt} full screen`}
    >
      {/* Reserve the exact box before the bytes arrive: the intrinsic
          width/height plus aspect-ratio in CSS means zero layout shift. */}
      <span
        className={`shot-frame${loaded ? ' is-loaded' : ''}`}
        style={{ aspectRatio: `${entry.width} / ${entry.height}` }}
      >
        <picture>
          <source type="image/avif" srcSet={sourceSet(entry, 'avif')} sizes={SIZES} />
          <source type="image/webp" srcSet={sourceSet(entry, 'webp')} sizes={SIZES} />
          <img
            ref={img}
            src={`${entry.base}-${entry.widths[0]}.webp`}
            width={entry.width}
            height={entry.height}
            alt={shot.alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
          />
        </picture>
      </span>
    </button>
  );
}

/** Full-screen viewer: arrows and Escape on keyboard, swipe on touch. */
function Lightbox({ shots, index, onIndex, onClose, title }) {
  const shot = shots[index];
  const entry = MANIFEST[shot.id];
  const touchStart = useRef(null);
  const closeButton = useRef(null);

  // Take focus on open and hand it back to the thumbnail on close, so keyboard
  // users are not dropped on <body> when the lightbox goes away.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButton.current?.focus();
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      } else if (event.key === 'ArrowRight') {
        onIndex((index + 1) % shots.length);
      } else if (event.key === 'ArrowLeft') {
        onIndex((index - 1 + shots.length) % shots.length);
      }
    };
    // Capture phase so Escape closes the lightbox before the detail panel.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [index, shots.length, onIndex, onClose]);

  const onTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      if (touchStart.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(delta) < 45) return; // ignore taps and jitter
      onIndex(
        delta < 0
          ? (index + 1) % shots.length
          : (index - 1 + shots.length) % shots.length
      );
    },
    [index, shots.length, onIndex]
  );

  if (!entry) return null;

  // Portalled to <body> deliberately. The detail panel animates in with a
  // transform and `animation-fill-mode: both`, so it keeps a transform after
  // the animation ends — which makes it the containing block for any
  // `position: fixed` descendant. Rendered in place, this "full-screen"
  // lightbox was clipped to the panel's box instead of the viewport.
  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} screenshots`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
        ref={closeButton}
        aria-label="Close screenshots"
      >
        <span aria-hidden="true">×</span>
      </button>

      {shots.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-nav--prev"
          onClick={() => onIndex((index - 1 + shots.length) % shots.length)}
          aria-label="Previous screenshot"
        >
          <span aria-hidden="true">‹</span>
        </button>
      )}

      <figure className="lightbox-figure">
        <picture>
          <source type="image/avif" srcSet={sourceSet(entry, 'avif')} sizes="92vw" />
          <source type="image/webp" srcSet={sourceSet(entry, 'webp')} sizes="92vw" />
          <img
            src={`${entry.base}-${entry.widths[entry.widths.length - 1]}.webp`}
            width={entry.width}
            height={entry.height}
            alt={shot.alt}
            decoding="async"
          />
        </picture>
        <figcaption>
          {shot.alt}
          {shots.length > 1 && (
            <span className="lightbox-count">
              {index + 1} / {shots.length}
            </span>
          )}
        </figcaption>
      </figure>

      {shots.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-nav--next"
          onClick={() => onIndex((index + 1) % shots.length)}
          aria-label="Next screenshot"
        >
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>,
    document.body
  );
}

const ScreenshotGallery = ({ screenshots, title, onClose }) => {
  const [lightbox, setLightbox] = useState(null);
  const shots = screenshots.filter((s) => MANIFEST[s.id]);

  if (shots.length === 0) {
    return <p className="gallery-empty">No screenshots available yet.</p>;
  }

  return (
    <section className="gallery" aria-label={`${title} screenshots`}>
      <div className="gallery-grid">
        {shots.map((shot, i) => (
          <Shot key={shot.id} shot={shot} index={i} onOpen={setLightbox} />
        ))}
      </div>
      <button type="button" className="gallery-hide" onClick={onClose}>
        Hide screenshots
      </button>

      {lightbox !== null && (
        <Lightbox
          shots={shots}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
          title={title}
        />
      )}
    </section>
  );
};

export default ScreenshotGallery;
