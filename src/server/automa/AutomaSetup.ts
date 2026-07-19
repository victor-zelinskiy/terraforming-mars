import {PLAYER_COLORS} from '../../common/Color';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {AutomaCompatibilityInput, automaConflicts} from '../../common/automa/automaCompatibility';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {GameId} from '../../common/Types';
import {safeCast, isPlayerId} from '../../common/Types';
import {inplaceShuffle} from '../utils/shuffle';
import {GameOptions} from '../game/GameOptions';
import {IGame} from '../IGame';
import {Player} from '../Player';
import {AutomaColonies} from './AutomaColonies';
import {AutomaState, AutomaActionCard} from './AutomaState';

export class AutomaSetup {
  /** Normalize the server `GameOptions` into the shared compatibility input. */
  public static compatibilityInput(gameOptions: GameOptions): AutomaCompatibilityInput {
    return {
      boardName: gameOptions.boardName,
      turmoil: gameOptions.turmoilExtension,
      prelude2: gameOptions.prelude2Expansion,
      community: gameOptions.communityCardsOption,
      moon: gameOptions.moonExpansion,
      pathfinders: gameOptions.pathfindersExpansion,
      ceo: gameOptions.ceoExtension,
      starwars: gameOptions.starWarsExpansion,
      underworld: gameOptions.underworldExpansion,
      randomMA: gameOptions.randomMA !== RandomMAOptionType.NONE,
      soloTR: gameOptions.soloTR,
      twoCorpsVariant: gameOptions.twoCorpsVariant,
      escapeVelocity: gameOptions.escapeVelocity !== undefined,
      solarPhaseOption: gameOptions.solarPhaseOption,
      requiresVenusTrackCompletion: gameOptions.requiresVenusTrackCompletion,
      shuffleMapOption: gameOptions.shuffleMapOption,
      customLists: gameOptions.customCorporationsList.length > 0 ||
        gameOptions.customColoniesList.length > 0 ||
        gameOptions.customPreludes.length > 0 ||
        gameOptions.customCeos.length > 0 ||
        gameOptions.bannedCards.length > 0 ||
        gameOptions.includedCards.length > 0,
    };
  }

  /**
   * The POC supports exactly the officially-covered module set on Tharsis:
   * Corporate Era + Prelude 1 + Venus Next + Colonies (any subset). Everything
   * else is rejected loudly at creation — never silently ignored. The RULES
   * live in the shared `automaConflicts` (src/common/automa/automaCompatibility.ts)
   * so the premium create-game UI highlights the SAME conflicts before submit;
   * this server check stays the source of truth.
   */
  public static validateOptions(gameOptions: GameOptions): void {
    if (gameOptions.automa === undefined) {
      return;
    }
    const conflicts = automaConflicts(AutomaSetup.compatibilityInput(gameOptions));
    if (conflicts.length > 0) {
      throw new Error(`MarsBot (Automa) does not support ${conflicts[0].reason}`);
    }
  }

  /** MarsBot joins the game as a real (server-side) player. */
  public static createBotPlayer(gameId: GameId, takenColors: ReadonlyArray<string>): Player {
    const color = PLAYER_COLORS.find((c) => !takenColors.includes(c));
    if (color === undefined) {
      throw new Error('No color left for MarsBot');
    }
    const bot = new Player('MarsBot', color, /* beginner= */ false, /* handicap= */ 0,
      safeCast('p-' + gameId + '-marsbot', isPlayerId));
    bot.isMarsBot = true;
    return bot;
  }

  /**
   * Official bonus deck for the enabled modules (Adding Expansions + Setup Guide):
   * B01–B04, B07 always; B05 unless Colonies replaces it with B17 (+B18);
   * B06 unless Venus Next replaces it with B15; B08 = the Tharsis Corporate
   * Competition (the Awards & Milestones module and other maps are out of scope).
   * B16 is never IN the bonus deck — it recurs through the action deck each generation.
   */
  public static bonusDeckContents(gameOptions: GameOptions): Array<BonusCardId> {
    const deck: Array<BonusCardId> = [
      BonusCardId.B01_METEOR_SHOWER,
      BonusCardId.B02_INVASIVE_SPECIES,
      BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
      BonusCardId.B04_OVERACHIEVEMENT,
      gameOptions.coloniesExtension ?
        BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES :
        BonusCardId.B05_EXPEDITED_CONSTRUCTION,
      gameOptions.venusNextExtension ?
        BonusCardId.B15_LOBBYISTS_VENUS :
        BonusCardId.B06_LOBBYISTS,
      BonusCardId.B07_LOCAL_NEURAL_INSTANCE,
      BonusCardId.B08_CORPORATE_COMPETITION,
    ];
    if (gameOptions.coloniesExtension) {
      deck.push(BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD);
    }
    return deck;
  }

  /**
   * Runs after the human has been dealt their starting cards (the official order:
   * you first, then MarsBot). Builds the bonus deck and the starting action deck:
   * 3 project cards (+3 with Prelude — instead of prelude cards; +1 on Brutal),
   * the top card of the bonus deck, and — with Venus Next — Government
   * Intervention, which recurs into the action deck every generation
   * *including the first* (Adding Expansions p.2).
   */
  public static setup(game: IGame): AutomaState {
    const options = game.gameOptions;
    if (options.automa === undefined) {
      throw new Error('Not an automa game');
    }
    const state = AutomaState.newInstance(options.automa.difficulty, options);

    if (options.coloniesExtension) {
      // Every colony tile starts active with its tracker on the highlighted
      // second step (Adding Expansions p.4).
      AutomaColonies.setupColonies(game);
    }

    state.bonusDeck = AutomaSetup.bonusDeckContents(options);
    inplaceShuffle(state.bonusDeck, game.rng);

    if (options.venusNextExtension) {
      state.recurringBonusCards.push(BonusCardId.B16_GOVERNMENT_INTERVENTION);
    }
    if (options.coloniesExtension) {
      state.setAsideBonusCards.push(BonusCardId.B19_SHIPPING_LINES, BonusCardId.B20_EXTENDED_SHIPPING_LINES);
    }

    let projectCount = 3;
    if (options.preludeExtension) {
      projectCount += 3; // Instead of prelude cards.
    }
    if (options.automa.difficulty === 'brutal') {
      projectCount += 1;
    }
    const actionDeck: Array<AutomaActionCard> =
      game.projectDeck.drawN(game, projectCount).map((card) => ({kind: 'project' as const, name: card.name}));
    const topBonus = state.bonusDeck.shift();
    if (topBonus === undefined) {
      throw new Error('Empty MarsBot bonus deck during setup');
    }
    actionDeck.push({kind: 'bonus', id: topBonus});
    for (const recurring of state.recurringBonusCards) {
      actionDeck.push({kind: 'bonus', id: recurring});
    }
    inplaceShuffle(actionDeck, game.rng);
    state.actionDeck = actionDeck;
    return state;
  }
}
