import {CardName} from '@/common/cards/CardName';

/**
 * Extensible per-card "special presenter" registry for the additional-resource
 * detail overlay.
 *
 * Most cards are fully described by the generic resource-count + VP-scoring
 * summary. A FEW have a bespoke state the generic summary can't convey — a
 * conditional "you found life" trigger, a thematic threshold gimmick, etc.
 * Those register a presenter here that returns a {@link SpecialResourceState}
 * for the current resource amount.
 *
 * The overlay renders the returned state as a PREMIUM STATUS MARKER inside the
 * same per-card info plate, so common + special cards keep one visual language
 * — the marker AUGMENTS the standard count, it doesn't fork the layout.
 *
 * To add a new special case: add one entry keyed by its `CardName`. Return a
 * state object (or `undefined` to fall back to the generic summary). Nothing
 * else needs to change — the overlay is data-driven from this map.
 */
export interface SpecialResourceState {
  /** Visual tone of the status marker. */
  readonly tone: 'success' | 'pending';
  /** i18n key for the status label (e.g. 'Life found'). */
  readonly label: string;
  /** VP this state grants right now; shown on the marker when > 0. */
  readonly vp?: number;
  /**
   * When true the card thumbnail's LEGACY on-card resource counter + VP sprite
   * are hidden in the overlay (the premium marker supersedes them). Used for
   * Search for Life, whose science-resource token reads as an out-of-place
   * "alien" sprite on the card face.
   */
  readonly replacesCardChrome?: boolean;
}

type Presenter = (amount: number) => SpecialResourceState | undefined;

const REGISTRY: Partial<Record<CardName, Presenter>> = {
  // Search for Life: holds a single science resource; the instant it has one,
  // the card is worth a flat 3 VP ("life found"). The generic per-resource
  // summary can't express this conditional trigger, so we present an explicit
  // premium status marker AND drop the legacy on-card alien (science) sprite.
  [CardName.SEARCH_FOR_LIFE]: (amount) => ({
    tone: amount > 0 ? 'success' : 'pending',
    label: amount > 0 ? 'Life found' : 'Searching for life',
    vp: amount > 0 ? 3 : 0,
    replacesCardChrome: true,
  }),

  // NOTE: a thematic threshold card (e.g. "Rats", if/when added to the card
  // set) would register here too. Threshold cards that ALREADY exist
  // (Tardigrades / Decomposers / Ants / …) don't need a bespoke entry — the
  // generic threshold-progress indicator covers them automatically.
};

/** The bespoke status for a card at the given amount, or undefined. */
export function specialResourceState(name: CardName, amount: number): SpecialResourceState | undefined {
  return REGISTRY[name]?.(amount);
}
