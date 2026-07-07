import {BoardName} from '../../common/boards/BoardName';
import {PLAYER_COLORS} from '../../common/Color';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {GameId} from '../../common/Types';
import {safeCast, isPlayerId} from '../../common/Types';
import {inplaceShuffle} from '../utils/shuffle';
import {GameOptions} from '../game/GameOptions';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Player} from '../Player';
import {AutomaColonies} from './AutomaColonies';
import {AutomaState, AutomaActionCard} from './AutomaState';

/** The one MarsBot player of an automa game. Throws when called on an ordinary game. */
export function marsBotOf(game: IGame): IPlayer {
  const bot = game.players.find((p) => p.isMarsBot);
  if (bot === undefined) {
    throw new Error('This game has no MarsBot player');
  }
  return bot;
}

export class AutomaSetup {
  /**
   * The POC supports exactly the officially-covered module set on Tharsis:
   * Corporate Era + Prelude 1 + Venus Next + Colonies (any subset). Everything
   * else is rejected loudly at creation — never silently ignored.
   */
  public static validateOptions(gameOptions: GameOptions): void {
    if (gameOptions.automa === undefined) {
      return;
    }
    const reject = (what: string) => {
      throw new Error(`MarsBot (Automa) does not support ${what}`);
    };
    if (gameOptions.boardName !== BoardName.THARSIS) {
      reject(`the ${gameOptions.boardName} board yet — the POC covers Tharsis`);
    }
    // Unsupported expansions / modules.
    if (gameOptions.turmoilExtension) {
      reject('Turmoil in the POC');
    }
    if (gameOptions.prelude2Expansion) {
      reject('Prelude 2 (per the official rules, and out of POC scope)');
    }
    if (gameOptions.promoCardsOption) {
      reject('promo cards in the POC');
    }
    if (gameOptions.communityCardsOption) {
      reject('community cards');
    }
    if (gameOptions.aresExtension) {
      reject('Ares');
    }
    if (gameOptions.moonExpansion) {
      reject('The Moon');
    }
    if (gameOptions.pathfindersExpansion) {
      reject('Pathfinders');
    }
    if (gameOptions.ceoExtension) {
      reject('CEOs');
    }
    if (gameOptions.starWarsExpansion) {
      reject('Star Wars');
    }
    if (gameOptions.underworldExpansion) {
      reject('Underworld');
    }
    if (gameOptions.deltaProjectExpansion) {
      reject('the Delta Project');
    }
    // Variants the official Automa setup does not describe.
    if (gameOptions.initialDraftVariant) {
      reject('the initial draft (the official Automa setup deals 10 cards)');
    }
    if (gameOptions.preludeDraftVariant) {
      reject('the prelude draft');
    }
    if (gameOptions.ceosDraftVariant) {
      reject('the CEO draft');
    }
    if (gameOptions.randomMA !== RandomMAOptionType.NONE) {
      reject('random milestones and awards');
    }
    if (gameOptions.soloTR) {
      reject('the 63 TR solo variant (the win condition is beating MarsBot)');
    }
    if (gameOptions.twoCorpsVariant) {
      reject('the two-corporations variant');
    }
    if (gameOptions.escapeVelocity !== undefined) {
      reject('Escape Velocity');
    }
    // Venus Next's World Government Terraforming: its role is played by the
    // Government Intervention bonus card (Adding Expansions p.3) — never both.
    if (gameOptions.solarPhaseOption) {
      reject('the Solar Phase / WGT option (Government Intervention covers it)');
    }
    if (gameOptions.requiresVenusTrackCompletion) {
      reject('the "Venus must be completed" variant');
    }
    if (gameOptions.altVenusBoard) {
      reject('the alternate Venus board');
    }
    if (gameOptions.shuffleMapOption) {
      reject('the shuffled map (MarsBot tile placement uses the printed board)');
    }
    if (gameOptions.customCorporationsList.length > 0 ||
        gameOptions.customColoniesList.length > 0 ||
        gameOptions.customPreludes.length > 0 ||
        gameOptions.customCeos.length > 0 ||
        gameOptions.bannedCards.length > 0 ||
        gameOptions.includedCards.length > 0) {
      reject('custom card/colony lists in the POC');
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
