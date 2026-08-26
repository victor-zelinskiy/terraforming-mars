import {BoardName} from '../../common/boards/BoardName';
import {HELLAS_BONUS_OCEAN_COST} from '../../common/constants';
import {Resource} from '../../common/Resource';
import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {SpaceName} from '../../common/boards/SpaceName';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';

/**
 * WHAT A PRINTED HEX IS WORTH TO MARSBOT — the ONE source both consumers read,
 * so a hex can never be RANKED as one thing and PAY OUT as another:
 *
 *  · the placement tiebreak «cover the most reward icons possible»
 *    (rulebook p.9 / Adding Expansions p.10 step 4) → {@link botRewardIcons};
 *  · the payout when the tile lands → {@link botCoveredIconMegacredits}, read by
 *    `Game.grantPlacementBonuses`'s MarsBot branch, plus
 *    {@link settleHellasSouthPole} for the hex's own printed transaction.
 *
 * The default rule is flat: «MarsBot gains 1 MC for each icon covered (instead
 * of the printed rewards)» (rulebook p.9). The exceptions are the maps' printed
 * PAY-TO-USE hexes, whose reward is CONDITIONAL — Adding Expansions p.11
 * «ADDITIONAL PLACEMENT BONUS RULES». Only Hellas' South Pole is in scope; the
 * Terra Cimmeria / Vastitas Borealis twins land here when those maps do.
 */

/**
 * The Hellas South Pole's reward-icon weight while it is usable: «treated as a
 * higher priority than other 2-bonus-resource hexes, but otherwise is the same
 * priority for other tiebreakers» (Adding Expansions p.11). Strictly above 2
 * and below 3 — the clamp the Terra Cimmeria twin spells out («but lower than
 * the 3 resource ones»); on Hellas no LAND hex prints 3 icons anyway, so both
 * readings of the shorter Hellas wording agree.
 */
const SOUTH_POLE_PRIORITY = 2.5;

/** The Hellas South Pole hex — the one printing an ocean bonus that charges 6 M€. */
export function isHellasSouthPole(game: IGame, space: Space): boolean {
  return game.gameOptions.boardName === BoardName.HELLAS &&
    space.id === SpaceName.HELLAS_OCEAN_TILE &&
    space.bonus.includes(SpaceBonus.OCEAN);
}

/**
 * «If there are oceans still available to place and MarsBot has at least 6 MC»
 * — the condition that decides BOTH halves of the South Pole rule.
 */
export function hellasSouthPoleUsable(game: IGame, bot: IPlayer): boolean {
  return game.canAddOcean() && bot.megaCredits >= HELLAS_BONUS_OCEAN_COST;
}

/**
 * How many reward icons this hex counts as FOR MARSBOT's tiebreakers — plain
 * `space.bonus.length` everywhere except a conditional pay-to-use hex.
 */
export function botRewardIcons(game: IGame, bot: IPlayer, space: Space): number {
  if (isHellasSouthPole(game, space)) {
    // Unusable ⇒ «treated as a hex without rewards for the purposes of
    // tiebreakers» — 0, not the 1 printed icon.
    return hellasSouthPoleUsable(game, bot) ? SOUTH_POLE_PRIORITY : 0;
  }
  return space.bonus.length;
}

/**
 * The flat «1 M€ per covered icon» payout, with the conditional hexes zeroed:
 * a usable South Pole pays its printed transaction instead (see
 * {@link settleHellasSouthPole}), an unusable one «doesn't gain or lose
 * anything».
 */
export function botCoveredIconMegacredits(game: IGame, space: Space): number {
  return isHellasSouthPole(game, space) ? 0 : space.bonus.length;
}

/**
 * The South Pole's own printed transaction, once MarsBot's tile is on it: «it
 * doesn't gain 2 resources, but places an ocean (gaining 1 TR) and loses 6 MC».
 *
 * `usable` is captured BEFORE the tile lands — the placement itself can pay the
 * bot ocean-adjacency M€, and a hex that was ranked as reward-less must not
 * turn into an ocean because that money arrived in between.
 *
 * The ocean rides the ordinary bot ocean placement (`placeOcean`), so it keeps
 * the standard tiebreakers, TR and adjacency M€ — this is never a second,
 * parallel way to put an ocean on the board.
 */
export function settleHellasSouthPole(bot: IPlayer, usable: boolean, placeOcean: () => void): void {
  if (!usable) {
    return;
  }
  bot.stock.deduct(Resource.MEGACREDITS, HELLAS_BONUS_OCEAN_COST, {log: true});
  placeOcean();
}

/**
 * The M€ rebate that makes a conditional pay-to-use hex legal for MarsBot.
 *
 * The human legality path drops the South Pole when the player cannot pay its
 * 6 M€ (`Board.canAfford` via `HellasBoard.spaceCosts`). Official Automa reads
 * the other way round: an unaffordable South Pole is not illegal, it is simply
 * «a hex without rewards», and «if MarsBot places on here, it doesn't gain or
 * lose anything». Asking the engine the very same legality question with the
 * bonus cost rebated keeps every OTHER rule (adjacency, reserved spaces,
 * ownership, Ares) deciding.
 */
export const HELLAS_SOUTH_POLE_REBATE = -HELLAS_BONUS_OCEAN_COST;

/** True when the bot needs that rebate at all — i.e. it cannot pay the 6 M€. */
export function needsSouthPoleRebate(game: IGame, bot: IPlayer): boolean {
  return game.gameOptions.boardName === BoardName.HELLAS &&
    bot.megaCredits < HELLAS_BONUS_OCEAN_COST;
}
