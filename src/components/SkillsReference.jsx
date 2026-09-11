import '../styles/skills-reference.css';
import { SKILL_GROUPS } from '../data/skills';

/**
 * The skills reference: every tool I work with, grouped, on one card.
 *
 * Not the hero's skills panel, and deliberately nothing like it. That one is
 * narrative — five sentences, each with a satellite orbiting the character,
 * highlighted from either side. This one is an inventory for someone scanning
 * for a keyword: no colours, no orbits, no hover, no pinning. If it ever grows
 * an interaction, it has started duplicating the hero.
 *
 * Rendered in two places, never both at once:
 *
 *   - on the projects voyage, as its last rest position (ProjectsSection
 *     passes `voyage-copy` so the master timeline can find and fade it)
 *   - as a plain section after the flat project stack, under reduced motion
 *     or with no WebGL
 *
 * `id="skills"` is what the navbar's link and the `#skills` deep link target.
 */
const SkillsReference = ({ className = '' }) => (
  <section
    id="skills"
    className={`skills-ref glass glass--scrim ${className}`.trim()}
    aria-labelledby="skills-ref-title"
  >
    <h2 id="skills-ref-title" className="skills-ref-title">
      Skills
    </h2>
    <div className="skills-ref-groups">
      {SKILL_GROUPS.map((group) => (
        <div className="skills-ref-group" key={group.id}>
          <h3 className="skills-ref-group-title">{group.title}</h3>
          <ul className="skills-ref-items">
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </section>
);

export default SkillsReference;
