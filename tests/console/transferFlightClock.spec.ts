import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A RESOURCE CHIP IS BORN AT ITS SOURCE — painted there once — AND ONLY THEN FLOWN.
 *
 * Two clocks that are not the chip's own used to pick its first painted frame: GSAP's global time advances only at
 * a tick (a timeline created inside the response's long task — measured 146 ms of `Response.json().then` on the
 * Habitat Science ledger — starts at the LAST tick), and a slow frame (a headless 4K frame is hundreds of ms) lands
 * the first tick after a correct start a whole frame later. Either way the chip, set at its source with
 * `autoAlpha: 0`, was first PAINTED 40 % along its arc, above the panel, born out of nothing
 * (`console-habitat-science`: «…born in Luna's own bonus cell»). `bornThenFlown`: on a tick the chip turns visible
 * at its source, the flight starts on a LATER tick, a kill cancels both. Source guard — the director is DOM + GSAP
 * and its real proof is that e2e probe, on both profiles.
 */
const DIRECTOR = path.resolve(__dirname, '..', '..', 'src', 'client', 'console', 'resourceTransfer', 'resourceTransferDirector.ts');

describe('a resource chip is born at its source — the flight starts on the animation clock', () => {
  const raw = fs.readFileSync(DIRECTOR, 'utf8').replace(/\r\n/g, '\n');
  const body = (name: string) => {
    const start = raw.indexOf(`export function ${name}(`);
    expect(start, `the director still has «${name}»`).to.be.greaterThan(-1);
    return raw.slice(start, raw.indexOf('\n}\n', start));
  };

  it('the chip is BORN at its source (painted once, on a tick) and FLOWN only on a later tick', () => {
    const flight = body('runTransferFlight');
    const deferred = flight.indexOf('guarded((done) => bornThenFlown(chip, opts.delayMs, () => {');
    expect(deferred, 'the flight waits for the birth').to.be.greaterThan(-1);
    expect(flight.indexOf('gsap.timeline('), 'the timeline is built only there').to.be.greaterThan(deferred);
    expect(flight.slice(deferred), 'the stagger is the birth\'s, never a second delay on the timeline').to.include('gsap.timeline({onComplete: done})');
    // The chip is still SET at its source at once (it measures and hides there).
    expect(flight.indexOf('gsap.set(chip, {'), 'the hidden source pose is set at once').to.be.lessThan(deferred);
    const birth = raw.slice(raw.indexOf('function bornThenFlown('), raw.indexOf('function guarded('));
    expect(birth, 'the birth turns the chip visible at its source').to.include('gsap.set(chip, {autoAlpha: TRANSFER_BIRTH_ALPHA});');
    expect(birth, 'on a tick, after the wave\'s stagger').to.include('gsap.delayedCall(delayMs / 1000,');
    expect(birth, 'the flight waits for a LATER tick (a painted frame between them)').to.include('if (gsap.ticker.frame <= bornFrame) {');
    expect(birth, 'never a wall clock').to.not.match(/setTimeout|requestAnimationFrame/);
  });

  it('a WAVE\'s births are a phrase of EVENTS — token k is born after token k − 1\'s real birth, never on an offset from one start', () => {
    // A wave launched from a long task (the response's apply at 4K on a software renderer) found every `delayedCall`
    // offset (0, 110 ms…) due at the next tick: both rating tokens were born in one tick, flew one path and touched down
    // together — the cell ticked once for two steps (CI 2026-11-05, `console-venus-l1-shade` B / B2: births 2 ms apart).
    const birth = raw.slice(raw.indexOf('function bornThenFlown('), raw.indexOf('function guarded('));
    expect(birth, 'the birth takes its wave slot').to.include('wave?: TransferWaveSlot');
    expect(birth, 'a token waits for its predecessor before it is born').to.include('waveSlotReady(wave)');
    expect(birth, 'its birth releases the next slot').to.include('markWave();');
    const ready = raw.slice(raw.indexOf('function waveSlotReady('), raw.indexOf('function waveAllowanceMs('));
    expect(ready, 'only after every predecessor is born (or never will be)').to.include('gate.next >= slot.index');
    expect(ready, 'in a LATER frame, its stagger later on the animation clock').to.include('gsap.ticker.frame > gate.lastFrame');
    expect(ready).to.include('gate.lastAtMs + slot.staggerMs');
    const cancel = birth.slice(birth.indexOf('const cancel = (): void => {'));
    expect(cancel, 'a token that will never be born lets the wave go on').to.include('markWave();');
    for (const name of ['runTransferFlight', 'runDetachedTransferFlight']) {
      expect(body(name), `${name}: the slot reaches the birth`).to.include('}, opts.wave), opts.delayMs');
    }
    const run = fs.readFileSync(path.resolve(path.dirname(DIRECTOR), 'consoleResourceTransfer.ts'), 'utf8');
    expect(run, 'ONE gate per run').to.include('const waveGate = createTransferWaveGate();');
    expect(run, 'every flight gets its slot').to.include('wave: waveSlots[e.index],');
    expect(run, 'a token with no piece releases its slot').to.include('releaseWaveSlot(waveGate, e.index);');
  });

  it('a WAVE\'s TOUCHDOWNS are a phrase of events too — token k touches down after token k − 1, in a LATER frame', () => {
    // Births 102 ms apart and still ONE tick for two: on the box at ×4 a frame is longer than the stagger, so both
    // tokens' timelines completed in one GSAP tick and the counter ticked 20 → 22 (`console-venus-l1-shade` B2, 3 / 8).
    const guard = raw.slice(raw.indexOf('function guarded('), raw.indexOf('function topRailBottom('));
    expect(guard, 'the guard takes the wave slot').to.include('wave?: TransferWaveSlot');
    expect(guard, 'a touchdown waits for its turn').to.include('landingSlotReady(wave)');
    expect(guard, 'on the animation clock').to.include('gsap.ticker.add(waiter);');
    expect(guard, 'every way out releases the next touchdown').to.include('releaseLandingSlot(wave.gate, wave.index);');
    // The safety resolves WITHOUT waiting for the turn — the bound stays the token's own.
    expect(guard.slice(guard.indexOf('const safety = window.setTimeout(')), 'the safety never waits for a predecessor').to.not.include('done()');
    const ready = raw.slice(raw.indexOf('function landingSlotReady('), raw.indexOf('function waveSlotReady('));
    expect(ready, 'only after every predecessor touched down (or never will)').to.include('gate.landNext >= slot.index');
    expect(ready, 'in a LATER frame').to.include('gsap.ticker.frame > gate.landFrame');
    expect(body('runTransferFlight'), 'the flight hands its slot to the guard').to.include('}, opts.wave);');
    // A detached token waits seconds for its surface to leave: it keeps no place in the order past its pop.
    expect(body('runDetachedTransferFlight'), 'a detached token leaves the order at its pop').to.include('void launchedAt.then(leaveLandingOrder);');
    const run = fs.readFileSync(path.resolve(path.dirname(DIRECTOR), 'consoleResourceTransfer.ts'), 'utf8');
    expect(run, 'a token with no piece releases its touchdown too').to.include('releaseLandingSlot(waveGate, e.index);');
  });

  it('a DETACHED flight (PL-165) is born at its source the same way, leaves it on the pop, and builds its arc only once the destination is painted', () => {
    const flight = body('runDetachedTransferFlight');
    const deferred = flight.indexOf('guarded((done) => bornThenFlown(chip, opts.delayMs, () => {');
    expect(deferred, 'the birth is the same painted-first beat').to.be.greaterThan(-1);
    const pop = flight.indexOf('launchedResolve();');
    const wait = flight.indexOf('opts.awaitTo().then(');
    const arc = flight.indexOf('transferArcPlan(');
    expect(pop, 'the token has LEFT its source at the pop — the caller may fold its surface then').to.be.greaterThan(deferred);
    expect(wait, 'the destination is awaited only after the pop').to.be.greaterThan(pop);
    expect(arc, 'the arc is planned from the destination as painted, never from a rect measured before the wait').to.be.greaterThan(wait);
    expect(flight, 'a destination that never opened absorbs the chip where it stands').to.include('restingAt');
    expect(flight, 'the wait is part of the guard budget — never a hang').to.include('opts.waitBudgetMs');
    expect(flight, 'never a wall clock').to.not.match(/setTimeout|requestAnimationFrame/);
  });

  it('a flight its SAFETY outlives is CAUGHT UP to its end — never abandoned in the air (a starved renderer)', () => {
    // GSAP's lag smoothing counts a frame over 500 ms as 33 ms, so on a starved renderer a live flight falls behind the
    // wall-clock safety; resolving there faded the chip mid-arc and played its contact beat at a destination it never
    // reached (CI 2026-11-04: `console-utopia-invest` C, `console-rail-landing`).
    const guard = raw.slice(raw.indexOf('function guarded('), raw.indexOf('function topRailBottom('));
    expect(guard, 'the safety asks the beat to catch up before it resolves').to.include('if (catchUp?.() === true) {');
    expect(guard, 'a caught-up beat gets its own touchdown\'s grace, then resolves anyway — never a hang').to.include('window.setTimeout(finish, CATCH_UP_TOUCHDOWN_GRACE_MS);');
    for (const name of ['runTransferFlight', 'runDetachedTransferFlight']) {
      const flight = body(name);
      expect(flight, `${name}: the timeline is kept for the safety`).to.match(/flight = (tl|arc);/);
      expect(flight, `${name}: the safety renders a flight in the air to its end`).to.include('flight.progress(1);');
      expect(flight, `${name}: and names it in the report`).to.include("report.caughtUp = 'arc';");
    }
    expect(body('runTransferFlight'), 'a flight that never left its source is absorbed THERE').to.include("report.caughtUp = 'unflown';");
    // …and the ABSORB too: resolved while GSAP still lagged, the token's ends were released and its surface folded under
    // a chip still painted at the touchdown.
    const absorb = raw.slice(raw.indexOf('function absorbChip('), raw.indexOf('export function settleTransferChip('));
    expect(absorb, 'the absorb is rendered to its end before the beat resolves').to.include('absorb?.progress(1);');
  });

  it('a kill before the flight cancels the birth and the flight that has not been built yet', () => {
    const kill = body('killTransferPiece');
    expect(kill).to.include('pendingStarts.get(piece.chip)?.cancel();');
    expect(kill.indexOf('pendingStarts.get(piece.chip)?.cancel();'), 'before the tweens are killed').to.be.lessThan(kill.indexOf('gsap.killTweensOf(piece.chip);'));
  });
});
