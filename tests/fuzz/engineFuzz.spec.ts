import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {PlayerInput} from '../../src/server/PlayerInput';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {reportServerError} from '../../src/server/diagnostics/serverDiagnostics';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {TestPlayer} from '../TestPlayer';
import {addToReport, FuzzReport, fuzzConfig, newReport, replayFuzzGame, runFuzzGame, silenceEvictionNotes} from './engineFuzz';

/**
 * THE ENGINE FUZZ (FREEZE ZERO, stage 5 — `tests/fuzz/engineFuzz.ts`).
 *
 * IN THE SUITE — a SMOKE: two dozen short games across the config space, and CONTROLS: a defect planted into a real
 * game for each invariant, which its judge must name. The smoke proves the instrument (the same config plays the
 * same game; answers are taken; games move through their phases) and holds the classes it names against THE BASELINE (`engineFuzzBaseline.json` — class key → why it may stand, the first seed that named it):
 * a class that is not on it fails the spec with what replays it. The idiom is the freeze gate's
 * (`scripts/freeze-gate.mjs`, `tests/client/bottle/monkeyBaseline.json`): a finding is CLOSED (and never reaches the
 * baseline) or written down with its reason — never silently tolerated.
 *
 * THE LONG RUN — `npm run fuzz:engine` (a laptop, a nightly job), driven by the environment:
 *
 *   TM_FUZZ_GAMES    how many games (default 200; setting it — or TM_FUZZ=1 — is what switches the long run on)
 *   TM_FUZZ_SEED     the first seed (default 1000); game i plays seed + i
 *   TM_FUZZ_STEPS    the step cap of one game (default 4000 answered questions)
 *   TM_FUZZ_MINUTES  stop starting new games after this many minutes (default: none)
 *   TM_FUZZ_VIEW_EVERY  build the seat's WHOLE view before every n-th answer only (default 5; the suite's smoke: 2)
 *   TM_FUZZ_OUT      a JSON report: the totals, the coverage, every refusal class, every violation with its replay
 *
 * TO STAND ONE FINDING UP AGAIN: `TM_FUZZ_REPLAY=<seed> [TM_FUZZ_STEPS=…] [TM_FUZZ_TRACE=<steps shown>] npm run
 * fuzz:engine` prints that game's violations with the answers before them; in code —
 * `replayFuzzGame(fuzzConfig(<seed>, {maxSteps: <TM_FUZZ_STEPS>}), <step>)` (a seed's config is a function of the seed).
 */

type Baseline = {
  what: string;
  classes: Record<string, {why: string, firstSeed: number}>;
};

const BASELINE_FILE = path.join(__dirname, 'engineFuzzBaseline.json');
const BASELINE = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;

// (Kept short — the suite pays for it on every run: ~2 000 answered questions, every second one with the whole view.)
const SMOKE = {games: 24, firstSeed: 1, steps: 80, viewEvery: 2};

function unknownClasses(report: FuzzReport): Array<string> {
  return report.classes
    .filter((entry) => BASELINE.classes[entry.key] === undefined)
    .map((entry) => `${entry.key}\n      seed ${entry.firstSeed}, step ${entry.first.step} (${entry.count}× in ${entry.games} game(s)) — ${entry.first.what}`);
}

function summary(report: FuzzReport): string {
  const lines = [
    `games ${report.games} · answered ${report.steps} · refused ${report.refused} · ended ${report.ended} · capped ${report.capped} · stuck ${report.stuck} · ${report.stepsPerSecond} steps/s`,
    `answered by type: ${Object.entries(report.answered).sort((a, b) => b[1] - a[1]).map(([type, n]) => `${type} ${n}`).join(' · ')}`,
    `never answered: ${report.neverAnswered.join(', ') || '—'}`,
    `modes: ${Object.entries(report.coverage.modes).map(([mode, n]) => `${mode} ${n}`).join(' · ')}`,
    `distinct cards named by a menu answer: ${report.coverage.distinctCards}`,
    `classes: ${report.classes.length}`,
    ...report.classes.map((entry) => `  ${BASELINE.classes[entry.key] === undefined ? 'NEW  ' : 'known'} ${entry.key} — ${entry.count}× in ${entry.games} game(s), first seed ${entry.firstSeed}`),
  ];
  return lines.join('\n');
}

describe('engineFuzz — random legal games on the real engine', () => {
  // The smoke is played once, by the first test that reads it (a test carries its own timeout).
  let played: FuzzReport | undefined;
  const smokeReport = (): FuzzReport => {
    if (played === undefined) {
      played = newReport();
      for (let i = 0; i < SMOKE.games; i++) {
        addToReport(played, runFuzzGame(fuzzConfig(SMOKE.firstSeed + i, {maxSteps: SMOKE.steps, viewEvery: SMOKE.viewEvery})));
      }
    }
    return played;
  };
  let unsilence = () => {};
  before(() => {
    unsilence = silenceEvictionNotes();
  });
  after(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    unsilence();
  });

  it('the same config plays the same game — a violation is replayable by its seed', () => {
    const config = fuzzConfig(7, {maxSteps: 60});
    const first = runFuzzGame(config);
    const second = runFuzzGame(config);
    expect(first.steps).to.be.greaterThan(0);
    expect(second.digest).to.eq(first.digest);
    expect(second.steps).to.eq(first.steps);
    // …and the config of a seed is a function of the seed alone.
    expect(fuzzConfig(7, {maxSteps: 60})).to.deep.eq(config);
    // The seat's view is READ-ONLY: a game whose whole view is never built is the same game.
    expect(runFuzzGame({...config, viewEvery: 1_000_000}).digest).to.eq(first.digest);
    // The replay stops where it is told to, with its whole trace.
    const replay = replayFuzzGame(config, 9);
    expect(replay.steps).to.eq(10);
    expect(replay.trace?.filter((step) => step.outcome === 'accepted')).to.have.length(10);
  }).timeout(30_000);

  it('the instrument works — answers are taken and games move through their phases', () => {
    const smoke = smokeReport();
    expect(smoke.games).to.eq(SMOKE.games);
    // (A game stopped by a finding answers fewer; the smoke as a whole plays most of what it was given.)
    expect(smoke.steps).to.be.greaterThan(SMOKE.games * SMOKE.steps * 0.7);
    expect(smoke.refused).to.be.lessThan(smoke.steps * 0.2);
    expect(smoke.coverage.phases[Phase.ACTION]).to.be.greaterThan(SMOKE.games * 0.7);
    expect(Object.keys(smoke.coverage.phases).length).to.be.greaterThan(3);
    for (const type of ['or', 'option', 'card', 'initialCards', 'projectCard', 'space', 'payment'] as const) {
      expect(smoke.answered[type], `no «${type}» question was answered`).to.be.greaterThan(0);
    }
    expect(Object.keys(smoke.coverage.modes).length).to.be.greaterThan(3);
  }).timeout(60_000);

  // THE JUDGES ARE NOT BLIND: each invariant is shown a defect planted into a real game (`afterAnswer`) and names it.
  describe('controls — a planted defect is named', () => {
    const config = fuzzConfig(3, {maxSteps: 40});
    type Seat = {waitingFor: PlayerInput | undefined, waitingForCb: (() => void) | undefined};
    const invariantsOf = (plant: (game: IGame, step: number) => void) => {
      const result = runFuzzGame(config, {afterAnswer: plant});
      return {result, invariants: result.violations.map((violation) => violation.invariant)};
    };

    it('I1 — a table that asks nobody', () => {
      const {result, invariants} = invariantsOf((game, step) => {
        if (step === 4) {
          game.players.forEach((player) => (player as TestPlayer).popWaitingFor());
        }
      });
      expect(invariants).to.include('I1');
      expect(result.end).to.eq('stuck');
      expect(result.steps).to.eq(5);
      // …and it carries the steps that led there.
      expect(result.violations.find((violation) => violation.invariant === 'I1')?.trace.length).to.be.at.least(5);
    });

    it('I2 — a question nobody can answer (the judge of the engine, then the generator over the wire model)', () => {
      const {invariants} = invariantsOf((game, step) => {
        if (step === 4) {
          game.players.forEach((player) => (player as TestPlayer).popWaitingFor());
          const seat = game.players[0] as unknown as Seat;
          seat.waitingFor = new SelectPlayer([], 'A planted question');
          seat.waitingForCb = () => {};
        }
      });
      expect(invariants).to.include('I2');
      expect(invariants).to.include('I2-none');
    });

    it('I3 — work left queued under a question that does not continue it', () => {
      const {invariants} = invariantsOf((game, step) => {
        if (step < 10) {
          game.defer(new SimpleDeferredAction(game.players[0], () => undefined));
        }
      });
      expect(invariants).to.include('I3');
    });

    it('I4 — an answer that makes the engine throw, kept with its stack', () => {
      const {result, invariants} = invariantsOf((game, step) => {
        if (step === 4) {
          for (const player of game.players) {
            player.process = () => {
              throw new TypeError('a planted failure');
            };
          }
        }
      });
      expect(invariants).to.include('I4');
      const crash = result.violations.find((violation) => violation.invariant === 'I4');
      expect(crash?.key).to.include('TypeError: a planted failure');
      expect(crash?.stack).to.be.a('string');
      expect(crash?.answer).not.to.eq(undefined);
      expect(crash?.step).to.eq(5);
      expect(result.end).to.eq('stuck');
    });

    it('S — what the server says while it answers', () => {
      const {invariants} = invariantsOf((_game, step) => {
        if (step === 4) {
          reportServerError('a planted report', new Error('said, not thrown'));
        }
      });
      expect(invariants).to.include('S');
    });
  });

  it('names no violation class the baseline does not hold', () => {
    const unknown = unknownClasses(smokeReport());
    expect(unknown, `the fuzz named ${unknown.length} class(es) that are not in engineFuzzBaseline.json — fix the engine / the card, ` +
      `or write the class down with its why:\n    ${unknown.join('\n    ')}\n`).to.deep.eq([]);
  }).timeout(60_000);

  /*
   * THE FUZZ'S FIRST FIND, HELD (2026-11-21, 2 652 whole games): THE EFFECTS OF MARSBOT'S FINAL GREENERIES WERE NEVER
   * PLAYED OUT. `Game.takeNextFinalGreeneryAction` placed them in the bot's slot and went on — to the end of the game —
   * with whatever the placements deferred still queued: seed 10659, a tile beside the Philares player's (the «gain N
   * standard resources» question never asked — M€ decide a tie at the end); seed 1007, a placement bonus counted in
   * the bot's corporation and never paid. A human's final greenery drained the queue; the bot's did not. Both seeds
   * are replayed whole: the game ends with nothing left queued. (A seed is a function of the config space — if the
   * space is widened these two stop telling this story and say only «a whole game ends clean»; the long run is what
   * keeps looking.)
   */
  it('the bot\'s final greeneries are PLAYED OUT — what its tiles set off is asked and paid before the game ends (seeds 10659 · 1007)', () => {
    for (const seed of [10659, 1007]) {
      const result = runFuzzGame(fuzzConfig(seed, {maxSteps: 4000}));
      expect(result.end, `seed ${seed}`).to.eq('ended');
      expect(result.violations.map((violation) => violation.key), `seed ${seed}`).to.deep.eq([]);
    }
  }).timeout(60_000);

  /*
   * THE SECOND RUN's FINDS, HELD (2026-11-22, 5 648 whole games) — each by the seed that named it, replayed whole:
   *  · 55496 — Neptunian Power Consultants: two oceans of one chain, one purse of five; the second bill came due on an
   *    emptied purse — a payment nobody could make (`NeptunianPowerConsultants.spec` holds the card itself);
   *  · 50337 — the World Government's ocean woke a card's question for a seat that still held the sitting's
   *    confirmation: the engine threw «Overwriting waitingFor option with or», and the same answer threw for ever. A
   *    question the deferred queue raises takes the slot; the confirmation is asked again when the slot is free.
   */
  it('the second run\'s finds stay closed — seeds 55496 (a bill nobody can pay) · 50337 (a question over the sitting\'s confirmation)', () => {
    for (const seed of [55496, 50337]) {
      const result = runFuzzGame(fuzzConfig(seed, {maxSteps: 4000}));
      expect(result.end, `seed ${seed}`).to.eq('ended');
      expect(result.violations.map((violation) => violation.key), `seed ${seed}`).to.deep.eq([]);
    }
  }).timeout(60_000);

  it('every baseline row says why it may stand', () => {
    for (const [key, row] of Object.entries(BASELINE.classes)) {
      expect(row.why, key).to.be.a('string').and.not.eq('');
      expect(row.firstSeed, key).to.be.a('number');
    }
  });

  // ONE SEED AGAIN, for a triage: `TM_FUZZ_REPLAY=<seed> [TM_FUZZ_STEPS=…] npm run fuzz:engine` prints what that game
  // named — each violation with the answer that produced it and the steps before it.
  const replaySeed = process.env.TM_FUZZ_REPLAY;
  // (Both are DEFINED only when asked for: the suite's own run must not carry two tests that are pending for ever.)
  const replayOneSeed = () => {
    const result = runFuzzGame(fuzzConfig(Number(replaySeed), {maxSteps: Number(process.env.TM_FUZZ_STEPS ?? 4000)}));
    const {violations, config, ...rest} = result;
    console.log(JSON.stringify({config, ...rest, refusals: undefined}, null, 1));
    for (const violation of violations) {
      const {config: _config, trace, ...what} = violation;
      console.log(`\n── ${violation.key} (${violation.count}×)`);
      console.log(JSON.stringify(what, null, 1));
      console.log(trace.slice(-Number(process.env.TM_FUZZ_TRACE ?? 8)).map((step) => `   ${step.step} ${step.seat} ${step.phase}/${step.generation} ${step.type} «${step.title}» [${step.source}] ${step.outcome}${step.error !== undefined ? ` (${step.error})` : ''}\n       ${step.answer}`).join('\n'));
    }
  };
  if (replaySeed !== undefined) {
    it('REPLAY ONE SEED (TM_FUZZ_REPLAY)', replayOneSeed).timeout(0);
  }

  const theLongRun = async () => {
    const games = Number(process.env.TM_FUZZ_GAMES ?? 200);
    const firstSeed = Number(process.env.TM_FUZZ_SEED ?? 1000);
    const maxSteps = Number(process.env.TM_FUZZ_STEPS ?? 4000);
    const minutes = Number(process.env.TM_FUZZ_MINUTES ?? 0);
    const viewEvery = Number(process.env.TM_FUZZ_VIEW_EVERY ?? 5);
    const out = process.env.TM_FUZZ_OUT;
    const started = Date.now();
    const report = newReport();
    const write = () => {
      if (out !== undefined && out !== '') {
        fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
        fs.writeFileSync(out, JSON.stringify({at: new Date().toISOString(), firstSeed, maxSteps, viewEvery, wallSeconds: Math.round((Date.now() - started) / 1000), ...report}, null, 2));
      }
    };
    for (let i = 0; i < games; i++) {
      if (minutes > 0 && Date.now() - started > minutes * 60_000) {
        break;
      }
      addToReport(report, runFuzzGame(fuzzConfig(firstSeed + i, {maxSteps, viewEvery})));
      // (The engine's saves and broadcasts settle as promises: let them go between games, or they pile up.)
      await new Promise((resolve) => setImmediate(resolve));
      if ((i + 1) % 25 === 0) {
        write();
        console.log(`    … ${report.games} games, ${report.steps} steps, ${report.classes.length} class(es), ${Math.round((Date.now() - started) / 1000)} s`);
      }
    }
    write();
    console.log(summary(report).split('\n').map((line) => `    ${line}`).join('\n'));
    const unknown = unknownClasses(report);
    expect(unknown, `the long run named ${unknown.length} class(es) that are not in engineFuzzBaseline.json:\n    ${unknown.join('\n    ')}\n`).to.deep.eq([]);
  };
  if (replaySeed === undefined && (process.env.TM_FUZZ_GAMES !== undefined || process.env.TM_FUZZ === '1')) {
    it('THE LONG RUN (TM_FUZZ_GAMES / TM_FUZZ_SEED / TM_FUZZ_STEPS / TM_FUZZ_MINUTES / TM_FUZZ_VIEW_EVERY / TM_FUZZ_OUT)', theLongRun).timeout(0);
  }
});
