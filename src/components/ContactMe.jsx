import '../styles/contact.css';
import {
  EMAIL,
  GITHUB_URL,
  LINKEDIN_URL,
  LOCATION,
  RESUME_FILENAME,
  RESUME_HREF,
} from '../data/contact';

/**
 * The contact section: a UFO hovering overhead, a cone of warm light falling
 * from it, and everything a visitor needs standing inside the light.
 *
 * All of the content is DOM — a heading and four real links — and none of it
 * depends on the canvas. The UFO and the beam are decoration drawn in the
 * shared root scene (scene/ContactBeam.jsx), where the bloom reaches them.
 * They are placed by reading the two empty boxes below every frame, so the
 * composition is laid out here, in CSS, and the 3D follows it at any width.
 *
 * With no WebGL, `.contact-beam` paints a CSS stand-in for the light (see
 * contact.css) and the links work exactly the same.
 */
const ContactMe = () => (
  <section className="contact" aria-labelledby="contact-title">
    {/* Where the UFO hovers: its centre and width. Read by ContactBeam. */}
    <div className="contact-ufo" data-contact-ufo aria-hidden="true" />
    {/* The cone of light: apex at the top edge, base along the bottom edge,
        base as wide as the box. Read by ContactBeam; painted by CSS only when
        there is no canvas. */}
    <div className="contact-beam" data-contact-beam aria-hidden="true" />

    <div className="contact-stack">
      <h2 id="contact-title" className="contact-title">
        Contact me
      </h2>

      <a className="contact-button contact-button--cv glass glass--scrim" href={RESUME_HREF} download={RESUME_FILENAME}>
        Download CV
      </a>

      <div className="contact-socials">
        <a
          className="contact-button glass glass--scrim"
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
        <a
          className="contact-button glass glass--scrim"
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
          <span className="visually-hidden"> (opens in a new tab)</span>
        </a>
      </div>

      <a className="contact-email" href={`mailto:${EMAIL}`}>
        {EMAIL}
      </a>
      <p className="contact-location">{LOCATION}</p>
    </div>
  </section>
);

export default ContactMe;
