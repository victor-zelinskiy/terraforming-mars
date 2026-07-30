/*
 * THE SMART DETAIL COMPOSER — the measured layout ladder of the action
 * workspace's left panel.
 *
 * The panel has a FIXED height (the workspace band) and MUST NOT scroll: the
 * right stick drives the action list, so a scrollbar here would be a context
 * the player cannot reach. The naive answers are both wrong:
 *   · a permanently dense panel wastes a 4K television on every ordinary
 *     action — the overwhelming majority of them;
 *   · a clamped description silently hides the very rule the panel exists to
 *     state.
 *
 * So the panel is COMPOSED, not styled: it renders its most comfortable
 * composition, measures what that actually needs against the box it actually
 * has, and only then — and only as far as the overflow demands — steps down a
 * ladder of deliberate, ordered concessions:
 *
 *   0 comfortable   the full composition, nothing given up
 *   1 tight         the air between blocks (gaps / paddings) goes first —
 *                   the cheapest space in the panel, invisible when taken
 *   2 chips-inline  the change summary recomposes: «spent → gained» on ONE
 *                   line, its labels carried by the arrow instead of headings
 *   3 card-medium   the card steps down one size tier
 *   4 card-compact  …and one more
 *   5 dense-type    tighter leading and secondary type
 *   6 group-changes secondary changes fold into a compact semantic group;
 *                   the primary result and every blocker stay in full
 *
 * The order is the point: nothing that carries a DECISION (the action's rule,
 * the reason it is blocked) is ever the thing that gives way. A card that
 * still overflows at the last step is an honest outlier and is reported by
 * the guard spec rather than silently clipped.
 *
 * Mechanics: one element, one attribute (`data-fit`), pure CSS below it —
 * so a step costs one class flip, never a re-render. Measurement is
 * post-layout, batched inside a single frame, and hysteretic: the ladder only
 * relaxes when there is real slack (`SLACK`), so a panel can never oscillate
 * between two neighbouring steps on a one-pixel difference.
 */

/** The last rung of the ladder. */
export const DETAIL_FIT_MAX = 6;

/**
 * Extra room (px) the content must have SPARE before the composer relaxes a
 * step. Without it, a step that exactly fits would immediately overflow again
 * — the classic two-state flicker.
 */
const SLACK = 10;

/** Overflow smaller than this is not worth a concession (sub-pixel rounding). */
const TOLERANCE = 1;

/**
 * Resolve the gentlest fit level at which the content fits its box.
 *
 * `apply` sets the level (the caller writes the attribute); the function
 * re-measures after each step, so every rung is judged on the layout it
 * actually produces — never on a prediction.
 */
export function resolveDetailFit(
  panel: HTMLElement,
  content: HTMLElement,
  apply: (level: number) => void,
  start = 0,
): number {
  let level = Math.max(0, Math.min(DETAIL_FIT_MAX, start));
  apply(level);
  // Step DOWN the ladder while the content genuinely does not fit.
  while (level < DETAIL_FIT_MAX && content.scrollHeight > panel.clientHeight + TOLERANCE) {
    level += 1;
    apply(level);
  }
  // …and back UP while there is room to spare (hysteresis: SLACK, not 0).
  while (level > 0) {
    apply(level - 1);
    if (content.scrollHeight > panel.clientHeight - SLACK) {
      apply(level);
      break;
    }
    level -= 1;
  }
  return level;
}
