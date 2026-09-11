import { useCallback, useEffect } from 'react';
import '../styles/skills-panel.css';
import { SKILLS, SKILLS_INTRO } from '../data/skills';
import {
  clearSkillPin,
  hoverSkill,
  toggleSkillPin,
  useSkillHighlight,
} from '../state/skills';

/**
 * Who I am and what I work on, as DOM.
 *
 * This is the content. The orbiting satellites in the shared canvas
 * (scene/SkillSatellites.jsx) are an enhancement drawn on top of it, and the
 * relationship only runs one way: every word out there is in here, at a size
 * that can be read, in text that can be selected, searched, translated and
 * spoken aloud. A machine with no WebGL never mounts the canvas at all
 * (App.jsx gates it on the device tier) and loses nothing but the animation.
 *
 * That is the same position CLAUDE.md rule 11 takes on the character's speech
 * bubble — "the bubble is DOM, never 3D text" — applied one level up: the
 * satellites are allowed to be a picture of words precisely because they are
 * not the only copy of them.
 *
 * ------------------------------------------------------------- the highlight
 *
 * The correspondence is bidirectional and goes through `state/skills.js`:
 * pointing at a row brightens and slows its satellite, pointing at a satellite
 * lights its row. Each row is a real button rather than a decorated <li>, for
 * two reasons that are not about tidiness:
 *
 *   - a 3D object cannot hold DOM focus (the same problem rule 0 solves for
 *     the project planets with a `#details-<id>` button), so without a control
 *     here the satellites would be reachable by pointer only
 *   - hover does not exist on a touch screen, so a pointer-only highlight
 *     would be a desktop-only feature
 *
 * Pressing a row pins it: the satellite stays bright and slowed until it is
 * released. That is what makes it usable from a keyboard and from a phone, and
 * it does something visible on a device with no canvas at all.
 */

const SkillsPanel = ({ visible, has3D }) => {
  const { active, pinned } = useSkillHighlight();

  // Escape releases a pin, the same way it closes the dialogue and the project
  // panel. Bound only while something is pinned, so it never competes with
  // them for the key.
  useEffect(() => {
    if (!pinned) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      clearSkillPin();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pinned]);

  const handleEnter = useCallback((id) => () => hoverSkill(id), []);
  const handleLeave = useCallback(() => hoverSkill(null), []);
  const handleToggle = useCallback((id) => () => toggleSkillPin(id), []);

  return (
    <aside
      className={`hero-skills glass${visible ? ' is-visible' : ''}`}
      aria-label="About Nouri"
    >
      {/* The panel's headline, not an eyebrow any more — so a heading, which
          also gives a screen reader's heading list something to land on in
          the hero. */}
      <h2 className="hero-skills-headline">{SKILLS_INTRO.headline}</h2>
      <p className="hero-skills-intro">{SKILLS_INTRO.body}</p>

      <ul className="hero-skills-list">
        {SKILLS.map((skill) => {
          const isActive = active === skill.id;
          return (
            <li key={skill.id}>
              <button
                type="button"
                className={`hero-skill${isActive ? ' is-active' : ''}`}
                // The satellite's colour, so the row and the node in orbit are
                // visibly the same thing rather than two lists that happen to
                // be in the same order.
                style={{ '--skill-color': skill.color }}
                onMouseEnter={handleEnter(skill.id)}
                onMouseLeave={handleLeave}
                onFocus={handleEnter(skill.id)}
                onBlur={handleLeave}
                onClick={handleToggle(skill.id)}
                aria-pressed={pinned === skill.id}
              >
                {/* No colour dot any more, and no wrapping <span> for it to sit
                    beside. The colour link to the satellite is carried by the
                    row's left rule and by the heading itself when active —
                    both driven from the same `--skill-color` this element
                    already sets, so the correspondence survives the dot's
                    removal rather than going with it. */}
                <span className="hero-skill-title">{skill.title}</span>
                <span className="hero-skill-blurb">{skill.blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {has3D && (
        <p className="hero-skills-note">
          Each one is orbiting the character. Point at a row to slow its
          satellite down, or press it to hold it there.
        </p>
      )}
    </aside>
  );
};

export default SkillsPanel;
