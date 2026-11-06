import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {AutomaGameEnd} from '../../src/server/automa/AutomaGameEnd';
import {IGame} from '../../src/server/IGame';
import {benchConfig, benchSequences, summarize} from './marsBotBench';

/**
 * THE ARES CLEARANCE BENCH (house rule 4 — docs/AUTOMA_DATA_AUDIT.md §22.7) — a DEV spec, run on demand:
 *
 *   TM_BOT_BALANCE=1 npx mocha --import=tsx --require tests/testing/setup.ts tests/automa/MarsBotAresClearance.dev.spec.ts
 *
 * The bench's sequences on every supported board with Ares (hazards dealt), the generation on the bench's clock and
 * the final greenery at the end: how many hazards the bot clears in the game and at the end, and what it pays.
 */
const SEEDS = 12;
const CARDS = 48;
const describeBench = process.env.TM_BOT_BALANCE === '1' ? describe : describe.skip;

describeBench('MarsBot Ares clearance bench (TM_BOT_BALANCE=1)', () => {
  it('clearances per game on every board', () => {
    const sequences = benchSequences(SEEDS, CARDS);
    const rows: Array<string> = [];
    let inGameAll = 0;
    let finalAll = 0;
    for (const boardName of AUTOMA_SUPPORTED_BOARDS) {
      let inGame = 0;
      let atEnd = 0;
      const count = (game: IGame) => game.aresData!.milestoneResults.find((e) => e.id === game.players.find((p) => p.isMarsBot)!.id)!.purifierCount;
      const before = new Map<IGame, number>();
      const runs = benchConfig({
        label: `ares-${boardName}`,
        options: {boardName, aresExtension: true, aresHazards: true},
        trackGeneration: true,
        finish: (game) => {
          before.set(game, count(game));
          AutomaGameEnd.placeFinalGreeneries(game);
        },
      }, sequences);
      for (const [game, n] of before) {
        inGame += n;
        atEnd += count(game) - n;
      }
      inGameAll += inGame;
      finalAll += atEnd;
      const s = summarize(boardName, runs, CARDS);
      rows.push(`${boardName.padEnd(24)} in-game ${(inGame / SEEDS).toFixed(2)} · final ${(atEnd / SEEDS).toFixed(2)} · TR ${s.tr.toFixed(1)} · M€ ${s.mc.toFixed(1)}`);
    }
    console.log(`\nARES CLEARANCE BENCH — ${SEEDS} × ${CARDS} cards, generation on the bench clock, final greenery\n${rows.join('\n')}` +
      `\nall boards: in-game ${(inGameAll / SEEDS / AUTOMA_SUPPORTED_BOARDS.length).toFixed(2)} · final ${(finalAll / SEEDS / AUTOMA_SUPPORTED_BOARDS.length).toFixed(2)} per game`);
  }).timeout(600_000);
});
