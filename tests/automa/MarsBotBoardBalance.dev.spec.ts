import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {newProjectCard} from '../../src/server/createCard';
import {resolveProjectCardForBot} from '../../src/server/automa/AutomaCardDraw';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {Board} from '../../src/server/boards/Board';
import {testGame} from '../TestGame';
import {testAutomaGame} from './AutomaTestGame';

/**
 * THE BOT-BOARD BALANCE BENCH — a DEV spec, run on demand:
 *
 *   TM_BOT_BALANCE=1 npx mocha --import=tsx --require tests/testing/setup.ts tests/automa/MarsBotBoardBalance.dev.spec.ts
 *
 * The same card sequences (base + corpera project cards, `CARDS` per game, `SEEDS` sequences) are resolved through
 * the real `resolveProjectCardForBot` on EVERY supported board, and the board's YIELD is tallied: the bot's TR, its
 * M€ (covered icons, Failed Actions), its tiles, the milestones it claimed and the awards it funded, its Failed
 * Actions, and where its tracks ended. The point is a HOME-MADE board (docs/claude/marsbot-fan-map-checklist.md
 * §8): its numbers must sit inside the band the six official boards span — a board visibly stronger or weaker is
 * re-tuned before it ships. The numbers of each adaptation go into docs/AUTOMA_DATA_AUDIT.md (§17.8 for the
 * fan-made Vastitas Borealis).
 *
 * A sandbox, never a game: no bonus cards, no Corporate Competition spending, no human, no research phase, no
 * production — the pure yield of the printed board under the same tags. The sequences are seeded by a small
 * LCG over one reference deck, so every board sees the very same cards in the very same order.
 */
const SEEDS = 12;
const CARDS = 48;

function shuffled<T>(items: ReadonlyArray<T>, seed: number): Array<T> {
  const out = [...items];
  let state = seed * 2654435761 >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const describeBench = process.env.TM_BOT_BALANCE === '1' ? describe : describe.skip;

describeBench('MarsBot board balance bench (TM_BOT_BALANCE=1)', () => {
  it('tallies every supported board\'s yield over the same card sequences', () => {
    const [reference] = testGame(2, {}, '-balance-reference');
    const pool = [...reference.projectDeck.drawPile, ...reference.projectDeck.discardPile]
      .filter((c) => c.type !== CardType.PRELUDE).map((c) => c.name);
    const sequences: Array<Array<CardName>> = [];
    for (let s = 1; s <= SEEDS; s++) {
      sequences.push(shuffled(pool, s).slice(0, CARDS));
    }
    const rows: Array<string> = [];
    for (const board of AUTOMA_SUPPORTED_BOARDS) {
      const sums = {tr: 0, mc: 0, greenery: 0, city: 0, ocean: 0, milestones: 0, awards: 0, failed: 0, maxTrack: 0, minTrack: 0, sumTracks: 0, temperature: 0, oxygen: 0};
      const perRole: Record<string, number> = {};
      const mid = {tr: 0, mc: 0, milestones: 0};
      for (let s = 0; s < SEEDS; s++) {
        const [game, , bot] = testAutomaGame({boardName: board, seed: (s + 1) / 100}, `-bal-${board}-${s}`);
        const startTr = bot.terraformRating;
        for (let i = 0; i < CARDS; i++) {
          const card = newProjectCard(sequences[s][i]);
          if (card === undefined) {
            continue;
          }
          resolveProjectCardForBot(game, card);
          if (i === CARDS / 2 - 1) {
            mid.tr += bot.terraformRating - startTr;
            mid.mc += bot.megaCredits;
            mid.milestones += game.claimedMilestones.filter((m) => m.player === bot).length;
          }
        }
        sums.tr += bot.terraformRating - startTr;
        sums.mc += bot.megaCredits;
        sums.greenery += game.board.spaces.filter((sp) => sp.player === bot && Board.isGreenerySpace(sp)).length;
        sums.city += game.board.spaces.filter((sp) => sp.player === bot && Board.isCitySpace(sp)).length;
        sums.ocean += game.board.spaces.filter((sp) => Board.isOceanSpace(sp)).length;
        sums.milestones += game.claimedMilestones.filter((m) => m.player === bot).length;
        sums.awards += game.fundedAwards.filter((a) => a.player === bot).length;
        sums.failed += game.automa!.failedActions;
        sums.temperature += game.getTemperature();
        sums.oxygen += game.getOxygenLevel();
        const positions = game.automa!.board.tracks.map((t) => t.position);
        sums.maxTrack += Math.max(...positions);
        sums.minTrack += Math.min(...positions);
        sums.sumTracks += positions.reduce((a, b) => a + b, 0);
        for (const t of game.automa!.board.tracks) {
          perRole[t.definition.role] = (perRole[t.definition.role] ?? 0) + t.position;
        }
      }
      const avg = (n: number) => (n / SEEDS).toFixed(1);
      rows.push(
        `${board.padEnd(24)} TR+${avg(sums.tr)} (mid ${avg(mid.tr)}) | M€ ${avg(sums.mc)} (mid ${avg(mid.mc)}) | ` +
        `greenery ${avg(sums.greenery)} city ${avg(sums.city)} oceans ${avg(sums.ocean)} | ` +
        `M ${avg(sums.milestones)} (mid ${avg(mid.milestones)}) A ${avg(sums.awards)} | failed ${avg(sums.failed)} | ` +
        `temp ${avg(sums.temperature)} O₂ ${avg(sums.oxygen)} | tracks Σ${avg(sums.sumTracks)} max ${avg(sums.maxTrack)} min ${avg(sums.minTrack)} | ` +
        Object.entries(perRole).map(([r, v]) => `${r}:${avg(v)}`).join(' '));
    }
    console.log(`\nMarsBot board balance — ${SEEDS} sequences × ${CARDS} cards (base + corpera), averages per game\n` + rows.join('\n'));
  }).timeout(600_000);
});
