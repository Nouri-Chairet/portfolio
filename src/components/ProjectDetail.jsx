import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState } from 'react';
import '../styles/project-detail.css';
import { projectById, projectMeta } from '../data/projects';
import { closeProject, getDetailOrigin, useOpenProjectId } from '../state/projectDetail';

/**
 * The gallery is the only thing on this page heavy enough to be worth
 * splitting: it pulls in the screenshot manifest, the lightbox, and its own
 * keyboard/touch handling. React.lazy keeps all of it — and every screenshot
 * URL — out of the main bundle until someone actually presses "Screenshots".
 */
const ScreenshotGallery = lazy(() => import('./gallery/ScreenshotGallery'));

/** Everything focusable we might need to cycle through inside the dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

const ProjectDetail = () => {
  const openId = useOpenProjectId();
  const project = openId ? projectById(openId) : null;
  const [galleryOpen, setGalleryOpen] = useState(false);
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  // A new project means a fresh panel: never carry the gallery across.
  useEffect(() => {
    setGalleryOpen(false);
  }, [openId]);

  // Focus in on open, and back to the control that opened it on close.
  useEffect(() => {
    if (!project) return undefined;
    const previouslyFocused = getDetailOrigin() ?? document.activeElement;
    // Wait a frame so the panel has laid out before we move focus into it.
    const raf = requestAnimationFrame(() => closeButton.current?.focus());

    return () => {
      cancelAnimationFrame(raf);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [project]);

  // Escape closes; Tab is trapped inside the dialog.
  useEffect(() => {
    if (!project) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        // No guard on galleryOpen here: that flag means "the thumbnail grid is
        // showing", not "the lightbox is up", and using it swallowed Escape
        // for the whole panel once the gallery had been opened once. The
        // lightbox instead registers on the CAPTURE phase and stops
        // propagation, so while it is up this listener never runs at all.
        event.stopPropagation();
        closeProject();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = dialog.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const list = [...nodes].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (list.length === 0) return;

      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [project]);

  // Stop the page scrolling behind the panel.
  useEffect(() => {
    if (!project) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [project]);

  const handleBackdrop = useCallback((event) => {
    if (event.target === event.currentTarget) closeProject();
  }, []);

  if (!project) return null;

  const hasLink = Boolean(project.link);

  return (
    <div className="detail-backdrop" onMouseDown={handleBackdrop}>
      <div
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        ref={dialog}
      >
        <button
          type="button"
          className="detail-close"
          onClick={closeProject}
          ref={closeButton}
          aria-label={`Close ${project.title} details`}
        >
          <span aria-hidden="true">×</span>
        </button>

        <p className="detail-year">{projectMeta(project)}</p>
        <h2 className="detail-title" id={titleId}>
          {project.title}
        </h2>
        {project.tagline && <p className="detail-tagline">{project.tagline}</p>}
        <ul className="detail-highlights" id={descriptionId}>
          {project.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <ul className="detail-tech" aria-label="Tech stack">
          {project.tech.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="detail-actions">
          {hasLink ? (
            <a
              className="detail-action detail-action--primary"
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit live site
            </a>
          ) : (
            // No dead anchor. Most of these are client or internal work with
            // no public URL, so the statement has to be true of all of them —
            // "still in development" was not true of a delivered internship.
            <p className="detail-nolink">No public link for this project.</p>
          )}

          {project.screenshots.length > 0 && (
            <button
              type="button"
              className="detail-action"
              onClick={() => setGalleryOpen(true)}
              aria-expanded={galleryOpen}
            >
              Screenshots
              <span className="detail-action-count">{project.screenshots.length}</span>
            </button>
          )}
        </div>

        {galleryOpen && (
          <Suspense
            fallback={
              <p className="detail-gallery-loading" role="status">
                Loading screenshots…
              </p>
            }
          >
            <ScreenshotGallery
              screenshots={project.screenshots}
              title={project.title}
              onClose={() => setGalleryOpen(false)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
