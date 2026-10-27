/**
 * A PRINTED TEXT THAT DEPENDS ON THE GAME'S EXPANSIONS (TR84 Titan Holdings — the owner: «…or Moon» ONLY when the Moon
 * is in the game). The face draws icons only; the printed SENTENCE lives in the card's information (the dossier, the
 * «Information» panel, the fullscreen viewer, the composer's rule rows). A variant names a shorter sentence that
 * replaces the full one when the listed expansions are OFF in the current game — so the text names only the tags this
 * game can play.
 *
 * Both strings are English i18n keys (each translated on its own, never a substituted noun); `text` is the FULL key
 * exactly as the information block carries it («Effect: After you play a Mars, Earth, Venus, Jovian, or Moon tag…»).
 * The rule itself never changes with the text (the hook still pays a Moon tag — without the Moon there is none to play).
 */
export type TextVariantExpansion = 'moon' | 'venus';

export type CardTextVariant = {
  /** The full printed key this variant stands in for. */
  readonly text: string;
  /** The expansions whose ABSENCE selects this variant — every one of them must be off. */
  readonly unless: ReadonlyArray<TextVariantExpansion>;
  /** The key printed instead. */
  readonly variant: string;
};

/** The expansions of one game as `GameOptionsModel.expansions` states them (absent = off). */
export type TextVariantExpansions = Partial<Readonly<Record<TextVariantExpansion, boolean>>>;

/**
 * THE ONE CHOICE: the key to print for `text` in a game with `expansions` — the variant whose `unless` set is all off
 * and the LARGEST (the most specific: «without the Moon and Venus» beats «without the Moon» when both are off), or the
 * full text when none applies. `expansions === undefined` — no game (the catalog, the card list) — prints the card.
 */
export function resolveCardText(text: string, variants: ReadonlyArray<CardTextVariant> | undefined, expansions: TextVariantExpansions | undefined): string {
  if (variants === undefined || expansions === undefined) {
    return text;
  }
  let best: CardTextVariant | undefined;
  for (const variant of variants) {
    if (variant.text !== text || !variant.unless.every((expansion) => expansions[expansion] !== true)) {
      continue;
    }
    if (best === undefined || variant.unless.length > best.unless.length) {
      best = variant;
    }
  }
  return best?.variant ?? text;
}
