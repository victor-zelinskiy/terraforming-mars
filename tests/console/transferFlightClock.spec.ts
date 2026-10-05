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

  it('a kill before the flight cancels the birth and the flight that has not been built yet', () => {
    const kill = body('killTransferPiece');
    expect(kill).to.include('pendingStarts.get(piece.chip)?.cancel();');
    expect(kill.indexOf('pendingStarts.get(piece.chip)?.cancel();'), 'before the tweens are killed').to.be.lessThan(kill.indexOf('gsap.killTweensOf(piece.chip);'));
  });
});
