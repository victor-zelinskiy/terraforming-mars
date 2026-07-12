import * as constants from '../common/constants';
import {getAutomaMaxGeneration} from '../common/automa/AutomaTypes';
import {AutomaController} from './automa/AutomaController';
import {BotTurnScheduler} from './automa/BotTurnScheduler';
import {failedAction as automaFailedAction} from './automa/AutomaFailedAction';
import {AutomaGameEnd} from './automa/AutomaGameEnd';
import {AutomaResearch} from './automa/AutomaResearch';
import {AutomaSetup} from './automa/AutomaSetup';
import {marsBotOf} from './automa/AutomaUtil';
import {AutomaState} from './automa/AutomaState';
import {AutomaTilePlacer} from './automa/AutomaTilePlacer';
import {BeginnerCorporation} from './cards/corporation/BeginnerCorporation';
import {Board} from './boards/Board';
import {CardName} from '../common/cards/CardName';
import {ClaimedMilestone, serializeClaimedMilestones, deserializeClaimedMilestones} from './milestones/ClaimedMilestone';
import {ColonyDealer} from './colonies/ColonyDealer';
import {IColony} from './colonies/IColony';
import {Color} from '../common/Color';
import {ICorporationCard, isICorporationCard} from './cards/corporation/ICorporationCard';
import {Database} from './database/Database';
import {FundedAward, serializeFundedAwards, deserializeFundedAwards} from './awards/FundedAward';
import {IAward} from './awards/IAward';
import {IMilestone} from './milestones/IMilestone';
import {Space} from './boards/Space';
import {Tile} from './Tile';
import {LogMessageBuilder} from './logs/LogMessageBuilder';
import {LogHelper} from './LogHelper';
import {LogMessage} from '../common/logs/LogMessage';
import {RevealLogMeta} from '../common/logs/RevealLogMeta';
import {EventRecorder} from './events/EventRecorder';
import {milestoneManifest} from './milestones/Milestones';
import {awardManifest} from './awards/Awards';
import {PartyHooks} from './turmoil/parties/PartyHooks';
import {Phase} from '../common/Phase';
import {IPlayer} from './IPlayer';
import {Player} from './Player';
import {PlayerId, GameId, SpectatorId, SpaceId} from '../common/Types';
import {PlayerInput} from './PlayerInput';
import {CardResource} from '../common/CardResource';
import {Resource} from '../common/Resource';
import {AndThen, DeferredAction, SimpleDeferredAction} from './deferredActions/DeferredAction';
import {Priority} from './deferredActions/Priority';
import {DeferredActionsQueue} from './deferredActions/DeferredActionsQueue';
import {SelectPaymentDeferred} from './deferredActions/SelectPaymentDeferred';
import {SelectInitialCards} from './inputs/SelectInitialCards';
import {PlaceOceanTile} from './deferredActions/PlaceOceanTile';
import {RemoveColonyFromGame} from './deferredActions/RemoveColonyFromGame';
import {GainResourcesDeferred} from './deferredActions/GainResourcesDeferred';
import {SerializedGame} from './SerializedGame';
import {SpaceBonus} from '../common/boards/SpaceBonus';
import {TileType} from '../common/TileType';
import {Turmoil} from './turmoil/Turmoil';
import {RandomMAOptionType} from '../common/ma/RandomMAOptionType';
import {AresHandler} from './ares/AresHandler';
import {AresData} from '../common/ares/AresData';
import {GameSetup, normalizeBoardName} from './GameSetup';
import {GameCards} from './GameCards';
import {GlobalParameter} from '../common/GlobalParameter';
import {AresSetup} from './ares/AresSetup';
import {MoonData} from './moon/MoonData';
import {MoonExpansion} from './moon/MoonExpansion';
import {TurmoilHandler} from './turmoil/TurmoilHandler';
import {SeededRandom, UnseededRandom} from '../common/utils/Random';
import {chooseMilestonesAndAwards} from './ma/MilestoneAwardSelector';
import {BoardType} from './boards/BoardType';
import {MultiSet} from 'mnemonist';
import {GrantVenusAltTrackBonusDeferred} from './venusNext/GrantVenusAltTrackBonusDeferred';
import {PathfindersExpansion} from './pathfinders/PathfindersExpansion';
import {PathfindersData} from './pathfinders/PathfindersData';
import {AddResourcesToCard} from './deferredActions/AddResourcesToCard';
import {ColonyDeserializer} from './colonies/ColonyDeserializer';
import {GameLoader} from './database/GameLoader';
import {DEFAULT_GAME_OPTIONS, GameOptions} from './game/GameOptions';
import {CorporationDeck, PreludeDeck, ProjectDeck, CeoDeck} from './cards/Deck';
import {Logger} from './logs/Logger';
import {addDays, stringToNumber} from './database/utils';
import {Tag} from '../common/cards/Tag';
import {IGame, Score} from './IGame';
import {MarsBoard} from './boards/MarsBoard';
import {UnderworldData} from './underworld/UnderworldData';
import {UnderworldExpansion} from './underworld/UnderworldExpansion';
import {SendDelegateToArea} from './deferredActions/SendDelegateToArea';
import {BuildColony} from './deferredActions/BuildColony';
import {newInitialDraft, newPreludeDraft, newCEOsDraft, newStandardDraft} from './Draft';
import {newAutomaDraft} from './automa/AutomaDraft';
import {partition, sum, toID, toName} from '../common/utils/utils';
import {OrOptions} from './inputs/OrOptions';
import {SelectOption} from './inputs/SelectOption';
import {createMarsSelectSpace} from './boards/marsSelectSpaceHelper';
import {maybeRenamedMilestone} from '../common/ma/MilestoneName';
import {maybeRenamedAward} from '../common/ma/AwardName';
import {AresHazards} from './ares/AresHazards';
import {hazardSeverity} from '../common/AresTileType';
import {IStandardProjectCard} from './cards/IStandardProjectCard';
import {BoardName} from '../common/boards/BoardName';
import {SpaceType} from '../common/boards/SpaceType';
import {ICard} from './cards/ICard';
import {generateGameName} from './GameName';

// Can be overridden by tests
let createGameLog: () => Array<LogMessage> = () => [];

export function setGameLog(f: () => Array<LogMessage>) {
  createGameLog = f;
}

export class Game implements IGame, Logger {
  public readonly id: GameId;
  public readonly name: string;
  public readonly gameOptions: Readonly<GameOptions>;
  public readonly players: ReadonlyArray<IPlayer>;
  // The API makes this readonly.
  public playersInGenerationOrder: ReadonlyArray<IPlayer> = [];

  // Game-level data
  public lastSaveId: number = 0;
  private clonedGamedId: string | undefined;
  public rng: SeededRandom;
  public spectatorId: SpectatorId;
  public deferredActions: DeferredActionsQueue = new DeferredActionsQueue();
  public createdTime: Date = new Date(0);
  public gameAge: number = 0; // Each log event increases it
  public gameLog: Array<LogMessage> = createGameLog();
  // Structured analytics event stream (alongside the text gameLog). See
  // LOGGING_EVENT_MODEL_PROPOSAL.md. Reads generation/phase lazily, so this
  // field initializer running before those is safe.
  public events: EventRecorder = new EventRecorder(this);
  public undoCount: number = 0; // Each undo increases it
  public inputsThisRound = 0;
  public resettable: boolean = false;
  public globalsPerGeneration: Array<Partial<Record<GlobalParameter, number>>> = [];

  public generation: number = 1;
  public phase: Phase = Phase.RESEARCH;
  public projectDeck: ProjectDeck;
  public preludeDeck: PreludeDeck;
  public ceoDeck: CeoDeck;
  public corporationDeck: CorporationDeck;
  public board: MarsBoard;

  // Global parameters
  private oxygenLevel: number = constants.MIN_OXYGEN_LEVEL;
  private temperature: number = constants.MIN_TEMPERATURE;
  private venusScaleLevel: number = constants.MIN_VENUS_SCALE;
  // Who claimed each global-parameter SCALE bonus (the premium reward zones on
  // the Venus/Oxygen/Temperature tracks). Keyed `<scale>-<step>` (e.g. `venus-8`,
  // `temperature--24`); value is the player's colour, or 'neutral' when the
  // bonus was passed during World Government terraforming (claimed by no one).
  // Public, additive — surfaced to every client so the claim shows for all.
  public scaleBonusClaims: Map<string, Color> = new Map();

  // Player data
  public activePlayer: IPlayer;
  /** Players that are done with the game after final greenery placement. */
  private donePlayers = new Set<PlayerId>();
  private passedPlayers = new Set<PlayerId>();
  private researchedPlayers = new Set<PlayerId>();
  /** The first player of this generation. */
  public first: IPlayer;

  // Drafting
  public draftRound: number = 1;
  public initialDraftIteration: number = 1;

  // Milestones and awards
  public claimedMilestones: Array<ClaimedMilestone> = [];
  public milestones: Array<IMilestone> = [];
  public fundedAwards: Array<FundedAward> = [];
  public awards: Array<IAward> = [];

  // Expansion-specific data
  public colonies: Array<IColony> = [];
  public discardedColonies: Array<IColony> = []; // Not serialized
  public turmoil: Turmoil | undefined;
  public aresData: AresData | undefined;
  public moonData: MoonData | undefined;
  public pathfindersData: PathfindersData | undefined;
  public underworldData: UnderworldData = UnderworldExpansion.initializeGameWithoutUnderworld();
  public inTurmoil: boolean = false;
  /** MarsBot (official Automa) runtime state. Undefined ⇒ ordinary game. */
  public automa: AutomaState | undefined;

  // Card-specific data
  // Mons Insurance promo corp
  public monsInsuranceOwner: IPlayer | undefined; // Not serialized
  // Crash Site promo project
  public someoneHasRemovedOtherPlayersPlants: boolean = false;
  // Syndicate Pirate Raids
  public syndicatePirateRaider?: PlayerId;
  // Gagarin Mobile Base
  public gagarinBase: Array<SpaceId> = [];
  // St. Joseph of Cupertino Mission
  stJosephCathedrals: Array<SpaceId> = [];
  // Mars Nomads
  nomadSpace: SpaceId | undefined = undefined;
  // Trade Embargo
  public tradeEmbargo: boolean = false;
  // Behold The Emperor
  public beholdTheEmperor: boolean = false;
  // Double Down
  public inDoubleDown: boolean = false;
  public doubleDownPrelude: CardName | undefined = undefined;

  // Vermin
  public verminInEffect: boolean = false;
  public exploitationOfVenusInEffect: boolean = false;

  // Whether the one-time "Mars is terraformed" announcement has been logged. Not serialized:
  // once Mars is terraformed the global parameters stay maxed, so this is never re-triggered.
  private marsIsTerraformedAnnounced: boolean = false;

  /* The set of tags available in this game. */
  public readonly tags: ReadonlyArray<Tag>;

  public underworldDraftEnabled = true;

  private constructor(
    id: GameId,
    name: string,
    players: Array<IPlayer>,
    first: IPlayer,
    activePlayer: PlayerId,
    spectatorId: SpectatorId,
    gameOptions: GameOptions,
    rng: SeededRandom,
    board: MarsBoard,
    projectDeck: ProjectDeck,
    corporationDeck: CorporationDeck,
    preludeDeck: PreludeDeck,
    ceoDeck: CeoDeck,
    tags: ReadonlyArray<Tag>) {
    this.id = id;
    this.name = name;
    this.gameOptions = {...gameOptions};
    this.players = players;
    const playerIds = players.map(toID);
    if (playerIds.includes(first.id) === false) {
      throw new Error('Cannot find first player ' + first.id + ' in [' + playerIds + ']');
    }
    if (playerIds.includes(activePlayer) === false) {
      throw new Error('Cannot find active player ' + activePlayer + ' in [' + playerIds + ']');
    }
    if (new Set(playerIds).size !== players.length) {
      throw new Error('Duplicate player found: [' + playerIds + ']');
    }
    const colors = players.map((p) => p.color);
    if (new Set(colors).size !== players.length) {
      throw new Error('Duplicate color found: [' + colors + ']');
    }

    this.activePlayer = this.getPlayerById(activePlayer);
    this.first = first; // To satisfy the constructor.
    this.setFirstPlayer(first);
    this.spectatorId = spectatorId;
    this.rng = rng;
    this.projectDeck = projectDeck;
    this.corporationDeck = corporationDeck;
    this.preludeDeck = preludeDeck;
    this.ceoDeck = ceoDeck;
    this.board = board;

    this.players.forEach((player) => {
      player.setup(this);
      if (player.tableau.has(CardName.MONS_INSURANCE)) {
        this.monsInsuranceOwner = player;
      }
    });

    this.tags = tags;
  }

  private setFirstPlayer(first: IPlayer) {
    if (!this.isSoloMode()) {
      this.log('First player this generation is ${0}', (b) => b.player(first));
    }
    this.first = first;
    const e = [...this.players, ...this.players];
    const idx = e.findIndex((p) => p.id === this.first.id);
    this.playersInGenerationOrder = e.slice(idx, idx + this.players.length);
  }

  public static newInstance(id: GameId,
    players: Array<IPlayer>,
    firstPlayer: IPlayer,
    spectatorId: SpectatorId,
    partialOptions: Partial<GameOptions> = {},
    seed = 0): Game {
    if (partialOptions.expansions === undefined) {
      partialOptions.expansions = {
        corpera: partialOptions.corporateEra ?? false,
        venus: partialOptions.venusNextExtension ?? false,
        colonies: partialOptions.coloniesExtension ?? false,
        prelude: partialOptions.preludeExtension ?? false,
        prelude2: partialOptions.prelude2Expansion ?? false,
        turmoil: partialOptions.turmoilExtension ?? false,
        promo: partialOptions.promoCardsOption ?? false,
        community: partialOptions.communityCardsOption ?? false,
        ares: partialOptions.aresExtension ?? false,
        moon: partialOptions.moonExpansion ?? false,
        pathfinders: partialOptions.pathfindersExpansion ?? false,
        ceo: partialOptions.ceoExtension ?? false,
        starwars: partialOptions.starWarsExpansion ?? false,
        underworld: partialOptions.underworldExpansion ?? false,
        deltaProject: partialOptions.deltaProjectExpansion ?? false,
      };
    }
    const gameOptions = {...DEFAULT_GAME_OPTIONS, ...partialOptions};
    if (gameOptions.testMode) {
      gameOptions.startingCorporations = constants.TEST_MODE_CORPORATION_CARDS_DEALT_PER_PLAYER;
      gameOptions.startingPreludes = constants.TEST_MODE_PRELUDE_CARDS_DEALT_PER_PLAYER;
    }

    if (gameOptions.clonedGamedId !== undefined) {
      throw new Error('Cloning should not come through this execution path.');
    }
    if (gameOptions.customPreludes !== undefined && gameOptions.customPreludes.includes(CardName.DELTA_PROJECT)) {
      throw new Error('Delta Project cannot be included in custom preludes. It is a global subsystem available to all players, not a prelude card.');
    }
    if (gameOptions.bannedCards !== undefined && gameOptions.bannedCards.includes(CardName.DELTA_PROJECT)) {
      throw new Error('Delta Project cannot be banned. It is a global subsystem available to all players, not a prelude card.');
    }

    // Solo vs MarsBot (official Automa): reject unsupported modules loudly and
    // seat the bot as a REAL second player — every two-player rule (turn order,
    // first-player rotation, game end without a Venus requirement, no neutral
    // solo tiles) then applies for free.
    if (gameOptions.automa !== undefined) {
      // The start-of-game DRAFT variants DEGENERATE with a single human: there
      // is nobody to pass cards to, and MarsBot never joins the human's
      // starting picks (the official Automa setup deals the standard 2 corps /
      // 4 preludes / 10 project cards; the bot gets its prelude compensation
      // as extra action-deck cards instead). Normalize them off rather than
      // rejecting — the human's setup is identical either way, and the fork's
      // default create template ships with the prelude draft enabled.
      gameOptions.initialDraftVariant = false;
      gameOptions.preludeDraftVariant = false;
      gameOptions.ceosDraftVariant = false;
      AutomaSetup.validateOptions(gameOptions);
      if (players.length === 1 && !players[0].isMarsBot) {
        players = [...players, AutomaSetup.createBotPlayer(id, players.map((p) => p.color))];
      }
      if (players.length !== 2 || players.filter((p) => p.isMarsBot).length !== 1) {
        throw new Error('An automa game is exactly one human player against MarsBot');
      }
      if (firstPlayer.isMarsBot) {
        throw new Error('The human player is the starting player of an automa game');
      }
    }

    const rng = new SeededRandom(seed);
    const board = GameSetup.newBoard(gameOptions, rng);
    const gameCards = new GameCards(gameOptions);

    const projectDeck = new ProjectDeck(gameCards.getProjectCards(), [], rng);
    projectDeck.shuffle();

    const corporationDeck = new CorporationDeck(gameCards.getCorporationCards(), [], rng);
    corporationDeck.shuffle(gameOptions.customCorporationsList);

    const preludeDeck = new PreludeDeck(gameCards.getPreludeCards(), [], rng);
    preludeDeck.shuffle(gameOptions.customPreludes);

    const ceoDeck = new CeoDeck(gameCards.getCeoCards(), [], rng);
    ceoDeck.shuffle(gameOptions.customCeos);

    const activePlayer = firstPlayer.id;

    const tags = new Set<Tag>();
    for (const deck of [projectDeck, corporationDeck, preludeDeck, ceoDeck]) {
      for (const card of deck.drawPile) {
        for (const tag of card.tags) {
          tags.add(tag);
        }
      }
    }

    if (players.length === 1) {
      gameOptions.draftVariant = false;
      gameOptions.initialDraftVariant = false;
      gameOptions.preludeDraftVariant = false;
      gameOptions.randomMA = RandomMAOptionType.NONE;

      // Single player game player starts with 14TR
      players[0].setTerraformRating(14);
    }

    const name = generateGameName(UnseededRandom.INSTANCE);
    const game = new Game(id, name, players, firstPlayer, activePlayer, spectatorId, gameOptions, rng, board, projectDeck, corporationDeck, preludeDeck, ceoDeck, Array.from(tags));
    // This evaluation of created time doesn't match what's stored in the database, but that's fine.
    game.createdTime = new Date();
    // Initialize Ares data
    if (gameOptions.aresExtension) {
      game.aresData = AresSetup.initialData(gameOptions.aresHazards, players);
    }

    const hasVolcanicSpaces = board.spaces.some((space) => space.volcanic === true);
    const {milestones, awards} = chooseMilestonesAndAwards(gameOptions, {hasVolcanicSpaces});
    game.milestones = milestones.map(milestoneManifest.createOrThrow);
    game.awards = awards.map(awardManifest.createOrThrow);

    // Add colonies stuff
    if (gameOptions.coloniesExtension) {
      const colonyDealer = new ColonyDealer(rng, gameOptions);
      colonyDealer.drawColonies(players.length);
      game.colonies = colonyDealer.colonies;
      game.discardedColonies = colonyDealer.discardedColonies;
    }

    // Add Turmoil stuff
    if (gameOptions.turmoilExtension) {
      game.turmoil = Turmoil.newInstance(game, gameOptions.politicalAgendasExtension);
    }

    // Must configure this before solo placement.
    if (gameOptions.underworldExpansion) {
      game.underworldData = UnderworldExpansion.initialize(rng);
    }

    // and 2 neutral cities and forests on board
    if (players.length === 1) {
      //  Setup solo player's starting tiles
      GameSetup.setupNeutralPlayer(game);
    }

    // Setup Ares hazards
    if (gameOptions.aresExtension && gameOptions.aresHazards) {
      AresSetup.setupHazards(game);
    }

    if (gameOptions.moonExpansion) {
      game.moonData = MoonExpansion.initialize(gameOptions, rng);
    }

    if (gameOptions.pathfindersExpansion) {
      game.pathfindersData = PathfindersExpansion.initialize(game);
    }

    if (game.gameOptions.deltaProjectExpansion) {
      // The Delta Project ("Гидросеть") is a global engineering subsystem, not a
      // prelude card: every player participates in the shared track from the
      // start and advances via the standard "Advance on the Delta Project track"
      // action (see Player.getActions). No card is dealt or played.
      for (const player of game.players) {
        player.deltaProjectData = {position: 0, jovianBonus: false, usedThisGeneration: false, stops: []};
      }
    }

    // Failsafe for exceeding corporation pool
    // (I do not think this is necessary any further given how corporation cards are stored now)
    // MarsBot never receives corporation cards, so only humans count here.
    const minCorpsRequired = players.filter((p) => !p.isMarsBot).length * gameOptions.startingCorporations;
    if (!gameOptions.testMode && minCorpsRequired > corporationDeck.drawPile.length) {
      gameOptions.startingCorporations = 2;
    }

    // Initialize each player:
    // Give them their corporation cards, other cards, starting production,
    // handicaps.
    for (const player of game.playersInGenerationOrder) {
      // MarsBot has no corporation, hand, preludes or production — its whole
      // setup (bonus deck + action deck) happens in AutomaSetup.setup below,
      // AFTER the human got their cards (the official setup order).
      if (player.isMarsBot) {
        continue;
      }
      player.setTerraformRating(player.terraformRating + player.handicap);
      if (!gameOptions.corporateEra) {
        player.production.override({
          megacredits: 1,
          steel: 1,
          titanium: 1,
          plants: 1,
          energy: 1,
          heat: 1,
        });
      }

      if (!player.beginner ||
        // Bypass beginner choice if any extension is choosen
        gameOptions.ceoExtension ||
        gameOptions.preludeExtension ||
        gameOptions.prelude2Expansion ||
        gameOptions.venusNextExtension ||
        gameOptions.coloniesExtension ||
        gameOptions.turmoilExtension ||
        gameOptions.initialDraftVariant ||
        gameOptions.preludeDraftVariant ||
        gameOptions.underworldExpansion ||
        gameOptions.moonExpansion) {
        player.dealtCorporationCards.push(...corporationDeck.drawN(game, gameOptions.startingCorporations));
        if (gameOptions.initialDraftVariant === false) {
          const projectCardsToDeal = gameOptions.testMode ? constants.TEST_MODE_PROJECT_CARDS_DEALT_PER_PLAYER : 10;
          player.dealtProjectCards.push(...projectDeck.drawN(game, projectCardsToDeal));
        }
        if (gameOptions.preludeExtension) {
          gameOptions.startingPreludes = Math.max(gameOptions.startingPreludes ?? 0, constants.PRELUDE_CARDS_DEALT_PER_PLAYER);
          player.dealtPreludeCards.push(...preludeDeck.drawN(game, gameOptions.startingPreludes));
        }
        if (gameOptions.ceoExtension) {
          gameOptions.startingCeos = Math.max(gameOptions.startingCeos ?? 0, constants.CEO_CARDS_DEALT_PER_PLAYER);
          player.dealtCeoCards.push(...ceoDeck.drawN(game, gameOptions.startingCeos));
        }
      } else {
        game.playerHasPickedCorporationCard(player, new BeginnerCorporation());
      }
    }

    // MarsBot's decks are built AFTER the human's cards are dealt (official order:
    // you get your starting hand, then MarsBot gets its action deck).
    if (gameOptions.automa !== undefined) {
      game.automa = AutomaSetup.setup(game);
    }

    // Print game_id if solo game
    if (players.length === 1) {
      game.log('The id of this game is ${0}', (b) => b.rawString(id));
    }

    players.forEach((player) => {
      if (player.isMarsBot) {
        return;
      }
      game.log('Good luck ${0}!', (b) => b.player(player), {reservedFor: player});
    });

    game.log('Generation ${0}', (b) => b.forNewGeneration().number(game.generation));

    game.gotoInitialPhase();

    return game;
  }

  /** Properly starts the game with the project draft, or initial research phase. */
  private gotoInitialPhase(): void {
    // Initial Draft
    if (this.gameOptions.initialDraftVariant) {
      this.phase = Phase.INITIALDRAFTING;
      newInitialDraft(this).startDraft();
    } else {
      this.gotoInitialResearchPhase();
    }
  }

  public save(): void {
    GameLoader.getInstance().saveGame(this);
  }

  public notifyStateChange(): void {
    GameLoader.getInstance().notifyGameStateChanged(this);
  }

  public serialize(): SerializedGame {
    const result: SerializedGame = {
      activePlayer: this.activePlayer.id,
      awards: this.awards.map(toName),
      beholdTheEmperor: this.beholdTheEmperor,
      board: this.board.serialize(),
      claimedMilestones: serializeClaimedMilestones(this.claimedMilestones),
      ceoDeck: this.ceoDeck.serialize(),
      colonies: this.colonies.map((colony) => colony.serialize()),
      corporationDeck: this.corporationDeck.serialize(),
      createdTimeMs: this.createdTime.getTime(),
      currentSeed: this.rng.current,
      deferredActions: [],
      donePlayers: Array.from(this.donePlayers),
      draftRound: this.draftRound,
      exploitationOfVenusInEffect: this.exploitationOfVenusInEffect,
      first: this.first.id,
      fundedAwards: serializeFundedAwards(this.fundedAwards),
      gagarinBase: this.gagarinBase,
      stJosephCathedrals: this.stJosephCathedrals,
      nomadSpace: this.nomadSpace,
      gameAge: this.gameAge,
      gameLog: this.gameLog,
      gameEvents: this.events.events,
      eventSeq: this.events.sequence,
      gameOptions: this.gameOptions,
      generation: this.generation,
      globalsPerGeneration: this.globalsPerGeneration,
      id: this.id,
      initialDraftIteration: this.initialDraftIteration,
      lastSaveId: this.lastSaveId,
      milestones: this.milestones.map(toName),
      moonData: MoonData.serialize(this.moonData),
      name: this.name,
      oxygenLevel: this.oxygenLevel,
      passedPlayers: Array.from(this.passedPlayers),
      pathfindersData: PathfindersData.serialize(this.pathfindersData),
      phase: this.phase,
      players: this.players.map((p) => p.serialize()),
      preludeDeck: this.preludeDeck.serialize(),
      projectDeck: this.projectDeck.serialize(),
      researchedPlayers: Array.from(this.researchedPlayers),
      seed: this.rng.seed,
      someoneHasRemovedOtherPlayersPlants: this.someoneHasRemovedOtherPlayersPlants,
      spectatorId: this.spectatorId,
      syndicatePirateRaider: this.syndicatePirateRaider,
      tags: this.tags,
      scaleBonusClaims: Array.from(this.scaleBonusClaims.entries()),
      temperature: this.temperature,
      tradeEmbargo: this.tradeEmbargo,
      underworldData: this.underworldData,
      undoCount: this.undoCount,
      venusScaleLevel: this.venusScaleLevel,
      verminInEffect: this.verminInEffect,
    };
    if (this.aresData !== undefined) {
      result.aresData = this.aresData;
    }
    if (this.automa !== undefined) {
      result.automa = this.automa.serialize();
    }
    if (this.clonedGamedId !== undefined) {
      result.clonedGamedId = this.clonedGamedId;
    }
    if (this.turmoil !== undefined) {
      result.turmoil = this.turmoil.serialize();
    }
    return result;
  }

  public isSoloMode() :boolean {
    return this.players.length === 1;
  }

  // Function to retrieve a player by it's id
  public getPlayerById(id: PlayerId): IPlayer {
    const player = this.players.find((p) => p.id === id);
    if (player === undefined) {
      throw new Error(`player ${id} does not exist on game ${this.id}`);
    }
    return player;
  }

  public defer<T>(action: DeferredAction<T>, priority?: Priority): AndThen<T> {
    if (priority !== undefined) {
      action.priority = priority;
    }
    this.deferredActions.push(action);
    return action;
  }

  public milestoneClaimed(milestone: IMilestone): boolean {
    return this.claimedMilestones.some(
      (claimedMilestone) => claimedMilestone.milestone.name === milestone.name,
    );
  }

  public marsIsTerraformed(): boolean {
    const oxygenMaxed = this.oxygenLevel >= constants.MAX_OXYGEN_LEVEL;
    const temperatureMaxed = this.temperature >= constants.MAX_TEMPERATURE;
    const oceansMaxed = !this.canAddOcean();
    let globalParametersMaxed = oxygenMaxed && temperatureMaxed && oceansMaxed;
    const venusMaxed = this.getVenusScaleLevel() === constants.MAX_VENUS_SCALE;

    MoonExpansion.ifMoon(this, (moonData) => {
      if (this.gameOptions.requiresMoonTrackCompletion) {
        const moonMaxed =
          moonData.habitatRate === constants.MAXIMUM_HABITAT_RATE &&
          moonData.miningRate === constants.MAXIMUM_MINING_RATE &&
          moonData.logisticRate === constants.MAXIMUM_LOGISTIC_RATE;
        globalParametersMaxed = globalParametersMaxed && moonMaxed;
      }
    });

    // Solo games with Venus needs Venus maxed to end the game.
    if (this.players.length === 1 && this.gameOptions.venusNextExtension) {
      return globalParametersMaxed && venusMaxed;
    }
    // Option "requiresVenusTrackCompletion" also makes maximizing Venus a game-end requirement
    if (this.gameOptions.venusNextExtension && this.gameOptions.requiresVenusTrackCompletion) {
      return globalParametersMaxed && venusMaxed;
    }
    return globalParametersMaxed;
  }

  // Announce, exactly once, when Mars (and any required additional tracks) becomes fully
  // terraformed. Called after every global parameter increase. The announcement fires the moment
  // the final parameter is maxed, even mid-action, rather than only at game end.
  public maybeLogMarsIsTerraformed(): void {
    if (this.marsIsTerraformedAnnounced === false && this.marsIsTerraformed()) {
      this.marsIsTerraformedAnnounced = true;
      this.log('Mars is terraformed!', (b) => b.announcement());
    }
  }

  public lastSoloGeneration(): number {
    let lastGeneration = 14;
    const options = this.gameOptions;
    if (options.preludeExtension) {
      lastGeneration -= 2;
    }

    // Only add 2 more generations when using the track completion option
    // and not the solo TR option.
    //
    // isSoloModeWin backs this up.
    if (options.moonExpansion) {
      if (!options.soloTR && options.requiresMoonTrackCompletion) {
        lastGeneration += 2;
      }
    }
    return lastGeneration;
  }

  public isSoloModeWin(): boolean {
    // Solo TR victory condition
    if (this.gameOptions.soloTR) {
      return this.players[0].terraformRating >= 63;
    }

    // Complete terraforing victory condition.
    if (!this.marsIsTerraformed()) {
      return false;
    }

    // Ares Extreme: Solo player must remove all unprotected hazards to win
    if (this.gameOptions.aresExtension && this.gameOptions.aresExtremeVariant) {
      if (this.board.getUnprotectedHazards().length > 0) {
        return false;
      }
    }

    // This last conditional doesn't make much sense to me. It's only ever really used
    // on the client at components/GameEnd.ts. Which is probably why it doesn't make
    // obvious sense why when this generation is earlier than the last generation
    // of the game means "true, is solo mode win."
    return this.generation <= this.lastSoloGeneration();
  }

  public getAwardFundingCost(): number {
    return 8 + (6 * this.fundedAwards.length);
  }

  public fundAward(player: IPlayer, award: IAward): void {
    if (this.allAwardsFunded()) {
      throw new Error('All awards already funded');
    }
    // Root the funding in an action scope so its log becomes a journal ROOT
    // event (correlationId + role 'root-action' + category 'award') — picked up
    // by the premium journal grouping AND surfaced by the notification system as
    // a distinct award card. Without this it was a bare, ungrouped log.
    this.events.beginAction(player, {kind: 'award', name: award.name}, {category: 'award'});
    try {
      this.log('${0} funded ${1} award',
        (b) => b.player(player).award(award));

      if (this.hasBeenFunded(award)) {
        throw new Error(award.name + ' cannot is already funded.');
      }
      this.fundedAwards.push({
        award: award,
        player: player,
      });
    } finally {
      this.events.endScope();
    }
  }

  public hasBeenFunded(award: IAward): boolean {
    return this.fundedAwards.some(
      (fundedAward) => fundedAward.award.name === award.name,
    );
  }

  public allAwardsFunded(): boolean {
    // Awards are disabled for 1 player games
    if (this.players.length === 1) {
      return true;
    }

    return this.fundedAwards.length >= constants.MAX_AWARDS;
  }

  public allMilestonesClaimed(): boolean {
    // Milestones are disabled for 1 player games
    if (this.players.length === 1) {
      return true;
    }

    return this.claimedMilestones.length >= constants.MAX_MILESTONES;
  }

  private playerHasPickedCorporationCard(player: IPlayer, corporationCard: ICorporationCard): void {
    // TODO(kberg): I think we can get rid of this weird validation at a later time.
    player.pickedCorporationCard = corporationCard;
    // MarsBot never picks a corporation (out of the POC scope) — waiting on it
    // here would deadlock the start of the game after the human's pick.
    if (this.players.every((p) => p.isMarsBot || p.pickedCorporationCard !== undefined)) {
      for (const somePlayer of this.playersInGenerationOrder) {
        if (somePlayer.isMarsBot) {
          continue;
        }
        if (somePlayer.pickedCorporationCard === undefined) {
          throw new Error(`pickedCorporationCard is not defined for ${somePlayer.id}`);
        }
        if (this.gameOptions.testMode) {
          this.applyTestModeStartingStock(somePlayer);
        }
        somePlayer.playCorporationCard(somePlayer.pickedCorporationCard);
        if (this.gameOptions.testMode) {
          this.applyTestModeStartingStock(somePlayer);
        }
      }
    }
  }

  private applyTestModeStartingStock(player: IPlayer): void {
    player.stock.override({
      megacredits: constants.TEST_MODE_STARTING_RESOURCE_COUNT,
      steel: constants.TEST_MODE_STARTING_RESOURCE_COUNT,
      titanium: constants.TEST_MODE_STARTING_RESOURCE_COUNT,
      plants: constants.TEST_MODE_STARTING_RESOURCE_COUNT,
      energy: constants.TEST_MODE_STARTING_RESOURCE_COUNT,
      heat: constants.TEST_MODE_STARTING_RESOURCE_COUNT,
    });
  }

  private selectInitialCards(player: IPlayer): PlayerInput {
    return new SelectInitialCards(player, (corporation: ICorporationCard) => {
      this.playerHasPickedCorporationCard(player, corporation);
      return undefined;
    });
  }

  public hasPassedThisActionPhase(player: IPlayer): boolean {
    return this.passedPlayers.has(player.id);
  }

  private setNextFirstPlayer() {
    const spaceWargamesOwner = this.getCardPlayerOrUndefined(CardName.SPACE_WARGAMES);
    if (spaceWargamesOwner) {
      const spaceWargames = spaceWargamesOwner.tableau.get(CardName.SPACE_WARGAMES);
      // This was set last generation hence the -1.
      if (spaceWargames?.generationUsed === this.generation - 1) {
        this.overrideFirstPlayer(spaceWargamesOwner);
        return;
      }
    }
    this.incrementFirstPlayer();
  }

  // Public for testing.
  public incrementFirstPlayer(): void {
    let firstIndex = this.players.map(toID).indexOf(this.first.id);
    if (firstIndex === -1) {
      throw new Error('Didn\'t find player');
    }
    firstIndex = (firstIndex + 1) % this.players.length;
    const first = this.players[firstIndex];
    this.setFirstPlayer(first);
  }

  // Only used in the prelude The New Space Race and card Space Wargames.
  public overrideFirstPlayer(newFirstPlayer: IPlayer): void {
    if (newFirstPlayer.game.id !== this.id) {
      throw new Error(`player ${newFirstPlayer.id} is not part of this game`);
    }
    this.setFirstPlayer(newFirstPlayer);
  }

  public gotoInitialResearchPhase(): void {
    this.phase = Phase.RESEARCH;

    this.save();

    for (const player of this.players) {
      if (player.pickedCorporationCard === undefined && player.dealtCorporationCards.length > 0) {
        player.setWaitingFor(this.selectInitialCards(player));
      }
    }
    // MarsBot has no setup decisions (no corporation, no starting hand) — it is
    // immediately done researching, so the human's pick alone starts the game.
    if (this.automa !== undefined) {
      this.researchedPlayers.add(marsBotOf(this).id);
    }
    if (this.players.length === 1 && this.gameOptions.coloniesExtension) {
      this.players[0].production.add(Resource.MEGACREDITS, -2);
      this.defer(new RemoveColonyFromGame(this.players[0]));
    }
  }

  public gotoResearchPhase(): void {
    this.phase = Phase.RESEARCH;
    this.researchedPlayers.clear();
    this.save();
    this.players.forEach((player) => {
      // MarsBot does not draw-4-and-buy — it builds an action deck instead (below,
      // after the human drew: the official order).
      if (player.isMarsBot) {
        return;
      }
      player.runResearchPhase();
    });
    if (this.automa !== undefined) {
      // In the draft variant AutomaDraft already built the action deck from the
      // bot's drafted cards before entering this phase.
      if (!this.gameOptions.draftVariant) {
        AutomaResearch.buildActionDeck(this);
      }
      this.researchedPlayers.add(marsBotOf(this).id);
    }
  }

  private gotoDraftPhase(): void {
    this.phase = Phase.DRAFTING;
    this.draftRound = 1;
    if (this.automa !== undefined) {
      // The official Automa research draft: MarsBot picks at random, instantly.
      newAutomaDraft(this).startDraft();
    } else {
      newStandardDraft(this).startDraft();
    }
  }

  public gameIsOver(): boolean {
    if (this.isSoloMode()) {
      // Solo games continue until the designated generation end even if Mars is already terraformed
      return this.generation === this.lastSoloGeneration();
    }
    return this.marsIsTerraformed();
  }

  public isDoneWithFinalProduction(): boolean {
    return this.phase === Phase.END || (this.gameIsOver() && this.phase === Phase.PRODUCTION);
  }

  private gotoProductionPhase(): void {
    this.phase = Phase.PRODUCTION;
    this.passedPlayers.clear();
    this.someoneHasRemovedOtherPlayersPlants = false;
    this.players.forEach((player) => {
      // "Your production is unaffected. MarsBot skips this phase." (rulebook p.5)
      if (player.isMarsBot) {
        return;
      }
      player.colonies.cardDiscount = 0; // Iapetus reset hook
      player.runProductionPhase();
    });
    this.postProductionPhase();
  }

  private postProductionPhase(): void {
    if (this.deferredActions.length > 0) {
      this.deferredActions.runAll(() => this.postProductionPhase());
      return;
    }
    if (this.gameIsOver()) {
      this.log('Final greenery placement', (b) => b.forNewGeneration());
      this.takeNextFinalGreeneryAction();
      return;
    } else {
      this.players.forEach((player) => {
        player.colonies.returnTradeFleets();
      });
    }

    // solar Phase Option
    this.phase = Phase.SOLAR;

    // Maybe spawn a new hazard on Mars every 3 generations
    if (this.gameOptions.aresExtension && this.gameOptions.aresExtremeVariant && this.generation % 3 === 0) {
      const direction = Math.floor(this.rng.nextInt(2)) === 0 ? 'top' : 'bottom';
      const tileType = this.board.getOceanSpaces().length >= 3 ? TileType.EROSION_MILD : TileType.DUST_STORM_MILD;

      try {
        const space = AresHazards.randomlyPlaceHazard(this, tileType, direction);
        this.log('${0} placed at ${1}', (b) => b.tileType(tileType).space(space));
      } catch (e) {
        // #7734, the map is probably full.
        this.log('The map is full. No random hazard can be placed this generation.');
      }
    }

    if (this.gameOptions.solarPhaseOption && ! this.marsIsTerraformed()) {
      this.gotoWorldGovernmentTerraforming();
      return;
    }
    this.gotoEndGeneration();
  }

  private endGenerationForColonies() {
    if (this.gameOptions.coloniesExtension) {
      this.colonies.forEach((colony) => {
        colony.endGeneration(this);
      });
      // Syndicate Pirate Raids hook. Also see Colony.ts and Player.ts
      this.syndicatePirateRaider = undefined;
      // Trade embargo hook.
      this.tradeEmbargo = false;
    }
  }

  private gotoEndGeneration() {
    if (this.deferredActions.length > 0) {
      this.deferredActions.runAll(() => this.gotoEndGeneration());
      return;
    }

    this.endGenerationForColonies();
    UnderworldExpansion.endGeneration(this);

    Turmoil.ifTurmoil(this, (turmoil) => {
      // this.phase = Phase.TURMOIL;
      this.inTurmoil = true;
      turmoil.endGeneration(this);
      // Behold The Emperor hook
      this.beholdTheEmperor = false;
    });

    // turmoil.endGeneration might have added actions.
    if (this.deferredActions.length > 0) {
      this.deferredActions.runAll(() => this.startGeneration());
    } else {
      this.inTurmoil = false;
      this.startGeneration();
    }
  }

  private updatePlayerVPForTheGeneration(): void {
    this.players.forEach((player) => {
      player.victoryPointsByGeneration.push(player.getVictoryPoints().total);
    });
  }

  private updateGlobalsForTheGeneration(): void {
    if (!Array.isArray(this.globalsPerGeneration)) {
      this.globalsPerGeneration = [];
    }
    this.globalsPerGeneration.push({});
    const entry = this.globalsPerGeneration[this.globalsPerGeneration.length - 1];
    entry[GlobalParameter.TEMPERATURE] = this.temperature;
    entry[GlobalParameter.OXYGEN] = this.oxygenLevel;
    entry[GlobalParameter.OCEANS] = this.board.getOceanSpaces().length;
    if (this.gameOptions.venusNextExtension) {
      entry[GlobalParameter.VENUS] = this.venusScaleLevel;
    }
    MoonExpansion.ifMoon(this, (moonData) => {
      entry[GlobalParameter.MOON_HABITAT_RATE] = moonData.habitatRate;
      entry[GlobalParameter.MOON_MINING_RATE] = moonData.miningRate;
      entry[GlobalParameter.MOON_LOGISTIC_RATE] = moonData.logisticRate;
    });
  }

  private startGeneration() {
    this.phase = Phase.INTERGENERATION;
    this.updatePlayerVPForTheGeneration();
    this.updateGlobalsForTheGeneration();

    this.generation++;

    // "If the game enters round 20 (18 with Prelude), you instantly lose!"
    // (Automa rulebook p.10 / Adding Expansions p.1). Checked AFTER the
    // terraforming end (postProductionPhase) had its chance — reaching here
    // means Mars is not terraformed and the next generation would begin.
    if (this.automa !== undefined &&
        this.generation >= getAutomaMaxGeneration(this.gameOptions.preludeExtension)) {
      this.automa.instantWin = true;
      this.log('${0} instantly wins — the game entered generation ${1}',
        (b) => b.player(marsBotOf(this)).number(this.generation));
      this.gotoEndGame();
      return;
    }

    this.log('Generation ${0}', (b) => b.forNewGeneration().number(this.generation));
    this.setNextFirstPlayer();

    this.players.forEach((player) => {
      player.hasIncreasedTerraformRatingThisGeneration = false;
      if (player.tableau.has(CardName.PRESERVATION_PROGRAM)) {
        player.preservationProgram = true;
      }
    });

    if (this.gameOptions.draftVariant) {
      this.gotoDraftPhase();
    } else {
      this.gotoResearchPhase();
    }
  }

  private gotoWorldGovernmentTerraforming() {
    this.worldGovernmentTerraforming();
  }

  public worldGovernmentTerraformingInput(player: IPlayer): OrOptions {
    const orOptions = new OrOptions()
      .setTitle('Select action for World Government Terraforming')
      .setButtonLabel('Confirm');
    if (this.getTemperature() < constants.MAX_TEMPERATURE) {
      orOptions.options.push(
        new SelectOption('Increase temperature', 'Increase')
          .annotate(GlobalParameter.TEMPERATURE)
          .andThen(() => {
            this.increaseTemperature(player, 1);
            this.log('${0} acted as World Government and raised ${1}', (b) => b.player(player).globalParameter(GlobalParameter.TEMPERATURE));
            return undefined;
          }),
      );
    }
    if (this.getOxygenLevel() < constants.MAX_OXYGEN_LEVEL) {
      orOptions.options.push(
        new SelectOption('Increase oxygen', 'Increase')
          .annotate(GlobalParameter.OXYGEN)
          .andThen(() => {
            this.increaseOxygenLevel(player, 1);
            this.log('${0} acted as World Government and raised ${1}', (b) => b.player(player).globalParameter(GlobalParameter.OXYGEN));
            return undefined;
          }),
      );
    }
    if (this.canAddOcean()) {
      orOptions.options.push(
        createMarsSelectSpace(player, 'Add an ocean', this.board.getAvailableSpacesForOcean(player), {placementType: 'ocean'})
          .annotate(GlobalParameter.OCEANS)
          .andThen((space) => {
            this.addOcean(player, space);
            this.log('${0} acted as World Government and placed ${1}', (b) => b.player(player).globalParameter(GlobalParameter.OCEANS));
            return undefined;
          }),
      );
    }
    if (this.getVenusScaleLevel() < constants.MAX_VENUS_SCALE && this.gameOptions.venusNextExtension) {
      orOptions.options.push(
        new SelectOption('Increase Venus scale', 'Increase').andThen(() => {
          this.increaseVenusScaleLevel(player, 1);
          this.log('${0} acted as World Government and raised ${1}', (b) => b.player(player).globalParameter(GlobalParameter.VENUS));
          return undefined;
        }),
      );
    }

    if (this.gameOptions.aresExtension && this.gameOptions.aresExtremeVariant && this.isSoloMode()) {
      const unprotectedHazardSpaces = this.board.getUnprotectedHazards();

      if (unprotectedHazardSpaces.length > 0) {
        orOptions.options.push(
          createMarsSelectSpace(
            player,
            'Remove an unprotected hazard',
            unprotectedHazardSpaces,
            {
              customReasoner: (space) => {
                // Operates on EXISTING hazard tiles. Generic 'occupied'
                // would be misleading. Three illegal-cell categories:
                //   - no hazard tile at all → 'has-hazard' reads inverse,
                //     so fall through to generic 'unavailable' (best fit).
                //   - has protected hazard → 'protected-hazard'.
                //   - has non-hazard tile → 'occupied' from generic.
                if (AresHandler.hasHazardTile(space) && space.tile?.protectedHazard === true) {
                  return 'protected-hazard';
                }
                return undefined;
              },
            }).andThen((space) => {
            space.tile = undefined;
            this.log('${0} acted as World Government and removed a hazard tile', (b) => b.player(player));
            return undefined;
          }),
        );
      }
    }

    MoonExpansion.ifMoon(this, (moonData) => {
      if (moonData.habitatRate < constants.MAXIMUM_HABITAT_RATE) {
        orOptions.options.push(
          new SelectOption('Increase the Moon habitat rate', 'Increase').andThen(() => {
            MoonExpansion.raiseHabitatRate(player, 1);
            return undefined;
          }),
        );
      }

      if (moonData.miningRate < constants.MAXIMUM_MINING_RATE) {
        orOptions.options.push(
          new SelectOption('Increase the Moon mining rate', 'Increase').andThen(() => {
            MoonExpansion.raiseMiningRate(player, 1);
            return undefined;
          }),
        );
      }

      if (moonData.logisticRate < constants.MAXIMUM_LOGISTIC_RATE) {
        orOptions.options.push(
          new SelectOption('Increase the Moon logistic rate', 'Increase').andThen(() => {
            MoonExpansion.raiseLogisticRate(player, 1);
            return undefined;
          }),
        );
      }
    });

    return orOptions;
  }

  public worldGovernmentTerraforming(): void {
    const player = this.first;
    const input = this.worldGovernmentTerraformingInput(player);
    player.setWaitingFor(input, () => {
      this.gotoEndGeneration();
    });
  }

  public temporarySolarPhase(player: IPlayer, cb: () => void): void {
    // This temporarily changes the game phase to Solar so the current player does not
    // benefit from the global parameter change.
    const savedPhase = this.phase;
    this.phase = Phase.SOLAR;
    cb();

    this.defer(new SimpleDeferredAction(player, () => {
      this.phase = savedPhase;
      return undefined;
    }), Priority.BACK_OF_THE_LINE);
  }

  private allPlayersHavePassed(): boolean {
    for (const player of this.players) {
      if (!this.hasPassedThisActionPhase(player)) {
        return false;
      }
    }
    return true;
  }

  public playerHasPassed(player: IPlayer): void {
    this.passedPlayers.add(player.id);
  }

  public hasResearched(player: IPlayer): boolean {
    return this.researchedPlayers.has(player.id);
  }

  public playerIsFinishedWithResearchPhase(player: IPlayer): void {
    this.deferredActions.runAllFor(player, () => {
      this.researchedPlayers.add(player.id);
      if (this.researchedPlayers.size === this.players.length) {
        this.researchedPlayers.clear();
        this.phase = Phase.ACTION;
        this.passedPlayers.clear();
        this.potentiallyChangeFirstPlayer();

        this.startActionsForPlayer(this.first);
      }
    });
  }

  public getPlayerBefore(player: IPlayer): IPlayer {
    const playerIndex = this.players.indexOf(player);
    if (playerIndex === -1) {
      throw new Error(`Player ${player.id} not in game ${this.id}`);
    }

    // Go to the end of the array if stand at the start
    return this.players[(playerIndex === 0) ? this.players.length - 1 : playerIndex - 1];
  }

  public getPlayerAfter(player: IPlayer): IPlayer {
    const playerIndex = this.players.indexOf(player);

    if (playerIndex === -1) {
      throw new Error(`Player ${player.id} not in game ${this.id}`);
    }

    // Go to the beginning of the array if we reached the end
    return this.players[(playerIndex + 1 >= this.players.length) ? 0 : playerIndex + 1];
  }

  public playerIsFinishedTakingActions(): void {
    if (this.deferredActions.length > 0) {
      this.deferredActions.runAll(() => this.playerIsFinishedTakingActions());
      return;
    }

    this.inputsThisRound = 0;

    // This next section can be done more simply.
    if (this.allPlayersHavePassed()) {
      this.gotoProductionPhase();
      return;
    }

    const nextPlayer = this.getPlayerAfter(this.activePlayer);
    if (!this.hasPassedThisActionPhase(nextPlayer)) {
      this.startActionsForPlayer(nextPlayer);
    } else {
      // Recursively find the next player
      this.activePlayer = nextPlayer;
      this.playerIsFinishedTakingActions();
    }
  }

  private async gotoEndGame(): Promise<void> {
    // NOTE: the upstream end-of-game "This game id was <id>" / "This game was a
    // clone from game <id>" log lines were intentionally removed — that's debug
    // identity info (the id is already in the URL) with no place in the premium
    // journal.

    const scores: Array<Score> = [];
    this.players.forEach((player) => {
      const corporation = player.playedCards.filter(isICorporationCard).map(toName).join('|');
      const vpb = player.getVictoryPoints();
      scores.push({corporation: corporation, playerScore: vpb.total});
    });

    Database.getInstance().saveGameResults(this.id, this.players.length, this.generation, this.gameOptions, scores);
    this.phase = Phase.END;
    const gameLoader = GameLoader.getInstance();
    await gameLoader.saveGame(this);
    gameLoader.completeGame(this);
  }

  // Part of final greenery placement.
  public canPlaceGreenery(player: IPlayer): boolean {
    return !this.donePlayers.has(player.id) &&
            player.plants >= player.plantsNeededForGreenery &&
            this.board.getAvailableSpacesForGreenery(player).length > 0;
  }

  // Called when a player cannot or chose not to place any more greeneries.
  public playerIsDoneWithGame(player: IPlayer): void {
    this.donePlayers.add(player.id);
    // Go back in to find someone else to play final greeneries.
    this.takeNextFinalGreeneryAction();
  }

  /**
   * Find the next player who might be able to place a final greenery and ask them.
   *
   * If nobody can add a greenery, end the game.
   */
  public /* for testing */ takeNextFinalGreeneryAction(): void {
    for (const player of this.playersInGenerationOrder) {
      if (this.donePlayers.has(player.id)) {
        continue;
      }

      // MarsBot's final greeneries come from its tracks, not plants — placed in
      // its turn-order slot, all at once, with no prompt (rulebook p.10).
      if (player.isMarsBot) {
        AutomaGameEnd.placeFinalGreeneries(this);
        this.donePlayers.add(player.id);
        continue;
      }

      // You many not place greeneries in solo mode unless you have already won the game
      // (e.g. completed global parameters, reached TR63.)
      if (this.isSoloMode() && !this.isSoloModeWin()) {
        this.log('Final greenery phase is skipped since you did not complete the win condition.', (b) => b.forNewGeneration());
        continue;
      }

      if (this.canPlaceGreenery(player)) {
        this.activePlayer = player;
        this.save();
        player.takeActionForFinalGreenery();
        return;
      } else if (player.getWaitingFor() !== undefined) {
        return;
      } else {
        this.donePlayers.add(player.id);
      }
    }
    this.updatePlayerVPForTheGeneration();
    this.updateGlobalsForTheGeneration();
    this.gotoEndGame();
  }

  private startActionsForPlayer(player: IPlayer) {
    this.activePlayer = player;
    if (player.isMarsBot) {
      // Preludes are setup, not turns: MarsBot has none (its compensation is
      // the extra action-deck cards), so when the human's prelude plays hand
      // the turn over in the PRELUDES phase, the bot passes it straight back
      // WITHOUT flipping — its first real flip answers the human's first
      // ACTION-phase turn, never the setup.
      if (this.phase === Phase.PRELUDES) {
        this.playerIsFinishedTakingActions();
        return;
      }
      // MarsBot never waits for input — its whole turn resolves server-side.
      // Server-authoritative pacing: when enabled (production), this marks the
      // turn pending, broadcasts the "bot is active" state, and schedules a
      // bounded, non-blocking deferred resolve; when disabled (tests) it
      // resolves synchronously exactly as before. Either way the game loop is
      // driven only by the server. See BotTurnScheduler.
      BotTurnScheduler.getInstance().onBotTurnDue(this);
      return;
    }
    player.actionsTakenThisGame++;
    player.actionsTakenThisRound = 0;

    player.takeAction();
  }

  /**
   * Reload recovery for a game deserialized while MarsBot is the ACTION-phase
   * active player. `IPlayer.takeAction()` is the human input flow and must never
   * run for the bot, so the deserializer routes here:
   *
   *  - a still-PENDING turn (BotTurnScheduler had made the bot active, but the
   *    bounded resolve timer died with the restart that dropped this game from
   *    memory) is resolved NOW — from scratch, so any forced human sub-prompt
   *    the turn raises is re-created correctly (nothing is lost) — instead of
   *    the game staying stuck on an unresolved bot turn;
   *  - a turn that had already resolved but was blocked on a deferred HUMAN
   *    sub-prompt its card raised (e.g. «сбросьте карту» from a colony trade) is
   *    ADVANCED past. Deferred actions are NOT serialized (`deferredActions: []`)
   *    so that prompt is lost on reload; re-resolving would double-play the
   *    already-played card, so the safe recovery is to move the game on rather
   *    than freeze. The lone cost is that one deferred prompt is skipped.
   */
  private resolveBotTurnOnLoad(): void {
    const automa = this.automa;
    if (automa === undefined) {
      return;
    }
    if (automa.pendingTurn) {
      automa.pendingTurn = false;
      AutomaController.takeTurn(this);
    } else {
      this.playerIsFinishedTakingActions();
    }
  }

  // Record who took a global-parameter scale bonus the first time its threshold
  // is crossed. The colour is the player's, or 'neutral' when it's passed during
  // World Government terraforming (SOLAR phase) and reaches no one. Logs the
  // claim so the journal + the premium scale-bonus notification surface it.
  private claimScaleBonus(player: IPlayer, scale: 'venus' | 'oxygen' | 'temperature', step: number): void {
    const key = `${scale}-${step}`;
    if (this.scaleBonusClaims.has(key)) {
      return;
    }
    const government = this.phase === Phase.SOLAR;
    this.scaleBonusClaims.set(key, government ? 'neutral' : player.color);
    if (government) {
      this.log('A ${0} scale bonus was claimed via World Government', (b) => b.string(scale));
    } else {
      this.log('${0} claimed a ${1} scale bonus', (b) => b.player(player).string(scale));
    }
  }

  // Record claims for every scale-bonus threshold an increase just crossed.
  private claimCrossedScaleBonuses(player: IPlayer, scale: 'venus' | 'oxygen' | 'temperature', from: number, to: number, steps: ReadonlyArray<number>): void {
    for (const step of steps) {
      if (from < step && to >= step) {
        this.claimScaleBonus(player, scale, step);
      }
    }
  }

  public increaseOxygenLevel(player: IPlayer, increments: -2 | -1 | 1 | 2): void {
    if (this.oxygenLevel >= constants.MAX_OXYGEN_LEVEL) {
      return undefined;
    }

    // PoliticalAgendas Reds P3 && Magnetic Field Stimulation Delays hook
    if (increments < 0) {
      this.oxygenLevel = Math.max(constants.MIN_OXYGEN_LEVEL, this.oxygenLevel + increments);
      return undefined;
    }

    // Literal typing makes |increments| a const
    const steps = Math.min(increments, constants.MAX_OXYGEN_LEVEL - this.oxygenLevel);

    if (this.phase !== Phase.SOLAR) {
      TurmoilHandler.onGlobalParameterIncrease(player, GlobalParameter.OXYGEN, steps);
      player.onGlobalParameterIncrease(GlobalParameter.OXYGEN, steps);
      player.increaseTerraformRating(steps, {global: true});
      this.events.recordGlobalParameterChange(player, GlobalParameter.OXYGEN, steps);
    }
    if (this.oxygenLevel < constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS &&
      this.oxygenLevel + steps >= constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS) {
      if (player.isMarsBot && this.temperature >= constants.MAX_TEMPERATURE) {
        // "If MarsBot increases the temperature or oxygen to a bonus step that
        // gives another terraforming action, it resolves that other terraforming
        // action immediately (taking a Failed Action if it cannot resolve it)."
        automaFailedAction(this, 'temperature-maxed');
      } else {
        this.increaseTemperature(player, 1);
      }
    }

    this.claimCrossedScaleBonuses(player, 'oxygen', this.oxygenLevel, this.oxygenLevel + steps, [constants.OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS]);

    this.oxygenLevel += steps;
    this.maybeLogMarsIsTerraformed();

    AresHandler.ifAres(this, (aresData) => {
      AresHandler.onOxygenChange(this, aresData, player);
    });
  }

  public getOxygenLevel(): number {
    return this.oxygenLevel;
  }

  public increaseVenusScaleLevel(player: IPlayer, increments: -1 | 1 | 2 | 3): number {
    if (this.venusScaleLevel >= constants.MAX_VENUS_SCALE) {
      return 0;
    }

    // PoliticalAgendas Reds P3 hook
    if (increments === -1) {
      this.venusScaleLevel = Math.max(constants.MIN_VENUS_SCALE, this.venusScaleLevel + increments * 2);
      return -1;
    }

    // Literal typing makes |increments| a const
    const steps = Math.min(increments, (constants.MAX_VENUS_SCALE - this.venusScaleLevel) / 2);

    if (this.phase !== Phase.SOLAR) {
      if (this.venusScaleLevel < constants.VENUS_LEVEL_FOR_CARD_BONUS &&
        this.venusScaleLevel + steps * 2 >= constants.VENUS_LEVEL_FOR_CARD_BONUS) {
        // MarsBot has no hand — the official Automa material never grants the bot
        // the Venus 8% card-draw bonus (OQ-7 in AUTOMA_DATA_AUDIT.md), so it is
        // skipped for it. The 16% TR bonus below applies normally ("per the
        // normal rules", Adding Expansions p.2).
        if (!player.isMarsBot) {
          // Tag the reveal with the Venus scale so the console lifts the
          // card-bonus cover off the 8% marker (mirrors the tile-bonus lift).
          // Explicit source beats the active card scope: the 8% reward is a
          // SCALE bonus, not the triggering card's own draw.
          player.drawCard(1, {source: {type: 'globalParameter', parameter: GlobalParameter.VENUS}});
        }
      }
      if (this.venusScaleLevel < constants.VENUS_LEVEL_FOR_TR_BONUS &&
        this.venusScaleLevel + steps * 2 >= constants.VENUS_LEVEL_FOR_TR_BONUS) {
        // The Venus 8% threshold TR bonus is a one-time effect, NOT a parameter
        // step — attribute it to "Cards & effects" (so it never leaks into the
        // clean base rating), not `{global: true}`.
        player.increaseTerraformRating(1, {trAttribution: {sourceType: 'venusTrackBonus', sourceName: 'Venus track bonus'}});
      }
      if (this.gameOptions.altVenusBoard) {
        const newValue = this.venusScaleLevel + steps * 2;
        const minimalBaseline = Math.max(this.venusScaleLevel, constants.ALT_VENUS_MINIMUM_BONUS);
        const maximumBaseline = Math.min(newValue, constants.MAX_VENUS_SCALE);
        const standardResourcesGranted = Math.max((maximumBaseline - minimalBaseline) / 2, 0);

        const grantWildResource = this.venusScaleLevel + (steps * 2) >= constants.MAX_VENUS_SCALE;
        // The second half of this expression removes any increases earler than 16-to-18.
        if (grantWildResource || standardResourcesGranted > 0) {
          if (player.isMarsBot) {
            // MarsBot never answers prompts, so the alt-track bonus resolves
            // immediately as fixed gains (house rule, mirroring the -24/-20
            // heat-production conversion in increaseTemperature): 1 M€ per
            // crossed bonus space, and the 30% wild resource becomes 1 floater
            // in the bot's storage area.
            if (standardResourcesGranted > 0) {
              player.stock.add(Resource.MEGACREDITS, standardResourcesGranted, {log: true});
            }
            if (grantWildResource && this.automa !== undefined) {
              this.automa.floaters += 1;
              this.log('${0} gained ${1} ${2}', (b) => b.player(player).number(1).cardResource(CardResource.FLOATER));
            }
          } else {
            this.defer(new GrantVenusAltTrackBonusDeferred(player, standardResourcesGranted, grantWildResource));
          }
        }
      }
      for (const card of player.playedCards) {
        if (card.onGlobalParameterIncrease === undefined) {
          continue;
        }
        this.events.withEffect(player, card, 'global-parameter', () => card.onGlobalParameterIncrease?.(player, GlobalParameter.VENUS, steps));
      }
      if (this.exploitationOfVenusInEffect) {
        player.stock.add(Resource.MEGACREDITS, steps * 2, {log: true, from: {card: CardName.EXPLOITATION_OF_VENUS}});
      }
      TurmoilHandler.onGlobalParameterIncrease(player, GlobalParameter.VENUS, steps);
      player.onGlobalParameterIncrease(GlobalParameter.VENUS, steps);
      player.increaseTerraformRating(steps, {global: true});
      this.events.recordGlobalParameterChange(player, GlobalParameter.VENUS, steps);
    }

    // Check for Aphrodite corporation
    const aphrodite = this.players.find((player) => player.tableau.has(CardName.APHRODITE));
    if (aphrodite !== undefined) {
      aphrodite.stock.add(Resource.MEGACREDITS, 2 * steps, {log: true, from: {card: CardName.APHRODITE}});
    }

    const venusBonusSteps = this.gameOptions.altVenusBoard ?
      [constants.VENUS_LEVEL_FOR_CARD_BONUS, constants.VENUS_LEVEL_FOR_TR_BONUS, 18, 20, 22, 24, 26, 28, 30] :
      [constants.VENUS_LEVEL_FOR_CARD_BONUS, constants.VENUS_LEVEL_FOR_TR_BONUS];
    this.claimCrossedScaleBonuses(player, 'venus', this.venusScaleLevel, this.venusScaleLevel + steps * 2, venusBonusSteps);

    this.venusScaleLevel += steps * 2;
    this.maybeLogMarsIsTerraformed();

    return steps;
  }

  public getVenusScaleLevel(): number {
    return this.venusScaleLevel;
  }

  public increaseTemperature(player: IPlayer, increments: -2 | -1 | 1 | 2 | 3): undefined {
    if (this.temperature >= constants.MAX_TEMPERATURE) {
      return undefined;
    }

    if (increments === -2 || increments === -1) {
      this.temperature = Math.max(constants.MIN_TEMPERATURE, this.temperature + increments * 2);
      return undefined;
    }

    // Literal typing makes |increments| a const
    const steps = Math.min(increments, (constants.MAX_TEMPERATURE - this.temperature) / 2);

    if (this.phase !== Phase.SOLAR) {
      // BONUS FOR HEAT PRODUCTION AT -20 and -24
      // MarsBot has no production: "If MarsBot raises the temperature to a bonus
      // step that gives a heat production (-24 C and -20 C), MarsBot gains 2 MC
      // instead of the heat bonus." (Automa rulebook p.9)
      if (this.temperature < constants.TEMPERATURE_BONUS_FOR_HEAT_1 &&
        this.temperature + steps * 2 >= constants.TEMPERATURE_BONUS_FOR_HEAT_1) {
        if (player.isMarsBot) {
          player.stock.add(Resource.MEGACREDITS, 2, {log: true});
        } else {
          player.production.add(Resource.HEAT, 1, {log: true});
        }
      }
      if (this.temperature < constants.TEMPERATURE_BONUS_FOR_HEAT_2 &&
        this.temperature + steps * 2 >= constants.TEMPERATURE_BONUS_FOR_HEAT_2) {
        if (player.isMarsBot) {
          player.stock.add(Resource.MEGACREDITS, 2, {log: true});
        } else {
          player.production.add(Resource.HEAT, 1, {log: true});
        }
      }

      for (const card of player.playedCards) {
        if (card.onGlobalParameterIncrease === undefined) {
          continue;
        }
        this.events.withEffect(player, card, 'global-parameter', () => card.onGlobalParameterIncrease?.(player, GlobalParameter.TEMPERATURE, steps));
      }
      player.onGlobalParameterIncrease(GlobalParameter.TEMPERATURE, steps);
      TurmoilHandler.onGlobalParameterIncrease(player, GlobalParameter.TEMPERATURE, steps);
      player.increaseTerraformRating(steps, {global: true});
      this.events.recordGlobalParameterChange(player, GlobalParameter.TEMPERATURE, steps);
    }

    // BONUS FOR OCEAN TILE AT 0
    if (this.temperature < constants.TEMPERATURE_FOR_OCEAN_BONUS && this.temperature + steps * 2 >= constants.TEMPERATURE_FOR_OCEAN_BONUS) {
      if (player.isMarsBot) {
        // The bonus terraforming action resolves immediately for MarsBot — its
        // own deterministic placement, or a Failed Action when no ocean is left
        // (rulebook p.9). No prompt is ever created for the bot.
        AutomaTilePlacer.placeOcean(this);
      } else {
        this.defer(new PlaceOceanTile(player, {title: 'Select space for ocean from temperature increase'}));
      }
    }

    this.claimCrossedScaleBonuses(player, 'temperature', this.temperature, this.temperature + steps * 2,
      [constants.TEMPERATURE_BONUS_FOR_HEAT_1, constants.TEMPERATURE_BONUS_FOR_HEAT_2, constants.TEMPERATURE_FOR_OCEAN_BONUS]);

    this.temperature += steps * 2;
    this.maybeLogMarsIsTerraformed();

    AresHandler.ifAres(this, (aresData) => {
      AresHandler.onTemperatureChange(this, aresData, player);
    });
    UnderworldExpansion.onTemperatureChange(this, steps);
    return undefined;
  }

  public getTemperature(): number {
    return this.temperature;
  }

  public getGeneration(): number {
    return this.generation;
  }

  public getPassedPlayers():Array<Color> {
    const passedPlayersColors: Array<Color> = [];
    this.passedPlayers.forEach((player) => {
      passedPlayersColors.push(this.getPlayerById(player).color);
    });
    return passedPlayersColors;
  }

  // addTile applies to the Mars board, but not the Moon board, see MoonExpansion.addTile for placing
  // a tile on The Moon.
  public addTile(
    player: IPlayer,
    space: Space,
    tile: Tile): void {
    // Part 1, basic validation checks.

    // Land claim a player can claim land for themselves
    if (space.player !== undefined && space.player !== player) {
      throw new Error('This space is land claimed by ' + space.player.name);
    }

    if (!MarsBoard.canCover(space, tile)) {
      throw new Error('Selected space is occupied: ' + space.id);
    }

    // Oceans are not subject to Ares adjacency production penalties.
    const subjectToHazardAdjacency = tile.tileType !== TileType.OCEAN;

    AresHandler.ifAres(this, () => {
      AresHandler.assertCanPay(player, space, subjectToHazardAdjacency);
    });

    // Part 2. Collect additional fees.
    // Adjacency costs are before the hellas ocean tile because this is a mandatory cost.
    AresHandler.ifAres(this, () => {
      AresHandler.payAdjacencyAndHazardCosts(player, space, subjectToHazardAdjacency);
    });

    TurmoilHandler.resolveTilePlacementCosts(player);

    // Part 3. Setup for bonuses
    const initialTileType = space.tile?.tileType;
    const coveringExistingTile = space.tile !== undefined;
    const arcadianCommunityBonus = space.player === player && player.tableau.has(CardName.ARCADIAN_COMMUNITIES);

    // Part 4. Place the tile
    this.simpleAddTile(player, space, tile);

    // Part 5. Collect the bonuses
    if (this.phase !== Phase.SOLAR) {
      this.grantPlacementBonuses(player, space, coveringExistingTile, arcadianCommunityBonus);

      AresHandler.ifAres(this, (aresData) => {
        AresHandler.maybeIncrementMilestones(aresData, player, space, hazardSeverity(initialTileType));
      });

      if (this.gameOptions.boardName === BoardName.HOLLANDIA) {
        const spaces = this.board.spaces.filter(Board.ownedBy(player));
        const [inside, outside] = partition(spaces, ((space) => space.spaceType === SpaceType.DEFLECTION_ZONE));
        player.withinDeflectionZone = inside.length > 0 && outside.length === 0;
      }
    } else {
      space.player = undefined;
    }

    // Clear out underworld components.
    UnderworldExpansion.onTilePlaced(this, space);

    this.triggerForAllCards((p, c) => {
      if (c.onTilePlaced === undefined) {
        return;
      }
      this.events.withEffect(p, c, 'tile-placed', () => c.onTilePlaced?.(p, player, space, BoardType.MARS));
    });

    if (initialTileType !== undefined) {
      AresHandler.ifAres(this, () => {
        AresHandler.grantBonusForRemovingHazard(player, initialTileType);
      });
    }
  }

  public triggerForAllCards(f: (cardOwner: IPlayer, card: ICard) => void) {
    for (const p of this.playersInGenerationOrder) {
      for (const playedCard of p.tableau) {
        f(p, playedCard);
      }
    }
  }

  public grantPlacementBonuses(player: IPlayer, space: Space, coveringExistingTile: boolean = false, arcadianCommunityBonus: boolean = false) {
    if (!coveringExistingTile) {
      if (player.isMarsBot) {
        // "If MarsBot places a tile that covers placement bonus icons (plants,
        // steel, titanium, cards, etc.), it gains 1 MC for each icon covered
        // (instead of the printed rewards)." (Automa rulebook p.9). The ocean
        // adjacency M€ below is shared — the bot's oceanBonus is the default 2.
        const icons = space.bonus.length;
        if (icons > 0) {
          this.events.withSource({kind: 'spaceBonus'}, () => {
            player.stock.add(Resource.MEGACREDITS, icons);
            this.log('${0} gained ${1} ${2} for ${3} covered bonus icon(s)', (b) =>
              b.player(player).number(icons).resource(Resource.MEGACREDITS).number(icons));
          });
        }
      } else {
        // Attribute the hex's printed bonuses to "cell bonus" in the journal.
        this.events.withSource({kind: 'spaceBonus'}, () => this.grantSpaceBonuses(player, space));
      }
    }

    const {oceans: adjacentOceanCount, megacredits: oceanAdjacencyBonus} = this.board.oceanAdjacencyBonus(player, space);
    if (oceanAdjacencyBonus > 0) {
      this.events.withSource({kind: 'oceanBonus'}, () => {
        player.stock.add(Resource.MEGACREDITS, oceanAdjacencyBonus);
        this.log('${0} gained ${1} ${2} from ${3} ocean(s)', (b) => b.player(player).number(oceanAdjacencyBonus).resource(Resource.MEGACREDITS).number(adjacentOceanCount));
      });
    }

    // TODO(kberg): these might not apply for some bonuses, e.g. Frontier Town.
    // https://boardgamegeek.com/thread/3344366/article/44658730#44658730
    if (space.tile !== undefined) {
      AresHandler.ifAres(this, () => {
        AresHandler.earnAdjacencyBonuses(player, space);
      });

      TurmoilHandler.resolveTilePlacementBonuses(player, space.spaceType);

      if (arcadianCommunityBonus) {
        this.defer(new GainResourcesDeferred(player, Resource.MEGACREDITS, {count: 3}));
      }

      if (space.undergroundResources === 'place6mc') {
        this.defer(new GainResourcesDeferred(player, Resource.MEGACREDITS, {count: 6}));
      }
    }
  }

  public simpleAddTile(player: IPlayer, space: Space, tile: Tile) {
    space.tile = tile;
    if (tile.tileType === TileType.OCEAN ||
      tile.tileType === TileType.MARTIAN_NATURE_WONDERS ||
      tile.tileType === TileType.REY_SKYWALKER) {
      space.player = undefined;
    } else {
      space.player = player;
    }
    LogHelper.logTilePlacement(player, space, tile.tileType);
    this.events.recordTilePlaced(player, space, tile.tileType);
  }

  public grantSpaceBonuses(player: IPlayer, space: Space) {
    const bonuses = MultiSet.from(space.bonus);
    bonuses.forEachMultiplicity((count: number, bonus: SpaceBonus) => {
      this.grantSpaceBonus(player, bonus, count);
    });
  }

  public grantSpaceBonus(player: IPlayer, spaceBonus: SpaceBonus, count: number = 1) {
    switch (spaceBonus) {
    case SpaceBonus.DRAW_CARD:
      player.drawCard(count, {source: {type: 'tile'}});
      break;
    case SpaceBonus.PLANT:
      player.stock.add(Resource.PLANTS, count, {log: true});
      break;
    case SpaceBonus.STEEL:
      player.stock.add(Resource.STEEL, count, {log: true});
      break;
    case SpaceBonus.TITANIUM:
      player.stock.add(Resource.TITANIUM, count, {log: true});
      break;
    case SpaceBonus.HEAT:
      player.stock.add(Resource.HEAT, count, {log: true});
      break;
    case SpaceBonus.OCEAN:
      // Hellas special requirements ocean tile
      if (this.canAddOcean()) {
        this.defer(new SelectPaymentDeferred(player, constants.HELLAS_BONUS_OCEAN_COST, {title: 'Select how to pay for placement bonus ocean'}))
          .andThen(() => {
            this.defer(new PlaceOceanTile(player, {title: 'Select space for ocean from placement bonus'}));
            return undefined;
          });
      }
      break;
    case SpaceBonus.MICROBE:
      this.defer(new AddResourcesToCard(player, CardResource.MICROBE, {count: count}));
      break;
    case SpaceBonus.ANIMAL:
      this.defer(new AddResourcesToCard(player, CardResource.ANIMAL, {count: count}));
      break;
    case SpaceBonus.DATA:
      this.defer(new AddResourcesToCard(player, CardResource.DATA, {count: count}));
      break;
    case SpaceBonus.ENERGY_PRODUCTION:
      player.production.add(Resource.ENERGY, count, {log: true});
      break;
    case SpaceBonus.SCIENCE:
      this.defer(new AddResourcesToCard(player, CardResource.SCIENCE, {count: count}));
      break;
    case SpaceBonus.TEMPERATURE:
    case SpaceBonus.TEMPERATURE_4MC:
      if (this.getTemperature() < constants.MAX_TEMPERATURE) {
        const cost = spaceBonus === SpaceBonus.TEMPERATURE ? constants.VASTITAS_BOREALIS_BONUS_TEMPERATURE_COST : constants.VASTITAS_BOREALIS_NOVA_BONUS_TEMPERATURE_COST;
        this.defer(new SelectPaymentDeferred(
          player,
          cost,
          {title: 'Select how to pay for placement bonus temperature'}))
          .andThen(() => this.increaseTemperature(player, 1));
      }
      break;
    case SpaceBonus.ENERGY:
      player.stock.add(Resource.ENERGY, count, {log: true});
      break;
    case SpaceBonus.ASTEROID:
      this.defer(new AddResourcesToCard(player, CardResource.ASTEROID, {count: count}));
      break;
    case SpaceBonus.DELEGATE:
      Turmoil.ifTurmoil(this, () => this.defer(new SendDelegateToArea(player)));
      break;
    case SpaceBonus.COLONY:
      this.defer(new SelectPaymentDeferred(
        player,
        constants.TERRA_CIMMERIA_COLONY_COST,
        {title: 'Select how to pay for building a colony'}))
        .andThen(() => this.defer(new BuildColony(player)));
      break;
    default:
      throw new Error('Unhandled space bonus ' + spaceBonus + '. Report this exact error, please.');
    }
  }

  public addGreenery(
    player: IPlayer, space: Space,
    shouldRaiseOxygen: boolean = true): undefined {
    this.addTile(player, space, {
      tileType: TileType.GREENERY,
    });
    // Turmoil Greens ruling policy
    PartyHooks.applyGreensRulingPolicy(player, space);

    if (shouldRaiseOxygen) {
      this.increaseOxygenLevel(player, 1);
    }
    return undefined;
  }

  public addCity(
    player: IPlayer, space: Space,
    cardName: CardName | undefined = undefined): void {
    this.addTile(player, space, {
      tileType: TileType.CITY,
      card: cardName,
    });
  }

  public canAddOcean(): boolean {
    return this.board.getOceanSpaces().length < constants.MAX_OCEAN_TILES;
  }

  public canRemoveOcean(): boolean {
    const count = this.board.getOceanSpaces().length;
    return count > 0 && count < constants.MAX_OCEAN_TILES;
  }

  public addOcean(player: IPlayer, space: Space): void {
    if (this.canAddOcean() === false) {
      return;
    }

    this.addTile(player, space, {tileType: TileType.OCEAN});
    this.maybeLogMarsIsTerraformed();

    if (this.phase !== Phase.SOLAR) {
      TurmoilHandler.onGlobalParameterIncrease(player, GlobalParameter.OCEANS);
      player.onGlobalParameterIncrease(GlobalParameter.OCEANS, 1);
      player.increaseTerraformRating(1, {global: true});
      this.events.recordGlobalParameterChange(player, GlobalParameter.OCEANS, 1);
    }
    AresHandler.ifAres(this, (aresData) => {
      AresHandler.onOceanPlaced(aresData, player);
    });
  }

  public removeTile(spaceId: SpaceId): void {
    const space = this.board.getSpaceOrThrow(spaceId);
    space.tile = undefined;
    space.player = undefined;
  }

  /**
   * Returns the Player holding this card, or throws.
   */
  public getCardPlayerOrThrow(name: CardName): IPlayer {
    const player = this.getCardPlayerOrUndefined(name);
    if (player === undefined) {
      throw new Error(`No player has played ${name}`);
    }
    return player;
  }

  /**
   * Returns the Player holding this card, or returns undefined.
   */
  public getCardPlayerOrUndefined(name: CardName): IPlayer | undefined {
    return this.players.find((player) => player.tableau.has(name));
  }

  private potentiallyChangeFirstPlayer() {
    for (const player of this.players) {
      // Check cards player has in hand
      for (const card of [...player.preludeCardsInHand, ...player.cardsInHand]) {
        if (card.name === CardName.THE_NEW_SPACE_RACE) {
          this.log(
            '${0} has ${1}, which is played before any other Prelude and makes them first player.',
            (b) => b.player(player).card(card));
          player.playCard(card);
        }
      }
    }
  }

  public getStandardProjects(): Array<IStandardProjectCard> {
    const gameOptions = this.gameOptions;
    return new GameCards(gameOptions)
      .getStandardProjects()
      .filter((card) => {
        switch (card.name) {
        // sell patents is not displayed as a card
        case CardName.SELL_PATENTS_STANDARD_PROJECT:
          return false;
          // For buffer gas, show ONLY IF in solo AND 63TR mode
        case CardName.BUFFER_GAS_STANDARD_PROJECT:
          return this.isSoloMode() && gameOptions.soloTR;
        case CardName.AIR_SCRAPPING_STANDARD_PROJECT:
          return gameOptions.altVenusBoard === false;
        case CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT:
          return gameOptions.altVenusBoard === true;
        case CardName.MOON_HABITAT_STANDARD_PROJECT_VARIANT_2:
        case CardName.MOON_MINE_STANDARD_PROJECT_VARIANT_2:
        case CardName.MOON_ROAD_STANDARD_PROJECT_VARIANT_2:
          return gameOptions.moonStandardProjectVariant === true;
        case CardName.MOON_HABITAT_STANDARD_PROJECT_VARIANT_1:
        case CardName.MOON_MINE_STANDARD_PROJECT_VARIANT_1:
        case CardName.MOON_ROAD_STANDARD_PROJECT_VARIANT_1:
          return gameOptions.moonStandardProjectVariant1 === true;
        case CardName.EXCAVATE_STANDARD_PROJECT:
          return gameOptions.underworldExpansion === true;
        case CardName.COLLUSION_STANDARD_PROJECT:
          return gameOptions.underworldExpansion === true && gameOptions.turmoilExtension === true;
        default:
          return true;
        }
      })
      .sort((a, b) => a.cost - b.cost);
  }

  public log(message: string, f?: (builder: LogMessageBuilder) => void, options?: {reservedFor?: IPlayer, reveal?: RevealLogMeta}) {
    const builder = new LogMessageBuilder(message);
    f?.(builder);
    const logMessage = builder.build();
    logMessage.playerId = options?.reservedFor?.id;
    if (options?.reveal !== undefined) {
      logMessage.reveal = options.reveal;
    }
    // Bridge to the structured stream: attach the active correlation chain so the
    // journal can group action → effect → result without parsing text.
    this.events.stampJournal(logMessage);
    this.gameLog.push(logMessage);
    this.gameAge++;
  }

  public discardForCost(cardCount: 1 | 2, toPlace: TileType) {
    // This method uses drawOrThrow, which means if there are really no more cards, it breaks the game.
    // I predict it will be an exceedingly rare problem.
    if (cardCount === 1) {
      const card = this.projectDeck.drawOrThrow(this);
      this.projectDeck.discard(card);
      this.log('Drew and discarded ${0} to place a ${1}', (b) => b.card(card, {cost: true}).tileType(toPlace));
      return card.cost;
    } else {
      const card1 = this.projectDeck.drawOrThrow(this);
      this.projectDeck.discard(card1);
      const card2 = this.projectDeck.drawOrThrow(this);
      this.projectDeck.discard(card2);
      this.log('Drew and discarded ${0} and ${1} to place a ${2}', (b) => b.card(card1, {cost: true}).card(card2, {cost: true}).tileType(toPlace));
      return card1.cost + card2.cost;
    }
  }

  public expectedPurgeTimeMs(): number {
    if (this.createdTime.getTime() === 0) {
      return 0;
    }
    const days = stringToNumber(process.env.MAX_GAME_DAYS, 10);
    return addDays(this.createdTime, days).getTime();
  }

  public static deserialize(d: SerializedGame): Game {
    const gameOptions = d.gameOptions;
    gameOptions.boardName = normalizeBoardName(gameOptions.boardName);
    const players = d.players.map((element) => Player.deserialize(element));
    const first = players.find((player) => player.id === d.first);
    if (first === undefined) {
      throw new Error(`Player ${d.first} not found when rebuilding First Player`);
    }

    const board = GameSetup.deserializeBoard(players, gameOptions, d);

    const rng = new SeededRandom(d.seed, d.currentSeed);

    const projectDeck = ProjectDeck.deserialize(d.projectDeck, rng);
    const corporationDeck = CorporationDeck.deserialize(d.corporationDeck, rng);
    const preludeDeck = PreludeDeck.deserialize(d.preludeDeck, rng);

    const ceoDeck = CeoDeck.deserialize(d.ceoDeck, rng);

    // TODO(kberg): remove ?? generateGameName(...) by 2026-07-01
    const name = d.name ?? generateGameName(UnseededRandom.INSTANCE);
    const game = new Game(d.id, name, players, first, d.activePlayer, d.spectatorId, gameOptions, rng, board, projectDeck, corporationDeck, preludeDeck, ceoDeck, d.tags);
    game.resettable = true;
    game.spectatorId = d.spectatorId;
    game.createdTime = new Date(d.createdTimeMs);

    const milestones: Array<IMilestone> = [];
    d.milestones.forEach((milestoneName) => {
      milestoneName = maybeRenamedMilestone(milestoneName);
      const milestone = milestoneManifest.create(milestoneName);
      if (milestone !== undefined) {
        milestones.push(milestone);
      }
    });

    game.milestones = milestones;
    game.claimedMilestones = deserializeClaimedMilestones(d.claimedMilestones, players, milestones);

    const awards: Array<IAward> = [];
    d.awards.forEach((awardName) => {
      awardName = maybeRenamedAward(awardName);
      const award = awardManifest.create(awardName);
      if (award !== undefined) {
        awards.push(award);
      }
    });

    game.awards = awards;
    game.fundedAwards = deserializeFundedAwards(d.fundedAwards, players, awards);

    if (gameOptions.aresExtension) {
      game.aresData = d.aresData;
    }
    // Reload colonies elements if needed
    if (gameOptions.coloniesExtension) {
      game.colonies = ColonyDeserializer.deserializeAndFilter(d.colonies);
      const colonyDealer = new ColonyDealer(rng, gameOptions);
      colonyDealer.restore(game.colonies);
      game.discardedColonies = colonyDealer.discardedColonies;
    }

    // Reload turmoil elements if needed
    if (d.turmoil && gameOptions.turmoilExtension) {
      game.turmoil = Turmoil.deserialize(d.turmoil, players);
    }

    // Reload moon elements if needed
    if (d.moonData !== undefined && gameOptions.moonExpansion === true) {
      game.moonData = MoonData.deserialize(d.moonData, players);
    }

    if (d.pathfindersData !== undefined && gameOptions.pathfindersExpansion === true) {
      game.pathfindersData = PathfindersData.deserialize(d.pathfindersData);
    }

    if (d.underworldData !== undefined) {
      game.underworldData = d.underworldData;
    }
    if (d.automa !== undefined) {
      game.automa = AutomaState.deserialize(d.automa, gameOptions);
    }
    game.passedPlayers = new Set<PlayerId>(d.passedPlayers);
    game.donePlayers = new Set<PlayerId>(d.donePlayers);
    game.researchedPlayers = new Set<PlayerId>(d.researchedPlayers);

    game.lastSaveId = d.lastSaveId;
    game.clonedGamedId = d.clonedGamedId;
    game.gameAge = d.gameAge;
    game.gameLog = d.gameLog;
    game.events.restore(d.gameEvents, d.eventSeq);
    game.generation = d.generation;
    game.phase = d.phase;
    game.oxygenLevel = d.oxygenLevel;
    game.undoCount = d.undoCount ?? 0;
    game.temperature = d.temperature;
    game.venusScaleLevel = d.venusScaleLevel;
    game.scaleBonusClaims = new Map(d.scaleBonusClaims ?? []);
    game.activePlayer = game.getPlayerById(d.activePlayer);
    game.draftRound = d.draftRound;
    game.initialDraftIteration = d.initialDraftIteration;
    game.someoneHasRemovedOtherPlayersPlants = d.someoneHasRemovedOtherPlayersPlants;
    game.syndicatePirateRaider = d.syndicatePirateRaider;
    game.gagarinBase = d.gagarinBase;
    game.stJosephCathedrals = d.stJosephCathedrals;
    game.nomadSpace = d.nomadSpace;
    game.tradeEmbargo = d.tradeEmbargo ?? false;
    game.beholdTheEmperor = d.beholdTheEmperor ?? false;
    game.globalsPerGeneration = d.globalsPerGeneration;

    // TODO(kberg): Remove this migration code by 2026-08-01
    for (const generation of game.globalsPerGeneration) {
      const asany = generation as any;
      if (asany['moon-logistics']) {
        generation['moon-logistic'] = asany['moon-logistics'];
        delete asany['moon-logistics'];
      }
    }
    game.verminInEffect = d.verminInEffect;
    game.exploitationOfVenusInEffect = d.exploitationOfVenusInEffect;
    // Still in Draft or Research of generation 1 — i.e. some player has not yet
    // played their corporation. MarsBot is EXCLUDED: it never picks/plays a
    // corporation (it builds an action deck instead), so a corporation-less bot
    // would make this proxy read TRUE forever in generation 1 and bounce an
    // already-started game back to gotoInitialResearchPhase() on reload, which
    // prompts nobody (the human already picked) — a RESEARCH-phase deadlock with
    // no waitingFor (both chips read «ГОТОВ»). Guard on human corp-pickers only.
    if (game.generation === 1 && players.some((p) => p.isMarsBot !== true && p.playedCards.filter(isICorporationCard).length === 0)) {
      if (game.phase === Phase.INITIALDRAFTING) {
        switch (game.initialDraftIteration) {
        case 1:
          newInitialDraft(game).restoreDraft();
          break;
        case 2:
          newInitialDraft(game).restoreDraft();
          break;
        case 3:
          newPreludeDraft(game).restoreDraft();
          break;
        case 4:
          newCEOsDraft(game).restoreDraft();
        }
      } else {
        game.gotoInitialResearchPhase();
      }
    } else if (game.phase === Phase.DRAFTING) {
      if (game.automa !== undefined) {
        newAutomaDraft(game).restoreDraft();
      } else {
        newStandardDraft(game).restoreDraft();
      }
    } else if (game.phase === Phase.RESEARCH) {
      game.gotoResearchPhase();
    } else if (game.phase === Phase.PRODUCTION) {
      if (game.gameIsOver() && game.isDoneWithFinalProduction()) {
        game.takeNextFinalGreeneryAction();
      }
    } else if (game.phase === Phase.END) {
      // There's nowhere that we need to go for end game.
    } else if (game.activePlayer.isMarsBot) {
      // ACTION phase, but the active player is MarsBot. `takeAction()` is the
      // HUMAN input flow — never valid for the bot: it would hang a dead action
      // menu on the bot (which nothing can submit) AND that stray waitingFor
      // would defeat BotTurnScheduler recovery. Re-drive the bot instead.
      game.resolveBotTurnOnLoad();
    } else {
      // We should be in ACTION phase, let's prompt the active player for actions
      game.activePlayer.takeAction(/* saveBeforeTakingAction */ false);
    }

    if (game.phase === Phase.END) {
      GameLoader.getInstance().mark(game.id);
    }
    return game;
  }

  public logIllegalState(description: string, metadata: {}) {
    const gameMetadata = {
      gameId: this.id,
      lastSaveId: this.lastSaveId,
      logAge: this.gameLog.length,
      currentPlayer: this.activePlayer.id,

      metadata: metadata,
    };
    console.warn('Illegal state: ' + description, JSON.stringify(gameMetadata, null, ' '));
  }

  public getActionCount() {
    return sum(this.players.map((p) => p.actionsTakenThisGame));
  }
}
