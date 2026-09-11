import '../styles/static-sky.css';

/**
 * The star field for devices that get no canvas at all (tier `low`, or WebGL
 * blocked/unavailable).
 *
 * Pure CSS: three layered radial-gradient tiles, no DOM node per star and no
 * JS. It is deliberately not a reproduction of the WebGL field — it just has
 * to keep the site looking like the same site, so the navy sections are not
 * flat black behind the copy.
 */
const StaticSky = () => <div className="static-sky" aria-hidden="true" />;

export default StaticSky;
