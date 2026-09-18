/*
 * FONTS LOAD AT BOOT, NEVER MID-ANIMATION.
 *
 * Every self-hosted face (common.less) is `font-display: swap` and fetched on
 * FIRST USE — and a face arriving is a «Fonts changed» invalidation: every text
 * node whose stack names that family is laid out again and the viewport
 * repaints. When that first use rides a FLIGHT, the relayout lands in the
 * flight's first frames. Measured on the Parliament's embedded take (Turmoil
 * Redux, Climate Research, a session booted straight into it): the first text
 * on screen set in Russo One was the hand dock's «КАРТЫ» delta chip
 * (`resource_change_feedback.less`), which ticks the moment a take is pressed.
 * The face's arrival re-laid out 2226 of 2514 layout objects and repainted the
 * whole viewport — ~90 ms on a dev box, ~335 ms under a 4× CPU throttle — right
 * as the card lifted off its seat. That is why only the FIRST take looked like
 * the card hung in the air: the second one found the face loaded.
 *
 * So the faces the console's cinematics carry are requested while the app
 * boots, when a relayout costs nothing anyone can see. A face that first
 * appears inside a flight or a scene belongs in this list.
 */

/** CSS `font` shorthands for `FontFaceSet.load` (+ a sample that selects the subset). */
const WARM_FACES: ReadonlyArray<{font: string, text?: string}> = [
  // The display face of the HUD's numbers — delta chips, counters, badges —
  // which tick exactly when something is animating. One file, Latin +
  // Cyrillic: no subset to select.
  {font: '1em "Russo One"'},
];

export function warmDisplayFonts(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): number {
  const fonts = doc?.fonts;
  if (fonts === undefined || typeof fonts.load !== 'function') {
    return 0;
  }
  for (const face of WARM_FACES) {
    // Best effort: a face that fails to load simply keeps its fallback — the
    // same outcome as not warming it, never an error the player can meet.
    fonts.load(face.font, face.text).catch(() => undefined);
  }
  return WARM_FACES.length;
}
