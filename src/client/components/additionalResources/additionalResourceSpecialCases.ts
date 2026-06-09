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
  readonly tone: 'success' | 'pending' | 'warning';
  /** i18n key for the status label (e.g. 'Life found'). */
  readonly label: string;
  /** VP this state grants right now; shown on the marker when > 0. */
  readonly vp?: number;
  /** Optional i18n secondary line describing the effect (e.g. the penalty). */
  readonly detail?: string;
  /**
   * Optional ACTIVATION threshold (a card-specific count that flips an effect
   * on, distinct from the per-resource VP rate). Drives a progress bar +
   * "current/required" readout, and `reached` recolours it to the active tone.
   */
  readonly threshold?: {readonly current: number; readonly required: number; readonly reached: boolean};
  /**
   * When true the card thumbnail's LEGACY on-card resource counter + VP sprite
   * are hidden in the overlay (the premium marker supersedes them). Used for
   * Search for Life, whose science-resource token reads as an out-of-place
   * "alien" sprite on the card face.
   */
  readonly replacesCardChrome?: boolean;
}

type Presenter = (amount: number) => SpecialResourceState | undefined;

/** Vermin's infestation threshold (server: `verminInEffect = resourceCount >= 10`). */
const VERMIN_THRESHOLD = 10;

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

  // Vermin ("Крысы"): a THRESHOLD card, but the threshold flips a global
  // PENALTY, not a VP rate — once it holds ≥ 10 animals every player loses
  // 1 VP per city they own. The generic per-resource summary can't express
  // this, so present a card-specific activation status + progress-to-10 bar
  // that turns to a warning tone the moment the infestation goes live.
  [CardName.VERMIN]: (amount) => {
    const reached = amount >= VERMIN_THRESHOLD;
    return {
      tone: reached ? 'warning' : 'pending',
      label: reached ? 'Vermin active' : 'Vermin inactive',
      detail: '-1 VP per city for all',
      threshold: {current: amount, required: VERMIN_THRESHOLD, reached},
    };
  },
};

/** The bespoke status for a card at the given amount, or undefined. */
export function specialResourceState(name: CardName, amount: number): SpecialResourceState | undefined {
  return REGISTRY[name]?.(amount);
}
