import {expect} from 'chai';
import {
  initialLivenessState,
  LIVENESS_GRACE_MS,
  LIVENESS_PRESSED_GRACE_MS,
  LIVENESS_PRESSES_NO_EFFECT,
  LIVENESS_RUNG_GAP_MS,
  LivenessSample,
  LivenessState,
  LivenessRung,
  livenessLadder,
  observeLiveness,
  registerLivenessRelease,
  resetLiveness,
  restoreLivenessLadderForTest,
  runLivenessRung,
  takeLivenessLadderForTest,
  tickLiveness,
} from '@/client/console/consoleLiveness';

/**
 * THE LIVENESS ARBITER — the player must be able to act: a question with no accepting surface and nothing in flight
 * for the grace, or presses that change nothing, is a stall whatever its cause; the cure is a ladder, one rung per
 * tick, named.
 */
describe('consoleLiveness', () => {
  // The real owners register their rungs at import — the specs below compose their OWN ladder and give the real one back.
  let realLadder: Array<LivenessRung> = [];
  beforeEach(() => {
    realLadder = takeLivenessLadderForTest();
  });
  afterEach(() => {
    resetLiveness();
    restoreLivenessLadderForTest(realLadder);
  });

  const sample = (now: number, over: Partial<LivenessSample> = {}): LivenessSample =>
    ({now, promptLive: true, accepting: false, inFlight: [], presses: 0, signature: 'same', ...over});

  function walk(samples: ReadonlyArray<LivenessSample>) {
    let state: LivenessState = initialLivenessState();
    return samples.map((s) => {
      const r = observeLiveness(state, s);
      state = r.state;
      return r.verdict;
    });
  }
  const seconds = (n: number, over: (t: number) => Partial<LivenessSample> = () => ({})) =>
    Array.from({length: n + 1}, (_, i) => sample(i * 1000, over(i * 1000)));

  it('a question with NO accepting surface and nothing in flight is a stall at the grace', () => {
    const v = walk(seconds(LIVENESS_GRACE_MS / 1000));
    expect(v.slice(0, -1).every((x) => !x.stalled)).is.true;
    const last = v[v.length - 1];
    expect(last.stalled && last.reason).to.equal('unserved');
    expect(last.stalled && last.first).is.true;
    expect(last.stalled && last.rung).to.equal(0);
  });

  it('an accepting surface is never a stall, however long the player reads it', () => {
    expect(walk(seconds(120, () => ({accepting: true}))).some((x) => x.stalled)).is.false;
  });

  it('something IN FLIGHT keeps the screen honest — the clock restarts from the last moment anything moved', () => {
    const v = walk(seconds(20 + LIVENESS_GRACE_MS / 1000, (t) => ({inFlight: t <= 20_000 ? ['transport'] : []})));
    const first = v.findIndex((x) => x.stalled);
    expect(first * 1000).to.equal(20_000 + LIVENESS_GRACE_MS);
    const x = v[first];
    expect(x.stalled && x.lastInFlight).to.deep.equal(['transport']);
  });

  it('the picture CHANGING is progress — a signature that moves restarts the clock', () => {
    expect(walk(seconds(40, (t) => ({signature: `s${Math.floor(t / 4000)}`}))).some((x) => x.stalled)).is.false;
  });

  it('A / B presses that change NOTHING are a stall sooner — an absorbed pad by every press, even with no question', () => {
    // Three presses over the first 3 s (the first tick always 'moves' — the signature is born), the picture never moves.
    const v = walk(seconds(LIVENESS_PRESSED_GRACE_MS / 1000, (t) => ({promptLive: false, accepting: false, presses: Math.min(3, Math.floor(t / 1000))})));
    const last = v[v.length - 1];
    expect(last.stalled && last.reason).to.equal('presses-no-effect');
    expect(last.stalled && last.presses).to.be.at.least(LIVENESS_PRESSES_NO_EFFECT);
    // …but fewer presses than the threshold never do.
    expect(walk(seconds(30, () => ({promptLive: false, accepting: false, presses: LIVENESS_PRESSES_NO_EFFECT - 1}))).some((x) => x.stalled)).is.false;
  });

  it('a screen that ACCEPTS is judged only by the A / B nobody took — the deaf screen, never a surface that answered quietly', () => {
    // The pass-confirm panel (console-workspace-band, 2026-10-31): presses a surface TOOK and answered with nothing
    // visible (A on a disabled tile while the player thinks) are no evidence.
    const taken = walk(seconds(30, (t) => ({promptLive: true, accepting: true, presses: Math.min(6, Math.floor(t / 1000)), dropped: 0})));
    expect(taken.some((x) => x.stalled), 'presses a surface took').is.false;
    // …while three A / B NO handler took are the deaf screen that claims to accept.
    const deaf = walk(seconds(LIVENESS_PRESSED_GRACE_MS / 1000, (t) => {
      const n = Math.min(3, Math.floor(t / 1000));
      return {promptLive: false, accepting: true, presses: n, dropped: n};
    }));
    const last = deaf[deaf.length - 1];
    expect(last.stalled && last.reason).to.equal('presses-no-effect');
  });

  it('…and on a frame PAST ITS COMMIT a B a handler TOOK that moved nothing is the deaf screen too (the chairman quest, 2026-11-07)', () => {
    // The quest's leaked beat: the section's handler took every B («a beat absorbs it») with nothing left in flight,
    // over the next action menu — `accepting: true` for the screen's whole life.
    const deaf = walk(seconds(LIVENESS_PRESSED_GRACE_MS / 1000, (t) => {
      const n = Math.min(3, Math.floor(t / 1000));
      return {promptLive: true, accepting: true, presses: n, dropped: 0, backTaken: n, backJudged: true};
    }));
    const last = deaf[deaf.length - 1];
    expect(last.stalled && last.reason).to.equal('presses-no-effect');
    // A taken B anywhere else (a browse layer, a verdict, a board home) is no evidence — it may honestly do nothing.
    const honest = walk(seconds(30, (t) => {
      const n = Math.min(6, Math.floor(t / 1000));
      return {promptLive: true, accepting: true, presses: n, dropped: 0, backTaken: n, backJudged: false};
    }));
    expect(honest.some((x) => x.stalled), 'a taken B off a committed frame').is.false;
    // …and a B that DID move the picture restarts the clock, judged or not.
    const moving = walk(seconds(30, (t) => {
      const n = Math.min(6, Math.floor(t / 1000));
      return {promptLive: true, accepting: true, presses: n, backTaken: n, backJudged: true, signature: `s${n}`};
    }));
    expect(moving.some((x) => x.stalled), 'a B that collapsed something').is.false;
  });

  it('an idle accepting screen with no question and no presses is not judged at all', () => {
    const v = walk(seconds(60, () => ({promptLive: false, accepting: true})));
    expect(v.some((x) => x.stalled)).is.false;
  });

  it('the ladder climbs ONE rung per gap and reports the stall once', () => {
    let state = initialLivenessState();
    const rungs: Array<number | undefined> = [];
    const firsts: Array<boolean> = [];
    for (let t = 0; t <= LIVENESS_GRACE_MS + 3 * LIVENESS_RUNG_GAP_MS; t += 1000) {
      const r = observeLiveness(state, sample(t));
      state = r.state;
      if (r.verdict.stalled) {
        rungs.push(r.verdict.rung);
        firsts.push(r.verdict.first);
      }
    }
    expect(rungs.filter((r) => r !== undefined)).to.deep.equal([0, 1, 2, 3]);
    expect(firsts.filter(Boolean).length).to.equal(1);
    // Progress resets everything: the next stall starts at rung 0 and reports again.
    const moved = observeLiveness(state, sample(99_000, {signature: 'moved'}));
    expect(moved.verdict.stalled).is.false;
    expect(moved.state.rung).to.equal(0);
  });

  it('the registered releases run by RANK, each named, nothing twice', () => {
    const log: Array<string> = [];
    registerLivenessRelease({rank: 20, name: 'flow', release: () => {
      log.push('flow'); return 'concluded';
    }});
    registerLivenessRelease({rank: 0, name: 'stories', release: () => {
      log.push('stories'); return 'degraded 2';
    }});
    registerLivenessRelease({rank: 0, name: 'park', release: () => {
      log.push('park'); return '';
    }});
    expect(livenessLadder().map((r) => r.name)).to.deep.equal(['stories', 'park', 'flow']);
    expect(runLivenessRung(0)).to.equal('stories: degraded 2');
    expect(runLivenessRung(1)).to.equal('flow: concluded');
    expect(runLivenessRung(2)).to.equal(undefined);
    expect(log).to.deep.equal(['stories', 'park', 'flow']);
    // A release that throws is named, never fatal.
    registerLivenessRelease({rank: 30, name: 'boom', release: () => {
      throw new Error('x');
    }});
    expect(runLivenessRung(2)).to.match(/^boom: threw/);
  });

  it('the shell sampler keeps its state between ticks and resets with the shell', () => {
    for (let t = 0; t < LIVENESS_GRACE_MS; t += 1000) {
      expect(tickLiveness(sample(t)).stalled).is.false;
    }
    expect(tickLiveness(sample(LIVENESS_GRACE_MS)).stalled).is.true;
    resetLiveness();
    expect(tickLiveness(sample(LIVENESS_GRACE_MS + 1000)).stalled).is.false;
  });
});
