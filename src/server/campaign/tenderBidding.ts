// Campaign «ТЕНДЕРЫ» — the BIDDING engine (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §3).
//
// Pure: the manager hands in the standings, the Register and the campaign's
// seeded stream; every function returns new state and touches nothing else, so
// the whole rule — the Register, the deal, the pick order with its lots, the
// bot's denial pick, the close — is tested row by row without a campaign.

import {Random} from '../../common/utils/Random';
import {MissionStanding} from '../../common/campaign/CampaignTypes';
import {
  BiddingLot,
  BiddingOfferCard,
  BiddingState,
  TENDER_CATALOG,
  TENDER_IDS,
  TenderHolding,
  TenderId,
  biddingOpenCards,
  biddingTurnSeat,
  botTenderPick,
} from '../../common/campaign/tenders';

/**
 * THE REGISTER — the campaign's shuffled tender deck. `order` is every copy of
 * every applicable kind, shuffled once with the route's seed; `drawn` is the
 * cursor. A kind skipped at a deal (already on the table) goes to the bottom;
 * an exhausted Register appends a second printing.
 */
export type TenderRegister = {
  order: Array<TenderId>;
  drawn: number;
};

function shuffled<T>(items: ReadonlyArray<T>, rng: Random): Array<T> {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One printing of the Register: every copy of every applicable kind, shuffled. */
export function printTenderRegister(applicable: (id: TenderId) => boolean, rng: Random): Array<TenderId> {
  const copies: Array<TenderId> = [];
  for (const id of TENDER_IDS) {
    if (!applicable(id)) {
      continue;
    }
    for (let k = 0; k < TENDER_CATALOG[id].copies; k++) {
      copies.push(id);
    }
  }
  return shuffled(copies, rng);
}

export function buildTenderRegister(applicable: (id: TenderId) => boolean, rng: Random): TenderRegister {
  return {order: printTenderRegister(applicable, rng), drawn: 0};
}

/**
 * THE DEAL — `size` cards off the top of the Register onto the table, every
 * kind DISTINCT within the offer (the owner's rule: no duplicates in one
 * bidding; duplicates across missions stack). A copy whose kind already lies
 * on the table — or whose kind this slot does not admit — goes under the
 * Register and is drawn again later. Exhausted → a second printing joins the
 * bottom. Returns the dealt offer and the Register as it stands after.
 */
export function dealTenderOffer(
  register: TenderRegister,
  size: number,
  slot: number,
  applicable: (id: TenderId) => boolean,
  rng: Random,
): {offer: Array<BiddingOfferCard>, register: TenderRegister} {
  const order = [...register.order];
  let drawn = register.drawn;
  const offer: Array<BiddingOfferCard> = [];
  const onTable = new Set<TenderId>();
  // A bound on the walk: every copy inspected at most twice plus one printing.
  let budget = order.length * 2 + 1;
  while (offer.length < size && budget > 0) {
    budget--;
    if (drawn >= order.length) {
      const printing = printTenderRegister(applicable, rng);
      if (printing.length === 0) {
        break; // nothing applicable at all — an honest short offer
      }
      order.push(...printing);
      budget += printing.length;
    }
    const id = order[drawn];
    if (!applicable(id)) {
      order.splice(drawn, 1); // a kind this campaign can never use leaves the Register
      continue;
    }
    if (onTable.has(id)) {
      order.splice(drawn, 1);
      order.push(id); // under the Register — drawn again later
      continue;
    }
    drawn++;
    onTable.add(id);
    offer.push({instance: `t${slot}-${offer.length}`, id});
  }
  return {offer, register: {order, drawn}};
}

/**
 * THE PICK ORDER — the standings' places, a seeded LOT inside every full tie
 * (`compareFinalScores === 0`: equal VP and M€). The lots are recorded so the
 * table can show them.
 */
export function biddingOrder(standings: ReadonlyArray<MissionStanding>, rng: Random): {order: Array<number>, lots: Array<BiddingLot>} {
  const byPlace = new Map<number, Array<number>>();
  for (const s of [...standings].sort((a, b) => a.place - b.place)) {
    const group = byPlace.get(s.place) ?? [];
    group.push(s.seat);
    byPlace.set(s.place, group);
  }
  const order: Array<number> = [];
  const lots: Array<BiddingLot> = [];
  for (const place of [...byPlace.keys()].sort((a, b) => a - b)) {
    const seats = byPlace.get(place) ?? [];
    if (seats.length === 1) {
      order.push(seats[0]);
      continue;
    }
    const drawnOrder = shuffled(seats, rng);
    lots.push({seats: [...seats], order: drawnOrder});
    order.push(...drawnOrder);
  }
  return {order, lots};
}

/** The seats that PICK: every seat of the order but the last (the last place leaves with nothing). */
export function biddingPickerCount(order: ReadonlyArray<number>): number {
  return Math.max(0, order.length - 1);
}

/**
 * Is the bidding over? Every picking seat has picked, or nothing is left on
 * the table. Leftover cards are withdrawn under the Register (the two-seat
 * table's second card).
 */
function closeIfDone(bidding: BiddingState): BiddingState {
  const open = biddingOpenCards(bidding);
  const done = bidding.pointer >= biddingPickerCount(bidding.order) || open.length === 0;
  if (!done) {
    return bidding;
  }
  return {
    ...bidding,
    done: true,
    offer: bidding.offer.map((c) => (c.takenBy === undefined && c.withdrawn !== true ? {...c, withdrawn: true} : c)),
  };
}

/** Open a bidding over a dealt offer and an order — the bot's picks are NOT applied here (`advanceBots`). */
export function openBidding(sourceSlot: number, offer: ReadonlyArray<BiddingOfferCard>, order: ReadonlyArray<number>, lots: ReadonlyArray<BiddingLot>): BiddingState {
  return closeIfDone({sourceSlot, offer: [...offer], order: [...order], lots: [...lots], pointer: 0, done: false});
}

/**
 * ONE PICK. Refuses out of turn, a card not on the table, a finished bidding
 * — by name. Returns the bidding after the pick (closed when it was the last).
 */
export function applyBid(bidding: BiddingState, seat: number, instance: string): BiddingState {
  if (bidding.done) {
    throw new Error('The bidding is over');
  }
  const turn = biddingTurnSeat(bidding);
  if (turn !== seat) {
    throw new Error('It is not this seat\'s turn to pick a tender');
  }
  const card = bidding.offer.find((c) => c.instance === instance);
  if (card === undefined || card.takenBy !== undefined || card.withdrawn === true) {
    throw new Error('That tender is not on the table');
  }
  const next: BiddingState = {
    ...bidding,
    offer: bidding.offer.map((c) => (c.instance === instance ? {...c, takenBy: seat} : c)),
    pointer: bidding.pointer + 1,
  };
  return closeIfDone(next);
}

/** The bot picks whenever the turn is its own — the catalog's denial order, at once. */
export function advanceBots(bidding: BiddingState, isBot: (seat: number) => boolean): BiddingState {
  let state = bidding;
  for (let guard = 0; guard < state.order.length + 1; guard++) {
    const turn = biddingTurnSeat(state);
    if (turn === undefined || !isBot(turn)) {
      break;
    }
    const pick = botTenderPick(biddingOpenCards(state));
    if (pick === undefined) {
      break;
    }
    state = applyBid(state, turn, pick.instance);
  }
  return state;
}

/** What a finished bidding gave each seat — the holdings to record (place = the seat's position in the order + 1). */
export function biddingHoldings(bidding: BiddingState): Array<{seat: number, holding: TenderHolding}> {
  const out: Array<{seat: number, holding: TenderHolding}> = [];
  for (const card of bidding.offer) {
    if (card.takenBy === undefined) {
      continue;
    }
    const place = bidding.order.indexOf(card.takenBy) + 1;
    out.push({
      seat: card.takenBy,
      holding: {instance: card.instance, id: card.id, wonAtSlot: bidding.sourceSlot, place, status: 'held'},
    });
  }
  return out;
}
