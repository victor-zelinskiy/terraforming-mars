/*
 * @console-shared LIVE — console native stands on this file.
 *
 * PL-1469 · THE BURN PAYS FROM THE CARD THAT BURNT. A prelude that cannot resolve when the mid-game pick plays it
 * (P91 WG Project) fizzles: the server gives 15 M€ with `from: {card}` — and the rail used to tick in the frame the view
 * applied, a number that changed with no cause on screen. The rail half's own grammar (`railReward.ts`) carries it:
 *
 *   ARM    — the deck pick's commit press, for the candidate the server's verdict says burns (never a guess);
 *   SEED   — the transport's apply block (`seedPreludeBurnRewardHold`): the answer that applied the burn holds the M€
 *            row at its pre-burn value, checked against the two views (`verifyRailReward` — a row that moved otherwise
 *            is not held and names itself); a frame that paid nothing yet keeps the arm OWED;
 *   FLY    — the deck pick's exit: ONE token born on the burnt card's face in its slot, the row ticking on the touchdown;
 *   RELEASE — the surface's end: a hold nobody flies is let go at once (a blocking rail entry must never stand).
 */
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {railRewardPending, releaseRailReward, seedRailReward, flyRailReward, RailReward} from '@/client/console/resourceTransfer/railReward';
import {TransferEndLike} from '@/client/console/resourceTransfer/resourceTransferModel';

export const PRELUDE_BURN_RAIL_KEY = 'prelude-burn';
/** The burn's printed payout (`PreludesExpansion.fizzle`) — the server's own number, checked against the views. */
export const PRELUDE_BURN_MEGACREDITS = 15;

let armed: CardName | undefined;
/** A price the same answer charges BEFORE the burn (P45's 12 M€) — a known move of the M€ row. */
let armedPrice = 0;

/** The commit press of a burning candidate: the next answer that pays it is this burn's. */
export function armPreludeBurn(card: CardName, priceMc = 0): void {
  armed = card;
  armedPrice = priceMc;
}

/** The reward the burn promises — one M€ token of 15 (the price paid in the same answer, a known move of the row). */
export function preludeBurnReward(priceMc = 0): RailReward {
  return {
    cause: [{channel: 'stock', resource: 'megacredits', amount: PRELUDE_BURN_MEGACREDITS}],
    reactions: [],
    known: priceMc > 0 ? {'stock:megacredits': -priceMc} : {},
  };
}

/** The transport's apply block. A no-op unless a burn is armed and this response moved the M€ row. */
export function seedPreludeBurnRewardHold(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (armed === undefined || before === undefined || after === undefined) {
    return;
  }
  // A frame that paid nothing yet (a poll ahead of the answer) — the promise stays owed.
  if (after.thisPlayer.megacredits === before.thisPlayer.megacredits) {
    return;
  }
  armed = undefined;
  const price = armedPrice;
  armedPrice = 0;
  seedRailReward(PRELUDE_BURN_RAIL_KEY, preludeBurnReward(price), before, after);
}

/** The burn's token is held and owed its flight. */
export function preludeBurnOwed(): boolean {
  return railRewardPending(PRELUDE_BURN_RAIL_KEY);
}

/** FLY — the token off the burnt card's face (a measured object; `undefined` degrades by name: the row ticks). */
export function flyPreludeBurn(origin: TransferEndLike | undefined): Promise<unknown> {
  return flyRailReward(PRELUDE_BURN_RAIL_KEY, () => origin);
}

/** The flyer is gone — nothing of the burn may stand: the arm is dropped, a held row ticks now. */
export function releasePreludeBurn(why: string): void {
  armed = undefined;
  armedPrice = 0;
  if (railRewardPending(PRELUDE_BURN_RAIL_KEY)) {
    releaseRailReward(PRELUDE_BURN_RAIL_KEY, why);
  }
}
