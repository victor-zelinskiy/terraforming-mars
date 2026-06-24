import {CardModel} from '../../common/models/CardModel';
import {Color} from '../../common/Color';
import {IGame} from '../IGame';
import {GameOptions} from '../game/GameOptions';
import {SimpleGameModel} from '../../common/models/SimpleGameModel';
import {GameOptionsModel} from '../../common/models/GameOptionsModel';
import {Board} from '../boards/Board';
import {Space} from '../boards/Space';
import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {PlayerInputModel} from '../../common/models/PlayerInputModel';
import {PlayerViewModel, Protection, PublicPlayerModel} from '../../common/models/PlayerModel';
import {SpaceHighlight, SpaceModel} from '../../common/models/SpaceModel';
import {TileType} from '../../common/TileType';
import {Phase} from '../../common/Phase';
import {Resource} from '../../common/Resource';
import {ClaimedMilestoneModel, MilestoneScore} from '../../common/models/ClaimedMilestoneModel';
import {FundedAwardModel, AwardScore} from '../../common/models/FundedAwardModel';
import {getTurmoilModel} from '../models/TurmoilModel';
import {SpectatorModel} from '../../common/models/SpectatorModel';
import {GameModel} from '../../common/models/GameModel';
import {Turmoil} from '../turmoil/Turmoil';
import {createPathfindersModel} from './PathfindersModel';
import {MoonModel} from '../../common/models/MoonModel';
import {CardName} from '../../common/cards/CardName';
import {AwardScorer} from '../awards/AwardScorer';
import {SpaceId} from '../../common/Types';
import {cardsToModel, coloniesToModel} from './ModelUtils';
import {runId} from '../utils/server-ids';
import {toName} from '../../common/utils/utils';
import {MAX_AWARDS, MAX_MILESTONES, MAX_TEMPERATURE} from '../../common/constants';
import {Message} from '../../common/logs/Message';
import {PartyHooks} from '../turmoil/parties/PartyHooks';
import {PartyName} from '../../common/turmoil/PartyName';
import {ConvertPlants} from '../cards/base/standardActions/ConvertPlants';
import {ConvertHeat} from '../cards/base/standardActions/ConvertHeat';
import {DeltaProjectExpansion} from '../delta/DeltaProjectExpansion';
import {KELVINISTS_POLICY_3} from '../turmoil/parties/Kelvinists';

const DEFAULT_HEAT_FOR_TEMPERATURE = 8;
const KELVINISTS_HEAT_FOR_TEMPERATURE = 6;

// Title patterns for World Government Terraforming. Single prompt; the title
// is a fixed string set in `Game.worldGovernmentTerraformingInput()`.
const WGT_TITLE_PATTERNS = [
  'Select action for World Government Terraforming',
];

// Title patterns for Turmoil delegate / ruling-party prompts. These are set
// in `SendDelegateToArea` (configurable per call) and `ChooseRulingPartyDeferred`.
const DELEGATE_TITLE_PATTERNS = [
  'Select new ruling party',
  'Select where to send a delegate',
  'Send a delegate', // matches the "Send a delegate in an area …" variants
];

function titleText(title: string | Message | undefined): string {
  if (title === undefined) {
    return '';
  }
  return typeof title === 'string' ? title : title.message;
}

/**
 * True iff the player's current pending PlayerInput is the standard
 * action-selection prompt — i.e. they're being asked "what action do
 * you want to take?" rather than being mid-card or mid-sub-prompt.
 * The action menu's title is set in `Player.getActions()`.
 */
function isInActionSelectionPhase(input: PlayerInput | undefined): boolean {
  if (!input) {
    return false;
  }
  const title = titleText(input.title);
  return title === 'Take your first action' || title === 'Take your next action';
}

/**
 * Classifies a player's pending PlayerInput into one of the
 * cross-phase prompt kinds (`globalsupport` / `delegate`) the status
 * label distinguishes. Returns undefined for anything else — the label
 * then falls back to a phase-derived value (turn / drafting / …).
 *
 * The walk is depth-limited and only descends OrOptions / AndOptions
 * containers (sub-prompts like SelectSpace, SelectCard never carry a
 * cross-phase title we'd match on).
 */
function detectWaitingForKind(input: PlayerInput | undefined): 'globalsupport' | 'delegate' | undefined {
  if (input === undefined) {
    return undefined;
  }
  let result: 'globalsupport' | 'delegate' | undefined;
  const visit = (node: PlayerInput, depth: number): boolean => {
    if (depth > 3) {
      return false;
    }
    const title = titleText(node.title);
    if (WGT_TITLE_PATTERNS.some((p) => title.includes(p))) {
      result = 'globalsupport';
      return true;
    }
    if (DELEGATE_TITLE_PATTERNS.some((p) => title.includes(p))) {
      result = 'delegate';
      return true;
    }
    // Only OrOptions / AndOptions expose nested options at this layer.
    const options = (node as unknown as {options?: ReadonlyArray<PlayerInput>}).options;
    if (Array.isArray(options)) {
      for (const child of options) {
        if (visit(child, depth + 1)) {
          return true;
        }
      }
    }
    return false;
  };
  visit(input, 0);
  return result;
}

export class Server {
  public static getSimpleGameModel(game: IGame): SimpleGameModel {
    return {
      activePlayer: game.activePlayer.color,
      id: game.id,
      name: game.name,
      phase: game.phase,
      players: game.playersInGenerationOrder.map((player) => ({
        color: player.color,
        id: player.id,
        name: player.name,
      })),
      spectatorId: game.spectatorId,
      gameOptions: this.getGameOptionsAsModel(game.gameOptions),
      lastSoloGeneration: game.lastSoloGeneration(),
      expectedPurgeTimeMs: game.expectedPurgeTimeMs(),
    };
  }

  public static getGameModel(game: IGame): GameModel {
    const turmoil = getTurmoilModel(game);

    return {
      aresData: game.aresData,
      awards: this.getAwards(game),
      colonies: coloniesToModel(game, game.colonies, false, true),
      deckSize: game.projectDeck.drawPile.length,
      discardPileSize: game.projectDeck.discardPile.length,
      discardedColonies: game.discardedColonies.map(toName),
      expectedPurgeTimeMs: game.expectedPurgeTimeMs(),
      gameAge: game.gameAge,
      gameOptions: this.getGameOptionsAsModel(game.gameOptions),
      generation: game.getGeneration(),
      globalsPerGeneration: game.gameIsOver() ? game.globalsPerGeneration : [],
      isSoloModeWin: game.isSoloModeWin(),
      isTerraformed: game.marsIsTerraformed(),
      lastSoloGeneration: game.lastSoloGeneration(),
      milestones: this.getMilestones(game),
      moon: this.getMoonModel(game),
      name: game.name,
      oceans: game.board.getOceanSpaces().length,
      oxygenLevel: game.getOxygenLevel(),
      passedPlayers: game.getPassedPlayers(),
      pathfinders: createPathfindersModel(game),
      phase: game.phase,
      spaces: this.getSpaces(game.board, game.gagarinBase, game.stJosephCathedrals, game.nomadSpace),
      spectatorId: game.spectatorId,
      standardProjects: game.getStandardProjects().map((sp) => ({name: sp.name, cost: sp.cost})),
      step: game.lastSaveId,
      temperature: game.getTemperature(),
      tags: game.tags,
      turmoil: turmoil,
      undoCount: game.undoCount,
      venusScaleLevel: game.getVenusScaleLevel(),
      scaleBonusClaims: Object.fromEntries(game.scaleBonusClaims),
    };
  }

  public static getPlayerModel(player: IPlayer): PlayerViewModel {
    const game = player.game;

    const players: Array<PublicPlayerModel> = game.playersInGenerationOrder.map((p) => this.getPlayer(p, p.color === player.color));

    const thisPlayerIndex = players.findIndex((p) => p.color === player.color);
    const thisPlayer: PublicPlayerModel = players[thisPlayerIndex];

    const rv: PlayerViewModel = {
      cardsInHand: cardsToModel(player, player.cardsInHand, {showCalculatedCost: true, unplayableReasons: true}),
      ceoCardsInHand: cardsToModel(player, Array.from(player.ceoCardsInHand)),
      dealtCorporationCards: cardsToModel(player, player.dealtCorporationCards),
      dealtPreludeCards: cardsToModel(player, player.dealtPreludeCards),
      dealtCeoCards: cardsToModel(player, player.dealtCeoCards),
      dealtProjectCards: cardsToModel(player, player.dealtProjectCards),
      draftedCards: cardsToModel(player, player.draftedCards, {showCalculatedCost: true}),
      game: this.getGameModel(player.game),
      id: player.id,
      runId: runId,
      pickedCorporationCard: player.pickedCorporationCard ? cardsToModel(player, [player.pickedCorporationCard]) : [],
      preludeCardsInHand: cardsToModel(player, player.preludeCardsInHand),
      pendingInitialActions: player.pendingInitialActions.map((c) => c.name),
      thisPlayer: thisPlayer,
      waitingFor: this.getWaitingFor(player, player.getWaitingFor()),
      players: players,
      autopass: player.autopass,
      cardDrawReveals: player.cardDrawReveals.map((r) => ({
        id: r.id,
        source: r.source,
        // Same options as cardsInHand so reveal cards render identically.
        cards: cardsToModel(player, r.cards, {showCalculatedCost: true, unplayableReasons: true}),
      })),
      // Self-only (this whole model IS the requesting player's view) + transient:
      // the result of the player's most recent reveal/deck-check action, for the
      // premium reveal-result overlay. Already a serialized RevealResultModel.
      lastReveal: player.lastReveal,
    };
    return rv;
  }

  public static getSpectatorModel(game: IGame): SpectatorModel {
    return {
      color: 'neutral',
      id: game.spectatorId,
      game: this.getGameModel(game),
      players: game.playersInGenerationOrder.map((p) => this.getPlayer(p, false)),
      thisPlayer: undefined,
      runId: runId,
    };
  }

  // The cards currently hosted on Self-replicating Robots. Built through the
  // shared `cardsToModel` so they carry the SAME data a normal hand card does:
  // `isSelfReplicatingRobotsCard` + the resource count (set by cardsToModel for
  // hosted cards), the DISCOUNTED `calculatedCost` (getCardCost applies the SRR
  // discount), and — only for the viewer's OWN model — structured
  // `unplayableReasons`. The reasons let the КАРТЫ В РУКЕ overlay show a hosted
  // card that can't be afforded/played right now as a proper rules block (with
  // the deficit/requirement popover) instead of a misleading "not your turn".
  public static getSelfReplicatingRobotsTargetCards(player: IPlayer, modelIsForThisPlayer: boolean): Array<CardModel> {
    return [...cardsToModel(player, player.getSelfReplicatingRobotsTargetCards(), {
      showResources: true,
      showCalculatedCost: true,
      unplayableReasons: modelIsForThisPlayer,
    })];
  }

  public static getMilestones(game: IGame): Array<ClaimedMilestoneModel> {
    const allMilestones = game.milestones;
    const claimedMilestones = game.claimedMilestones;
    const milestoneModels: Array<ClaimedMilestoneModel> = [];

    for (const milestone of allMilestones) {
      const claimed = claimedMilestones.find(
        (m) => m.milestone.name === milestone.name,
      );
      let scores: Array<MilestoneScore> = [];
      if (claimed === undefined && claimedMilestones.length < MAX_MILESTONES) {
        scores = game.players.map((player) => ({
          color: player.color,
          score: milestone.getScore(player),
          claimable: milestone.canClaim(player),
        }));
      }

      // Per-game threshold + description. Most milestones return their static
      // values; a few (Terraformer) implement getThreshold/getDescription to
      // pick a different number based on expansion state (e.g. Turmoil).
      const threshold = milestone.getThreshold !== undefined ?
        milestone.getThreshold(game) :
        (milestone as unknown as {threshold?: number}).threshold;
      const description = milestone.getDescription !== undefined ?
        milestone.getDescription(game) :
        milestone.description;

      milestoneModels.push({
        playerName: claimed?.player.name,
        color: claimed?.player.color,
        name: milestone.name,
        scores,
        threshold,
        description,
      });
    }

    return milestoneModels;
  }

  public static getAwards(game: IGame): Array<FundedAwardModel> {
    const fundedAwards = game.fundedAwards;
    const awardModels: Array<FundedAwardModel> = [];

    for (const award of game.awards) {
      const funded = fundedAwards.find((a) => a.award.name === award.name);
      const scorer = new AwardScorer(game, award);
      let scores: Array<AwardScore> = [];
      if (fundedAwards.length < MAX_AWARDS || funded !== undefined) {
        scores = game.players.map((player) => ({
          color: player.color,
          score: scorer.get(player),
        }));
      }

      awardModels.push({
        playerName: funded?.player.name,
        color: funded?.player.color,
        name: award.name,
        scores: scores,
      });
    }

    return awardModels;
  }

  public static getWaitingFor(
    player: IPlayer,
    waitingFor: PlayerInput | undefined,
  ): PlayerInputModel | undefined {
    if (waitingFor === undefined) {
      return undefined;
    }
    // TODO(kberg): in theory this should be in all the other toModel calls.
    const model = waitingFor.toModel(player);
    model.warning = waitingFor.warning;
    // Start-of-game-flow marker (corp initial action / prelude selection) — set
    // centrally so any input type carries it without touching per-type toModel.
    if (waitingFor.startGamePrompt !== undefined) {
      model.startGamePrompt = waitingFor.startGamePrompt;
    }
    // Award-funding marker — routes the prompt to the modern AwardsOverlay.
    if (waitingFor.awardFundingPrompt !== undefined) {
      model.awardFundingPrompt = waitingFor.awardFundingPrompt;
    }
    // Contextual-choice marker — routes the prompt to the premium
    // ContextualChoiceContent modal (source card + trigger + rich options).
    if (waitingFor.choiceContext !== undefined) {
      model.choiceContext = waitingFor.choiceContext;
    }
    // Venus alt-track bonus marker — routes the prompt to the premium
    // VenusBonusContent modal (resource tiles + final-step wild bonus).
    if (waitingFor.venusBonusPrompt !== undefined) {
      model.venusBonusPrompt = waitingFor.venusBonusPrompt;
    }
    // "Spend N heat" marker (Stormcraft) — routes the heat-source AndOptions to the
    // premium SpendHeatContent modal instead of the legacy AndOptions widget.
    if (waitingFor.spendHeatPrompt !== undefined) {
      model.spendHeatPrompt = waitingFor.spendHeatPrompt;
    }
    return model;
    // showReset: player.game.inputsThisRound > 0 && player.game.resettable === true && player.game.phase === Phase.ACTION,
  }

  /** When the model is for this player, show the VP. Players like seeing their own VP even if the feature is off. */
  public static getPlayer(player: IPlayer, modelIsForThisPlayer: boolean): PublicPlayerModel {
    const game = player.game;
    const useHandicap = game.players.some((p) => p.handicap !== 0);
    // canConvertPlants / canConvertHeat: same eligibility logic that
    // Player.getActions() uses to decide whether to push the option into
    // the action OR. Gated by `isInActionSelectionPhase` so the buttons
    // are only enabled when a click can actually be submitted (not during
    // mid-card sub-prompts).
    const inActionSelection = isInActionSelectionPhase(player.getWaitingFor());
    const canConvertPlants = inActionSelection && new ConvertPlants().canAct(player);
    // Heat→temperature is pointless once temperature is maxed (no parameter rise,
    // no TR): suppress the dedicated button AND the pass warning there, even though
    // the legacy action menu still technically offers it with a 'maxtemp' warning.
    const canConvertHeat = inActionSelection && game.getTemperature() < MAX_TEMPERATURE && (
      PartyHooks.shouldApplyPolicy(player, PartyName.KELVINISTS, 'kp03') ?
        KELVINISTS_POLICY_3.canAct(player) :
        new ConvertHeat().canAct(player));
    // The global "Гидросеть" advance action is available right now (drives the
    // bottom-bar ready cue + the pass warning). Same gate as Player.getActions().
    const canAdvanceDelta = inActionSelection &&
      game.gameOptions.deltaProjectExpansion === true &&
      player.deltaProjectData !== undefined &&
      player.deltaProjectData.usedThisGeneration !== true &&
      DeltaProjectExpansion.maxSteps(player) > 0;
    const model: PublicPlayerModel = {
      actionsTakenThisRound: player.actionsTakenThisRound,
      actionsTakenThisGame: player.actionsTakenThisGame,
      actionsThisGeneration: Array.from(player.actionsThisGeneration),
      alliedParty: player.alliedParty,
      availableBlueCardActionCount: player.getPlayableActionCards().length,
      cardCost: player.cardCost,
      cardDiscount: player.colonies.cardDiscount,
      cardsInHandNbr: player.cardsInHand.length,
      citiesCount: game.board.getCities(player).length,
      coloniesCount: player.getColoniesCount(),
      color: player.color,
      energy: player.energy,
      energyProduction: player.production.energy,
      fleetSize: player.colonies.getFleetSize(),
      handicap: useHandicap ? player.handicap : undefined,
      heat: player.heat,
      heatProduction: player.production.heat,
      id: game.phase === Phase.END ? player.id : undefined,
      influence: Turmoil.ifTurmoilElse(game, (turmoil) => turmoil.getInfluence(player), () => 0),
      isActive: player.id === game.activePlayer.id,
      isWaitingForInput: player.getWaitingFor() !== undefined,
      waitingForKind: detectWaitingForKind(player.getWaitingFor()),
      lastCardPlayed: player.lastCardPlayed,
      megacredits: player.megaCredits,
      megacreditProduction: player.production.megacredits,
      name: player.name,
      needsToDraft: player.needsToDraft,
      needsToResearch: !game.hasResearched(player),
      noTagsCount: player.tags.numberOfCardsWithNoTags(),
      plants: player.plants,
      plantProduction: player.production.plants,
      plantsNeededForGreenery: player.plantsNeededForGreenery,
      // Turmoil Kelvinists kp03 lowers heat cost to 6; otherwise it's the
      // base-game 8. Compute server-side so the client never has to guess
      // from prompt titles.
      heatNeededForTemperature:
        PartyHooks.shouldApplyPolicy(player, PartyName.KELVINISTS, 'kp03') ?
          KELVINISTS_HEAT_FOR_TEMPERATURE :
          DEFAULT_HEAT_FOR_TEMPERATURE,
      canConvertPlants,
      canConvertHeat,
      canAdvanceDelta,
      protectedResources: Server.getResourceProtections(player),
      protectedProduction: Server.getProductionProtections(player),
      // actionReasons only for the viewer's OWN tableau (the self-model): the
      // Actions overlay needs the "why can't I activate" reasons only for the
      // player who can actually act; opponents' actions are view-only.
      tableau: cardsToModel(player, player.tableau.asArray(), {showResources: true, actionReasons: modelIsForThisPlayer}),
      selfReplicatingRobotsCards: Server.getSelfReplicatingRobotsTargetCards(player, modelIsForThisPlayer),
      steel: player.steel,
      steelProduction: player.production.steel,
      steelValue: player.getSteelValue(),
      tags: player.tags.countAllTags(),
      terraformRating: player.terraformRating,
      timer: player.timer.serialize(),
      titanium: player.titanium,
      titaniumProduction: player.production.titanium,
      titaniumValue: player.getTitaniumValue(),
      tradesThisGeneration: player.colonies.usedTradeFleets,
      colonyTradeOffset: player.colonies.tradeOffset,
      underworldData: player.underworldData,
      victoryPointsBreakdown: {
        terraformRating: 0,
        terraformRatingBreakdown: {base: 0, baseRating: 0, handicap: 0, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0, cardEntries: []},
        milestones: 0,
        awards: 0,
        greenery: 0,
        city: 0,
        escapeVelocity: 0,
        moonHabitats: 0,
        moonMines: 0,
        moonRoads: 0,
        planetaryTracks: 0,
        deltaProject: 0,
        victoryPoints: 0,
        total: 0,
        detailsCards: [],
        detailsMilestones: [],
        detailsAwards: [],
        detailsPlanetaryTracks: [],
        negativeVP: 0,
      },
      victoryPointsByGeneration: [],
      globalParameterSteps: {},
    };

    if (game.phase === Phase.END || game.isSoloMode() ||
        game.gameOptions.showOtherPlayersVP === true || modelIsForThisPlayer) {
      model.victoryPointsBreakdown = player.getVictoryPoints();
      model.victoryPointsByGeneration = player.victoryPointsByGeneration;
      model.globalParameterSteps = player.globalParameterSteps;
    }

    model.deltaProject = player.deltaProjectData;

    return model;
  }

  private static getResourceProtections(player: IPlayer) {
    const protection: Record<Resource, Protection> = {
      megacredits: 'off',
      steel: 'off',
      titanium: 'off',
      plants: 'off',
      energy: 'off',
      heat: 'off',
    };

    if (player.alloysAreProtected()) {
      protection.steel = 'on';
      protection.titanium = 'on';
    }

    if (player.plantsAreProtected()) {
      protection.plants = 'on';
    } else if (player.tableau.has(CardName.BOTANICAL_EXPERIENCE)) {
      protection.plants = 'half';
    }

    return protection;
  }

  private static getProductionProtections(player: IPlayer) {
    const defaultProteection = player.tableau.has(CardName.PRIVATE_SECURITY) ? 'on' : 'off';
    const protection: Record<Resource, Protection> = {
      megacredits: defaultProteection,
      steel: defaultProteection,
      titanium: defaultProteection,
      plants: defaultProteection,
      energy: defaultProteection,
      heat: defaultProteection,
    };

    if (player.alloysAreProtected()) {
      protection.steel = 'on';
      protection.titanium = 'on';
    }

    return protection;
  }

  // Oceans can't be owned so they shouldn't have a color associated with them
  // Land claim can have a color on a space without a tile
  private static getColor(space: Space): Color | undefined {
    if (
      (space.tile === undefined || space.tile.tileType !== TileType.OCEAN) &&
    space.player !== undefined
    ) {
      return space.player.color;
    }
    if (space.tile?.protectedHazard === true) {
      return 'bronze';
    }
    return undefined;
  }

  private static getSpaces(
    board: Board,
    gagarin: ReadonlyArray<SpaceId> = [],
    cathedrals: ReadonlyArray<SpaceId> = [],
    nomads: SpaceId | undefined = undefined): Array<SpaceModel> {
    const noctisCitySpaceId = board.noctisCitySpaceId;

    return board.spaces.map((space) => {
      let highlight: SpaceHighlight = undefined;
      if (space.volcanic) {
        highlight = 'volcanic';
      } else if (noctisCitySpaceId === space.id) {
        highlight = 'noctis';
      }

      const model: SpaceModel = {
        x: space.x,
        y: space.y,
        id: space.id,
        spaceType: space.spaceType,
        bonus: space.bonus,
      };
      const tileType = space.tile?.tileType;
      if (tileType !== undefined) {
        model.tileType = tileType;
      }
      const color = this.getColor(space);
      if (color !== undefined) {
        model.color = color;
      }
      if (highlight !== undefined) {
        model.highlight = highlight;
      }
      if (space.tile?.rotated === true) {
        model.rotated = true;
      }
      const gagarinIndex = gagarin.indexOf(space.id);
      if (gagarinIndex > -1) {
        model.gagarin = gagarinIndex;
      }
      if (cathedrals.includes(space.id)) {
        model.cathedral = true;
      }
      if (space.id === nomads) {
        model.nomads = true;
      }
      if (space.undergroundResources !== undefined) {
        model.undergroundResource = space.undergroundResources;
      }
      if (space.excavator !== undefined) {
        model.excavator = space.excavator.color;
      }
      if (space.coOwner !== undefined) {
        model.coOwner = space.coOwner.color;
      }

      return model;
    });
  }

  public static getGameOptionsAsModel(options: GameOptions): GameOptionsModel {
    return {
      altVenusBoard: options.altVenusBoard,
      aresExtremeVariant: options.aresExtremeVariant,
      boardName: options.boardName,
      bannedCards: options.bannedCards,
      draftVariant: options.draftVariant,
      escapeVelocity: options.escapeVelocity,
      expansions: {
        corpera: options.corporateEra,
        promo: options.promoCardsOption,
        venus: options.venusNextExtension,
        colonies: options.coloniesExtension,
        prelude: options.preludeExtension,
        prelude2: options.prelude2Expansion,
        turmoil: options.turmoilExtension,
        community: options.communityCardsOption,
        ares: options.aresExtension,
        moon: options.moonExpansion,
        pathfinders: options.pathfindersExpansion,
        ceo: options.ceoExtension,
        starwars: options.starWarsExpansion,
        underworld: options.underworldExpansion,
        deltaProject: options.deltaProjectExpansion,
      },
      fastModeOption: options.fastModeOption,
      includedCards: options.includedCards,
      includeFanMA: options.includeFanMA,
      initialDraftVariant: options.initialDraftVariant,
      preludeDraftVariant: options.preludeDraftVariant,
      ceosDraftVariant: options.ceosDraftVariant,
      politicalAgendasExtension: options.politicalAgendasExtension,
      removeNegativeGlobalEvents: options.removeNegativeGlobalEventsOption,
      showOtherPlayersVP: options.showOtherPlayersVP,
      showTimers: options.showTimers,
      testMode: options.testMode,
      shuffleMapOption: options.shuffleMapOption,
      solarPhaseOption: options.solarPhaseOption,
      soloTR: options.soloTR,
      randomMA: options.randomMA,
      requiresMoonTrackCompletion: options.requiresMoonTrackCompletion,
      requiresVenusTrackCompletion: options.requiresVenusTrackCompletion,
      twoCorpsVariant: options.twoCorpsVariant,
      undoOption: options.undoOption,
    };
  }

  private static getMoonModel(game: IGame): MoonModel | undefined {
    const moonData = game.moonData;
    if (moonData) {
      return {
        logisticRate: moonData.logisticRate,
        miningRate: moonData.miningRate,
        habitatRate: moonData.habitatRate,
        spaces: this.getSpaces(moonData.moon),
      };
    }
    return undefined;
  }
}
