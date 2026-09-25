/*
 * DISCARD INTENT — the PURE, DOM-free derivation behind the console's ONE
 * discard flow.
 *
 * Every rule that makes a player throw cards away (Mars University's
 * science-tag exchange, a Pluto colony bonus, Sponsored Academies, a global
 * event, a CEO action, a behaviour's `spend.cards`) marks its prompt with the
 * server's `discardPrompt` marker. Both surfaces that can host the pick —
 * the server `handSelect` task and the client hand-pick bridge (a discard
 * nested inside an OrOptions branch, e.g. Mars University) — feed that SAME
 * marker in here, so the skin, the copy, the verb and the animation can never
 * diverge between cases. That is the "single entry point" of the flow at the
 * data level.
 *
 * i18n is key-based: this module returns English keys + numbers, the surface
 * translates. Unit-tested by tests/client/components/console/discardIntent.spec.ts.
 */

import {CardName} from '@/common/cards/CardName';
import {BaseInputModel, DiscardPromptMeta, PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';

/** The A-verb of a discard pick. The server's own `buttonLabel` wins when it
 *  says something more specific than the generic ask (Stefan's «Продать»). */
export const DISCARD_VERB = 'Discard';

/** Source chip copy per marker kind — never derived from the (translated) title. */
const SOURCE_KEYS: Record<string, string> = {
  card: 'Card effect',
  corporation: 'Corporation effect',
  colony: 'Colony',
  standardProject: 'Standard project',
  // Turmoil Redux: a party's action asks (the Reds' recycle) — the header
  // names the party through `partyName`.
  party: 'Party action',
  // Turmoil Redux: an ENACTED RESOLUTION asks (Colonial Affairs repeating Pluto's
  // «draw 1, then discard 1») — the header leads with the colony that demands it
  // (`colonyRepeat`), the resolution stands as the hero of the sitting's stage.
  resolution: 'Resolution',
  system: 'Game rule',
};

export type DiscardExchange = {
  icon: string,
  /** The amount for the CURRENT pick (a `perCard` payout already multiplied). */
  amount: number,
  /** True when the payout scales with how many cards go. */
  perCard: boolean,
};

/**
 * Everything a surface needs to present a discard, derived from one marker.
 * Deliberately flat and value-only so a spec can assert it without a DOM.
 */
export type DiscardIntent = {
  min: number,
  max: number,
  /** i18n key of the headline ask, with `amount` filled when the key takes one. */
  headline: {key: string, amount?: number},
  /** Kicker chip naming the operation — always the discard, never the source. */
  kicker: string,
  /** i18n key naming WHO demands it. */
  sourceKey: string,
  /** The source card to preview, when there is one. */
  card?: CardName,
  /** What the discard buys back for the CURRENT selection (undefined = pure loss). */
  exchange?: DiscardExchange,
  /** Pluto's per-cube position, when the discard closes a colony payout — or a resolution's REPEAT of it (`colonyRepeat`). */
  sequence?: {index: number, total: number},
  /** The colony demanding it (colony-bonus discards) — the ask plate leads
   *  with its planet mini, so the source is a PLACE, not just the word
   *  «Колония». */
  colonyName?: string,
  /** The PARTY whose action demands it (Turmoil Redux) — an i18n key (the party name). */
  partyName?: string,
  /** The enacted RESOLUTION whose action / effect demands it (Turmoil Redux) — its catalog id (the surface names it). */
  resolution?: string,
  /** How many cards are picked right now (0 for a single-press pick). */
  picked: number,
  /** min === max === 1 → A answers in one press (no toggle-then-confirm). */
  single: boolean,
};

/** The raw marker of an input, if it is a discard prompt. */
export function discardMetaOf(input: BaseInputModel | undefined): DiscardPromptMeta | undefined {
  return input?.discardPrompt;
}

/** Is this prompt a discard from hand? The ONE structural test. */
export function isDiscardPrompt(input: BaseInputModel | undefined): boolean {
  return discardMetaOf(input) !== undefined;
}

/**
 * The headline ask. Distinct keys per shape so a translator can phrase each
 * naturally instead of receiving a stitched sentence.
 */
export function discardHeadline(meta: DiscardPromptMeta): {key: string, amount?: number} {
  if (meta.min === meta.max) {
    return meta.min === 1 ?
      {key: 'Discard 1 card'} :
      {key: 'Discard ${0} cards', amount: meta.min};
  }
  if (meta.min === 0) {
    return {key: 'Discard up to ${0} cards', amount: meta.max};
  }
  // «Any number» (the sale's own form — Open IP Trade's action: 1 to the whole hand): the ask names no count.
  if (meta.min === 1 && meta.max > 1) {
    return {key: 'Discard any number of cards'};
  }
  return {key: 'Discard ${0} cards', amount: meta.min};
}

/**
 * Resolve the payout for a concrete selection: per card, per matching TAG on
 * the picked cards (`pickedTags` — the Reds' recycle), or flat.
 */
export function discardExchangeFor(meta: DiscardPromptMeta, picked: number, pickedTags = 0): DiscardExchange | undefined {
  const exchange = meta.exchange;
  if (exchange === undefined) {
    return undefined;
  }
  const perCard = exchange.perCard === true;
  const perTag = exchange.perTag !== undefined;
  return {
    icon: exchange.icon,
    amount: perTag ? exchange.amount * pickedTags : perCard ? exchange.amount * picked : exchange.amount,
    perCard: perCard || perTag,
  };
}

/** How many of the exchange's TAGS the picked cards carry (0 for a per-card / flat exchange). */
export function discardPickedTags(meta: DiscardPromptMeta, pickedTags: ReadonlyArray<ReadonlyArray<string>>): number {
  const wanted = meta.exchange?.perTag;
  if (wanted === undefined) {
    return 0;
  }
  return pickedTags.reduce((sum, tags) => sum + tags.filter((tag) => (wanted as ReadonlyArray<string>).includes(tag)).length, 0);
}

/**
 * Derive the full presentation from the marker + the live selection.
 *
 * @param meta       the server marker (from a top-level prompt OR a nested branch).
 * @param picked     how many cards the player has selected so far.
 * @param pickedTags how many of the exchange's tags those cards carry (a per-tag payout).
 */
export function deriveDiscardIntent(meta: DiscardPromptMeta, picked: number, pickedTags = 0): DiscardIntent {
  const source = meta.source;
  // A colony payout's own discard (`colonyBonus` — the colony workspace's step) and a resolution's
  // REPEAT of that bonus (`colonyRepeat` — the sitting's step) read the same sequence and the same
  // planet; only the routing differs, and that is the marker's whole point.
  const colony = meta.colonyBonus ?? meta.colonyRepeat;
  return {
    min: meta.min,
    max: meta.max,
    headline: discardHeadline(meta),
    kicker: DISCARD_VERB,
    sourceKey: SOURCE_KEYS[source?.kind ?? 'system'] ?? SOURCE_KEYS.system,
    card: source?.card,
    exchange: discardExchangeFor(meta, picked, pickedTags),
    sequence: colony === undefined ?
      undefined :
      {index: colony.index, total: colony.total},
    colonyName: colony?.colonyName,
    partyName: source?.kind === 'party' ? source.party : undefined,
    resolution: source?.kind === 'resolution' ? source.resolution : undefined,
    picked,
    single: meta.min === 1 && meta.max === 1,
  };
}

/**
 * The DISCARD branch nested inside a top-level `OrOptions` (Mars University:
 * "discard a card to draw a card" OR "do nothing"). Returns the branch index
 * and its `SelectCard`, so the shell can hand the pick to the hand overlay and
 * wrap the answer back into that OR index.
 *
 * Only ONE level deep on purpose — that is the whole shape the server builds,
 * and the task host serves exactly one nested level.
 */
export function nestedDiscardBranch(
  input: PlayerInputModel | undefined,
): {index: number, select: SelectCardModel} | undefined {
  if (input?.type !== 'or') {
    return undefined;
  }
  for (let index = 0; index < input.options.length; index++) {
    const option = input.options[index];
    if (option.type === 'card' && option.discardPrompt !== undefined) {
      return {index, select: option};
    }
  }
  return undefined;
}
