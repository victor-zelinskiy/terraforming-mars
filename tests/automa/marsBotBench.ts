import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {newProjectCard} from '../../src/server/createCard';
import {resolveProjectCardForBot} from '../../src/server/automa/AutomaCardDraw';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {testGame} from '../TestGame';
import {AutomaTestOptions, testAutomaGame} from './AutomaTestGame';

/**
 * THE MARSBOT BENCH — the library behind the balance dev specs (`MarsBotBoardBalance.dev.spec.ts`, and the
 * generated-mat bench of the random-set framework, docs/claude/marsbot-dynamic-ma-framework.md §4).
 *
 * A sandbox, never a game: the same seeded card sequences (base + corpera project cards) are resolved through the
 * real `resolveProjectCardForBot` on a board, and the board's YIELD is tallied — the bot's TR, its M€ (covered icons,
 * Failed Actions), its tiles, its Failed Actions, the milestones it claimed and the awards it funded, WHEN each
 * milestone criterion of the row was first met, when each milestone / award CELL of its tracks was reached, and its
 * score in every award of the row. No bonus cards, no Corporate Competition, no human moves, no research phase, no
 * production — the pure yield of the printed board under the same tags.
 *
 * GENERATIONS. The bench has no generation of its own; it reads one as `BENCH_CARDS_PER_GENERATION` resolved project
 * cards (the official research phase deals MarsBot 3 project cards a generation — rulebook p.4). The number is a
 * CONVENTION of the bench: every band and every comparison is read in the same unit, never against a real game.
 */
export const BENCH_CARDS_PER_GENERATION = 3;

/** Generation of the i-th resolved card (0-based) — the 1-based generation the bench says it fell in. */
export function benchGeneration(cardIndex: number): number {
  return Math.floor(cardIndex / BENCH_CARDS_PER_GENERATION) + 1;
}

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

/** The seeded card sequences every board of one bench run sees — the SAME cards in the SAME order. */
export function benchSequences(seeds: number, cards: number): Array<Array<CardName>> {
  const [reference] = testGame(2, {}, '-bench-reference');
  const pool = [...reference.projectDeck.drawPile, ...reference.projectDeck.discardPile]
    .filter((c) => c.type !== CardType.PRELUDE).map((c) => c.name);
  const sequences: Array<Array<CardName>> = [];
  for (let s = 1; s <= seeds; s++) {
    sequences.push(shuffled(pool, s).slice(0, cards));
  }
  return sequences;
}

/** One sequence on one board. `undefined` generations = never within the sequence. */
export type BenchRun = {
  tr: number;
  mc: number;
  greenery: number;
  city: number;
  oceans: number;
  failed: number;
  milestonesClaimed: number;
  awardsFunded: number;
  /** The generation of each milestone the bot claimed, in claim order. */
  claimGenerations: Array<number>;
  /** Per milestone of the row: the first generation its bot criterion was met. */
  criterionMet: Record<string, number | undefined>;
  /** Per milestone / award cell of the tracks (`<role>:M<i>` / `<role>:A<i>`): the generation it was reached. */
  cellReached: Record<string, number | undefined>;
  /** Per award of the row: the bot's score at the end. */
  awardScores: Record<string, number>;
  tracks: Record<string, number>;
};

export type BenchConfig = {
  label: string;
  options: AutomaTestOptions;
  /** Runs once the game is built — the hook a generated-mat bench uses to seat its mat. */
  prepare?: (game: IGame) => void;
};

/** Resolves every sequence on one configuration and returns one record per sequence. */
export function benchConfig(config: BenchConfig, sequences: ReadonlyArray<ReadonlyArray<CardName>>): Array<BenchRun> {
  const runs: Array<BenchRun> = [];
  sequences.forEach((sequence, s) => {
    const [game, , bot] = testAutomaGame({...config.options, seed: (s + 1) / 100}, `-bench-${config.label}-${s}`);
    config.prepare?.(game);
    const automa = game.automa!;
    const startTr = bot.terraformRating;
    const criterionMet: Record<string, number | undefined> = {};
    const cellReached: Record<string, number | undefined> = {};
    const cells: Array<{key: string, track: number, at: number}> = [];
    automa.board.tracks.forEach((t, ti) => {
      t.definition.layout.forEach((a, i) => {
        if (a === 'milestone' || a === 'award') {
          const key = `${t.definition.role}:${a === 'milestone' ? 'M' : 'A'}${i}`;
          cells.push({key, track: ti, at: i});
          cellReached[key] = undefined;
        }
      });
    });
    for (const m of game.milestones) {
      criterionMet[m.name] = undefined;
    }
    const claimGenerations: Array<number> = [];
    let claimed = 0;
    for (let i = 0; i < sequence.length; i++) {
      const card = newProjectCard(sequence[i]);
      if (card === undefined) {
        continue;
      }
      resolveProjectCardForBot(game, card);
      const generation = benchGeneration(i);
      for (const m of game.milestones) {
        if (criterionMet[m.name] === undefined && AutomaMAEvaluation.botMilestoneMet(m, game)) {
          criterionMet[m.name] = generation;
        }
      }
      for (const cell of cells) {
        if (cellReached[cell.key] === undefined && automa.board.tracks[cell.track].position >= cell.at) {
          cellReached[cell.key] = generation;
        }
      }
      const nowClaimed = game.claimedMilestones.filter((m) => m.player === bot).length;
      for (; claimed < nowClaimed; claimed++) {
        claimGenerations.push(generation);
      }
    }
    const awardScores: Record<string, number> = {};
    for (const a of game.awards) {
      awardScores[a.name] = AutomaMAEvaluation.botAwardScore(a, game);
    }
    const tracks: Record<string, number> = {};
    for (const t of automa.board.tracks) {
      tracks[t.definition.role] = t.position;
    }
    runs.push({
      tr: bot.terraformRating - startTr,
      mc: bot.megaCredits,
      greenery: game.board.spaces.filter((sp) => sp.player === bot && Board.isGreenerySpace(sp)).length,
      city: game.board.spaces.filter((sp) => sp.player === bot && Board.isCitySpace(sp)).length,
      oceans: game.board.spaces.filter((sp) => Board.isOceanSpace(sp)).length,
      failed: automa.failedActions,
      milestonesClaimed: claimed,
      awardsFunded: game.fundedAwards.filter((a) => a.player === bot).length,
      claimGenerations,
      criterionMet,
      cellReached,
      awardScores,
      tracks,
    });
  });
  return runs;
}

/** The never-reached generation the averages read — one past the sequence, so «never» weighs as «late», not as 0. */
export function neverGeneration(cards: number): number {
  return benchGeneration(cards - 1) + 1;
}

/** The per-configuration summary a band is taken over. */
export type BenchSummary = {
  label: string;
  tr: number;
  mc: number;
  tiles: number;
  failed: number;
  milestonesClaimed: number;
  awardsFunded: number;
  /** Mean generation of the bot's FIRST claim (never = one past the sequence). */
  firstClaim: number;
  /** Mean generation, over the row's milestones and the sequences, at which a bot criterion was first met. */
  criterionMet: number;
  /** Share of (milestone × sequence) pairs whose bot criterion was never met. */
  criterionNever: number;
  /** Mean generation at which the milestone cells / award cells were reached. */
  milestoneCell: number;
  awardCell: number;
  /** Mean bot score over the row's awards. */
  awardScore: number;
};

const mean = (xs: ReadonlyArray<number>) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function summarize(label: string, runs: ReadonlyArray<BenchRun>, cards: number): BenchSummary {
  const never = neverGeneration(cards);
  const criteria: Array<number> = [];
  let nevers = 0;
  const mCells: Array<number> = [];
  const aCells: Array<number> = [];
  for (const r of runs) {
    for (const g of Object.values(r.criterionMet)) {
      criteria.push(g ?? never);
      if (g === undefined) {
        nevers++;
      }
    }
    for (const [key, g] of Object.entries(r.cellReached)) {
      (key.includes(':M') ? mCells : aCells).push(g ?? never);
    }
  }
  return {
    label,
    tr: mean(runs.map((r) => r.tr)),
    mc: mean(runs.map((r) => r.mc)),
    tiles: mean(runs.map((r) => r.greenery + r.city)),
    failed: mean(runs.map((r) => r.failed)),
    milestonesClaimed: mean(runs.map((r) => r.milestonesClaimed)),
    awardsFunded: mean(runs.map((r) => r.awardsFunded)),
    firstClaim: mean(runs.map((r) => r.claimGenerations[0] ?? never)),
    criterionMet: mean(criteria),
    criterionNever: criteria.length === 0 ? 0 : nevers / criteria.length,
    milestoneCell: mean(mCells),
    awardCell: mean(aCells),
    awardScore: mean(runs.flatMap((r) => Object.values(r.awardScores))),
  };
}

/** The metrics a band spans, in print order. */
export const BAND_METRICS: ReadonlyArray<keyof Omit<BenchSummary, 'label'>> = [
  'tr', 'mc', 'tiles', 'failed', 'milestonesClaimed', 'awardsFunded', 'firstClaim', 'criterionMet', 'criterionNever',
  'milestoneCell', 'awardCell', 'awardScore',
];

export type Band = Record<keyof Omit<BenchSummary, 'label'>, {min: number, max: number}>;

/** min … max of every metric over a set of summaries — the band a candidate must sit inside. */
export function bandOf(summaries: ReadonlyArray<BenchSummary>): Band {
  const band = {} as Band;
  for (const metric of BAND_METRICS) {
    const values = summaries.map((s) => s[metric]);
    band[metric] = {min: Math.min(...values), max: Math.max(...values)};
  }
  return band;
}

export function formatSummary(s: BenchSummary): string {
  return `${s.label.padEnd(26)} ` + BAND_METRICS.map((m) => `${m} ${s[m].toFixed(m === 'criterionNever' ? 2 : 1)}`).join(' | ');
}
