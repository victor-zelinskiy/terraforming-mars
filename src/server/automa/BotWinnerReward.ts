/*
 * THE WINNER'S REWARD, AS MARSBOT EXECUTES IT (docs/TURMOIL_REDUX_MARSBOT.md §4).
 *
 * A resolution declares its winner's part as DATA (`winnerReward` — a tile,
 * a colony, a parameter step; `tileGrant` — a city tier by threshold), and
 * the bot pays it with ITS OWN PRIMITIVES by the KIND of the declaration,
 * never by the card: the ocean and the greenery through `AutomaTilePlacer`
 * (the bot's placement rules, its tie-breaks, the cell's bonuses, the human
 * reactions — all through the shared `Game.addTile`), the colony through
 * `AutomaColonies.botBuildColony` (flip-to-pick among the tiles the rules
 * allow, two storage resources, no M€), the parameter through the bot's own
 * raise (rewarded: the TR, the scale's bonuses as the bot takes them — 2 M€
 * for a heat step, the 0 °C ocean placed at once), the tier through
 * `Game.addCityTier` on one of the bot's own cities (its tie-break).
 *
 * This module is the ONE reading of «which kinds can the bot execute»: the
 * vote chooser's ★ tie-break asks it (§3.3) and the sitting's bot pass pays
 * by it (`ParliamentPhase.runBotWinnerPass`), so the two never disagree.
 *
 * NEVER A PROMPT, NEVER A FAILED ACTION: every impossibility is checked BEFORE
 * the primitive (the Failed Action is the bot's TURN compensation — a reward
 * that cannot land pays nothing and says so), and every branch REPORTS once
 * with the same kinds the human's steps record (`ocean` · `greenery` ·
 * `colony` · `globalParameter` · `city` · `skipped`), under the card's own
 * step key — so the results, the history and the journal read the bot's
 * reward as one more seat's outcome.
 */
import {GlobalParameter} from '../../common/GlobalParameter';
import {TileType} from '../../common/TileType';
import {tileGrantStepKey, TILE_GRANT_NO_DESTINATION_REASON} from '../../common/parliament/tileGrant';
import {winnerParameterStepKey, WinnerStepParameter} from '../../common/parliament/winnerReward';
import {parameterRoom} from '../../common/parliament/parameterMove';
import {Board} from '../boards/Board';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {EnactOutcome, ResolutionDefinition} from '../parliament/resolutions/IResolution';
import {EnactOutcomePart} from '../parliament/SerializedParliament';
import {parameterTableOf, WINNER_STEP_AT_MAXIMUM_REASON} from '../parliament/resolutions/WinnerParameterStep';
import {NO_COLONY_AVAILABLE} from '../parliament/resolutions/unity/ColonyContest';
import {AutomaColonies} from './AutomaColonies';
import {AutomaTerraformer} from './AutomaTerraformer';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {AutomaCorporations} from './corps/AutomaCorporations';

export type BotWinnerRewardKind = 'ocean' | 'greenery' | 'colony' | 'parameter' | 'city';

/** The named skip when the bot's corporation took the step over (C36 Pristar: «instead it gains…»). */
export const CORPORATION_REPLACED_STEP_REASON = 'MarsBot\'s corporation replaced the step';
/** The named skip of a winner's part the bot has no executor for — the guard lists such a card; the game never goes silent. */
export const NO_BOT_EXECUTOR_REASON = 'No MarsBot executor for this winner\'s part';

/**
 * The kind of winner's reward `definition` declares that the bot CAN execute;
 * `undefined` for a card with no winner's part, or with one the bot has no
 * primitive for (a `winnerSteps` list with no declaration — the guard of the
 * bot pass lists such a card).
 */
export function botWinnerRewardKind(definition: ResolutionDefinition): BotWinnerRewardKind | undefined {
  const reward = definition.winnerReward;
  if (reward !== undefined) {
    switch (reward.kind) {
    case 'tile':
      return reward.tile;
    case 'colony':
      return 'colony';
    case 'parameter':
      return 'parameter';
    }
  }
  const grant = definition.tileGrant;
  if (grant !== undefined && grant.placement === 'own-city' && grant.recipients.winner) {
    return 'city';
  }
  return undefined;
}

/**
 * WHAT the bot pass records: the kind it executes, the STEP KEY the record
 * wears — the card's own (the same key the human winner's step reports
 * under, so every reader of the outcomes finds the bot's reward where it
 * finds a human's), and the PART (the winner's, or the effect's for a tile
 * granted by threshold — Skyscrapers records its tier for every seat as the
 * effect, the winner included).
 */
export type BotWinnerRewardPlan = {kind: BotWinnerRewardKind; key: string; part: Exclude<EnactOutcomePart, 'world'>};

export function botWinnerRewardPlan(definition: ResolutionDefinition): BotWinnerRewardPlan | undefined {
  const kind = botWinnerRewardKind(definition);
  if (kind === undefined) {
    return undefined;
  }
  const reward = definition.winnerReward;
  switch (kind) {
  case 'ocean':
  case 'greenery':
  case 'colony':
    return {kind, key: definition.winnerSteps?.[0]?.key ?? kind, part: 'winner'};
  case 'parameter':
    return {kind, key: reward?.kind === 'parameter' ? winnerParameterStepKey(reward) : kind, part: 'winner'};
  case 'city':
    return {kind, key: definition.tileGrant === undefined ? kind : tileGrantStepKey(definition.tileGrant), part: 'effect'};
  }
}

/** Does `definition` carry a winner's part at all (declared or only as steps)? The guard's question. */
export function declaresWinnerPart(definition: ResolutionDefinition): boolean {
  return (definition.winnerSteps?.length ?? 0) > 0 || definition.winnerReward !== undefined ||
    definition.tileGrant?.recipients.winner === true;
}

const GLOBAL_PARAMETER: Readonly<Record<WinnerStepParameter, GlobalParameter>> = {
  temperature: GlobalParameter.TEMPERATURE,
  oxygen: GlobalParameter.OXYGEN,
  venus: GlobalParameter.VENUS,
};

/** PAY the bot the winner's part of `definition` by `plan`, reporting exactly once. Mutates; never asks. */
export function payBotWinnerReward(game: IGame, bot: IPlayer, definition: ResolutionDefinition, plan: BotWinnerRewardPlan, report: (outcome: EnactOutcome) => void): void {
  game.log('${0} receives the winner\'s reward of ${1}', (b) => b.player(bot).resolution(definition.id));
  switch (plan.kind) {
  case 'ocean':
    payOcean(game, bot, definition, report);
    return;
  case 'greenery':
    payGreenery(game, definition, report);
    return;
  case 'colony':
    payColony(game, bot, definition, report);
    return;
  case 'parameter':
    payParameter(game, bot, definition, report);
    return;
  case 'city':
    payCityTier(game, bot, definition, report);
    return;
  }
}

function payOcean(game: IGame, bot: IPlayer, definition: ResolutionDefinition, report: (outcome: EnactOutcome) => void): void {
  if (!game.canAddOcean()) {
    game.log('No ocean tile is left — the winner\'s ocean from ${0} is skipped', (b) => b.resolution(definition.id));
    report({kind: 'skipped', reason: 'No ocean tile is left'});
    return;
  }
  if (game.board.getAvailableSpacesForOcean(bot).length === 0) {
    game.log('No space can take an ocean — the winner\'s ocean from ${0} is skipped', (b) => b.resolution(definition.id));
    report({kind: 'skipped', reason: 'No space can take an ocean'});
    return;
  }
  const before = game.board.getOceanSpaces();
  const seen = new Set(before.map((space) => space.id));
  // The bot's own placement — its ocean rules, its tie-break, the shared `addOcean` (the TR, the cell's bonuses, the reactions).
  AutomaTilePlacer.placeOcean(game);
  const landed = game.board.getOceanSpaces().find((space) => !seen.has(space.id));
  if (landed === undefined) {
    // The corporation took the step over (C36) — the ocean is not on the board, and the record says why.
    report({kind: 'skipped', reason: CORPORATION_REPLACED_STEP_REASON});
    return;
  }
  report({kind: 'ocean', space: landed.id, parameter: {id: 'oceans', before: before.length, after: before.length + 1}});
}

function payGreenery(game: IGame, definition: ResolutionDefinition, report: (outcome: EnactOutcome) => void): void {
  const oxygenBefore = game.getOxygenLevel();
  const seen = new Set(game.board.spaces.filter((space) => space.tile?.tileType === TileType.GREENERY).map((space) => space.id));
  // «impossible» — a reward with nowhere to go pays no Failed Action: the primitive answers the question and places nothing.
  const placed = AutomaTilePlacer.placeGreenery(game, {onEmpty: 'impossible'});
  const landed = placed ? game.board.spaces.find((space) => space.tile?.tileType === TileType.GREENERY && !seen.has(space.id)) : undefined;
  if (landed === undefined) {
    game.log('No space can take a greenery — the winner\'s greenery from ${0} is skipped', (b) => b.resolution(definition.id));
    report({kind: 'skipped', reason: 'No space can take a greenery'});
    return;
  }
  // The greenery's own oxygen step (none at the maximum — the tile still lands and still pays its own TR).
  report({kind: 'greenery', space: landed.id, parameter: {id: 'oxygen', before: oxygenBefore, after: game.getOxygenLevel()}});
}

function payColony(game: IGame, bot: IPlayer, definition: ResolutionDefinition, report: (outcome: EnactOutcome) => void): void {
  const before = new Map(game.colonies.map((colony) => [colony.name, colony.colonies.filter((id) => id === bot.id).length]));
  // The bot's own build: flip-to-pick among the tiles the rules allow, two storage resources (Europa: an ocean), no M€.
  if (!AutomaColonies.botBuildColony(game)) {
    game.log('No colony can be built — the winner\'s colony from ${0} is skipped', (b) => b.resolution(definition.id));
    report({kind: 'skipped', reason: NO_COLONY_AVAILABLE});
    return;
  }
  const built = game.colonies.find((colony) => colony.colonies.filter((id) => id === bot.id).length > (before.get(colony.name) ?? 0));
  if (built === undefined) {
    throw new Error('MarsBot built a colony that is on no tile');
  }
  game.log('${0} built the free colony of ${1} on ${2}', (b) => b.player(bot).resolution(definition.id).colony(built));
  report({kind: 'colony', colony: built.name});
}

function payParameter(game: IGame, bot: IPlayer, definition: ResolutionDefinition, report: (outcome: EnactOutcome) => void): void {
  const reward = definition.winnerReward;
  if (reward === undefined || reward.kind !== 'parameter') {
    throw new Error(`${definition.id} plans a parameter step it does not declare`);
  }
  const parameter = reward.parameter;
  const gp = GLOBAL_PARAMETER[parameter];
  // The ROOM is the shared arithmetic (the same the vote panel printed and the human's step reads): the ceiling is NAMED.
  const room = parameterRoom({parameter, steps: reward.steps}, parameterTableOf(game));
  if (!room.moves) {
    game.log('${0} is at its maximum — the winner\'s step from ${1} is skipped', (b) => b.globalParameter(gp).resolution(definition.id));
    report({kind: 'skipped', amount: 0, parameter: {id: parameter, before: room.current, after: room.current}, reason: WINNER_STEP_AT_MAXIMUM_REASON[parameter]});
    return;
  }
  const before = room.current;
  const trBefore = bot.terraformRating;
  for (let i = 0; i < room.applied; i++) {
    raiseOne(game, bot, parameter);
  }
  const after = valueOf(game, parameter);
  if (after === before) {
    // The corporation took the step over (C36) — the parameter did not move, and the record says why.
    report({kind: 'skipped', amount: 0, parameter: {id: parameter, before, after}, reason: CORPORATION_REPLACED_STEP_REASON});
    return;
  }
  const tr = bot.terraformRating - trBefore;
  const applied = Math.round(Math.abs(after - before) / (parameter === 'temperature' ? 2 : 1));
  game.log('${0} raised ${1} ${2} step(s) from ${3} (${4} → ${5}) and gains ${6} TR', (b) =>
    b.player(bot).globalParameter(gp).number(applied).resolution(definition.id).number(before).number(after).number(tr));
  report({kind: 'globalParameter', amount: applied, parameter: {id: parameter, before, after}, tr});
}

/** ONE step of the parameter, the bot's own way — the corporation asked first (C36), the engine's raise rewarded. */
function raiseOne(game: IGame, bot: IPlayer, parameter: WinnerStepParameter): void {
  switch (parameter) {
  case 'temperature':
    // The shared raise: its C36 gate, its journal line, the 2 M€ of a heat step and the 0 °C ocean through the engine.
    AutomaTerraformer.raiseTemperature(game);
    return;
  case 'oxygen':
    if (!AutomaCorporations.replacesParameterRaise(game, GlobalParameter.OXYGEN)) {
      game.increaseOxygenLevel(bot, 1);
      game.log('${0} raised ${1} ${2} {step|steps}', (b) => b.player(bot).globalParameter(GlobalParameter.OXYGEN).number(1));
    }
    return;
  case 'venus':
    if (!AutomaCorporations.replacesParameterRaise(game, GlobalParameter.VENUS)) {
      game.increaseVenusScaleLevel(bot, 1);
      game.log('${0} raised ${1} ${2} {step|steps}', (b) => b.player(bot).globalParameter(GlobalParameter.VENUS).number(1));
    }
    return;
  }
}

function valueOf(game: IGame, parameter: WinnerStepParameter): number {
  switch (parameter) {
  case 'temperature': return game.getTemperature();
  case 'oxygen': return game.getOxygenLevel();
  case 'venus': return game.getVenusScaleLevel();
  }
}

function payCityTier(game: IGame, bot: IPlayer, definition: ResolutionDefinition, report: (outcome: EnactOutcome) => void): void {
  const influence = game.parliament?.influence(bot) ?? 0;
  // The candidates are the bot's own cities on Mars — the ONE placement validator (`city-tier`), as for a human.
  const cities = game.board.getAvailableSpacesForType(bot, 'city-tier');
  if (cities.length === 0) {
    game.log('${0} has no city on Mars — the city tile from ${1} is skipped', (b) => b.player(bot).resolution(definition.id));
    report({kind: 'skipped', influence, reason: TILE_GRANT_NO_DESTINATION_REASON});
    return;
  }
  const space = AutomaTilePlacer.breakTie(game, cities);
  game.addCityTier(bot, space);
  game.log('${0} placed the city tile from ${1} on top of its city', (b) => b.player(bot).resolution(definition.id));
  report({kind: 'city', influence, space: space.id, stackHeight: Board.tiersOf(space)});
}
