/**
 * What the character says, and nothing else.
 *
 * This replaces a ten-paragraph script that played itself on load and typed
 * out one character at a time. Two things were wrong with it: nobody asked for
 * it, and it buried the thing people actually came to look at. The character is
 * the focus; this is the garnish.
 *
 * Rules for editing:
 *   - one short line per entry, the length of something a person would say
 *   - four or five entries, never ten
 *   - the last entry is model-dependent (see MODEL_DEPENDENT_LINES): it points
 *     at the 3D character, which the no-WebGL tier does not have
 */
export const DIALOGUE = [
  'Hey — thanks for stopping by.',
  "I'm a software engineering student in Sousse, Tunisia.",
  'I build web, mobile and desktop apps — React, React Native, Django.',
  "Scroll down and I'll show you what I've built.",
  'Or click me once. I might dance.',
];

/**
 * Trailing lines that only make sense with the character on screen. The
 * no-WebGL tier drops them rather than pointing at something that is not there.
 */
export const MODEL_DEPENDENT_LINES = 1;

/** The hint that appears near the character, by input type. */
export const HINT = {
  fine: 'Want to talk? Click me twice.',
  coarse: 'Want to talk? Tap me twice.',
  /** No character to tap — the button is the only affordance, so it says so. */
  flat: 'Want to talk?',
};
