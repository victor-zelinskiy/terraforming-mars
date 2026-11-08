// Campaign «ТЕНДЕРЫ» — the BIDDING engine (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §3).
//
// Pure: the manager hands in the standings, the applicability and the mission's
// seeded stream; every function returns new state and touches nothing else, so
// the whole rule — the mission deck, the deal, the pick order with its lots, the
// bot's denial pick, the close — is tested row by row without a campaign.

import {Random} from '../../common/utils/Random';
import {MissionStanding} from '../../common/campaign/CampaignTypes';
import {
  BiddingLot,
  BiddingOfferCard,
  BiddingState,
  TENDER_IDS,
  TenderHolding,
  TenderId,
  biddingOpenCards,
  biddingPickerCount,
  biddingTurnSeat,
  botTenderPick,
  tenderDef,
} from '../../common/campaign/tenders';

/**
 * THE MISSION DECK (the owner, 2026-11-08): ONE card of every applicable kind
 * of the catalog, shuffled afresh for THIS mission from the campaign's seeded
 * stream. Nothing persists between
 * missions — the same kind may come again at the next table, which is why a
 * tender's text speaks of what ONE MORE copy adds.
 */
export function missionTenderDeck(applicable: (id: TenderId) => boolean, rng: Random): Array<TenderId> {
  return shuffled(TENDER_IDS.filter((id) => applicable(id)), rng);
}

function shuffled<T>(items: ReadonlyArray<T>, rng: Random): Array<T> {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * THE DEAL — `size` cards off the top of the mission's fresh deck onto the
 * table, RANDOM but for ONE rule: AT MOST ONE DECISIVE tender among them (the
 * owner, 2026-11-07: «Продление программы» and «Дополнительный пролог» never
 * lie on one table — a player may still collect both by winning two missions).
 * Nothing else is steered (the owner, 2026-11-08: «в остальном ограничений нет
 * — может хоть два малых выпасть»): two minors may be the whole table. A second
 * decisive is set aside and the next card takes its place. A deck shorter than
 * the table (few applicable kinds) deals an honest short offer.
 */
export function dealTenderOffer(
  size: number,
  slot: number,
  applicable: (id: TenderId) => boolean,
  rng: Random,
): Array<BiddingOfferCard> {
  const deck = missionTenderDeck(applicable, rng);
  const offer: Array<BiddingOfferCard> = [];
  let decisiveOnTable = false;
  for (const id of deck) {
    if (offer.length >= size) {
      break;
    }
    if (tenderDef(id).tier === 'decisive') {
      if (decisiveOnTable) {
        continue; // set aside — the next card takes its place
      }
      decisiveOnTable = true;
    }
    offer.push({instance: `t${slot}-${offer.length}`, id});
  }
  return offer;
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

export {biddingPickerCount};

/**
 * Is the bidding over? Every picking seat has picked, or nothing is left on
 * the table. Leftover cards are withdrawn (the two-seat table's second card).
 */
function closeIfDone(bidding: BiddingState): BiddingState {
  const open = biddingOpenCards(bidding);
  const done = bidding.pointer >= biddingPickerCount(bidding) || open.length === 0;
  if (!done) {
    return bidding;
  }
  return {
    ...bidding,
    done: true,
    offer: bidding.offer.map((c) => (c.takenBy === undefined && c.withdrawn !== true ? {...c, withdrawn: true} : c)),
  };
}

/**
 * Open a bidding over a dealt offer and an order — the bot's picks are NOT applied here (`advanceBots`). `pickers` is
 * the campaign's offer rule read for this table (`biddingPickers`); absent = every seat but the last.
 */
export function openBidding(sourceSlot: number, offer: ReadonlyArray<BiddingOfferCard>, order: ReadonlyArray<number>, lots: ReadonlyArray<BiddingLot>, pickers?: number): BiddingState {
  const state: BiddingState = {sourceSlot, offer: [...offer], order: [...order], lots: [...lots], pointer: 0, done: false};
  if (pickers !== undefined) {
    state.pickers = Math.max(0, Math.min(order.length, pickers));
  }
  return closeIfDone(state);
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
