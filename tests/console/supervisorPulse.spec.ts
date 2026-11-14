import {expect} from 'chai';
import {causeOf} from '../../src/common/diagnostics/cause';
import {PULSE_MISSED_LOOKS, PULSE_REST, PulseState, pulseStep} from '../../src/client/console/session/supervisorPulse';

/**
 * WHO WATCHES THE WATCHER (docs/claude/console/freeze-zero/PLAN.md §4 · 6 / 7, decision F11 —
 * `src/client/console/session/supervisorPulse.ts`).
 *
 * The console's last line is asked by the liveness arbiter — one pass of the shell's supervisor. A game screen whose
 * supervisor completes no pass (no shell at all; a pass that throws) had nobody to ask for it. The witness outside
 * the shell reads the count of completed passes; this is its decision, look by look.
 */
describe('the supervisor\'s pulse — one look of the witness', () => {
  /** Walk the looks; return the index of every look at which the last line was due. */
  function walk(looks: ReadonlyArray<{watched: boolean, passes: number}>): Array<number> {
    let state: PulseState = PULSE_REST;
    const due: Array<number> = [];
    looks.forEach((look, at) => {
      const step = pulseStep(state, look);
      state = step.state;
      if (step.due) {
        due.push(at);
      }
    });
    return due;
  }

  it('a supervisor that RUNS is never due — the count moves between any two looks', () => {
    expect(walk(Array.from({length: 40}, (_, at) => ({watched: true, passes: at * 5})))).to.deep.eq([]);
  });

  it('a game screen with NO completed pass is due at the third miss in a row — the first look is only a baseline', () => {
    expect(PULSE_MISSED_LOOKS).to.eq(3);
    // look 0 = the baseline, looks 1 – 3 = the three misses.
    expect(walk(Array.from({length: 4}, () => ({watched: true, passes: 7})))).to.deep.eq([3]);
  });

  it('ONE pass between two looks is a supervisor that runs — the misses start over', () => {
    expect(walk([
      {watched: true, passes: 7}, {watched: true, passes: 7}, {watched: true, passes: 7},
      {watched: true, passes: 8}, // it passed once: back to rest
      {watched: true, passes: 8}, {watched: true, passes: 8},
    ])).to.deep.eq([]);
  });

  it('what is NOT WATCHED is never a miss — the curtain, a hidden page, no game screen: the next watched look is a baseline', () => {
    const looks = [
      {watched: true, passes: 7}, {watched: true, passes: 7}, {watched: true, passes: 7}, // two misses…
      {watched: false, passes: 7}, // …the curtain rose (or the page was hidden, or the route left the game)
      {watched: true, passes: 7}, // a baseline again — the count it had is no evidence
      {watched: true, passes: 7}, {watched: true, passes: 7},
    ];
    expect(walk(looks)).to.deep.eq([]);
    expect(walk([...looks, {watched: true, passes: 7}]), 'three misses in a row AFTER the baseline').to.deep.eq([7]);
  });

  it('a REFUSED rebuild is asked for again a full three looks later — never at every look', () => {
    expect(walk(Array.from({length: 11}, () => ({watched: true, passes: 0})))).to.deep.eq([3, 6, 9]);
  });

  it('its rebuild is a DEFECT under its OWN cause — apart from a spent ladder\'s, and the two silences apart from each other', () => {
    const noPass = causeOf('[session-rebuild] page — «no-pass» (card#12) — by pulse: the supervisor completed no pass in 15s — its pass does not reach the arbiter', 'warn');
    const noShell = causeOf('[session-rebuild] page — «no-shell» (no question) — by pulse: the game screen stands and no supervisor runs for 15s — the shell is not there', 'warn');
    expect(noPass).to.deep.include({cls: 'session-rebuild/page/no-pass', tier: 'defect'});
    expect(noShell).to.deep.include({cls: 'session-rebuild/page/no-shell', tier: 'defect'});
    expect(noPass?.dims).to.deep.include({by: 'pulse'});
  });
});
