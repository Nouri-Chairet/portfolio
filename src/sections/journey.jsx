import { useRef } from 'react'
import '../styles/journey.css'
import ContactMe from '../components/ContactMe'
import { useSectionProgress } from '../hooks/useScrollProgress'
import { useDeviceTier } from '../state/deviceTier'

/**
 * The contact panel.
 *
 * It used to have a <View> of its own on the right, with a second copy of the
 * character waving a "call me" clip. That went in the rebuild: the character's
 * last appearance is now its departure from the hero, and this section's 3D —
 * the UFO and its beam — lives in the shared root scene instead, where the
 * bloom can reach it (scene/ContactBeam.jsx).
 */
const Journey = () => {
  const container = useRef(null);
  const has3D = useDeviceTier() !== 'low';
  // Measured only, never pinned and never snapped — Contact is reached, not
  // caught. This range is what lets the star field and the last planet fade
  // out before the panel's own gradient takes over; the voyage's own snap
  // (rule 20) is the only thing on this page allowed to complete a scroll for
  // the visitor, and it lets go cleanly once the last rest position is behind
  // them.
  useSectionProgress('journey', container, { start: 'top bottom', end: 'top top' });

  return (
    <div
      id="contact"
      className={has3D ? 'journey-container' : 'journey-container journey-container--flat'}
      ref={container}
    >
      <ContactMe />
    </div>
  )
}

export default Journey
