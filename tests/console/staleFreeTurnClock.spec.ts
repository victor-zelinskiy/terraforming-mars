import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {observeStaleFreeTurn, staleFreeTurnClockInit, staleFreeTurnHeld} from '@/client/console/supervisor/staleFreeTurnClock';
import {workingAreaSettled} from '@/client/console/colonyTrade/workingAreaBack';

/*
 * A FINISHED FRAME OVER THE FREE TURN IS REAPED ON ITS OWN QUIET — never on a progress stamp one tick old, never
 * through a hold, never on the tick a new question arrived (CI 2026-11-11, run 42998242617 — `console-colony-pluto-
 * embed` :329: the Pluto payout waited on the player's take, the reaper's conclusion was HELD on `live-outcome`, the
 * take asked a new free-turn prompt and on that very tick the reaper read «9 s quiet», released the claim and
 * concluded the colonies under the trade's own closing beat — the track reset glided over a dissolving stage).
 * And the closing beat's stage gate waits for the working area's OWN return transitions, not for a wall-clock dwell.
 */
const STALE = 8_000;
const source = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'client', ...p), 'utf8').replace(/\r\n/g, '\n');

describe('the stale free-turn clock', () => {
  it('is due only after a whole quiet span on ONE key', () => {
    let clock = staleFreeTurnClockInit(0);
    let r = observeStaleFreeTurn(clock, {now: 1_000, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'a key first seen starts the clock').to.equal(false);
    clock = r.clock;
    r = observeStaleFreeTurn(clock, {now: 8_500, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due).to.equal(false);
    r = observeStaleFreeTurn(r.clock, {now: 9_100, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, '8 s after the key was first seen').to.equal(true);
  });

  it('THE PLUTO TAKE: a held conclusion, then a NEW prompt with the arbiter\'s stamp one tick old — not due', () => {
    let clock = staleFreeTurnClockInit(0);
    clock = observeStaleFreeTurn(clock, {now: 0, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE).clock;
    let r = observeStaleFreeTurn(clock, {now: 9_000, key: 'colonies|p1', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'quiet 9 s on the payout — the reaper asks').to.equal(true);
    clock = staleFreeTurnHeld(r.clock, 9_000); // held: live-outcome (the take is owed)
    // The player takes the card: the server asks a NEW free-turn prompt; the arbiter has not observed it yet.
    r = observeStaleFreeTurn(clock, {now: 10_000, key: 'colonies|p2', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'a new question is progress — in this very tick').to.equal(false);
    r = observeStaleFreeTurn(r.clock, {now: 14_000, key: 'colonies|p2', inFlight: false, progressAt: 0}, STALE);
    expect(r.due, 'the flow owns its closing beat for a whole span').to.equal(false);
  });

  it('a hold waits a whole quiet span again — never re-asked on the next tick', () => {
    let clock = staleFreeTurnClockInit(0);
    clock = observeStaleFreeTurn(clock, {now: 0, key: 'hand|p1', inFlight: false, progressAt: 0}, STALE).clock;
    clock = staleFreeTurnHeld(clock, 8_000);
    expect(observeStaleFreeTurn(clock, {now: 9_000, key: 'hand|p1', inFlight: false, progressAt: 0}, STALE).due).to.equal(false);
    expect(observeStaleFreeTurn(clock, {now: 16_000, key: 'hand|p1', inFlight: false, progressAt: 0}, STALE).due).to.equal(true);
  });

  it('anything in flight and a non-candidate restart the clock; the arbiter\'s later progress still counts', () => {
    let clock = staleFreeTurnClockInit(0);
    clock = observeStaleFreeTurn(clock, {now: 0, key: 'k', inFlight: false, progressAt: 0}, STALE).clock;
    clock = observeStaleFreeTurn(clock, {now: 7_000, key: 'k', inFlight: true, progressAt: 0}, STALE).clock;
    expect(observeStaleFreeTurn(clock, {now: 9_000, key: 'k', inFlight: false, progressAt: 0}, STALE).due).to.equal(false);
    clock = observeStaleFreeTurn(clock, {now: 9_000, key: undefined, inFlight: false, progressAt: 0}, STALE).clock;
    expect(clock.key).to.equal('');
    clock = observeStaleFreeTurn(staleFreeTurnClockInit(0), {now: 0, key: 'k', inFlight: false, progressAt: 0}, STALE).clock;
    expect(observeStaleFreeTurn(clock, {now: 9_000, key: 'k', inFlight: false, progressAt: 5_000}, STALE).due,
      'the arbiter saw the picture move at 5 s').to.equal(false);
  });

  it('the reaper decides on the clock, never on the raw progress stamp', () => {
    const src = source('console', 'supervisor', 'supervisorController.ts');
    const start = src.indexOf('function reapStaleFreeTurnFrame(');
    const body = src.slice(start, src.indexOf('\n  }\n', start));
    expect(body).to.contain('observeStaleFreeTurn(');
    expect(body, 'a held conclusion restarts the clock').to.contain('staleFreeTurnHeld(');
    expect(body, 'no stale verdict off `progressAt` alone').to.not.match(/Date\.now\(\) - livenessStateSnapshot\(\)\.progressAt >= STALE_FREE_TURN_MS/);
  });
});

describe('the working area is back when its own transitions ran out', () => {
  type Fake = {getAnimations?: () => Array<{transitionProperty?: string, finished: Promise<unknown>}>};
  const settled = (el: Fake, ms: number) => workingAreaSettled(el as unknown as Element, ms);

  it('nothing running (or no animation API) — at once', async () => {
    await settled({}, 5_000);
    await settled({getAnimations: () => []}, 5_000);
  });

  it('waits for a pending opacity transition, not for the dwell', async () => {
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => finish = resolve);
    let done = false;
    const p = settled({getAnimations: () => [{transitionProperty: 'opacity', finished}]}, 5_000).then(() => done = true);
    await new Promise((r) => setTimeout(r, 20));
    expect(done, 'still fading back').to.equal(false);
    finish();
    await p;
    expect(done).to.equal(true);
  });

  it('a cancelled transition is an ending; a transition that never ends is bounded', async () => {
    await settled({getAnimations: () => [{transitionProperty: 'transform', finished: Promise.reject(new Error('cancel'))}]}, 5_000);
    const t0 = Date.now();
    await settled({getAnimations: () => [{transitionProperty: 'opacity', finished: new Promise(() => undefined)}]}, 60);
    expect(Date.now() - t0).to.be.lessThan(2_000);
  });

  it('the stage gate releases through it, after the dwell, for THIS fall only', () => {
    const src = source('components', 'console', 'ConsoleColonyFocusStage.vue');
    const start = src.indexOf('    stageBusy: {');
    const body = src.slice(start, src.indexOf('\n    },\n', start));
    expect(body).to.contain('workingAreaSettled(');
    expect(body.indexOf('workingAreaSettled('), 'the settle is asked before the release').to.be.lessThan(body.lastIndexOf('setColonyStageYielded(false)'));
    expect(body, 'a pose re-raised meanwhile owns the stage again').to.contain('back === this.stageBackToken');
  });
});
