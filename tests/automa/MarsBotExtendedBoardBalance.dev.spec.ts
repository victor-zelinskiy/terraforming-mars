import {BoardName} from '../../src/common/boards/BoardName';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {resolveProjectCardForBot} from '../../src/server/automa/AutomaCardDraw';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {newProjectCard} from '../../src/server/createCard';
import {testAutomaGame} from './AutomaTestGame';
import {bandOf, BAND_METRICS, benchConfig, benchGeneration, benchSequences, summarize} from './marsBotBench';

/**
 * THE EXTENDED-BOARD BENCH — a DEV spec, run on demand:
 *
 *   TM_BOT_BALANCE=1 npx mocha --import=tsx --require tests/testing/setup.ts tests/automa/MarsBotExtendedBoardBalance.dev.spec.ts
 *
 * The owner's hypothesis for Amazonis Planitia (2026-11-07): «the bot may fall behind late, so the late track bonuses
 * must be especially strong to keep it in tone». Measured, not felt — the same card sequences (the bench's flow, 3
 * project cards a generation) resolved on the Tharsis board and on the Amazonis Planitia extended board for 24
 * generations (72 cards — the long game the map's parameters run to), read by generation band: the bot's TR gain, its
 * Failed Actions (a tag on a finished track), its tiles, and how many of its tracks stand at their end. Then the
 * standard 48-card band — the extended board must sit INSIDE the ten printed boards' band for the first 16
 * generations (its body IS the Tharsis board; the reserve is reached only past them). The numbers go into
 * docs/AUTOMA_DATA_AUDIT.md §24.4.
 */
const SEEDS = 12;
const LONG_GAME_CARDS = 72;
const STANDARD_CARDS = 48;
const BANDS: ReadonlyArray<readonly [number, number]> = [[1, 6], [7, 12], [13, 18], [19, 24]];

const describeBench = process.env.TM_BOT_BALANCE === '1' ? describe : describe.skip;

describeBench('MarsBot extended-board bench (TM_BOT_BALANCE=1)', () => {
  it('Tharsis vs Amazonis Planitia over 24 generations, by band', () => {
    const sequences = benchSequences(SEEDS, LONG_GAME_CARDS);
    for (const boardName of [BoardName.THARSIS, BoardName.AMAZONIS_PLANITIA]) {
      const trByBand = BANDS.map(() => 0);
      const failedByBand = BANDS.map(() => 0);
      const tilesByBand = BANDS.map(() => 0);
      const atEnd: Record<number, number> = {12: 0, 16: 0, 20: 0, 24: 0};
      let tracksCounted = 0;
      for (let s = 0; s < SEEDS; s++) {
        const [game, , bot] = testAutomaGame({boardName, seed: (s + 1) / 100}, `-extended-bench-${boardName}-${s}`);
        const tracks = game.automa!.board.tracks;
        let trPrev = bot.terraformRating;
        let failedPrev = 0;
        let tilesPrev = 0;
        const tiles = () => game.board.spaces.filter((sp) => sp.player === bot).length;
        sequences[s].forEach((name, i) => {
          const gen = benchGeneration(i);
          game.generation = gen;
          resolveProjectCardForBot(game, newProjectCard(name)!);
          if ((i + 1) % 3 === 0) {
            const band = BANDS.findIndex(([a, b]) => gen >= a && gen <= b);
            trByBand[band] += bot.terraformRating - trPrev;
            trPrev = bot.terraformRating;
            failedByBand[band] += game.automa!.failedActions - failedPrev;
            failedPrev = game.automa!.failedActions;
            tilesByBand[band] += tiles() - tilesPrev;
            tilesPrev = tiles();
            if (atEnd[gen] !== undefined) {
              atEnd[gen] += tracks.filter((t) => !t.canAdvance()).length;
              if (gen === 12) {
                tracksCounted += tracks.length;
              }
            }
          }
        });
      }
      console.log(`\n${boardName} — ${SEEDS} sequences × ${LONG_GAME_CARDS} cards (3 cards = 1 generation)`);
      console.log('  TR per band:     ' + BANDS.map((b, k) => `${b[0]}–${b[1]}: ${(trByBand[k] / SEEDS).toFixed(1)}`).join(' · ') +
        ` | total ${(trByBand.reduce((a, b) => a + b, 0) / SEEDS).toFixed(1)}`);
      console.log('  Failed per band: ' + BANDS.map((b, k) => `${b[0]}–${b[1]}: ${(failedByBand[k] / SEEDS).toFixed(2)}`).join(' · '));
      console.log('  Tiles per band:  ' + BANDS.map((b, k) => `${b[0]}–${b[1]}: ${(tilesByBand[k] / SEEDS).toFixed(1)}`).join(' · '));
      console.log('  Tracks at their end: ' + [12, 16, 20, 24].map((gen) => `gen ${gen}: ${atEnd[gen]} of ${tracksCounted}`).join(' · '));
    }
  }).timeout(900_000);

  it('Amazonis Planitia at 48 cards against the printed boards\' band', () => {
    const sequences = benchSequences(SEEDS, STANDARD_CARDS);
    const printed = AUTOMA_SUPPORTED_BOARDS.filter((b) => marsBotMapProfile(b).borrowedBoard === undefined && b !== BoardName.AMAZONIS_PLANITIA);
    const band = bandOf(printed.map((b) => summarize(b, benchConfig({label: `band-${b}`, options: {boardName: b}}, sequences), STANDARD_CARDS)));
    const amazonis = summarize('amazonis planitia', benchConfig({label: 'amz-48', options: {boardName: BoardName.AMAZONIS_PLANITIA}}, sequences), STANDARD_CARDS);
    console.log('\nAmazonis Planitia at 48 cards vs the printed band:');
    for (const metric of BAND_METRICS) {
      const value = amazonis[metric];
      const flag = value < band[metric].min - 1e-9 ? 'BELOW' : value > band[metric].max + 1e-9 ? 'ABOVE' : 'in';
      console.log(`  ${metric.padEnd(18)} ${value.toFixed(2).padStart(7)}  band ${band[metric].min.toFixed(2)}…${band[metric].max.toFixed(2)}  ${flag}`);
    }
  }).timeout(900_000);
});
