import * as constants from '../../common/constants';
import {AutomaTerraformer} from './AutomaTerraformer';
import {BonusCardId, MarsBotTrackRole} from '../../common/automa/AutomaTypes';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {Phase} from '../../common/Phase';
import {Resource} from '../../common/Resource';
import {CardType} from '../../common/cards/CardType';
import {TileType} from '../../common/TileType';
import {SpaceType} from '../../common/boards/SpaceType';
import {Board} from '../boards/Board';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {IProjectCard} from '../cards/IProjectCard';
import {SelectCard} from '../inputs/SelectCard';
import {SimpleDeferredAction} from '../deferredActions/DeferredAction';
import {AwardScorer} from '../awards/AwardScorer';
import {AutomaAres} from './AutomaAres';
import {drawAndResolveProjectCard, resolveProjectCardForBot} from './AutomaCardDraw';
import {newProjectCard} from '../createCard';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {cardResourceAttackPrompt} from './AutomaAttackPrompt';
import {AutomaColonies} from './AutomaColonies';
import {AutomaMilestonesAwards} from './AutomaMilestonesAwards';
import {pushNearestBonus} from './AutomaNearBonusPush';
import {AutomaResearch} from './AutomaResearch';
import {inplaceShuffle} from '../utils/shuffle';
import {AutomaResolver} from './AutomaResolver';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {AutomaTurnLog} from './AutomaTurnLog';
import {humansOf, marsBotOf, pickVictim} from './AutomaUtil';
import {marsBotMapProfile} from './boards/MarsBotMapProfile';

/**
 * Where a resolved bonus card goes. Recurring cards (B16, later B19/B20) stay
 * in their holding pool; `'return-to-deck'` is the one printed fate that puts a
 * card straight back into the BONUS DECK instead of the discard — C22/B27's
 * fallback branch («shuffle this card back into the bonus deck»), which keeps
 * it in the rotation right now rather than after the next reshuffle.
 */
export type BonusCardOutcome = 'discard' | 'destroy' | 'return-to-deck';

/**
 * "MarsBot advances the (Martian) global parameter furthest from completion.
 * If tied, prioritize raising oxygen, then placing an ocean tile, and finally
 * raising temperature." Returns false when everything is complete.
 *
 * EXPORTED because a CORP-OWNED card prints the same sentence (B26 Venusian
 * Lobby: «raises oxygen 1 step, places an ocean, or raises temperature 1 step,
 * whichever is furthest from being complete») and those live in their
 * corporation's file — one rule, one implementation, whichever file asks.
 */
export function advanceFurthestMartianParameter(game: IGame): boolean {
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
    // Each branch is one of the four printed actions, so each may be taken
    // over by the corporation (C36) — the ladder still counts as resolved,
    // because the action WAS taken, just converted.
    if (!AutomaCorporations.replacesParameterRaise(game, GlobalParameter.OXYGEN)) {
      game.increaseOxygenLevel(bot, 1);
      game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.OXYGEN).number(1));
    }
  } else if (oceansLeft === most) {
    AutomaTilePlacer.placeOcean(game); // …consulted inside the shared placer.
  } else {
    // The shared raise, for its own gate, its log and its Failed Action.
    AutomaTerraformer.raiseTemperature(game);
  }
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
 * «The human must lose 1 animal or 1 microbe (highest scoring if you have
 * multiple)» — printed on B02 Invasive Species AND on the Eccentric helper
 * action of the Hellas Corporate Competition (B09). ONE selection, so the two
 * can never drift apart.
 *
 * `removable` is the outcome the caller can act on; `protected`/`none` are the
 * two honest ways the sentence can find nothing, which the cards narrate
 * differently (B02 still resolves and pays; a helper action that finds nothing
 * is «impossible to resolve» and costs MarsBot nothing).
 */
type CubeAttack =
  | {kind: 'removable', victim: IPlayer, targets: Array<ICard>}
  | {kind: 'protected', victim: IPlayer}
  | {kind: 'none'};

/**
 * Pick the victim and their tied highest-scoring animal/microbe cards.
 *
 * Victim canon (§12 Q9): the GLOBAL highest cube rate; ties across players
 * resolve RANDOMLY with EQUAL weight per PLAYER (never per card — a player with
 * more equal-rate cards must not attract the hit more often). Consumes the
 * seeded rng at most ONCE, and only for a genuine cross-player tie.
 */
function selectHighestScoringCubeAttack(game: IGame): CubeAttack {
  const humans = humansOf(game);
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
    const maxRate = Math.max(...removable.map(({card}) => cubeVpRate(card)));
    const tiedOwners = humans.filter((h) =>
      removable.some(({owner, card}) => owner === h && cubeVpRate(card) === maxRate));
    const victim = pickVictim(game, tiedOwners, () => 0) ?? tiedOwners[0];
    // The prompt below only settles ties WITHIN that victim's own equal-rate
    // cards (scoring-equivalent by construction — never "pick the loss you
    // prefer").
    const targets = removable
      .filter((h) => h.owner === victim && cubeVpRate(h.card) === maxRate)
      .map((h) => h.card);
    return {kind: 'removable', victim, targets};
  }
  if (cubeHolders.length > 0) {
    const shielded = (pickVictim(game, cubeHolders, ({card}) => cubeVpRate(card)) ?? cubeHolders[0]).owner;
    return {kind: 'protected', victim: shielded};
  }
  return {kind: 'none'};
}

/**
 * Announce the cube attack and hand the victim their pick. The cube leaves via
 * the victim's own follow-up answer, after this turn commits.
 */
function deferCubeRemoval(game: IGame, attack: Extract<CubeAttack, {kind: 'removable'}>, bonusCard: BonusCardId): void {
  const bot = marsBotOf(game);
  const {victim, targets} = attack;
  // The attack is announced NOW (target + demand); the actual cube leaves
  // via the target's own follow-up pick, after this turn commits.
  AutomaTurnLog.note(game, {kind: 'attack', attack: {
    target: victim.color, resource: 'cube', demanded: 1, removed: 0, outcome: 'target-chooses',
  }});
  // The pick is shown even for a single candidate (the fork's no-auto-select
  // rule): the victim confirms WHICH cube leaves.
  //
  // The prompt carries its whole meaning STRUCTURALLY (`markBotAttackPrompt`):
  // who attacked, which of the bot's cards did it, what leaves and what each
  // candidate costs. The title is a translatable key that no longer has to
  // smuggle the source card's name in brackets — the client reads the marker.
  // Built INSIDE the deferred callback so the preview is derived from the
  // state the player will actually be looking at (the queue may run other
  // effects between this turn's resolution and the victim's answer).
  game.defer(new SimpleDeferredAction(victim, () => new SelectCard(
    'Remove 1 resource from one of your cards',
    'Remove resource', targets, {min: 1, max: 1})
    .markBotAttackPrompt(cardResourceAttackPrompt({
      attacker: bot,
      victim,
      source: {kind: 'bonusCard', bonusCard},
      targets,
      amount: 1,
      restrictionKey: 'Only your highest-scoring animal or microbe cards can be chosen.',
    }))
    .andThen(([card]) => {
      // `removingPlayer` attributes the cube loss to the bot (LawSuit hook).
      victim.removeResourceFrom(card, 1, {log: true, removingPlayer: bot});
      return undefined;
    })));
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
  case BonusCardId.B08_CORPORATE_COMPETITION:
  case BonusCardId.B09_CORPORATE_COMPETITION_HELLAS:
  case BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM:
    // One card, one resolver: the map only swaps the helper-action list.
    return corporateCompetition(game);
  case BonusCardId.B16_GOVERNMENT_INTERVENTION: return governmentIntervention(game);
  case BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES: return expeditedConstructionColonies(game);
  case BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD: return outerSystemFoothold(game);
  case BonusCardId.B19_SHIPPING_LINES:
  case BonusCardId.B20_EXTENDED_SHIPPING_LINES:
    return shippingLines(game);
  default: {
    // Corporation-specific bonus cards (B22–B32) resolve co-located in their
    // corporation's own module — the registry dispatches by ownership.
    const corpOutcome = AutomaCorporations.resolveCorpBonusCard(game, id);
    if (corpOutcome !== undefined) {
      return corpOutcome;
    }
    throw new Error(`MarsBot bonus card ${id} is out of the POC scope`);
  }
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
    // Nobody at the table has a plant at all — say so; silence reads as a bug.
    // No `target`: there was no victim, and naming one would be a lie.
    AutomaTurnLog.note(game, {kind: 'attack', attack: {
      resource: Resource.PLANTS, demanded: 5, removed: 0,
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

  if (game.gameOptions.venusNextExtension || game.gameOptions.coloniesExtension) {
    bot.stock.add(Resource.MEGACREDITS, 2, {log: true});
    automa.floaters += 1;
    game.log('${0} gained ${1} ${2}', (b) => b.player(bot).number(1).cardResource(CardResource.FLOATER));
  } else {
    bot.stock.add(Resource.MEGACREDITS, 5, {log: true});
  }

  const attack = selectHighestScoringCubeAttack(game);
  if (attack.kind === 'removable') {
    deferCubeRemoval(game, attack, BonusCardId.B02_INVASIVE_SPECIES);
  } else if (attack.kind === 'protected') {
    // Cubes exist, but Protected Habitats / a per-card protection blocks every
    // removal (official FAQ). The card still resolves (M€ above) and discards.
    const shielded = attack.victim;
    game.log('${0} animals and microbes are protected — Invasive Species removes nothing', (b) => b.player(shielded));
    AutomaTurnLog.note(game, {kind: 'attack', attack: {
      target: shielded.color, resource: 'cube', demanded: 1, removed: 0, outcome: 'protected',
    }}, {consumeLog: true});
  } else {
    // No animal/microbe cube anywhere — say so; silence reads as a bug.
    // No `target`, for the same reason as Meteor Shower's empty branch.
    AutomaTurnLog.note(game, {kind: 'attack', attack: {
      resource: 'cube', demanded: 1, removed: 0,
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
    // A project card seeded into the bonus deck (C07) goes to the PROJECT
    // discard — it is a project card, whatever pile it was sitting in.
    if (thinned.kind === 'bonus') {
      automa.bonusDiscard.push(thinned.id);
    } else {
      const card = newProjectCard(thinned.name);
      if (card !== undefined) {
        game.projectDeck.discard(card);
      }
    }
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
  // The ladder (and the ONE branch it announces to the review) is shared with
  // Do It Right (B25) — see AutomaNearBonusPush. Only the fate is this card's.
  const branch = pushNearestBonus(game, venus ? 'venus' : 'ocean');
  if (branch === 'venus') {
    return 'discard'; // The Venus branch explicitly does NOT destroy the card.
  }
  if (branch !== undefined) {
    return 'destroy';
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

/** The Corporate Competition card THIS map plays with — B08 Tharsis, B09 Hellas, B10 Elysium. */
function mapCorporateCompetition(game: IGame): BonusCardId {
  return marsBotMapProfile(game.gameOptions.boardName).corporateCompetition;
}

/**
 * «Reveal cards from the project deck until a <matching> card is revealed,
 * resolve it, and discard the rest» — the shape shared by the Magnate (B09,
 * green), Celebrity (B10, cost 20+), Incorporator, Forecaster and Administrator
 * helper actions across the map-specific Corporate Competition cards. ONE
 * reveal loop; only the predicate is per-card.
 *
 * Rides the deck's own conditional search, so the reveal ORDER, the discarding
 * of the rejected cards, the reshuffle and the ONE public «Discarded N cards»
 * line are the engine's — never a private re-implementation, and never one
 * notification per rejected card. Returns false when the deck holds no
 * matching card at all (the search is bounded by the deck size): the helper is
 * then «impossible to resolve» and MarsBot pays nothing.
 */
function revealUntilAndResolve(game: IGame, matches: (card: IProjectCard) => boolean): boolean {
  const found = game.projectDeck.drawByConditionOrThrow(game, 1, matches);
  if (found.length === 0) {
    return false;
  }
  // Resolved as an ordinary MarsBot project card: its PRINTED TAGS advance this
  // map's tracks, the corporation hook and the human reactors both fire, and it
  // joins the played pile. The card's own human text is never executed.
  resolveProjectCardForBot(game, found[0]);
  return true;
}

/**
 * Corporate Competition — B08 (Tharsis), B09 (Hellas) and B10 (Elysium) are the
 * SAME card with a different helper-action list, so they are the same resolver:
 * with 5+ M€,
 * help its position on the CLOSEST already-funded award (the one the human
 * leads by the smallest margin or is tied; MarsBot leading everywhere → its own
 * smallest margin), skipping awards whose helper is impossible. A resolved help
 * costs 5 M€; no help possible → draw another bonus card and resolve it (both
 * discarded). The Venuphile helper is added to every version (Adding Expansions
 * p.3). The per-map action list lives in `tryAwardHelper`.
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
    // «Leftmost if tied» means the AWARD ROW, not the order the awards happened
    // to be funded in — so the candidates enter the sort already in row order
    // (Venuphile last), and JS's stable sort keeps that as the tiebreak.
    const leftmost = AutomaMilestonesAwards.awardsInLeftmostOrder(game);
    const funded = game.fundedAwards.map(({award}) => award);
    const withMargin = leftmost.filter((award) => funded.includes(award)).map((award) => {
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
        // «If MarsBot takes an action, it loses 5 MC.» The card checked its 5 M€
        // BEFORE the helper ran, and a helper can spend money of its own on the
        // way (Hellas' South Pole charges 6 M€ for the greenery it just placed
        // there) — so the bot may now hold less. It loses what it has; clamped
        // explicitly because the engine's own under-deduct guard would report
        // this legal outcome as an illegal state.
        bot.stock.deduct(Resource.MEGACREDITS, Math.min(5, bot.megaCredits), {log: true});
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
    game.log('${0} drew another bonus card', (b) => b.player(bot));
    // Attribute the SECONDARY card's own steps to their own cause so the review
    // nests them under this card as ONE flow (not a second event).
    AutomaTurnLog.setCause(game, {kind: 'secondary-bonus'});
    if (next.kind === 'bonus') {
      AutomaTurnLog.setBonusSecondary(game, next.id);
      const outcome = resolveBonusCard(game, next.id);
      routeBonusCard(game, next.id, outcome);
    } else {
      // The deck can hold PROJECT cards (C07 seeds them) — resolve as one.
      const card = newProjectCard(next.name);
      if (card !== undefined) {
        resolveProjectCardForBot(game, card);
      }
    }
    AutomaTurnLog.setCause(game, {kind: 'bonus'});
  }
  return 'discard';
}

/**
 * The Corporate Competition helper actions — Tharsis (rulebook p.7), Hellas
 * (Adding Expansions p.12), Elysium (B10) and the Venuphile line every version
 * of the card gains with Venus Next (Adding Expansions p.3). False when the
 * action is «impossible to resolve»: the caller then tries the NEXT funded
 * award and the bot pays nothing — which is how B10's two CONSTRAINED greenery
 * helpers refuse rather than place somewhere the card does not allow.
 *
 * Award names are unique across the supported board set, so ONE switch serves
 * every map; the tracks are addressed by canonical ROLE, which is what makes
 * «advance the science track» reach the Jovian/Science track on Hellas.
 */
function tryAwardHelper(game: IGame, awardName: string): boolean {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const board = automa.board;
  const advanceRole = (role: MarsBotTrackRole): boolean => {
    const index = board.getTrackIndexOfRole(role);
    if (index === undefined || !board.tracks[index].canAdvance()) {
      return false;
    }
    AutomaResolver.advanceTrack(game, index);
    return true;
  };
  /**
   * «MarsBot places a greenery tile and raises oxygen 1 step» — the ORDINARY
   * bot greenery pipeline, so tile ownership, the covered-icon M€, oxygen, TR,
   * the placement bonuses, the «any player» card triggers, Ares and the map's
   * own tiebreakers all apply exactly as they do for a printed track icon.
   *
   * `restrict` is a card's HARD CONSTRAINT on WHERE (B10's Southern Region /
   * ocean adjacency): it narrows the LEGAL set before any strategy runs, and
   * an empty result means the helper is impossible — never a fallback to an
   * unconstrained greenery, and never a Failed Action (the caller then tries
   * the next funded award and MarsBot pays nothing).
   */
  const placeGreenery = (restrict?: (space: Space) => boolean): boolean =>
    AutomaTilePlacer.placeGreenery(game, {restrict, onEmpty: 'impossible'});
  switch (awardName) {
  // ── Tharsis (B08) ────────────────────────────────────────────────────────
  case 'Landlord':
    return placeGreenery();
  case 'Banker': {
    // Advance Building or Event, whichever is least advanced; Building on ties.
    const alive = (['building', 'event'] as const)
      .map((role) => ({role, track: board.getTrackOfRole(role)}))
      .filter((e) => e.track?.canAdvance() === true);
    if (alive.length === 0) {
      return false;
    }
    alive.sort((a, b) => (a.track?.position ?? 0) - (b.track?.position ?? 0)); // Stable: Building first on ties.
    return advanceRole(alive[0].role);
  }
  case 'Scientist': return advanceRole('science');
  case 'Thermalist': return advanceRole('power');
  case 'Miner': return advanceRole('space');
  // ── Hellas (B09, Adding Expansions p.12) ─────────────────────────────────
  case 'Cultivator':
    return placeGreenery();
  case 'Magnate':
    // «Reveal cards from the project deck until a green card is revealed,
    // resolve it, and discard the rest.»
    return revealUntilAndResolve(game, (card) => card.type === CardType.AUTOMATED);
  case 'Space Baron': return advanceRole('space');
  case 'Excentric': {
    // «You (the player) must remove the highest-scoring animal/microbe cube
    // from a card in your tableau, if possible» — the same sentence B02
    // Invasive Species prints, so it is the same resolver. Nothing removable
    // ⇒ impossible to resolve (no 5 M€ changes hands).
    const attack = selectHighestScoringCubeAttack(game);
    if (attack.kind !== 'removable') {
      return false;
    }
    deferCubeRemoval(game, attack, mapCorporateCompetition(game));
    return true;
  }
  case 'Contractor': return advanceRole('building');
  // ── Elysium (B10, the official card) ──────────────────────────
  case 'Celebrity':
    // «Reveal cards from the project deck until a card costing 20+ M€ is
    // revealed. Resolve it.» Magnate's shape with a different predicate — the
    // rejected cards are discarded by the deck's own search. 20 EXACTLY
    // qualifies, and an EVENT costing 20+ qualifies (the bot counts events for
    // this award, so its helper must be able to find one).
    return revealUntilAndResolve(game, (card) => card.cost >= 20);
  case 'Industrialist':
    // «Advance the power track.» The canonical ROLE, so it reaches the same
    // track the award scores (+5) on every map. A maxed track cannot advance
    // ⇒ impossible to resolve, exactly like B09's track helpers — never a
    // paid Failed Action.
    return advanceRole('power');
  case 'Desert Settler':
    // «MarsBot places a greenery tile IN THE SOUTHERN REGION and raises oxygen
    // 1 step.» A hard constraint on the legal set (the same four bottom rows
    // the award counts), not a tiebreaker: with no legal Southern space the
    // helper is impossible and the card tries the next funded award.
    return placeGreenery(Board.isSouthernRegion);
  case 'Estate Dealer':
    // «MarsBot places a greenery tile ADJACENT TO AN OCEAN and raises oxygen
    // 1 step.» The second hard constraint — no ocean-adjacent legal space
    // means impossible, never a plain greenery somewhere else.
    return placeGreenery((space) => game.board.getAdjacentSpaces(space).some(Board.isOceanSpace));
  case 'Benefactor':
    // «MarsBot raises its TR 2 steps.» A direct terraform-rating gain through
    // the authoritative mutation — no global parameter moves, no tile, no
    // placement bonus. Always possible, so it always costs the 5 M€.
    marsBotOf(game).increaseTerraformRating(2, {log: true});
    return true;
  // ── Venus Next: added to ALL versions of the card ─────────────────────────
  case 'Venuphile': return advanceRole('venus');
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
    if (game.getVenusScaleLevel() < constants.MAX_VENUS_SCALE &&
        !AutomaCorporations.replacesParameterRaise(game, GlobalParameter.VENUS)) {
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
    // A destroyed card is out of the GAME, so it can never come back — not
    // even from the recurring holding pool. Until C17 Vitor no recurring card
    // could reach this branch (B16/B19/B20/B23/B25/B28 always discard), but
    // Vitor hands back B04 Overachievement, which destroys itself the moment
    // it lands a milestone: leaving it in the pool would resurrect it in the
    // next generation's deck rebuild.
    const recurring = automa.recurringBonusCards.indexOf(id);
    if (recurring !== -1) {
      automa.recurringBonusCards.splice(recurring, 1);
    }
    game.log('MarsBot bonus card was destroyed and removed from the game');
    return;
  }
  if (outcome === 'return-to-deck') {
    // Printed on the card itself, so it outranks the discard: back into the
    // live deck, shuffled, available again this game.
    automa.bonusDeck.push({kind: 'bonus', id});
    inplaceShuffle(automa.bonusDeck, game.rng);
    game.log('MarsBot bonus card was shuffled back into its bonus deck');
    return;
  }
  if (automa.recurringBonusCards.includes(id)) {
    return; // B16 (later B19/B20) returns to the action deck next generation.
  }
  automa.bonusDiscard.push(id);
}
