import {BoardName} from '../../common/boards/BoardName';
import {HELLAS_BONUS_OCEAN_COST, TERRA_CIMMERIA_COLONY_COST} from '../../common/constants';
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
 * «ADDITIONAL PLACEMENT BONUS RULES»: Hellas' South Pole and Terra Cimmeria's
 * MSL Curiosity. Both have the same three-state shape — USABLE (a priority
 * strictly between a 2-icon and a 3-icon hex, plus its own printed transaction
 * when the tile lands), UNUSABLE («a hex without rewards», and landing there
 * gains and loses nothing) and, for MSL, ABSENT (no Colonies ⇒ the board never
 * prints the bonus at all). The Vastitas Borealis twin lands here when that
 * map does.
 */

/**
 * A usable PAY-TO-USE hex's reward-icon weight: «treated as a higher priority
 * than other 2-bonus-resource hexes, but otherwise is the same priority for
 * other tiebreakers» (Hellas, Adding Expansions p.11) / «a higher priority than
 * other 2-bonus-resource hexes (but lower than the 3 resource ones)» (MSL
 * Curiosity). Strictly above 2 and below 3 — the longer MSL wording spells the
 * clamp out, and on Hellas no LAND hex prints 3 icons anyway, so both readings
 * of the shorter wording agree.
 */
const PAY_TO_USE_PRIORITY = 2.5;

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
 * TERRA CIMMERIA'S MSL CURIOSITY — «the hex containing a colony and −5 MC».
 *
 * Identified by the PRINTED BONUS, never by a coordinate: `TerraCimmeriaNovaBoard`
 * is the only board that prints `SpaceBonus.COLONY`, and it STRIPS that bonus
 * from every space when Colonies is out of the game — which IS the official
 * third state, «if playing without Colonies, treat this hex as empty for both
 * MarsBot and the player». So this predicate is automatically false without
 * Colonies and nothing downstream has to ask about the expansion.
 */
export function isMslCuriosity(space: Space): boolean {
  return space.bonus.includes(SpaceBonus.COLONY);
}

/**
 * «If there is still a colony tile without a MarsBot colony available and
 * MarsBot has at least 5 MC» — the condition that decides BOTH halves of the
 * MSL rule, exactly like the South Pole's.
 *
 * The colony question is the very one `AutomaColonies.botBuildColony` asks
 * itself, so a hex ranked USABLE can never turn out to have nowhere to put the
 * colony it promised.
 */
export function mslCuriosityUsable(game: IGame, bot: IPlayer): boolean {
  if (bot.megaCredits < TERRA_CIMMERIA_COLONY_COST) {
    return false;
  }
  return game.colonies.some((colony) =>
    colony.isActive && !colony.isFull() && !colony.colonies.includes(bot.id));
}

/**
 * How many reward icons this hex counts as FOR MARSBOT's tiebreakers — plain
 * `space.bonus.length` everywhere except a conditional pay-to-use hex.
 */
export function botRewardIcons(game: IGame, bot: IPlayer, space: Space): number {
  if (isHellasSouthPole(game, space)) {
    // Unusable ⇒ «treated as a hex without rewards for the purposes of
    // tiebreakers» — 0, not the 1 printed icon.
    return hellasSouthPoleUsable(game, bot) ? PAY_TO_USE_PRIORITY : 0;
  }
  if (isMslCuriosity(space)) {
    // The same three states — and note this modifies STEP 4 only. Ocean
    // adjacency and Terra Cimmeria's special-tile step still run first.
    return mslCuriosityUsable(game, bot) ? PAY_TO_USE_PRIORITY : 0;
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
  return isHellasSouthPole(game, space) || isMslCuriosity(space) ? 0 : space.bonus.length;
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
 * MSL Curiosity's own printed transaction, once MarsBot's tile is on it: «it
 * doesn't gain 2 resources, but places a colony (using the method described
 * under Expedited Construction in the Colonies expansion, including gaining 2
 * matching resources) and loses 5 MC».
 *
 * `usable` is captured BEFORE the tile lands, for the South Pole's reason: the
 * placement itself can pay the bot ocean-adjacency M€, and a hex that was
 * RANKED as reward-less must not turn into a colony because that money arrived
 * in between.
 *
 * The colony rides `AutomaColonies.botBuildColony` — the same primitive B17/B18
 * use — so the random tile pick, the 2 matching storage resources, Europa's
 * ocean replacement, the «any player built a colony» triggers and the
 * corporation hook are all the production ones. Passed in as a callback to keep
 * this module free of the colony import (it is read by `Game` itself).
 */
export function settleMslCuriosity(bot: IPlayer, usable: boolean, buildColony: () => void): void {
  if (!usable) {
    // «If MarsBot places on here, it doesn't gain or lose anything.»
    return;
  }
  // The colony FIRST, then the price — so a bot holding exactly 5 M€ can still
  // pay for the thing it just received.
  buildColony();
  bot.stock.deduct(Resource.MEGACREDITS, TERRA_CIMMERIA_COLONY_COST, {log: true});
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

/**
 * The same rebate for MSL Curiosity, which the human path gates TWICE — on the
 * 5 M€ (`TerraCimmeriaNovaBoard.spaceCosts`) and on «the player has a colony
 * they could still build» (its `getAvailableSpacesOnLand` override). Official
 * Automa reads both the other way round: an unusable MSL is not illegal, it is
 * «a hex without rewards» the bot may still land on for nothing.
 *
 * `cost` covers the money gate; the colony gate has no cost to rebate, so the
 * recovered hex is re-admitted by the caller (see `AutomaTilePlacer`).
 */
export const MSL_CURIOSITY_REBATE = -TERRA_CIMMERIA_COLONY_COST;

/** True when the bot cannot use MSL Curiosity and therefore needs it recovered. */
export function needsMslCuriosityRebate(game: IGame, bot: IPlayer): boolean {
  return game.gameOptions.boardName === BoardName.TERRA_CIMMERIA_NOVA &&
    !mslCuriosityUsable(game, bot);
}
