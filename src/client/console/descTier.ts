/**
 * The slot caption's READING TIER — which of the profile's three (size,
 * lines) pairs a rule gets (console.less § the caption's length ladder).
 *
 * Same principle as the fullscreen rules panel's `lengthTier`, applied to a
 * box that is a LAYOUT CONSTANT: the action body row is fixed at the canvas
 * height (the «или» joint anchors to it), so every pair fits that row and the
 * only thing length decides is which pair — a short rule buys a bigger face,
 * a long one buys the third line. One size for every length is the size the
 * LONGEST rule needs, which is what left the whole grid whispering at the
 * caption step (17 logical px, well under the couch profile's 26px reading
 * floor) on a 4K TV.
 *
 * TWO facts decide a tier, because a line is broken at WORDS, not at
 * characters:
 *  · the total LENGTH — how much text there is;
 *  · the LONGEST WORD — how much of a line one unbreakable run claims. A word
 *    wider than about half the column forces an early break and wastes the
 *    rest of that line, so «Повысьте производство энергии» (29 chars) needs
 *    THREE lines at the brief size while a 40-char sentence of short words
 *    fits in two. Length alone shipped exactly that clip.
 * Both caps are ~55% of the couch column at their own size: 11 chars × 28px
 * and 13 × 23px.
 *
 * ⚠️ THE LADDER IS ONLY THE STARTING TIER — THE COLUMN HAS THE LAST WORD (PL-123).
 * It was calibrated against a ~292 logical px couch column, and the column
 * did not stay there: by 2026-10-09 «Действия карт» measured 278 px beside
 * the 4K canvas and the effects explorer — a second host of the same ladder —
 * 222 px, so 18 of 84 action captions and 30 of 52 explorer captions in the
 * brief/regular tiers were cut by their own clamp on the TV (none at 1080).
 * A length ladder cannot know its host's width, so every host now runs
 * `fitDescTiers` after it lays out: a caption its tier's face does not hold
 * steps DOWN one tier at a time (brief → regular → dense) instead of being
 * cut, and a caption that fits keeps the bigger face. Dense is the overflow
 * tier — its clamp and ellipsis stand (the whole rule reads in the detail).
 * Guard: `tests/e2e/console-desc-tier-fit.spec.ts` (the shipped corpus in
 * both hosts' real columns, 1080 + 4K).
 */
export type ActionDescTier = 'brief' | 'regular' | 'dense';

const DESC_BRIEF_MAX = 33;
const DESC_BRIEF_WORD_MAX = 11;
const DESC_REGULAR_MAX = 40;
const DESC_REGULAR_WORD_MAX = 13;

function longestWord(text: string): number {
  let longest = 0;
  for (const word of text.split(/\s+/)) {
    longest = Math.max(longest, word.length);
  }
  return longest;
}

export function actionDescTier(text: string): ActionDescTier {
  const word = longestWord(text);
  if (text.length <= DESC_BRIEF_MAX && word <= DESC_BRIEF_WORD_MAX) {
    return 'brief';
  }
  return text.length <= DESC_REGULAR_MAX && word <= DESC_REGULAR_WORD_MAX ? 'regular' : 'dense';
}

const TIERS: ReadonlyArray<ActionDescTier> = ['brief', 'regular', 'dense'];

/** The attribute a fitted step rides on — never the tier CLASS, which Vue owns and rewrites. */
export const DESC_FIT_ATTR = 'data-desc-fit';

/** One step down the ladder; dense is the floor. */
export function nextDescTier(tier: ActionDescTier): ActionDescTier {
  return TIERS[Math.min(TIERS.indexOf(tier) + 1, TIERS.length - 1)];
}

/** The tier a caption RENDERS: the fitted step when there is one, else its ladder class (`<prefix>--<tier>`). */
export function renderedDescTier(el: Element, classPrefix: string): ActionDescTier {
  const fitted = el.getAttribute(DESC_FIT_ATTR);
  const asTier = TIERS.find((tier) => tier === fitted);
  if (asTier !== undefined) {
    return asTier;
  }
  return TIERS.find((tier) => el.classList.contains(`${classPrefix}--${tier}`)) ?? 'dense';
}

/** Cut by its own line clamp. A box with no layout (display: none) is not judged. */
function clippedByClamp(el: HTMLElement): boolean {
  return el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1;
}

export type DescFitOptions = {
  /** The caption elements (`.con-cardactions__desc`, `.con-efx__desc`). */
  selector: string,
  /** Their ladder class prefix (`con-cardactions__desc` → `--brief` …). */
  classPrefix: string,
  /**
   * Clear the previous steps first, so a WIDER column grows them back (a resize, a profile flip). Off in the
   * steady state: the host re-fits on every render, and a step only ever goes DOWN, so the common pass is one
   * batched read and nothing else. (A text that changed under a standing step is re-judged by the same pass:
   * the step is what renders, and a clip steps it further.)
   */
  regrow?: boolean,
};

/**
 * Fit every caption under `root` to its own column: in batched passes, one
 * layout each, step every caption its face does not hold one tier down, until
 * each fits or stands at dense (`regrow` clears the previous steps first). At
 * most three layouts for the whole grid, one in the steady state. Run it from
 * the host's existing per-paint fit (it measures what the paint will show,
 * so the player never sees the clipped first try).
 */
export function fitDescTiers(root: HTMLElement | undefined | null, opts: DescFitOptions): void {
  if (root === undefined || root === null || typeof window === 'undefined') {
    return;
  }
  const captions = Array.from(root.querySelectorAll<HTMLElement>(opts.selector));
  if (captions.length === 0) {
    return;
  }
  if (opts.regrow === true) {
    for (const el of captions) {
      el.removeAttribute(DESC_FIT_ATTR);
    }
  }
  for (let pass = 0; pass < TIERS.length - 1; pass++) {
    const over = captions.filter((el) => renderedDescTier(el, opts.classPrefix) !== 'dense' && clippedByClamp(el));
    if (over.length === 0) {
      return;
    }
    const steps = over.map((el) => nextDescTier(renderedDescTier(el, opts.classPrefix)));
    over.forEach((el, i) => el.setAttribute(DESC_FIT_ATTR, steps[i]));
  }
}
