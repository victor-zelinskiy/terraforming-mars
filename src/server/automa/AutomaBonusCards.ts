import * as constants from '../../common/constants';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {GlobalParameter} from '../../common/GlobalParameter';
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
import {AutomaAres} from './AutomaAres';
import {AutomaColonies} from './AutomaColonies';
import {AutomaMilestonesAwards} from './AutomaMilestonesAwards';
import {AutomaResearch} from './AutomaResearch';
import {AutomaResolver} from './AutomaResolver';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {AutomaTurnLog} from './AutomaTurnLog';
import {humansOf, marsBotOf, pickVictim} from './AutomaUtil';
import {THARSIS_TRACK} from './boards/TharsisMarsBot';

/** Where a resolved bonus card goes. Recurring cards (B16, later B19/B20) stay in their holding pool. */
export type BonusCardOutcome = 'discard' | 'destroy';

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
    game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.OXYGEN).number(1));
  } else if (oceansLeft === most) {
    AutomaTilePlacer.placeOcean(game);
  } else {
    game.increaseTemperature(bot, 1);
    game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.TEMPERATURE).number(1));
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
  // The bot PLAYS the card (its tags), it does not "show/reveal" it — reuse the
  // standard "played" log so the journal reads «Бот сыграл …», never «показал».
  game.log('${0} played ${1}', (b) => b.player(marsBotOf(game)).card(card, {tags: true}));
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
  case BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES: return expeditedConstructionColonies(game);
  case BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD: return outerSystemFoothold(game);
  case BonusCardId.B19_SHIPPING_LINES:
  case BonusCardId.B20_EXTENDED_SHIPPING_LINES:
    return shippingLines(game);
  default:
    throw new Error(`MarsBot bonus card ${id} is out of the POC scope`);
  }
}

/**
 * B01 Meteor Shower: the human must remove 5 plants (or as many as possible).
 * Removed ≥3, or an effect (Protected Habitats) blocked the removal → destroy.
 * The attack step is recorded for EVERY outcome — the theater must name the
 * target and answer "did I actually lose anything?" even when the answer is
 * "no" (nothing to take / protected), which the snapshot diff can't see.
 */
function meteorShower(game: IGame): BonusCardOutcome {
  const humans = humansOf(game);
  // Victim canon (§12 Q9): the human with the MOST plants among the VALID
  // (unprotected, plant-holding) candidates — the bot never "attacks into the
  // shield" while a valid target exists; ties resolve randomly (seeded rng).
  // Official solo (one human) degenerates to the old rule.
  const victim = pickVictim(game, humans.filter((h) => h.plants > 0 && !h.plantsAreProtected()), (h) => h.plants);
  if (victim === undefined) {
    const shielded = pickVictim(game, humans.filter((h) => h.plantsAreProtected()), (h) => h.plants);
    if (shielded !== undefined) {
      // No valid target and somebody IS protected — the printed outcome:
      // nothing removed, the card is destroyed (FAQ).
      game.log('${0} plants are protected — Meteor Shower is destroyed', (b) => b.player(shielded));
      AutomaTurnLog.note(game, {kind: 'attack', attack: {
        target: shielded.color, resource: Resource.PLANTS, demanded: 5, removed: 0,
        before: shielded.plants, after: shielded.plants, outcome: 'protected',
      }}, {consumeLog: true});
      return 'destroy';
    }
    // Nobody has a plant at all — say so; silence reads as a bug.
    AutomaTurnLog.note(game, {kind: 'attack', attack: {
      target: humans[0].color, resource: Resource.PLANTS, demanded: 5, removed: 0,
      before: 0, after: 0, outcome: 'nothing-to-lose',
    }});
    return 'discard';
  }
  const before = victim.plants;
  const removed = Math.min(5, before);
  // `from` attributes the removal to the bot — the LawSuit / Crash Site
  // Cleanup resource hooks must see WHO removed the resources (FAQ: both
  // promo cards work against MarsBot).
  victim.stock.deduct(Resource.PLANTS, removed, {log: true, from: {player: marsBotOf(game)}});
  AutomaTurnLog.note(game, {kind: 'attack', attack: {
    target: victim.color, resource: Resource.PLANTS, demanded: 5, removed,
    before, after: before - removed, outcome: 'hit',
  }}, {consumeLog: true}); // The deduct's own log line rides the step — never narrated twice.
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
  const humans = humansOf(game);

  if (game.gameOptions.venusNextExtension || game.gameOptions.coloniesExtension) {
    bot.stock.add(Resource.MEGACREDITS, 2, {log: true});
    automa.floaters += 1;
    game.log('${0} gained ${1} ${2}', (b) => b.player(bot).number(1).cardResource(CardResource.FLOATER));
  } else {
    bot.stock.add(Resource.MEGACREDITS, 5, {log: true});
  }

  // Every animal/microbe cube holder across ALL humans (owner-major, stable order).
  type Holder = {owner: IPlayer, card: ICard};
  const cubeHolders: Array<Holder> = [];
  for (const owner of humans) {
    for (const card of owner.tableau) {
      if ((card.resourceType === CardResource.ANIMAL || card.resourceType === CardResource.MICROBE) &&
          card.resourceCount > 0) {
        cubeHolders.push({owner, card});
      }
    }
  }
  // Official FAQ (rulebook p.11): Protected Habitats DOES block Invasive Species.
  // Per-card protection (Pets' protectedResources) blocks the same way — mirrors
  // the opponent branch of RemoveResourcesFromCard.getAvailableTargetCards.
  const removable = cubeHolders.filter(({owner, card}) =>
    !owner.tableau.has(CardName.PROTECTED_HABITATS) && card.protectedResources !== true);
  if (removable.length > 0) {
    // Victim canon (§12 Q9): the GLOBAL highest cube rate; ties across players
    // resolve RANDOMLY with EQUAL weight per PLAYER (never per card — a player
    // with more equal-rate cards must not attract the hit more often). The
    // prompt below only settles ties WITHIN that victim's own equal-rate cards
    // (scoring-equivalent by construction — never "pick the loss you prefer").
    const maxRate = Math.max(...removable.map(({card}) => cubeVpRate(card)));
    const tiedOwners = humans.filter((h) =>
      removable.some(({owner, card}) => owner === h && cubeVpRate(card) === maxRate));
    const victim = pickVictim(game, tiedOwners, () => 0) ?? tiedOwners[0];
    const targets = removable
      .filter((h) => h.owner === victim && cubeVpRate(h.card) === maxRate)
      .map((h) => h.card);
    // The attack is announced NOW (target + demand); the actual cube leaves
    // via the target's own follow-up pick, after this turn commits.
    AutomaTurnLog.note(game, {kind: 'attack', attack: {
      target: victim.color, resource: 'cube', demanded: 1, removed: 0, outcome: 'target-chooses',
    }});
    // The pick is shown even for a single candidate (the fork's no-auto-select
    // rule): the victim confirms WHICH cube leaves.
    game.defer(new SimpleDeferredAction(victim, () => new SelectCard(
      'Select the highest-scoring animal/microbe card to remove 1 resource from (Invasive Species)',
      'Remove resource', targets, {min: 1, max: 1})
      .andThen(([card]) => {
        // `removingPlayer` attributes the cube loss to the bot (LawSuit hook).
        victim.removeResourceFrom(card, 1, {log: true, removingPlayer: bot});
        return undefined;
      })));
  } else if (cubeHolders.length > 0) {
    // Cubes exist, but Protected Habitats / a per-card protection blocks every
    // removal (official FAQ). The card still resolves (M€ above) and discards.
    const shielded = (pickVictim(game, cubeHolders, ({card}) => cubeVpRate(card)) ?? cubeHolders[0]).owner;
    game.log('${0} animals and microbes are protected — Invasive Species removes nothing', (b) => b.player(shielded));
    AutomaTurnLog.note(game, {kind: 'attack', attack: {
      target: shielded.color, resource: 'cube', demanded: 1, removed: 0, outcome: 'protected',
    }}, {consumeLog: true});
  } else {
    // No animal/microbe cube anywhere — say so; silence reads as a bug.
    AutomaTurnLog.note(game, {kind: 'attack', attack: {
      target: humans[0].color, resource: 'cube', demanded: 1, removed: 0,
      before: 0, after: 0, outcome: 'nothing-to-lose',
    }});
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
  return tryCitySurroundedByTwo(game) ? 'destroy' : 'discard';
}

/** The shared "city adjacent to 2+ greenery/ocean tiles" placement of B05/B17. */
function tryCitySurroundedByTwo(game: IGame): boolean {
  const bot = marsBotOf(game);
  const surrounded = (space: Space): number =>
    game.board.getAdjacentSpaces(space).filter((adj) => Board.isGreenerySpace(adj) || Board.isOceanSpace(adj)).length;
  // Ares: never ON a hazard + strong hazard avoidance after the card's own
  // criterion (identity without Ares) — mirrors AutomaTilePlacer.placeCity.
  const candidates = AutomaAres.withoutHazardSpaces(game, game.board.getAvailableSpacesForCity(bot))
    .filter((space) => surrounded(space) >= 2);
  if (candidates.length === 0) {
    return false;
  }
  const most = Math.max(...candidates.map(surrounded));
  const space = AutomaTilePlacer.breakTie(game,
    AutomaAres.preferAwayFromHazards(game, candidates.filter((s) => surrounded(s) === most)));
  game.addCity(bot, space);
  return true;
}

/**
 * B17 Expedited Construction (Colonies, Adding Expansions p.4) — the first
 * possible effect only:
 *  a. the B05 city (adjacent to 2+ greenery/ocean) → destroy;
 *  b. with 1 or 0 colonies in play, place one on a random eligible tile (the
 *     flip method) + 2 resources into its storage area — does NOT destroy;
 *  c. otherwise, no effect.
 */
function expeditedConstructionColonies(game: IGame): BonusCardOutcome {
  if (tryCitySurroundedByTwo(game)) {
    return 'destroy';
  }
  if (AutomaColonies.botColonyCount(game) <= 1 && AutomaColonies.botBuildColony(game)) {
    return 'discard';
  }
  return 'discard';
}

/**
 * B18 Outer System Foothold (Adding Expansions p.5): place a colony on a
 * random eligible tile (+2 storage resources), then draw a card from the
 * BONUS deck (reshuffling the discard if necessary — never this card itself,
 * which is still in hand) and discard it without resolving it.
 */
function outerSystemFoothold(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  if (!AutomaColonies.botBuildColony(game)) {
    return 'discard'; // No eligible tile: the primary effect is impossible — nothing happens.
  }
  AutomaResearch.reshuffleBonusDeckIfEmpty(game, automa);
  const thinned = automa.bonusDeck.shift();
  if (thinned !== undefined) {
    automa.bonusDiscard.push(thinned);
    game.log('${0} discarded a bonus card without resolving it', (b) => b.player(marsBotOf(game)));
  }
  return 'discard';
}

/** B19 Shipping Lines / B20 Extended Shipping Lines: MarsBot trades (Adding Expansions p.5). */
function shippingLines(game: IGame): BonusCardOutcome {
  AutomaColonies.botTrade(game); // Impossible (all visited / no M€) → nothing; never a Failed Action.
  return 'discard';
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

  // The review shows this ONE resolved branch (the "first possible effect"),
  // never the card's whole a/b/c/d rule text.
  const temperatureSteps = temperatureStepsToTarget(game);
  if (temperatureSteps !== undefined && temperatureSteps <= 2) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Temperature near a bonus step'});
    game.increaseTemperature(bot, 2); // Clamped internally at completion.
    game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.TEMPERATURE).number(2));
    return 'destroy';
  }

  const oxygenSteps = oxygenStepsToTarget(game);
  if (oxygenSteps !== undefined && oxygenSteps <= 2 &&
      game.board.getAvailableSpacesForGreenery(bot).length > 0) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Oxygen near a bonus step'});
    AutomaTilePlacer.placeGreenery(game); // Raises oxygen 1 step for the greenery.
    game.increaseOxygenLevel(bot, 1);
    game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.OXYGEN).number(1));
    return 'destroy';
  }

  if (venus) {
    const venusSteps = venusStepsToTarget(game);
    if (game.gameOptions.venusNextExtension && venusSteps !== undefined && venusSteps <= 2) {
      AutomaTurnLog.setBonusBranch(game, {key: 'Venus near a bonus step'});
      game.increaseVenusScaleLevel(bot, 2); // Clamped internally.
      game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.VENUS).number(2));
      return 'discard'; // The Venus branch explicitly does NOT destroy the card.
    }
  } else {
    const oceanTarget = game.board.getAvailableSpacesForOcean(bot).filter((space) =>
      game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length >= 2);
    if (oceanTarget.length > 0) {
      AutomaTurnLog.setBonusBranch(game, {key: 'Ocean next to two oceans'});
      const space = AutomaTilePlacer.breakTie(game, oceanTarget);
      game.addOcean(bot, space);
      return 'destroy';
    }
  }

  AutomaTurnLog.setBonusBranch(game, {key: 'Advanced the furthest Martian parameter'});
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

  // Ares: hazard-cover spaces excluded (the neighbors are already required to
  // be EMPTY, so hazard adjacency is impossible here). Identity without Ares.
  const candidates = AutomaAres.withoutHazardSpaces(game, board.getAvailableSpacesOnLand(bot)).filter((space) => {
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
  const humans = humansOf(game);

  // Can't afford the 5 M€ cost → the card does nothing (rulebook: needs 5+ M€).
  if (bot.megaCredits < 5) {
    return 'discard';
  }

  // Try to help the CLOSEST funded award (leftmost on ties); a resolved help
  // costs 5 M€. With no funded awards this loop simply doesn't run.
  // §12 Q12: "the human's lead" generalizes to the BEST human per award.
  if (game.fundedAwards.length > 0) {
    const withMargin = game.fundedAwards.map(({award}) => {
      const scorer = new AwardScorer(game, award);
      const bestHuman = Math.max(...humans.map((h) => scorer.get(h)));
      return {award, humanLead: bestHuman - scorer.get(bot)};
    });
    const humanLeads = withMargin.filter((e) => e.humanLead >= 0).sort((a, b) => a.humanLead - b.humanLead);
    const botLeads = withMargin.filter((e) => e.humanLead < 0).sort((a, b) => b.humanLead - a.humanLead);
    const ordered = humanLeads.length > 0 ? [...humanLeads, ...botLeads] : botLeads;

    for (const {award} of ordered) {
      if (tryAwardHelper(game, award.name)) {
        AutomaTurnLog.setBonusBranch(game, {key: 'Helped the closest funded award: ${0}', params: [award.name]});
        bot.stock.deduct(Resource.MEGACREDITS, 5, {log: true});
        return 'discard';
      }
    }
  }

  // No funded award / no valid helper → draw and resolve ANOTHER bonus card
  // (the primary effect is impossible). Shown as ONE linked flow: the review
  // names the secondary card and nests its resolution under this card.
  AutomaTurnLog.setBonusBranch(game, {key: 'No award to help — drew another card'});
  AutomaResearch.reshuffleBonusDeckIfEmpty(game, automa);
  const next = automa.bonusDeck.shift();
  if (next !== undefined) {
    AutomaTurnLog.setBonusSecondary(game, next);
    game.log('${0} drew another bonus card', (b) => b.player(bot));
    // Attribute the SECONDARY card's own steps to their own cause so the review
    // nests them under this card as ONE flow (not a second event).
    AutomaTurnLog.setCause(game, {kind: 'secondary-bonus'});
    const outcome = resolveBonusCard(game, next);
    routeBonusCard(game, next, outcome);
    AutomaTurnLog.setCause(game, {kind: 'bonus'});
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
    const raiseMartian = game.generation % 2 === 0 || venusComplete;
    // The review shows this ONE trigger branch, not the card's full rule text;
    // the effect (Temperature / Venus +1) is the flow's own consequence line.
    AutomaTurnLog.setBonusBranch(game, {key: venusComplete ? 'Venus is complete' : (raiseMartian ? 'Even generation' : 'Odd generation')});
    if (raiseMartian && advanceFurthestMartianParameter(game)) {
      return 'discard';
    }
    if (game.getVenusScaleLevel() < constants.MAX_VENUS_SCALE) {
      game.increaseVenusScaleLevel(bot, 1);
      game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.VENUS).number(1));
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
