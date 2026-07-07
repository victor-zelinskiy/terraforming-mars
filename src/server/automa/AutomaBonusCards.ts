import * as constants from '../../common/constants';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {CardResource} from '../../common/CardResource';
import {Phase} from '../../common/Phase';
import {Resource} from '../../common/Resource';
import {Tag} from '../../common/cards/Tag';
import {TileType} from '../../common/TileType';
import {SpaceType} from '../../common/boards/SpaceType';
import {Board} from '../boards/Board';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {SelectCard} from '../inputs/SelectCard';
import {SimpleDeferredAction} from '../deferredActions/DeferredAction';
import {AwardScorer} from '../awards/AwardScorer';
import {AutomaMilestonesAwards} from './AutomaMilestonesAwards';
import {AutomaResearch} from './AutomaResearch';
import {AutomaResolver} from './AutomaResolver';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {marsBotOf} from './AutomaSetup';
import {THARSIS_TRACK} from './boards/TharsisMarsBot';

/** Where a resolved bonus card goes. Recurring cards (B16, later B19/B20) stay in their holding pool. */
export type BonusCardOutcome = 'discard' | 'destroy';

function humanOf(game: IGame): IPlayer {
  const human = game.players.find((p) => !p.isMarsBot);
  if (human === undefined) {
    throw new Error('This game has no human player');
  }
  return human;
}

/** Steps left to the NEAREST bonus step / completion above the current value; undefined when complete. */
function stepsToNextTarget(current: number, targets: ReadonlyArray<number>, stepSize: number): number | undefined {
  const ahead = targets.filter((t) => t > current);
  if (ahead.length === 0) {
    return undefined;
  }
  return (Math.min(...ahead) - current) / stepSize;
}

/** Temperature bonus steps: heat at −24/−20, the ocean at 0, completion at +8. */
function temperatureStepsToTarget(game: IGame): number | undefined {
  return stepsToNextTarget(game.getTemperature(),
    [constants.TEMPERATURE_BONUS_FOR_HEAT_1, constants.TEMPERATURE_BONUS_FOR_HEAT_2, constants.TEMPERATURE_FOR_OCEAN_BONUS, constants.MAX_TEMPERATURE], 2);
}

/** Oxygen bonus steps: the temperature raise at 8%, completion at 14%. */
function oxygenStepsToTarget(game: IGame): number | undefined {
  return stepsToNextTarget(game.getOxygenLevel(),
    [constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS, constants.MAX_OXYGEN_LEVEL], 1);
}

/** Venus bonus steps: the card draw at 8%, the TR at 16%, completion at 30% (standard board). */
function venusStepsToTarget(game: IGame): number | undefined {
  return stepsToNextTarget(game.getVenusScaleLevel(),
    [constants.VENUS_LEVEL_FOR_CARD_BONUS, constants.VENUS_LEVEL_FOR_TR_BONUS, constants.MAX_VENUS_SCALE], 2);
}

/**
 * "MarsBot advances the (Martian) global parameter furthest from completion.
 * If tied, prioritize raising oxygen, then placing an ocean tile, and finally
 * raising temperature." Returns false when everything is complete.
 */
function advanceFurthestMartianParameter(game: IGame): boolean {
  const bot = marsBotOf(game);
  const oxygenLeft = constants.MAX_OXYGEN_LEVEL - game.getOxygenLevel();
  const oceansLeft = constants.MAX_OCEAN_TILES - game.board.getOceanSpaces().length;
  const temperatureLeft = (constants.MAX_TEMPERATURE - game.getTemperature()) / 2;
  const most = Math.max(oxygenLeft, oceansLeft, temperatureLeft);
  if (most <= 0) {
    return false;
  }
  // The tie order IS the priority order among the leaders.
  if (oxygenLeft === most) {
    game.increaseOxygenLevel(bot, 1);
    game.log('${0} raised oxygen 1 step', (b) => b.player(bot));
  } else if (oceansLeft === most) {
    AutomaTilePlacer.placeOcean(game);
  } else {
    game.increaseTemperature(bot, 1);
    game.log('${0} raised the temperature 1 step', (b) => b.player(bot));
  }
  return true;
}

/** B03 / B07-fallback: "MarsBot draws 1 card from the project deck and resolves it immediately." */
function drawAndResolveProjectCard(game: IGame): boolean {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const card = game.projectDeck.draw(game);
  if (card === undefined) {
    return false; // Draw + discard piles fully exhausted — nothing to resolve.
  }
  game.log('${0} revealed ${1}', (b) => b.player(marsBotOf(game)).card(card, {tags: true}));
  AutomaResolver.resolveProjectCard(game, card);
  automa.playedPile.push(card.name);
  return true;
}

/** The per-cube VP rate of a card resource ("highest-scoring animal/microbe cube"). */
function cubeVpRate(card: ICard): number {
  const vp = card.victoryPoints;
  if (vp === undefined || typeof vp === 'number' || vp === 'special') {
    // No icon / flat printed VP / bespoke scorers: the cube itself scores 0.
    return 0;
  }
  if (vp.resourcesHere === undefined) {
    return 0;
  }
  return (vp.each ?? 1) / (vp.per ?? 1);
}

/**
 * Resolves one MarsBot bonus card (rulebook pp.6–7 + Adding Expansions p.3).
 * A failed PRIMARY effect never causes a Failed Action — each card defines its
 * own fallback (rulebook p.5). Returns where the card goes; recurring cards
 * (B16) are routed by the controller regardless.
 */
export function resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
  switch (id) {
  case BonusCardId.B01_METEOR_SHOWER: return meteorShower(game);
  case BonusCardId.B02_INVASIVE_SPECIES: return invasiveSpecies(game);
  case BonusCardId.B03_RESEARCH_AND_DEVELOPMENT: return researchAndDevelopment(game);
  case BonusCardId.B04_OVERACHIEVEMENT: return overachievement(game);
  case BonusCardId.B05_EXPEDITED_CONSTRUCTION: return expeditedConstruction(game);
  case BonusCardId.B06_LOBBYISTS: return lobbyists(game, /* venus= */ false);
  case BonusCardId.B15_LOBBYISTS_VENUS: return lobbyists(game, /* venus= */ true);
  case BonusCardId.B07_LOCAL_NEURAL_INSTANCE: return localNeuralInstance(game);
  case BonusCardId.B08_CORPORATE_COMPETITION: return corporateCompetition(game);
  case BonusCardId.B16_GOVERNMENT_INTERVENTION: return governmentIntervention(game);
  case BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES:
  case BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD:
  case BonusCardId.B19_SHIPPING_LINES:
  case BonusCardId.B20_EXTENDED_SHIPPING_LINES:
    // These need the MarsBot colony/trade machinery (shipping storage grants,
    // colony placement, trading) — the whole of Automa Phase 6.
    throw new Error(`MarsBot bonus card ${id} is not implemented yet (Automa Phase 6)`);
  default:
    throw new Error(`MarsBot bonus card ${id} is out of the POC scope`);
  }
}

/**
 * B01 Meteor Shower: the human must remove 5 plants (or as many as possible).
 * Removed ≥3, or an effect (Protected Habitats) blocked the removal → destroy.
 */
function meteorShower(game: IGame): BonusCardOutcome {
  const human = humanOf(game);
  if (human.plantsAreProtected()) {
    game.log('${0} plants are protected — Meteor Shower is destroyed', (b) => b.player(human));
    return 'destroy';
  }
  const removed = Math.min(5, human.plants);
  if (removed > 0) {
    human.stock.deduct(Resource.PLANTS, removed, {log: true});
  }
  return removed >= 3 ? 'destroy' : 'discard';
}

/**
 * B02 Invasive Species: the human must remove their highest-scoring
 * animal/microbe cube, if possible. MarsBot gains 5 M€ regardless — 2 M€ and
 * 1 floater instead when playing with Venus Next or Colonies.
 */
function invasiveSpecies(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  const human = humanOf(game);

  if (game.gameOptions.venusNextExtension || game.gameOptions.coloniesExtension) {
    bot.stock.add(Resource.MEGACREDITS, 2, {log: true});
    automa.floaters += 1;
    game.log('${0} gained 1 floater', (b) => b.player(bot));
  } else {
    bot.stock.add(Resource.MEGACREDITS, 5, {log: true});
  }

  const holders = human.tableau.filter((card) =>
    (card.resourceType === CardResource.ANIMAL || card.resourceType === CardResource.MICROBE) &&
    card.resourceCount > 0);
  if (holders.length > 0) {
    const maxRate = Math.max(...holders.map(cubeVpRate));
    const targets = holders.filter((card) => cubeVpRate(card) === maxRate);
    // The pick is shown even for a single candidate (the fork's no-auto-select
    // rule): the human confirms WHICH cube leaves.
    game.defer(new SimpleDeferredAction(human, () => new SelectCard(
      'Select the highest-scoring animal/microbe card to remove 1 resource from (Invasive Species)',
      'Remove resource', targets, {min: 1, max: 1})
      .andThen(([card]) => {
        human.removeResourceFrom(card, 1, {log: true});
        return undefined;
      })));
  }
  return 'discard';
}

/** B03 Research and Development: draw + resolve immediately. */
function researchAndDevelopment(game: IGame): BonusCardOutcome {
  drawAndResolveProjectCard(game);
  return 'discard';
}

/**
 * B04 Overachievement: attempt to claim a milestone; failing that, from
 * generation 6 on, attempt to fund an award. Either success → destroy.
 * Otherwise MarsBot gains 5 M€ (a printed fallback, NOT a Failed Action —
 * always 5, even on Easy).
 */
function overachievement(game: IGame): BonusCardOutcome {
  if (AutomaMilestonesAwards.tryClaimMilestone(game)) {
    return 'destroy';
  }
  if (game.generation >= 6 && AutomaMilestonesAwards.tryFundAward(game)) {
    return 'destroy';
  }
  marsBotOf(game).stock.add(Resource.MEGACREDITS, 5, {log: true});
  return 'discard';
}

/**
 * B05 Expedited Construction (base): place a city adjacent to any mix of at
 * least 2 greenery/ocean tiles (tied: most such tiles, then the shared
 * tiebreakers). Placed → destroy; no legal spot → nothing (discard).
 */
function expeditedConstruction(game: IGame): BonusCardOutcome {
  const bot = marsBotOf(game);
  const surrounded = (space: Space): number =>
    game.board.getAdjacentSpaces(space).filter((adj) => Board.isGreenerySpace(adj) || Board.isOceanSpace(adj)).length;
  const candidates = game.board.getAvailableSpacesForCity(bot).filter((space) => surrounded(space) >= 2);
  if (candidates.length === 0) {
    return 'discard';
  }
  const most = Math.max(...candidates.map(surrounded));
  const space = AutomaTilePlacer.breakTie(game, candidates.filter((s) => surrounded(s) === most));
  game.addCity(bot, space);
  return 'destroy';
}

/**
 * B06 Lobbyists / B15 Venus Next Lobbyists: evaluate only the FIRST possible
 * effect; usual TR for the raises.
 *  a. temperature 1–2 steps from a bonus step or completion → +2 steps, destroy.
 *  b. oxygen 1–2 steps away → 1 greenery (its oxygen) + 1 more oxygen, destroy.
 *  c. base: an empty ocean-reserved space adjacent to 2+ oceans → place an
 *     ocean there, destroy. Venus (B15) replaces this branch: Venus 1–2 steps
 *     from a bonus step or completion → +2 Venus steps, NOT destroyed.
 *  d. advance the Martian global parameter furthest from completion
 *     (tie: oxygen → ocean → temperature); not destroyed.
 */
function lobbyists(game: IGame, venus: boolean): BonusCardOutcome {
  const bot = marsBotOf(game);

  const temperatureSteps = temperatureStepsToTarget(game);
  if (temperatureSteps !== undefined && temperatureSteps <= 2) {
    game.increaseTemperature(bot, 2); // Clamped internally at completion.
    game.log('${0} raised the temperature 2 steps', (b) => b.player(bot));
    return 'destroy';
  }

  const oxygenSteps = oxygenStepsToTarget(game);
  if (oxygenSteps !== undefined && oxygenSteps <= 2 &&
      game.board.getAvailableSpacesForGreenery(bot).length > 0) {
    AutomaTilePlacer.placeGreenery(game); // Raises oxygen 1 step for the greenery.
    game.increaseOxygenLevel(bot, 1);
    game.log('${0} raised oxygen 1 step', (b) => b.player(bot));
    return 'destroy';
  }

  if (venus) {
    const venusSteps = venusStepsToTarget(game);
    if (game.gameOptions.venusNextExtension && venusSteps !== undefined && venusSteps <= 2) {
      game.increaseVenusScaleLevel(bot, 2); // Clamped internally.
      game.log('${0} raised Venus 2 steps', (b) => b.player(bot));
      return 'discard'; // The Venus branch explicitly does NOT destroy the card.
    }
  } else {
    const oceanTarget = game.board.getAvailableSpacesForOcean(bot).filter((space) =>
      game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length >= 2);
    if (oceanTarget.length > 0) {
      const space = AutomaTilePlacer.breakTie(game, oceanTarget);
      game.addOcean(bot, space);
      return 'destroy';
    }
  }

  advanceFurthestMartianParameter(game);
  return 'discard';
}

/**
 * B07 Local Neural Instance: place the Neural Instance tile adjacent to no
 * tiles — not on an edge space, nor on or adjacent to any reserved space
 * (ocean-reserved, Noctis); usual tiebreakers. Cannot be placed → draw and
 * resolve a project card instead. Then destroy this card.
 */
function localNeuralInstance(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  const board = game.board;
  const isReserved = (space: Space): boolean =>
    space.spaceType === SpaceType.OCEAN || space.id === board.noctisCitySpaceId;

  const candidates = board.getAvailableSpacesOnLand(bot).filter((space) => {
    const adjacent = board.getAdjacentSpaces(space);
    return adjacent.length === 6 && // Not an edge space.
      !isReserved(space) &&
      adjacent.every((adj) => adj.tile === undefined && !isReserved(adj));
  });

  if (candidates.length > 0) {
    const space = AutomaTilePlacer.breakTie(game, candidates);
    game.addTile(bot, space, {tileType: TileType.NEURAL_INSTANCE});
    automa.neuralInstanceSpaceId = space.id;
  } else {
    drawAndResolveProjectCard(game);
  }
  return 'destroy';
}

/**
 * B08 Corporate Competition (Tharsis): with 5+ M€, help its position on the
 * CLOSEST already-funded award (the one the human leads by the smallest margin
 * or is tied; MarsBot leading everywhere → its own smallest margin), skipping
 * awards whose helper is impossible. A resolved help costs 5 M€; no help
 * possible → draw another bonus card and resolve it (both discarded).
 * The Venuphile helper is added to every version (Adding Expansions p.3).
 */
function corporateCompetition(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  const human = humanOf(game);

  if (bot.megaCredits < 5 || game.fundedAwards.length === 0) {
    return 'discard';
  }

  // Order the funded awards by closeness.
  const withMargin = game.fundedAwards.map(({award}) => {
    const scorer = new AwardScorer(game, award);
    return {award, humanLead: scorer.get(human) - scorer.get(bot)};
  });
  const humanLeads = withMargin.filter((e) => e.humanLead >= 0).sort((a, b) => a.humanLead - b.humanLead);
  const botLeads = withMargin.filter((e) => e.humanLead < 0).sort((a, b) => b.humanLead - a.humanLead);
  const ordered = humanLeads.length > 0 ? [...humanLeads, ...botLeads] : botLeads;

  for (const {award} of ordered) {
    if (tryAwardHelper(game, award.name)) {
      bot.stock.deduct(Resource.MEGACREDITS, 5, {log: true});
      return 'discard';
    }
  }

  // No helping action could be resolved: draw another bonus card and resolve it.
  AutomaResearch.reshuffleBonusDeckIfEmpty(game, automa);
  const next = automa.bonusDeck.shift();
  if (next !== undefined) {
    game.log('${0} drew another bonus card', (b) => b.player(bot));
    const outcome = resolveBonusCard(game, next);
    routeBonusCard(game, next, outcome);
  }
  return 'discard';
}

/** The Tharsis Corporate Competition helper actions (+ Venuphile). False when impossible. */
function tryAwardHelper(game: IGame, awardName: string): boolean {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const tracks = automa.board.tracks;
  const advanceIfPossible = (index: number): boolean => {
    if (!tracks[index].canAdvance()) {
      return false;
    }
    AutomaResolver.advanceTrack(game, index);
    return true;
  };
  switch (awardName) {
  case 'Landlord': {
    // Places a greenery, raising oxygen and TR as normal; all placement rules apply.
    if (game.board.getAvailableSpacesForGreenery(marsBotOf(game)).length === 0) {
      return false;
    }
    AutomaTilePlacer.placeGreenery(game);
    return true;
  }
  case 'Banker': {
    // Advance Building or Event, whichever is least advanced; Building on ties.
    const building = tracks[THARSIS_TRACK.BUILDING];
    const event = tracks[THARSIS_TRACK.EVENT];
    const alive = [
      {index: THARSIS_TRACK.BUILDING, track: building},
      {index: THARSIS_TRACK.EVENT, track: event},
    ].filter((e) => e.track.canAdvance());
    if (alive.length === 0) {
      return false;
    }
    alive.sort((a, b) => a.track.position - b.track.position); // Stable: Building first on ties.
    return advanceIfPossible(alive[0].index);
  }
  case 'Scientist': return advanceIfPossible(THARSIS_TRACK.SCIENCE);
  case 'Thermalist': return advanceIfPossible(THARSIS_TRACK.ENERGY);
  case 'Miner': return advanceIfPossible(THARSIS_TRACK.SPACE);
  case 'Venuphile': {
    const venusIndex = tracks.findIndex((t) => t.definition.tags.includes(Tag.VENUS));
    return venusIndex === -1 ? false : advanceIfPossible(venusIndex);
  }
  default:
    return false;
  }
}

/**
 * B16 Government Intervention — the WGT stand-in (Adding Expansions p.3):
 * on an even generation, or with Venus complete, advance the Martian parameter
 * furthest from completion (tie: oxygen → ocean → temperature); otherwise
 * raise Venus 1 step. MarsBot receives NO TR and NO M€ from bonuses for these
 * effects (cascaded raises included) — implemented exactly like World
 * Government Terraforming: the whole effect runs under Phase.SOLAR.
 */
function governmentIntervention(game: IGame): BonusCardOutcome {
  const bot = marsBotOf(game);
  const savedPhase = game.phase;
  game.phase = Phase.SOLAR;
  try {
    const venusComplete = game.getVenusScaleLevel() >= constants.MAX_VENUS_SCALE;
    if (game.generation % 2 === 0 || venusComplete) {
      if (advanceFurthestMartianParameter(game)) {
        return 'discard';
      }
      // Every Martian parameter complete: fall through to Venus (first POSSIBLE effect).
    }
    if (game.getVenusScaleLevel() < constants.MAX_VENUS_SCALE) {
      game.increaseVenusScaleLevel(bot, 1);
      game.log('${0} raised Venus 1 step', (b) => b.player(bot));
    }
    return 'discard';
  } finally {
    game.phase = savedPhase;
  }
}

/** Routes a resolved non-recurring bonus card to its pile. Recurring cards stay in their holding pool. */
export function routeBonusCard(game: IGame, id: BonusCardId, outcome: BonusCardOutcome): void {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  if (outcome === 'destroy') {
    automa.destroyedBonusCards.push(id);
    game.log('MarsBot bonus card was destroyed and removed from the game');
    return;
  }
  if (automa.recurringBonusCards.includes(id)) {
    return; // B16 (later B19/B20) returns to the action deck next generation.
  }
  automa.bonusDiscard.push(id);
}
