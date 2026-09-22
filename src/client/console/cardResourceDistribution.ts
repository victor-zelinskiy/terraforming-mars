/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE LAYOUT of a card-resource DISTRIBUTION — the PURE half of the card-target
 * chassis's LAYOUT MODE (the shared `AddResourcesToCards` step: N units of one
 * resource spread over the player's holders, the sum EXACTLY N — Cloud
 * Development's floaters, Cyanobacteria's microbes, and every distributing
 * resolution after them).
 *
 * The chassis is the card-target picker itself (`ConsoleTaskHost`, mode
 * `distribute`): the same grid of real faces, the same status line. What this
 * module adds is the ARITHMETIC of the layout, stated once and unit-tested
 * under the server runner:
 *   · a counter per card that never goes below 0 and never above what is left
 *     to place (LB takes one back, RB adds one, RT pours the rest);
 *   · the remaining count, and the honest reason the commit is withheld while
 *     it is above zero (invariant 5: a disabled control carries its reason);
 *   · the focused card's reading for ITS current amount — the resource
 *     «current → resulting» and the VP for that very k, read off the server's
 *     table (`vpByAmount`, one entry per k — never a delta scaled on the
 *     client, invariant 7);
 *   · the whole layout's VP shift;
 *   · the durable form of the layout (the picks store keeps card NAMES — the
 *     layout travels as each name repeated as many times as it holds).
 *
 * THE LAYOUT OPENS EMPTY: no «everything on the first card» default — that is
 * an auto-select (invariant 3) and a loaded reflex submit at once. And the
 * answer is BUILT ONLY FROM A COMPLETE LAYOUT (`taskResponses
 * .cardResourceDistributionResponse` returns nothing for any other sum), so
 * the rule «an incomplete layout cannot be sent» holds at the button, at the
 * handler and at the builder — never at one disabled button alone.
 *
 * PURE: no Vue, no DOM, no i18n — English keys out, numbers in.
 */
import {CardName} from '@/common/cards/CardName';
import {CardResourceDistributionMeta} from '@/common/models/PlayerInputModel';
import {VictoryPointsDelta} from '@/common/models/ActionPreviewModel';

/** The layout: card name → units placed on it (absent = 0). */
export type SpreadState = Readonly<Record<string, number>>;

export function spreadOn(state: SpreadState, card: string): number {
  return state[card] ?? 0;
}

/** Units placed so far. */
export function spreadTotal(state: SpreadState): number {
  return Object.values(state).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** Units still to place (never negative). */
export function spreadRemaining(amount: number, state: SpreadState): number {
  return Math.max(0, amount - spreadTotal(state));
}

/**
 * Move `delta` units on `card`: up is bounded by what is left to place, down by
 * zero. A step that changes nothing returns the SAME state, so a bound press
 * (LB on zero, RB with nothing left) is a no-op the caller can tell apart.
 */
export function stepSpread(state: SpreadState, card: string, delta: number, amount: number): SpreadState {
  const current = spreadOn(state, card);
  const remaining = spreadRemaining(amount, state);
  const next = delta > 0 ? current + Math.min(delta, remaining) : Math.max(0, current + delta);
  if (next === current) {
    return state;
  }
  const out: Record<string, number> = {...state};
  if (next === 0) {
    delete out[card];
  } else {
    out[card] = next;
  }
  return out;
}

/** RT — pour everything still unplaced onto `card` (a no-op with nothing left). */
export function pourRemaining(state: SpreadState, card: string, amount: number): SpreadState {
  return stepSpread(state, card, spreadRemaining(amount, state), amount);
}

/** Is the layout complete — every unit placed, and something to place at all? */
export function spreadComplete(amount: number, state: SpreadState): boolean {
  return amount > 0 && spreadTotal(state) === amount;
}

/**
 * WHY the commit is withheld — an English key with its parameter, or undefined
 * when the layout is complete. The one sentence the status line, the bar and
 * the handler all stand on.
 */
export function spreadBlocked(amount: number, state: SpreadState): {key: string, params: ReadonlyArray<string>} | undefined {
  const remaining = spreadRemaining(amount, state);
  return remaining === 0 ? undefined : {key: 'Left to place: ${0}', params: [String(remaining)]};
}

/** The resource reading of ONE card at its current amount: «current → resulting». */
export type SpreadCardReading = {
  card: CardName;
  /** Units placed on this card in the layout. */
  placed: number;
  /** The stored count now, and after the layout lands (equal at 0 placed). */
  resources: {from: number, to: number};
  /** The VP for THIS amount, from the server's table — absent for a card whose points never respond. */
  vp?: VictoryPointsDelta;
};

/**
 * The focused card's reading for its current amount. The VP is the SERVER's
 * entry for exactly `placed` (index placed − 1); at 0 placed a responding card
 * reads its points standing still (`from → from`) — «responds but does not
 * move» is a reading, silence is not.
 */
export function spreadCardReading(meta: CardResourceDistributionMeta, state: SpreadState, card: CardName): SpreadCardReading | undefined {
  const model = meta.cards.find((c) => c.name === card);
  if (model === undefined) {
    return undefined;
  }
  const placed = spreadOn(state, card);
  const from = model.resources ?? 0;
  const table = meta.vpByAmount?.[card];
  const reading: SpreadCardReading = {card, placed, resources: {from, to: from + placed}};
  if (table !== undefined && table.length > 0) {
    const first = table[0];
    reading.vp = placed > 0 ? (table[placed - 1] ?? table[table.length - 1]) : {from: first.from, to: first.from, ...(first.owner === undefined ? {} : {owner: first.owner})};
  }
  return reading;
}

/** The whole layout's VP shift — the sum of every placed card's `to − from` for its own amount. */
export function spreadVictoryPointsShift(meta: CardResourceDistributionMeta, state: SpreadState): number {
  let shift = 0;
  for (const card of meta.cards) {
    const placed = spreadOn(state, card.name);
    if (placed <= 0) {
      continue;
    }
    const entry = meta.vpByAmount?.[card.name]?.[placed - 1];
    if (entry !== undefined) {
      shift += entry.to - entry.from;
    }
  }
  return shift;
}

/**
 * THE DURABLE FORM — the picks store keeps card NAMES (a minimize → restore
 * survives on it), so a layout travels as each name repeated as many times as
 * it holds, and comes back as the same counters.
 */
export function spreadToPicks(state: SpreadState): Array<string> {
  const out: Array<string> = [];
  for (const [card, n] of Object.entries(state)) {
    for (let i = 0; i < (n ?? 0); i++) {
      out.push(card);
    }
  }
  return out;
}

export function spreadFromPicks(picks: ReadonlyArray<string>, meta: CardResourceDistributionMeta): SpreadState {
  const known = new Set(meta.cards.map((c) => c.name as string));
  let state: SpreadState = {};
  for (const name of picks) {
    if (known.has(name)) {
      state = stepSpread(state, name, 1, meta.amount);
    }
  }
  return state;
}
