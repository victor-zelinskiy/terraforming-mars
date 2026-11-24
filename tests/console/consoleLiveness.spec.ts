import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  advanceLivenessRung,
  initialLivenessState,
  LIVENESS_GRACE_MS,
  LIVENESS_PRESSED_GRACE_MS,
  LIVENESS_PRESSES_NO_EFFECT,
  LIVENESS_RUNG_GAP_MS,
  LIVENESS_STRANDED_GRACE_MS,
  LivenessSample,
  LivenessState,
  LivenessRung,
  livenessLadder,
  observeLiveness,
  PAD_OWNING_OVERLAY_SELECTOR,
  PAD_OWNING_OVERLAYS,
  PLAYER_LOOK_SELECTOR,
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

  it('a TRANSIENT BEAT with nobody asked still owes its end — the two-campaign rally (ledger HC) is judged like an unserved question', () => {
    const noQuestion = walk(seconds(LIVENESS_GRACE_MS / 1000, () => ({promptLive: false})));
    expect(noQuestion.some((x) => x.stalled), 'no question, no beat: nothing to judge').is.false;
    const beat = walk(seconds(LIVENESS_GRACE_MS / 1000, () => ({promptLive: false, beatOwed: true})));
    const last = beat[beat.length - 1];
    expect(last.stalled && last.reason).to.equal('unserved');
    const busy = walk(seconds(LIVENESS_GRACE_MS / 1000, () => ({promptLive: false, beatOwed: true, inFlight: ['parliament-neutral-rally[blocking]']})));
    expect(busy.some((x) => x.stalled), 'a beat with its work in flight is honest').is.false;
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

  /*
   * A GATE THAT NEVER OPENS (FREEZE ZERO, stage 6 — the autopilot's sixth whole game). «Добор карт» stood with
   * «A Взять» on the bar and its take turn waiting for an `animationend` that did not come: `reveal-busy` swallowed
   * every press, the surface's handler had TAKEN each of them, nothing was dropped — `accepting: true`, the arbiter
   * content, for six generations. A deliberate gate is a transient by nature (it stands over something in flight); a
   * gate that swallows A / B over a still picture with nothing in flight is the deaf screen's third shape.
   */
  it('…and an A / B a DELIBERATE GATE swallowed over a still picture is the deaf screen too — a gate that never opens', () => {
    const gated = walk(seconds(LIVENESS_PRESSED_GRACE_MS / 1000, (t) => {
      const n = Math.min(3, Math.floor(t / 1000));
      return {promptLive: true, accepting: true, presses: n, dropped: 0, absorbed: n};
    }));
    const last = gated[gated.length - 1];
    expect(last.stalled && last.reason).to.equal('presses-no-effect');
    expect(gated.slice(0, -1).some((x) => x.stalled), 'never before the pressed grace').is.false;
    // THE GATE'S OWN MOTION KEEPS IT HONEST: while what it stands over is in flight, or the picture moves under it,
    // however many presses it swallows (a batch landing, a take's turn, the settle window of a decision).
    const flying = walk(seconds(30, (t) => {
      const n = Math.floor(t / 1000);
      return {promptLive: true, accepting: true, presses: n, absorbed: n, inFlight: ['hold:deck-draw']};
    }));
    expect(flying.some((x) => x.stalled), 'a gate over a flight').is.false;
    const moving = walk(seconds(30, (t) => {
      const n = Math.floor(t / 1000);
      return {promptLive: true, accepting: true, presses: n, absorbed: n, signature: `s${n}`};
    }));
    expect(moving.some((x) => x.stalled), 'a gate over a picture that moves').is.false;
    // …a press or two swallowed by a gate that then opens is nothing (below the threshold)…
    const brief = walk(seconds(30, () => ({promptLive: true, accepting: true, presses: 2, absorbed: LIVENESS_PRESSES_NO_EFFECT - 1})));
    expect(brief.some((x) => x.stalled), 'fewer than the threshold').is.false;
    // THE WIRING: counted at the router by the dispatch's own bracket, carried by the supervisor's sample.
    const wiring = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/supervisor/supervisorController.ts'), 'utf8');
    expect(wiring, 'the sample carries the count').to.contain('absorbed: quietAbsorbed(),');
    // …OF THE PRESSES SWALLOWED OVER NOTHING: a gate over a declared flight is doing its work, however long the
    // flight takes — only a look at which the graph names nothing in flight counts what was swallowed since the last.
    expect(wiring).to.contain('if (now > absorbedSeen && inputAbsorbSnapshot().active.length > 0 && flightsInTheAir() === \'\') {');
    // …and ONLY WHILE A GATE STILL STANDS: a gate that never opens is closed at every look; a press swallowed by a gate
    // that has opened since is the gate having done its work. The standing gates are part of the picture's signature —
    // a gate closing or opening is the screen changing state.
    const signature = wiring.slice(wiring.indexOf('const signature = ['), wiring.indexOf('].join(\'|\');', wiring.indexOf('const signature = [')));
    expect(signature, 'the picture names the gates standing over the pad').to.contain('inputAbsorbSnapshot().active.join(\',\'),');
    const router = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/consoleRouter.ts'), 'utf8');
    expect(router, 'counted at the router, by the dispatch\'s own bracket — every device, every gate')
      .to.match(/if \(absorbedBy\.length > 0 && intent\.kind === 'press' && \(intent\.button === 'confirm' \|\| intent\.button === 'back'\)\) \{\s+recordVerbAbsorbed\(\);/);
  });

  /*
   * THE FIRST GATE THE NEW TERM NAMED (the bottle's walk of `aerospace-family`, the hour it was written): the
   * fullscreen viewer's `zoom-flight`. «X → A Разыграть» flies the card into the composer and raises `zoomClosing`;
   * its only unwinder was the dialog's queued 'close' event — every press after it swallowed, B included. The plain
   * close had learned to unwind in a `finally` (two CI findings); the hand-off and the depart had not.
   */
  it('every flight that takes the viewer away unwinds it itself — the flag that swallows the pad never waits for an event alone', () => {
    const viewer = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/shell/viewerController.ts'), 'utf8').replace(/\r\n/g, '\n');
    const raised = viewer.split('zoomClosing.value = true;').length - 1;
    expect(raised, 'the places that raise the flag (the depart, the hand-off, the plain close) — a new one is read here').to.equal(3);
    expect(viewer, 'the depart').to.match(/void playZoomDepart\([^\n]*\)\n\s+\.finally\(unwindZoomFlight\(\)\);/);
    expect(viewer, 'the hand-off').to.match(/void playZoomHandoff\([^\n]*\)\n\s+\.then\(\(\) => zoom\.close\(\)\)\n\s+\.finally\(unwindZoomFlight\(\)\);/);
    const close = viewer.slice(viewer.indexOf('async function closeZoomViewer('), viewer.indexOf('function whenConsoleCardZoomCardChanges('));
    expect(close, 'the plain close').to.match(/\} finally \{[\s\S]*if \(zoomClosing\.value\) \{\s+onCardZoomClosed\(\);/);
    // …fenced by the open token: the flight of one viewer never unwinds the next.
    expect(viewer).to.match(/function unwindZoomFlight\(\): \(\) => void \{\s+const token = zoomOpenToken\.value;\s+return \(\) => \{\s+if \(zoomOpenToken\.value === token && zoomClosing\.value\) \{\s+onCardZoomClosed\(\);/);
  });

  /*
   * …AND THE GATE THAT STOOD SO HAS ITS OWN BOUND (the cause, cured where it is): the reveal's take-in-place turn ends
   * on its `animationend` — and the wait for that event is a declared ceiling wait, so an event that never comes (a
   * slot re-made under the turn, an animation cancelled, a renderer with no CSS clock) commits the take at its
   * ceiling and says so, instead of swallowing the pad for good.
   */
  it('the reveal\'s take turn is a DECLARED, BOUNDED wait — an `animationend` that never comes cannot hold the pad', () => {
    const reveal = fs.readFileSync(path.resolve(__dirname, '../../src/client/components/console/ConsoleRevealOverlay.vue'), 'utf8').replace(/\r\n/g, '\n');
    const take = reveal.slice(reveal.indexOf('function takeInPlace('), reveal.indexOf('function onTakeFlipEnd('));
    expect(take).to.contain('takingIdx.value = entry.index;');
    expect(take, 'declared on the wait graph').to.match(/beginCeilingWait\(\{id: 'reveal:take-turn', owner: 'revealOverlay'/);
    expect(take, 'bounded on the motion\'s ceiling clock, by this instance\'s scope')
      .to.match(/cancelTakeTurnCeiling = flow\.after\(motionCeilingMs\(TAKE_TURN_MS \+ TAKE_TURN_NET_MS\), '[^\n]*', \(\) => \{\s+if \(takingIdx\.value === index\) \{\s+wait\.ceiling\(\);\s+commitTakeInPlace\(index\);/);
    const commit = reveal.slice(reveal.indexOf('function commitTakeInPlace('), reveal.indexOf('function commitTakeInPlace(') + 500);
    expect(commit, 'the commit — by the event or at the ceiling — ends the wait').to.match(/cancelTakeTurnCeiling\(\);\s+takeTurnWait\?\.met\(\);/);
    // The sheet's own number is the bound's base (a turn made longer there must move this one).
    const less = fs.readFileSync(path.resolve(__dirname, '../../src/styles/console.less'), 'utf8');
    expect(less).to.match(/animation: con-take-turn calc\(560ms \* var\(--motion-scale, 1\)\)/);
    expect(reveal).to.contain('const TAKE_TURN_MS = 560;');
  });

  /*
   * THE PLAYER'S TIME IS NOBODY'S STALL (the monkey's seed of the day on CI, 2026-11-22 - `d20261122:red-lawyers`,
   * issues #88 / #89 / #91 / #92): the Parliament's walk stood on its card step, the player read the information screen
   * over it, and ten seconds of reading were «stall (unserved) ... holder: beat» - the reveal's claims expired, the
   * walk's beat torn down under the screen.
   */
  describe('a look the player opened', () => {
    it('is never an unserved question, however long it is read - not with a question under it, not with a beat that owes its end', () => {
      const asked = walk(seconds(60, () => ({playerLook: true})));
      expect(asked.some((x) => x.stalled), 'a question under the look').is.false;
      const beat = walk(seconds(60, () => ({promptLive: false, beatOwed: true, playerLook: true})));
      expect(beat.some((x) => x.stalled), 'a beat under the look').is.false;
      const stranded = walk(seconds(60, () => ({stranded: true, playerLook: true})));
      expect(stranded.some((x) => x.stalled), 'a stranded question under the look').is.false;
    });

    it('A / B the look TOOK are the look working - the absorbed pad under it is not what the presses are judged by', () => {
      // Every press is taken by the look (none dropped) and the picture stands (a B on the look's root, an A on a row with nothing to open).
      const v = walk(seconds(30, (t) => ({playerLook: true, presses: t / 1000, dropped: 0})));
      expect(v.some((x) => x.stalled)).is.false;
    });

    it('...but a DEAF look is a deaf screen: presses NOBODY took are judged as on any accepting surface', () => {
      const v = walk(seconds(LIVENESS_PRESSED_GRACE_MS / 1000 + 2, (t) => ({playerLook: true, presses: t / 1000, dropped: t / 1000})));
      const stalled = v.find((x) => x.stalled);
      expect(stalled !== undefined && stalled.stalled && stalled.reason).to.eq('presses-no-effect');
    });

    it('the time under the look is not the stall\'s: the clock starts when the look closes, never «ten seconds already»', () => {
      const under = seconds(30, () => ({playerLook: true}));
      // The look closes and the picture does not move (the worst case - a close the signature did not see).
      // (The clock stands at the last look of the arbiter that saw the view open - one tick before the first without it.)
      const after = Array.from({length: LIVENESS_GRACE_MS / 1000}, (_, i) => sample(31_000 + i * 1000));
      const v = walk([...under, ...after]);
      expect(v.slice(0, -1).some((x) => x.stalled), 'no stall before a whole grace has passed WITHOUT the look').is.false;
      expect(v[v.length - 1].stalled, 'what still stands a grace after the look closed is judged as ever').is.true;
    });

    it('the looks are the views only the PLAYER opens - never a surface of the game', () => {
      const looks = PAD_OWNING_OVERLAYS.filter((overlay) => overlay.look === true).map((overlay) => overlay.selector);
      expect(looks).to.have.members(['.con-info', '.con-zoom', '.con-journal', '.con-sys', '.con-bot-review']);
      expect(PLAYER_LOOK_SELECTOR.split(', ')).to.deep.eq(looks);
      for (const game of ['.con-reveal', '.con-mandatory', '.con-task', '.con-stranded']) {
        expect(looks, `${game} is the game's own surface - it answers for itself`).to.not.include(game);
      }
    });

    it('the arbiter\'s sample and the doors of finished frames both read it (the wiring)', () => {
      const supervisor = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/supervisor/supervisorController.ts'), 'utf8');
      expect(supervisor, 'the sample carries the look').to.match(/playerLook: playerLookStands\(\)/);
      // (The reaper of finished frames read it here until 2026-11-23; what concludes a finished frame now is its owner's
      // doors by level — and every one of them asks «no look the player reads».)
      const outcome = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/shell/outcomeController.ts'), 'utf8');
      expect(outcome, 'the conclusion\'s and the claim\'s doors do not open under a look').to.match(/const look = document\.querySelector\(PLAYER_LOOK_SELECTOR\) !== null \? ' · look' : '';/);
      expect(outcome).to.contain('quiet: conclusion.verdict === \'dismiss\' && look === \'\' && (flight === \'\' || underOwn),');
      expect(outcome, 'the ghost\'s door of an owed conclusion does not open under a look').to.match(/quiet: \(kind\) => document\.querySelector\(PLAYER_LOOK_SELECTOR\) === null &&/);
      expect(supervisor).to.match(/document\.querySelector\(PLAYER_LOOK_SELECTOR\) !== null/);
    });
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

  it('a STRANDED question (no surface serves it) is judged sooner — the Hi-Tech Lab plate stood 10 s before the first rung', () => {
    const v = walk(seconds(LIVENESS_STRANDED_GRACE_MS / 1000, () => ({stranded: true})));
    expect(v.slice(0, -1).every((x) => !x.stalled)).is.true;
    const last = v[v.length - 1];
    expect(last.stalled && last.reason).to.equal('unserved');
    expect(LIVENESS_STRANDED_GRACE_MS).to.be.below(LIVENESS_GRACE_MS);
    // Not stranded: the ordinary grace still holds at the same moment.
    expect(walk(seconds(LIVENESS_STRANDED_GRACE_MS / 1000)).some((x) => x.stalled)).is.false;
  });

  it('rungs that had NOTHING to release cost no gap — the shell walks on in the same tick and the next stall rung follows it', () => {
    for (let t = 0; t < LIVENESS_GRACE_MS; t += 1000) {
      tickLiveness(sample(t));
    }
    const first = tickLiveness(sample(LIVENESS_GRACE_MS));
    expect(first.stalled && first.rung).to.equal(0);
    // The shell ran rungs 0, 1, 2 in this tick (0 and 1 were empty) — the next gap runs rung 3, not rung 1.
    advanceLivenessRung(3);
    const within = tickLiveness(sample(LIVENESS_GRACE_MS + 1000));
    expect(within.stalled && within.rung).to.equal(undefined);
    const next = tickLiveness(sample(LIVENESS_GRACE_MS + LIVENESS_RUNG_GAP_MS));
    expect(next.stalled && next.rung).to.equal(3);
    // Never backwards.
    advanceLivenessRung(1);
    const after = tickLiveness(sample(LIVENESS_GRACE_MS + 2 * LIVENESS_RUNG_GAP_MS));
    expect(after.stalled && after.rung).to.equal(4);
  });

  it('a REPORTED stall that moves again says how long it stood and how many rungs ran — the time-to-cure', () => {
    const v = walk([...seconds(LIVENESS_GRACE_MS / 1000 + 2), sample(LIVENESS_GRACE_MS + 3000, {signature: 'moved'}), sample(LIVENESS_GRACE_MS + 4000, {signature: 'again'})]);
    const back = v[v.length - 2];
    expect(!back.stalled && back.recovered).to.deep.equal({afterMs: LIVENESS_GRACE_MS + 3000, rungs: 1 + Math.floor(2000 / LIVENESS_RUNG_GAP_MS)});
    // Once: the next progress is plain progress.
    const after = v[v.length - 1];
    expect(!after.stalled && after.recovered).to.equal(undefined);
    // An unreported quiet that moves is no recovery.
    expect(walk([sample(0), sample(1000, {signature: 'moved'})]).every((x) => !x.stalled && x.recovered === undefined)).is.true;
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

  /*
   * THE SURFACES THAT OWN THE PAD OVER A STANDING FRAME (freeze zero, stage 1 - CI's seed of the day, 2026-11-18,
   * parliament-research-enact: a player reading the information screen over a Parliament that had asked them to take
   * drawn cards was a stall of 33 s, and the ladder took the Parliament down under them). On such a surface a B that
   * leaves the frame alone is the surface working - the arbiter does not judge it.
   */
  describe('the surfaces that own the pad over a standing frame', () => {
    const components = path.resolve(__dirname, '../../src/client/components/console');
    const vue = (dir: string): Array<string> => fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) =>
      entry.isDirectory() ? vue(path.join(dir, entry.name)) : entry.name.endsWith('.vue') ? [path.join(dir, entry.name)] : []);
    const sources = vue(components).map((file) => fs.readFileSync(file, 'utf8')).join(String.fromCharCode(10));

    it('the information screen and the opened turn review are among them, and every row says why', () => {
      const selectors = PAD_OWNING_OVERLAYS.map((overlay) => overlay.selector);
      expect(selectors).to.include.members(['.con-info', '.con-bot-review', '.con-journal', '.con-zoom', '.con-sys', '.con-reveal', '.con-mandatory']);
      expect(PAD_OWNING_OVERLAYS.filter((overlay) => overlay.why.trim().length < 12).map((overlay) => overlay.selector), 'a row with no reason').to.deep.eq([]);
      expect(new Set(selectors).size, 'no row twice').to.eq(selectors.length);
      expect(PAD_OWNING_OVERLAY_SELECTOR.split(', ')).to.deep.eq(selectors);
    });

    it('no row is dead: every surface of the list is a class some console component still mounts', () => {
      const dead = PAD_OWNING_OVERLAYS.map((overlay) => overlay.selector.slice(1))
        .filter((name) => !new RegExp('class="[^"]*\\b' + name + '(?![\\w-])').test(sources));
      expect(dead, 'a listed surface no component mounts - the class was renamed or the surface is gone').to.deep.eq([]);
    });
  });
});
