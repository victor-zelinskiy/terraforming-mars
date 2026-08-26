import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {GameOptions} from '../../src/server/game/GameOptions';
import {DifficultyLevel, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {TestPlayer} from '../TestPlayer';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {marsBotOf} from '../../src/server/automa/AutomaUtil';

export type AutomaTestOptions = Partial<GameOptions> & {
  difficulty?: DifficultyLevel;
  /**
   * The bot's corporation. DEFAULT: C01 Credicor — the most inert corp for a
   * spec (no Setup box, no Before-Action-Phase box, no deck or track
   * footprint; only +4 M€ when the bot resolves a ≥20 M€ card), so the
   * hundreds of pre-corporation specs keep their exact expectations.
   * 'random' exercises the real seeded selection (Spire's starting Earth tag
   * then advances the Earth track onto its 'city' cell at setup — real
   * official behavior most old specs never budgeted for).
   */
  corporation?: MarsBotCorpId | 'random';
  /** Keep the human's SelectInitialCards prompt (default: popped, like testGame). */
  keepInitialCardSelection?: boolean;
  /**
   * The game's rng seed (default 0, like `Game.newInstance`). Varying it is how
   * a spec proves a SEEDED random choice is actually SPREAD — at one seed, a
   * victim tie that always lands on the same seat is indistinguishable from
   * «pick the first candidate».
   */
  seed?: number;
};

/**
 * Creates a solo-vs-MarsBot game for testing: one human (TestPlayer, blue) +
 * the bot the engine seats itself. Returns [game, human, bot].
 */
export function testAutomaGame(customOptions?: AutomaTestOptions, idSuffix = ''): [IGame, TestPlayer, IPlayer] {
  const {difficulty, corporation, keepInitialCardSelection, seed, ...gameOptions} = customOptions ?? {};
  const forced = corporation ?? MarsBotCorpId.C01_CREDICOR;
  const human = TestPlayer.BLUE.newPlayer({name: 'player1', idSuffix});
  const game = Game.newInstance(`game-id${idSuffix}`, [human], human, `spectator-id${idSuffix}`, {
    automa: {difficulty: difficulty ?? 'normal', ...(forced !== 'random' ? {corporation: forced} : {})},
    ...gameOptions,
  }, seed ?? 0);
  if (keepInitialCardSelection !== true) {
    if (human.getWaitingFor() instanceof SelectInitialCards) {
      human.popWaitingFor();
    }
  }
  return [game, human, marsBotOf(game)];
}

const MULTI_COLORS = [TestPlayer.BLUE, TestPlayer.RED, TestPlayer.GREEN, TestPlayer.YELLOW] as const;

/**
 * Creates a MULTIPLAYER-with-Automa game (mode B, §12): `humanCount` humans
 * (2–4; blue/red/green/yellow, blue first) + the bot the engine seats itself.
 * Returns [game, humans[], bot].
 */
export function testAutomaMultiplayerGame(
  humanCount: number, customOptions?: AutomaTestOptions, idSuffix = ''): [IGame, ReadonlyArray<TestPlayer>, IPlayer] {
  const {difficulty, corporation, keepInitialCardSelection, seed, ...gameOptions} = customOptions ?? {};
  const forced = corporation ?? MarsBotCorpId.C01_CREDICOR;
  const humans = MULTI_COLORS.slice(0, humanCount)
    .map((factory, i) => factory.newPlayer({name: `player${i + 1}`, idSuffix}));
  const game = Game.newInstance(`game-id${idSuffix}`, humans, humans[0], `spectator-id${idSuffix}`, {
    automa: {difficulty: difficulty ?? 'normal', ...(forced !== 'random' ? {corporation: forced} : {})},
    ...gameOptions,
  }, seed ?? 0);
  if (keepInitialCardSelection !== true) {
    for (const human of humans) {
      if (human.getWaitingFor() instanceof SelectInitialCards) {
        human.popWaitingFor();
      }
    }
  }
  return [game, humans, marsBotOf(game)];
}
