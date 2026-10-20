/*
 * THE TILE A LAW GRANTS THE SEATS, AS MARSBOT TAKES IT (decision D11 — the
 * owner, 2026-10-20: «the bot is a full participant»; docs/TURMOIL_REDUX_MARSBOT.md
 * §4, §10).
 *
 * An enacted law never PAYS the bot and never CHARGES it (D3 — it has no
 * production, its «tags» are track positions, every payout would need an
 * invented translation). A TILE is different: the bot has a primitive for it,
 * so the tile a law grants the seats (`tileGrant`) is the bot's by the SAME
 * recipients rule a human's is (`tileGrantEligibility` with the bot's own
 * influence and the recorded winner), and it places it by its OWN rule:
 *
 *   own-city  — a tier on one of the bot's own cities on Mars (the ONE
 *               placement validator `city-tier`, the bot's tie-break);
 *   any-legal — a new city by the bot's official city rule («next to as much
 *               greenery as possible», the ordinary city rules, Ares hazard
 *               avoidance — `AutomaTilePlacer.placeCity`) with `onEmpty:
 *               'impossible'`: a LAW is not a printed icon of the bot's card,
 *               so an empty board costs it NO Failed Action.
 *
 * The bot is walked IN ITS PLACE in the seat order (`ParliamentPhase.stepEffects`
 * — a first-player bot places first and closes the cells next to its city),
 * under the card's own step key and part (`effect`), the idempotency key under
 * its seat — so a reload never places it twice and the results read the bot's
 * tile as one more seat's. Never a prompt; every branch REPORTS exactly once
 * with the kinds the human's step records (`city` · `skipped`). The ruling
 * party gives the bot nothing (it holds no party effect); the human cards that
 * answer a city (Tharsis Republic…) answer the bot's like any other.
 */
import {tileGrantEligibility, TileGrantDeclaration, TILE_GRANT_NOT_ELIGIBLE_REASON, tileGrantNoDestinationReason} from '../../common/parliament/tileGrant';
import {Board} from '../boards/Board';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {EnactOutcome, ResolutionDefinition} from '../parliament/resolutions/IResolution';
import {AutomaTilePlacer} from './AutomaTilePlacer';

/** PAY the bot the tile `definition` grants the seats, by `grant`'s recipients and placement — reporting exactly once. Mutates; never asks. */
export function payBotTileGrant(
  game: IGame,
  bot: IPlayer,
  definition: ResolutionDefinition,
  grant: TileGrantDeclaration,
  winner: IPlayer | undefined,
  report: (outcome: EnactOutcome) => void,
): void {
  const influence = game.parliament?.influence(bot) ?? 0;
  // WHO — the one predicate the human's step pays by, with the bot's own influence and the recorded winner.
  if (tileGrantEligibility(grant, {winner: winner?.id === bot.id, influence}) === 'none') {
    game.log('${0} is below 2 influence and did not win the vote — no city tile from ${1}', (b) => b.player(bot).resolution(definition.id));
    report({kind: 'skipped', influence, reason: TILE_GRANT_NOT_ELIGIBLE_REASON});
    return;
  }
  switch (grant.placement) {
  case 'own-city':
    payCityTier(game, bot, definition, grant, influence, report);
    return;
  case 'any-legal':
    payCity(game, bot, definition, grant, influence, report);
    return;
  }
}

function payCityTier(game: IGame, bot: IPlayer, definition: ResolutionDefinition, grant: TileGrantDeclaration, influence: number, report: (outcome: EnactOutcome) => void): void {
  // The candidates are the bot's own cities on Mars — the ONE placement validator (`city-tier`), as for a human.
  const cities = game.board.getAvailableSpacesForType(bot, 'city-tier');
  if (cities.length === 0) {
    game.log('${0} has no city on Mars — the city tile from ${1} is skipped', (b) => b.player(bot).resolution(definition.id));
    report({kind: 'skipped', influence, reason: tileGrantNoDestinationReason(grant)});
    return;
  }
  const space = AutomaTilePlacer.breakTie(game, cities);
  game.addCityTier(bot, space);
  game.log('${0} placed the city tile from ${1} on top of its city', (b) => b.player(bot).resolution(definition.id));
  report({kind: 'city', influence, space: space.id, stackHeight: Board.tiersOf(space)});
}

function payCity(game: IGame, bot: IPlayer, definition: ResolutionDefinition, grant: TileGrantDeclaration, influence: number, report: (outcome: EnactOutcome) => void): void {
  const seen = new Set(game.board.spaces.filter((space) => Board.isCitySpace(space)).map((space) => space.id));
  // «impossible» — a law's tile with nowhere to go pays no Failed Action: the primitive answers the question and places nothing.
  const placed = AutomaTilePlacer.placeCity(game, {onEmpty: 'impossible'});
  const landed = placed ? game.board.spaces.find((space) => Board.isCitySpace(space) && !seen.has(space.id)) : undefined;
  if (landed === undefined) {
    game.log('${0} has no legal space for a city tile — the city tile from ${1} is skipped', (b) => b.player(bot).resolution(definition.id));
    report({kind: 'skipped', influence, reason: tileGrantNoDestinationReason(grant)});
    return;
  }
  game.log('${0} placed the city tile from ${1}', (b) => b.player(bot).resolution(definition.id));
  report({kind: 'city', influence, space: landed.id});
}
