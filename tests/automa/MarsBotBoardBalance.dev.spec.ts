import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {bandOf, BAND_METRICS, benchConfig, benchSequences, formatSummary, neverGeneration, summarize} from './marsBotBench';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';

/**
 * THE BOT-BOARD BALANCE BENCH — a DEV spec, run on demand:
 *
 *   TM_BOT_BALANCE=1 npx mocha --import=tsx --require tests/testing/setup.ts tests/automa/MarsBotBoardBalance.dev.spec.ts
 *
 * The same card sequences are resolved on EVERY supported board (the library: `marsBotBench.ts`), and each board's
 * yield is summarized — TR, M€, tiles, Failed Actions, milestones claimed, awards funded, the generation of the first
 * claim, when the row's milestone criteria were first met (and how often never), when the milestone / award cells
 * were reached, and the bot's mean award score. The min … max over the ten static boards is THE BAND: a home-made
 * board, and every mat the random-set generator builds (docs/claude/marsbot-dynamic-ma-framework.md §4), must sit
 * inside it. The numbers go into docs/AUTOMA_DATA_AUDIT.md (§22.4 for the band itself).
 */
const SEEDS = 12;
const CARDS = 48;

const describeBench = process.env.TM_BOT_BALANCE === '1' ? describe : describe.skip;

describeBench('MarsBot board balance bench (TM_BOT_BALANCE=1)', () => {
  // `shuffled` — «Random tile placement» with the bot (supported since 2026-11-07): the same sequences on boards whose bonuses moved.
  for (const [variant, extra] of [['base', {}], ['venus+colonies', {venusNextExtension: true, coloniesExtension: true}], ['shuffled', {shuffleMapOption: true}]] as const) {
    it(`tallies every supported board's yield and the band (${variant})`, () => {
      const sequences = benchSequences(SEEDS, CARDS);
      const perMilestone: Array<string> = [];
      // The PRINTED mats only: a map that borrows its board (Hollandia) always plays a generated one — the random-set bench's.
      const summaries = AUTOMA_SUPPORTED_BOARDS.filter((boardName) => marsBotMapProfile(boardName).borrowedBoard === undefined).map((boardName) => {
        const runs = benchConfig({label: `${boardName}-${variant}`, options: {boardName, ...extra}}, sequences);
        // The per-milestone window: when each criterion of the row was first met (mean over the sequences; never = 17).
        for (const name of Object.keys(runs[0].criterionMet)) {
          const gens = runs.map((r) => r.criterionMet[name] ?? neverGeneration(CARDS));
          const never = runs.filter((r) => r.criterionMet[name] === undefined).length;
          perMilestone.push(`${boardName}/${name} ${(gens.reduce((a, b) => a + b, 0) / gens.length).toFixed(1)} (never ${never}/${runs.length})`);
        }
        return summarize(boardName, runs, CARDS);
      });
      console.log(`\nPer-milestone criterion window (${variant}):\n` + perMilestone.join('\n'));
      const band = bandOf(summaries);
      console.log(`\nMarsBot board balance — ${variant} — ${SEEDS} sequences × ${CARDS} cards (3 cards = 1 generation)\n` +
        summaries.map(formatSummary).join('\n') + '\nBAND: ' +
        BAND_METRICS.map((m) => `${m} ${band[m].min.toFixed(2)}…${band[m].max.toFixed(2)}`).join(' | '));
    }).timeout(600_000);
  }
});
