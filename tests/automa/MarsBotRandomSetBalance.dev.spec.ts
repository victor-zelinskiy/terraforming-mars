import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {MilestoneName} from '../../src/common/ma/MilestoneName';
import {AwardName} from '../../src/common/ma/AwardName';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {GameOptions} from '../../src/server/game/GameOptions';
import {getCandidates} from '../../src/server/ma/MilestoneAwardSelector';
import {randomExclusionGroup} from '../../src/server/ma/MilestoneAwardExclusions';
import {botMilestoneRule} from '../../src/server/automa/ma/botMAInterpreter';
import {Band, bandOf, BAND_METRICS, BenchRun, benchConfig, benchSequences, BenchSummary, neverGeneration, summarize} from './marsBotBench';
import {seatRandomSet} from './ma/matTestGame';
import {testAutomaGame} from './AutomaTestGame';
import {IGame} from '../../src/server/IGame';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';

/**
 * THE RANDOM-SET BENCH — a DEV spec, run on demand (the prompt's § Баланс 4):
 *
 *   TM_BOT_BALANCE=1 npx mocha --import=tsx --require tests/testing/setup.ts tests/automa/MarsBotRandomSetBalance.dev.spec.ts
 *
 * The same seeded card sequences as the static bench (`MarsBotBoardBalance.dev.spec.ts`), resolved on the mats the
 * generator deals for seeded random sets (the real candidate pools, the maps in turn). Each set's yield is summarized
 * like a static board's and read against THE BAND the ten static boards span, taken in the same run: the mat's yield
 * (TR, M€, tiles, Failed, the milestone / award cells), the claims, and the window of the set's TRACK criteria (when a
 * criterion the bot reads off its tracks is first met — the official window, §22.4). Numbers go to the audit (§22.6).
 *
 * `TM_BOT_SETS` (default 300), `TM_BOT_VARIANT` = base | corps | redux.
 */
const SEEDS = 12;
const CARDS = 48;
const SETS = Number(process.env.TM_BOT_SETS ?? 300);
const VARIANT = process.env.TM_BOT_VARIANT ?? 'base';

/** The maps that print a mat of their own — the band's members. */
const PRINTED_BOARDS = AUTOMA_SUPPORTED_BOARDS.filter((boardName) => marsBotMapProfile(boardName).borrowedBoard === undefined);
const PINNED_BOARD = AUTOMA_SUPPORTED_BOARDS.find((boardName) => boardName === process.env.TM_BOT_BOARD);

/** The official window of the track criteria (§22.4): earliest / latest mean generation on the six official boards. */
const OFFICIAL_WINDOW = {min: 4.3, max: 13.3};

/** The bench's metrics a generated mat is held to (a set's ROW metrics — criterion / award score — vary with the set). */
const MAT_METRICS: ReadonlyArray<keyof Omit<BenchSummary, 'label'>> =
  ['tr', 'mc', 'mcIcons', 'tiles', 'failed', 'milestonesClaimed', 'awardsFunded', 'firstClaim', 'milestoneCell', 'awardCell'];

function lcg(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T extends string>(candidates: ReadonlyArray<T>, n: number, rnd: () => number, used: Set<string>): Array<T> {
  const pool = [...candidates];
  const out: Array<T> = [];
  while (out.length < n && pool.length > 0) {
    const [name] = pool.splice(Math.floor(rnd() * pool.length), 1);
    const group = randomExclusionGroup(name as MilestoneName | AwardName);
    if (group !== undefined && used.has(group)) {
      continue;
    }
    if (group !== undefined) {
      used.add(group);
    }
    out.push(name);
  }
  return out;
}

const isTrackRule = (name: string) => {
  const kind = botMilestoneRule(name)?.criterion.kind;
  return kind === 'track' || kind === 'tracks';
};

function trackWindow(runs: ReadonlyArray<BenchRun>): {mean: number, never: number, names: Array<string>} {
  const gens: Array<number> = [];
  let never = 0;
  const names = Object.keys(runs[0].criterionMet).filter(isTrackRule);
  for (const r of runs) {
    for (const name of names) {
      const g = r.criterionMet[name];
      gens.push(g ?? neverGeneration(CARDS));
      if (g === undefined) {
        never++;
      }
    }
  }
  return {mean: gens.length === 0 ? Number.NaN : gens.reduce((a, b) => a + b, 0) / gens.length, never: gens.length === 0 ? 0 : never / gens.length, names};
}

function quantiles(values: ReadonlyArray<number>): string {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return `min ${q(0).toFixed(2)} · p10 ${q(0.1).toFixed(2)} · median ${q(0.5).toFixed(2)} · p90 ${q(0.9).toFixed(2)} · max ${q(1).toFixed(2)}`;
}

const describeBench = process.env.TM_BOT_BALANCE === '1' ? describe : describe.skip;

describeBench(`MarsBot random-set bench (TM_BOT_BALANCE=1, ${VARIANT})`, () => {
  it(`${SETS} random sets on generated mats against the band of the static boards`, () => {
    const extra = VARIANT === 'redux' ? {turmoilReduxExpansion: true, coloniesExtension: true} : {};
    const corps = VARIANT === 'corps' ?
      [MarsBotCorpId.CF1_FERRUS_ACADEMY, MarsBotCorpId.CF2_VEYNON_DYNAMICS, MarsBotCorpId.CF3_POLDERTECH_DUTCH, MarsBotCorpId.CF4_MONS_INSURANCE,
        MarsBotCorpId.CF5_ARWIND_INC, MarsBotCorpId.CF6_HARTLAN_HEATING, MarsBotCorpId.CF7_LOTUS_INNOVATIONS, MarsBotCorpId.CF8_PROTEUS,
        MarsBotCorpId.CF9_DEIMOS_GROUP, MarsBotCorpId.CF10_TITAN_HOLDINGS] : [undefined];
    const sequences = benchSequences(SEEDS, CARDS);
    // THE BAND — the ten static boards in this same configuration.
    // The bot's corporation is seated at the generation-1 gate, which the sandbox never reaches — seat it by hand.
    const seat = (game: IGame) => {
      if (VARIANT === 'corps') {
        AutomaCorporations.onActionPhaseStart(game);
      }
    };
    // (A map that prints no board — Hollandia, on its borrowed Tharsis rows — has no static mat to put in the band.)
    const statics = PRINTED_BOARDS.map((boardName, b) =>
      summarize(boardName, benchConfig({label: `static-${boardName}`,
        options: {boardName, ...extra, ...(corps[b % corps.length] !== undefined ? {corporation: corps[b % corps.length]} : {})},
        prepare: seat}, sequences), CARDS));
    const band: Band = bandOf(statics);
    const [reference] = testAutomaGame(extra, '-rs-pool');
    const rnd = lcg(1106);
    const summaries: Array<BenchSummary> = [];
    const windows: Array<number> = [];
    const nevers: Array<number> = [];
    const firstClaims: Array<number> = [];
    const late: Array<string> = [];
    for (let s = 0; s < SETS; s++) {
      const modular = s % 2 === 1;
      const poolOptions: GameOptions = {...reference.gameOptions, randomMA: modular ? RandomMAOptionType.UNLIMITED : RandomMAOptionType.ALL, modularMA: modular};
      const [milestonePool, awardPool] = getCandidates(poolOptions);
      const used = new Set<string>();
      const set = {milestones: pick(milestonePool, 5, rnd, used), awards: pick(awardPool, 5, rnd, used)};
      // `TM_BOT_BOARD=<name>` pins every set to one map (Hollandia's own numbers — docs/AUTOMA_DATA_AUDIT.md §23).
      const boardName = PINNED_BOARD ?? AUTOMA_SUPPORTED_BOARDS[s % AUTOMA_SUPPORTED_BOARDS.length];
      const corporation = corps[s % corps.length];
      const runs = benchConfig({
        label: `rs-${s}`,
        options: {boardName, ...extra, ...(corporation !== undefined ? {corporation} : {})},
        prepare: (game) => {
          seatRandomSet(game, set);
          seat(game);
        },
      }, sequences);
      let matNote = '';
      if (process.env.TM_BOT_DEBUG === '1') {
        const [probe] = testAutomaGame({boardName, ...extra}, `-rs-probe-${s}`);
        seatRandomSet(probe, set);
        const report = probe.automa!.mat!.report;
        matNote = ` {${report.topology}${report.topology === report.baseTopology ? '' : ' MOVED'} rows ${report.rows.filter((r) => r.replaced).map((r) => `${r.role}<${r.source}`).join(',')} · ${report.repairs.join(' · ')}}`;
      }
      if (process.env.TM_BOT_BYBIAS === '1') {
        const [probe] = testAutomaGame({boardName, ...extra}, `-rs-bias-${s}`);
        seatRandomSet(probe, set);
        const bias = probe.automa!.mat!.report.placement.find((p) => !p.includes('after the icons')) ?? 'none';
        const r = summarize('x', runs, CARDS);
        // One TSV line per set: the competing rule, who asked, the map, the mat M€, TR, tiles (the per-bias deficit table).
        console.log(['BIAS', bias.replace(/ \(.*$/, ''), bias.replace(/^.*\(/, '').replace(/\)$/, ''), boardName,
          r.mcIcons.toFixed(1), r.tr.toFixed(1), r.tiles.toFixed(1)].join('\t'));
      }
      const summary = summarize(`#${s} ${boardName} [${set.milestones.join(', ')} | ${set.awards.join(', ')}]${matNote}`, runs, CARDS);
      summaries.push(summary);
      firstClaims.push(...runs.map((r) => r.claimGenerations[0] ?? neverGeneration(CARDS)));
      const w = trackWindow(runs);
      if (w.names.length > 0) {
        windows.push(w.mean);
        nevers.push(w.never);
        if (w.mean > OFFICIAL_WINDOW.max || w.never > 4 / 12) {
          late.push(`#${s} ${boardName} [${w.names.join(', ')}] mean ${w.mean.toFixed(1)} never ${(w.never * 100).toFixed(0)}%`);
        }
      }
    }
    const lines: Array<string> = [];
    for (const metric of MAT_METRICS) {
      const values = summaries.map((x) => x[metric]);
      const outside = values.filter((v) => v < band[metric].min - 1e-9 || v > band[metric].max + 1e-9).length;
      lines.push(`${metric.padEnd(18)} band ${band[metric].min.toFixed(2)}…${band[metric].max.toFixed(2)} | sets ${quantiles(values)} | outside ${outside}/${SETS}`);
    }
    const mean = (xs: ReadonlyArray<number>) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = (xs: ReadonlyArray<number>) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
    const officialClaims = statics.slice(0, 6).map((x) => x.firstClaim);
    if (process.env.TM_BOT_DEBUG === '1') {
      const worst = (metric: 'mcIcons' | 'tr') => [...summaries].sort((a, b) => a[metric] - b[metric]).slice(0, 15)
        .map((x) => `${x.label} icons ${x.mcIcons.toFixed(1)} tr ${x.tr.toFixed(1)} tiles ${x.tiles.toFixed(1)}`).join('\n');
      console.log(`LOWEST ICON M€:\n${worst('mcIcons')}\nLOWEST TR:\n${worst('tr')}\nSTATIC:\n` +
        statics.map((x) => `${x.label} icons ${x.mcIcons.toFixed(1)} tr ${x.tr.toFixed(1)} tiles ${x.tiles.toFixed(1)}`).join('\n'));
    }
    console.log(`\nRANDOM-SET BENCH (${VARIANT}) — ${SETS} sets × ${SEEDS} sequences × ${CARDS} cards\n` + lines.join('\n') +
      `\ntrack-criterion window (mean per set): ${quantiles(windows)} | official ${OFFICIAL_WINDOW.min}…${OFFICIAL_WINDOW.max}` +
      `\ntrack-criterion «never» share per set: ${quantiles(nevers)}` +
      `\nfirst claim per sequence: mean ${mean(firstClaims).toFixed(2)} sd ${sd(firstClaims).toFixed(2)} | official boards' means ${officialClaims.map((v) => v.toFixed(1)).join(' ')}` +
      `\nsets with a late / never track window (${late.length}): ${late.slice(0, 30).join(' · ')}` +
      `\nstatic band: ` + BAND_METRICS.map((m) => `${m} ${band[m].min.toFixed(2)}…${band[m].max.toFixed(2)}`).join(' | '));
  }).timeout(3_600_000);
});
