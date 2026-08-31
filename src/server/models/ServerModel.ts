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
import {CardResource} from '../../common/CardResource';
import {ClaimedMilestoneModel, MilestoneScore} from '../../common/models/ClaimedMilestoneModel';
import {AutomaDeltaProject} from '../automa/AutomaDeltaProject';
import {AutomaState} from '../automa/AutomaState';
import {AutomaCorporations} from '../automa/corps/AutomaCorporations';
import {MarsBotCorpModel, marsBotCorpInfo} from '../../common/automa/MarsBotCorpData';
import {AutomaMAEvaluation} from '../automa/AutomaMAEvaluation';
import {milestoneThreshold} from '../milestones/IMilestone';
import {FundedAwardModel, AwardScore} from '../../common/models/FundedAwardModel';
import {getTurmoilModel} from '../models/TurmoilModel';
import {GameModel} from '../../common/models/GameModel';
import {MarsBotModel} from '../../common/models/MarsBotModel';
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
import {isActionMenuTitle} from '../../common/inputs/actionMenuTitles';
import {Message} from '../../common/logs/Message';
import {PartyHooks} from '../turmoil/parties/PartyHooks';
import {PartyName} from '../../common/turmoil/PartyName';
import {ConvertPlants} from '../cards/base/standardActions/ConvertPlants';
import {ConvertHeat} from '../cards/base/standardActions/ConvertHeat';
import {potentialActions, potentialHydroAdvance} from './potentialActions';
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
  return isActionMenuTitle(titleText(input.title));
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
  // NB: a card-granted BONUS action is deliberately NOT a kind here. It is a
  // whole TURN, not one prompt — the player plays a card and the next three
  // prompts are a payment, a placement and a triggered effect, none of which
  // carry the menu's marker. The status label reads the LEDGER
  // (`PublicPlayerModel.bonusActions`) instead, so it holds for the whole
  // window and for every seat.
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
      aresAdjacencyGrants: game.aresAdjacencyGrants.length > 0 ? game.aresAdjacencyGrants : undefined,
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
      automa: this.getAutomaModel(game),
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
        // The conditional search's reveal order (present only when it really
        // discarded something). Serialized with the SAME options so a
        // discarded card renders exactly like a kept one. These names are
        // already public — Deck logs the discards to the shared game log —
        // and this whole model is the requesting player's own view anyway.
        sequence: r.sequence?.map((step) => ({
          card: cardsToModel(player, [step.card], {showCalculatedCost: true, unplayableReasons: true})[0],
          matched: step.matched,
        })),
        // The income/bonus split of a trade-merged batch (see
        // CardDrawRevealModel.tradeSegments) — drives the console trade
        // cinematic's per-wave launches.
        tradeSegments: r.tradeSegments,
      })),
      // Self-only (this whole model IS the requesting player's view) + transient:
      // the result of the player's most recent reveal/deck-check action, for the
      // premium reveal-result overlay. Already a serialized RevealResultModel.
      lastReveal: player.lastReveal,
      // Self-only + transient: the energy→heat conversion that just happened in
      // this player's production phase, for the premium paired transition
      // animation. Already a serialized EnergyHeatConversionModel (or undefined).
      energyHeatConversion: player.energyHeatConversion,
      // Self-only + transient: which adjacent oceans just paid this player's
      // placement bonus (and how much each), for the premium per-ocean coin
      // payout. Already a serialized OceanAdjacencyBonusModel (or undefined).
      lastOceanBonus: player.lastOceanBonus,
      // Self-only + transient: the start-of-game corporation setup (starting
      // bonuses + card payment) for the premium start-flow reveal stages.
      // Already a serialized StartingSetupModel (or undefined).
      startingSetup: player.startingSetup,
      // Self-only + transient: the atomic reward manifest of this player's
      // most recent colony trade (income at the pre-reset track position,
      // per-cube colony bonuses + recipients, pre/post track positions).
      // Persists until the next trade overwrites it — the client
      // de-duplicates by tradeId and only plays a trade it armed itself.
      colonyTradeManifest: player.colonyTradeManifest,
      // The LIVE claim/fund prices, straight off the engine methods the action
      // itself charges with — never the raw constants (Van Allen / Nirgal make
      // them free, Staged Protests adds 8, the award price climbs with each
      // funding). The console's Milestones/Awards workspace shows this number
      // and submits against it.
      maCosts: {
        milestone: player.milestoneCost(),
        award: player.awardFundingCost(),
      },
    };
    return rv;
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

  /** How many recent turn scripts ride the model (the client archives them). */
  private static readonly MODEL_TURN_HISTORY = 8;

  /** The bot's corporation as open information: identity reference, card
   *  resources and the public statistic counters. */
  private static getAutomaCorpModel(game: IGame, automa: AutomaState): MarsBotCorpModel {
    if (automa.corporation === undefined) {
      throw new Error('MarsBot has no corporation');
    }
    const info = marsBotCorpInfo(automa.corporation);
    const resource = automa.corpResourceKind ?? info.resource;
    return {
      id: info.id,
      original: info.original,
      startingTags: info.startingTags,
      // The kind currently on the card: C43's slot takes either cube colour,
      // and the face has to draw the one that is actually waiting there.
      ...(resource !== undefined ? {resource} : {}),
      resources: automa.corpResources,
      cubes: AutomaCorporations.cubeModels(game),
      whiteMarkerTracks: AutomaCorporations.whiteMarkerTrackIndexes(game),
      stats: {...automa.corpStats},
    };
  }

  /**
   * The public MarsBot state: tracks with regression markers, deck COUNTS
   * (contents/order stay hidden — face-down decks), the open discards, the
   * played pile, floaters and the shipping storage. Everything mirrors the
   * physically-open information of the tabletop game.
   */
  private static getAutomaModel(game: IGame): MarsBotModel | undefined {
    const automa = game.automa;
    if (automa === undefined) {
      return undefined;
    }
    const model: MarsBotModel = {
      difficulty: automa.difficulty,
      ...(automa.corporation !== undefined ? {corporation: Server.getAutomaCorpModel(game, automa)} : {}),
      tracks: automa.board.tracks.map((t) => ({
        tags: t.definition.tags,
        position: t.position,
        maxPosition: t.maxPosition,
        layout: t.definition.layout,
        regressed: Array.from(t.regressedPositions),
      })),
      actionDeckSize: automa.actionDeck.length,
      bonusDeckSize: automa.bonusDeck.length,
      bonusDiscard: [...automa.bonusDiscard],
      recurringBonusCards: [...automa.recurringBonusCards],
      destroyedBonusCards: [...automa.destroyedBonusCards],
      playedPile: [...automa.playedPile],
      floaters: automa.floaters,
    };
    if (automa.revealedCard !== undefined) {
      model.revealedCard = automa.revealedCard;
    }
    if (automa.lastTurn !== undefined) {
      model.lastTurn = automa.lastTurn;
    }
    if (automa.turnHistory.length > 0) {
      // A bounded tail keeps the payload small; the client archives what it sees.
      model.turnHistory = automa.turnHistory.slice(-Server.MODEL_TURN_HISTORY);
    }
    if (game.gameOptions.coloniesExtension) {
      model.shippingStorage = {...automa.shippingStorage};
      model.secondFleetUnlocked = automa.secondFleetUnlocked;
    }
    if (automa.instantWin) {
      model.instantWin = true;
    }
    if (game.gameOptions.deltaProjectExpansion) {
      model.deltaPower = {
        available: AutomaDeltaProject.availablePower(game),
        consumed: automa.deltaPowerConsumed,
      };
    }
    return model;
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
        scores = game.players.map((player) => {
          // MarsBot meets milestones via the board reference card (tracks,
          // tiles, TR) — its displayed progress uses the automa evaluation.
          if (player.isMarsBot) {
            return {
              color: player.color,
              score: AutomaMAEvaluation.botMilestoneScore(milestone, game),
              claimable: AutomaMAEvaluation.botMilestoneMet(milestone, game),
            };
          }
          return {
            color: player.color,
            score: milestone.getScore(player),
            claimable: milestone.canClaim(player),
          };
        });
      }

      // Per-game threshold + description. Most milestones return their static
      // values; a few (Terraformer) implement getThreshold/getDescription to
      // pick a different number based on expansion state (e.g. Turmoil).
      // The threshold comes from the SHARED helper because MarsBot's score is
      // normalized onto this very number — the two must never disagree.
      const threshold = milestoneThreshold(milestone, game);
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
    // Bonus-action marker — a card-granted action outside the normal turn
    // structure (Head Start). Always the TOP-LEVEL prompt (it IS the action
    // menu), so central decoration is the right home.
    if (waitingFor.bonusActionPrompt !== undefined) {
      model.bonusActionPrompt = waitingFor.bonusActionPrompt;
    }
    // Award-funding marker — routes the prompt to the modern AwardsOverlay.
    if (waitingFor.awardFundingPrompt !== undefined) {
      model.awardFundingPrompt = waitingFor.awardFundingPrompt;
    }
    // Contextual-choice marker — routes the prompt to the premium
    // ContextualChoiceContent modal (source card + trigger + rich options).
    if (waitingFor.deltaBonusPrompt !== undefined) {
      model.deltaBonusPrompt = waitingFor.deltaBonusPrompt;
    }
    if (waitingFor.choiceContext !== undefined) {
      model.choiceContext = waitingFor.choiceContext;
    }
    // The COPIED-ACTION source. Central decoration is right here — unlike the
    // placement/discard markers, this one is stamped by `setWaitingFor` on the
    // TOP-LEVEL input itself (that is the funnel it rides), so nesting cannot
    // lose it.
    if (waitingFor.copiedActionSource !== undefined) {
      model.copiedActionSource = waitingFor.copiedActionSource;
    }
    // NOTE: the PLACEMENT marker (`placementContext`) is deliberately NOT
    // decorated here either — same reason as the discard marker below: a
    // placement is routinely NESTED (convert plants, a task's own space
    // option). It rides `SelectSpace.toModel()` instead, so it survives any
    // nesting depth.
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
    // The FINAL GREENERY beat — routes to the console's finale screen, where
    // the "stop" branch is destructive and two-step instead of a calm row.
    if (waitingFor.finalGreeneryPrompt !== undefined) {
      model.finalGreeneryPrompt = waitingFor.finalGreeneryPrompt;
    }
    // NOTE: the DISCARD marker (`discardPrompt`) is deliberately NOT decorated
    // here. This function only touches the TOP-LEVEL prompt, and a discard is
    // routinely NESTED (Mars University's "discard a card to draw a card" is one
    // branch of an OrOptions) — a central copy silently dropped it for exactly
    // those cases. It rides `SelectCard.toModel()` instead, so it survives any
    // nesting depth. See `src/server/inputs/SelectCard.ts`.
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
    // ── AVAILABILITY, in two separate senses ───────────────────────────────
    // POTENTIAL (turn-independent, self model only): what this player could do
    // if it were their window — the action wheel's green counts read this, so
    // they cannot vanish just because an opponent is acting.
    const potential = modelIsForThisPlayer ? potentialActions(player) : undefined;
    // EXECUTABLE NOW = potential AND the action window is live. The global
    // "Гидросеть" advance drives the bottom-bar ready cue + the pass warning;
    // same gate as Player.getActions(). Derived from the projection rather than
    // restating its rules, so the two can never disagree.
    const canAdvanceDelta = inActionSelection &&
      (potential !== undefined ? potential.hydroAdvance > 0 : potentialHydroAdvance(player));
    const model: PublicPlayerModel = {
      actionsTakenThisRound: player.actionsTakenThisRound,
      actionsTakenThisGame: player.actionsTakenThisGame,
      actionsThisGeneration: Array.from(player.actionsThisGeneration),
      alliedParty: player.alliedParty,
      // Public for every seat; for the viewer's own model it is the same number
      // `potentialActions.cardActions` carries (one validator, two readers).
      availableBlueCardActionCount: potential?.cardActions ?? player.getPlayableActionCards().length,
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
      isMarsBot: player.isMarsBot === true ? true : undefined,
      isWaitingForInput: player.getWaitingFor() !== undefined,
      waitingForKind: detectWaitingForKind(player.getWaitingFor()),
      // PUBLIC on purpose: an opponent taking Head Start's two immediate
      // actions must read as exactly that on every seat's chip, not as a
      // generic «prelude phase» while they act on the board.
      bonusActions: player.bonusActions > 0 ? player.bonusActions : undefined,
      bonusActionsGranted: player.bonusActions > 0 ? player.bonusActionsGranted : undefined,
      bonusActionSource: player.bonusActions > 0 ? player.bonusActionSource : undefined,
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
      potentialActions: potential,
      protectedResources: Server.getResourceProtections(player),
      protectedProduction: Server.getProductionProtections(player),
      protectedCardResources: Server.getCardResourceProtections(player),
      // actionReasons only for the viewer's OWN tableau (the self-model): the
      // Actions overlay needs the "why can't I activate" reasons only for the
      // player who can actually act; opponents' actions are view-only.
      tableau: cardsToModel(player, player.tableau.asArray(), {showResources: true, actionReasons: modelIsForThisPlayer}),
      selfReplicatingRobotsCards: Server.getSelfReplicatingRobotsTargetCards(player, modelIsForThisPlayer),
      steel: player.steel,
      steelProduction: player.production.steel,
      steelValue: player.getSteelValue(),
      canUseHeatAsMegaCredits: player.canUseHeatAsMegaCredits,
      canUseTitaniumAsMegacredits: player.canUseTitaniumAsMegacredits,
      canUsePlantsAsMegacredits: player.canUsePlantsAsMegacredits,
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

    // The MarsBot's score is OPEN INFORMATION by the Automa rules: every
    // input to it (tracks, tiles, M€ supply, played pile, difficulty) is on
    // the physical table, so hiding the derived number protects nothing —
    // it only made the live Information workspace show a fake 0 next to the
    // bot's real TR. Humans keep the ordinary hidden-VP contract.
    if (game.phase === Phase.END || game.isSoloMode() ||
        game.gameOptions.showOtherPlayersVP === true || modelIsForThisPlayer ||
        player.isMarsBot === true) {
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

  /**
   * Protection of the resources stored ON the player's cards, by type. The
   * one blanket source is Protected Habitats, and the rule it encodes is the
   * target FILTER in `RemoveResourcesFromCard.getAvailableTargetCards`: an
   * opponent may not take animals or microbes from a player who holds it.
   *
   * Per-CARD printed protection (Pets, Bioengineering Enclosure) deliberately
   * stays on the card (`CardModel.protectedResources`) — it shields ONE
   * card's stock, so folding it in here would claim a whole resource type is
   * safe when only part of it is.
   */
  private static getCardResourceProtections(player: IPlayer): Partial<Record<CardResource, Protection>> {
    const protection: Partial<Record<CardResource, Protection>> = {};
    if (player.tableau.has(CardName.PROTECTED_HABITATS)) {
      protection[CardResource.ANIMAL] = 'on';
      protection[CardResource.MICROBE] = 'on';
    }
    return protection;
  }

  /**
   * Production protection AGAINST OPPONENTS — the scope every printed card
   * states («Opponents may not remove your…»). The engine applies exactly
   * this scope (`Player.canHaveProductionReduced` skips both protections when
   * the attacker is the owner), so the rail's shield and the rule agree.
   */
  private static getProductionProtections(player: IPlayer) {
    const opponentProtection = player.tableau.has(CardName.PRIVATE_SECURITY) ? 'on' : 'off';
    const protection: Record<Resource, Protection> = {
      megacredits: opponentProtection,
      steel: opponentProtection,
      titanium: opponentProtection,
      plants: opponentProtection,
      energy: opponentProtection,
      heat: opponentProtection,
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
