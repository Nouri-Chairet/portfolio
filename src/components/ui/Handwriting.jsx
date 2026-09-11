import { useId, useRef } from 'react';

/**
 * Two-layer handwriting: filled glyph outlines revealed by an animated
 * centreline mask.
 *
 *   layer 1  the text as filled paths in Caveat, baked at build time by
 *            scripts/generate-handwriting.mjs (no webfont, so no FOUT)
 *   layer 2  one stroke per pen movement, following the medial axis of each
 *            glyph, thick enough to cover the letterform, used as an SVG
 *            <mask> over layer 1
 *
 * Animating DrawSVG 0%->100% along the mask strokes reveals the *filled* text
 * progressively in the direction the pen travels. Stroking the letter outlines
 * directly — what the old HandwritingSVG did — traces a wobbly border around
 * each glyph instead, which never reads as writing.
 *
 * This component only renders. Sequencing lives in hooks/useHandwriting.js;
 * the parent collects `strokeRefs` and drives them, so one timeline can span
 * several lines.
 */

const Handwriting = ({
  data,
  strokeRefs,
  className,
  reducedMotion = false,
  title,
  /**
   * Overrides the baked viewBox. The navbar logo passes the "Nouri" crop; the
   * morph tweens the attribute imperatively in between, which React leaves
   * alone because it diffs against its own previous props, not the DOM.
   */
  viewBox,
  svgRef,
  children,
}) => {
  const maskId = `hw-${useId().replace(/[:]/g, '')}`;
  const fallbackRefs = useRef([]);
  const refs = strokeRefs ?? fallbackRefs;
  // The mask region is always stated from the *baked* box, never the display
  // one: it has to cover every stroke whatever window is currently framed.
  const [vbX, vbY, vbW, vbH] = data.viewBox.split(' ').map(Number);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={viewBox ?? data.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title ?? data.text}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Under reduced motion the mask is omitted entirely: the text is simply
          there, fully written, with nothing to animate. */}
      {!reducedMotion && (
        <defs>
          {/* The mask region MUST be stated explicitly. Its x/y/width/height
              default to -10%/-10%/120%/120%, and under userSpaceOnUse those
              percentages resolve against the viewport while ignoring the
              viewBox origin — which for a negative origin (text sits above the
              baseline, so y starts around -169) clips everything above y≈-21
              and reveals only a horizontal band through each letter. */}
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={vbX}
            y={vbY}
            width={vbW}
            height={vbH}
          >
            {data.strokes.map((stroke, i) => (
              <path
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                d={stroke.d}
                fill="none"
                stroke="#fff"
                strokeWidth={stroke.strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </mask>
        </defs>
      )}
      <path
        d={data.fill}
        fill="currentColor"
        mask={reducedMotion ? undefined : `url(#${maskId})`}
      />
      {children}
    </svg>
  );
};

export default Handwriting;
