/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE VERDICT AFTER THE REVEAL (P45 Board of Directors · ledger ET) — «draw 1 prelude: either discard it, or pay 12 M€
 * and remove 1 director from here to play it».
 *
 * The mid-game prelude pick (`ConsoleDeckPick` in `play` mode — P91 WG Project's «ВЫБОР ПРОЛОГА») speaks «choose 1 of
 * N»: A moves the choice, RT plays it. A pick whose marker carries a PRICE and `min 0` is not that question: ONE card
 * was turned over and the player decides what happens to it — two OUTCOMES, each a row with its chips and its reason,
 * and A on a row is the decision AND the commit. Read off the server's marker (`DeckPickPromptMeta.price`, `min`,
 * `max`) — never a title, never a button label; `max 0` (the server could not offer the play) is the refused row with
 * its magnitude, never a re-derived affordability.
 *
 * PURE (no Vue, no DOM, no i18n): the surface renders the rows, the server runner tests them.
 */
import {CardResource} from '@/common/CardResource';
import {DeckPickPlayPrice, DeckPickPromptMeta} from '@/common/models/PlayerInputModel';
import type {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import type {RailReward} from '@/client/console/resourceTransfer/railReward';

/** One `current → resulting` chip of an outcome. */
export type PreludeVerdictChip = {
  kind: 'megacredits' | 'card-resource';
  resource?: CardResource;
  from: number;
  to: number;
};

export type PreludeVerdictRow = {
  key: 'play' | 'discard';
  /** The row's verb (an i18n key). */
  label: string;
  /** The row's consequence line (an i18n key + params). */
  detail: {key: string, params: ReadonlyArray<string>};
  available: boolean;
  /** Why the row is refused (`available === false`) — the magnitude named. */
  reason?: {key: string, params: ReadonlyArray<string>};
  /** The only outcome the player can take — shown and marked, still pressed (no auto-answer). */
  sole: boolean;
  /** The played prelude cannot resolve: it burns for 15 M€ (the server's verdict). */
  burns: boolean;
  chips: ReadonlyArray<PreludeVerdictChip>;
};

/** The burn's printed payout (`PreludesExpansion.fizzle`). */
const BURN_MEGACREDITS = 15;

/** The verdict grammar is on: a `play` pick with a price and `min 0`. Anything else keeps P91's «choose 1 of N». */
export function preludeVerdictOf(meta: DeckPickPromptMeta | undefined): DeckPickPlayPrice | undefined {
  return meta !== undefined && meta.mode === 'play' && meta.min === 0 && meta.price !== undefined ? meta.price : undefined;
}

/** The two outcome rows, the play first (the printed order: «either discard it, or pay … to play it» is a choice of two). */
export function preludeVerdictRows(price: DeckPickPlayPrice, o: {
  /** The player's M€ now (the rail's own number). */
  megacredits: number,
  /** The server's `max` — 0 when it could not offer the play. */
  max: number,
  /** The drawn prelude burns (its outlook — the server's verdict, the price held back). */
  burns: boolean,
}): Array<PreludeVerdictRow> {
  const playable = o.max >= 1 && price.affordable;
  const chips: Array<PreludeVerdictChip> = [
    {kind: 'megacredits', from: o.megacredits, to: o.megacredits - price.megacredits + (o.burns ? BURN_MEGACREDITS : 0)},
  ];
  const here = price.resourcesHere;
  if (here !== undefined) {
    chips.push({kind: 'card-resource', resource: here.resource, from: here.have, to: Math.max(0, here.have - here.count)});
  }
  const deficit = price.deficit ?? Math.max(0, price.megacredits - o.megacredits);
  const play: PreludeVerdictRow = {
    key: 'play',
    label: o.burns ? 'Play: it burns' : 'Play it',
    detail: o.burns ?
      {key: 'Pay ${0} M€ and 1 director; the prelude burns and you gain 15 M€', params: [String(price.megacredits)]} :
      {key: 'Pay ${0} M€ and 1 director to play it', params: [String(price.megacredits)]},
    available: playable,
    ...(playable ? {} : {reason: {key: 'Need ${0} more M€', params: [String(Math.max(1, deficit))]}}),
    sole: false,
    burns: o.burns,
    chips: playable ? chips : [],
  };
  const discard: PreludeVerdictRow = {
    key: 'discard',
    label: 'Discard it',
    detail: {key: 'To the prelude discard pile; nothing else changes', params: []},
    available: true,
    sole: !playable,
    burns: false,
    chips: [],
  };
  return [play, discard];
}

/** Where the cursor opens: the play when it is open, else the one outcome there is. */
export function initialVerdictFocus(rows: ReadonlyArray<PreludeVerdictRow>): number {
  const at = rows.findIndex((r) => r.available);
  return at < 0 ? 0 : at;
}

/** A d-pad step between the rows (no wrap; a refused row is still walkable — it is READ, never taken). */
export function stepVerdictFocus(rows: ReadonlyArray<PreludeVerdictRow>, focus: number, delta: 1 | -1): number {
  return Math.min(rows.length - 1, Math.max(0, focus + delta));
}

/** Where the price's token is absorbed: the printed cost on the SOURCE card standing in the action composer's hero. */
export const PRELUDE_PRICE_TARGET_SELECTOR = '.con-cardactions .con-composer__actcardwrap';

/** The source card's capsule on that hero — where a card-resource token of the price (the director) is BORN. */
export function preludePriceCapsuleSelector(card: string): string {
  return `${PRELUDE_PRICE_TARGET_SELECTOR}[data-zoom-slot="${card.replace(/"/g, '\\"')}"] .pcard__res`;
}

/** The stock rows a price can be paid from (a payment's other keys are card resources — never this price's). */
const STOCK_PAY_ROWS: ReadonlyArray<string> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

/**
 * THE PRICE LEAVES FIRST (P45 · decision 5 — PL-099 / PL-104): the verdict's price rides the played prelude's hero scene
 * as its BILL (the law's grammar, RX36 PL-725) — one token per row the price was ACTUALLY paid from (`paid`: Helion's
 * heat leaves the heat row; absent = all M€), sideways off the rail into the printed «12 M€» on the source card, and the
 * DIRECTOR off the source card's own capsule into its printed icon (PL-1561) — each row / the capsule ticking on its
 * departure — before the prelude lifts and its own rewards are born. The answer that charges the price also pays the
 * prelude's own stock gains (Loan's 30 M€): those are the bill's KNOWN moves; the check against the two views is the
 * hero's (`verifyRailReward`), never assumed.
 */
export function preludePriceBill(
  price: DeckPickPlayPrice,
  rewards: ReadonlyArray<ResourceTransferSpec> | undefined,
  paid?: Readonly<Record<string, number | undefined>>,
): {reward: RailReward, targetSelector: string, capsuleSelector?: string} {
  const known: Record<string, number> = {};
  for (const spec of rewards ?? []) {
    if (spec.channel === 'stock') {
      const row = `${spec.channel}:${spec.resource}`;
      known[row] = (known[row] ?? 0) + (spec.direction === 'loss' ? -spec.amount : spec.amount);
    }
  }
  const cause: Array<ResourceTransferSpec> = [];
  if (paid === undefined) {
    cause.push({channel: 'stock', resource: 'megacredits', amount: price.megacredits, direction: 'loss'});
  } else {
    for (const row of STOCK_PAY_ROWS) {
      const amount = paid[row] ?? 0;
      if (amount > 0) {
        cause.push({channel: 'stock', resource: row, amount, direction: 'loss'});
      }
    }
  }
  const here = price.resourcesHere;
  if (here !== undefined && here.count > 0) {
    cause.push({channel: 'card-resource', resource: String(here.resource).toLowerCase().replace(/ /g, '-'), amount: here.count,
      direction: 'loss', targetCard: here.card});
  }
  return {
    reward: {cause, reactions: [], known},
    targetSelector: PRELUDE_PRICE_TARGET_SELECTOR,
    ...(here !== undefined ? {capsuleSelector: preludePriceCapsuleSelector(here.card)} : {}),
  };
}
