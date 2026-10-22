import {expect} from 'chai';
import {nextTick} from 'vue';
import {
  arriveAtCommit, commitArrivalAbsorbs, commitArrivalDiag, createCommitArrival, endCommitBreath, leaveCommit,
} from '@/client/console/commitArrival';
import {COMMIT_ARRIVAL_ABSORB_MS} from '@/client/console/consoleCommitGate';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {setReduceMotionOverride} from '@/client/utils/reducedMotion';

/*
 * THE COMMIT ARRIVES (T14 · ledger CC — `docs/claude/console/composer-preselect.md` §2). The DOM half of the inertia
 * gate: the arrival is PAINTED only once the pose can paint (a surface's `[data-cursor-pending]` gone), a press before
 * that — or within the ring's clock after it — is the arrival, and the paint takes ONE breath.
 */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, PROBE_TICK_FALLBACK_MS + 20));
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('commitArrival — the commit ARRIVES, and a press in its window is the arrival', () => {
  afterEach(() => {
    setReduceMotionOverride(false);
  });

  it('no gate: the pose paints on the next probe tick, the breath arms; a press inside the window is absorbed, after it not', async () => {
    const r = createCommitArrival('test');
    const el = document.createElement('div');
    arriveAtCommit(r, () => el, {opening: false});
    expect(commitArrivalAbsorbs(r), 'before the paint: the arrival').to.eq(true);
    await nextTick();
    await tick();
    expect(r.arrival?.paintedAt, 'painted').to.not.eq(undefined);
    expect(r.armed, 'one breath').to.eq(true);
    expect(commitArrivalAbsorbs(r), 'inside the ring clock: still the arrival').to.eq(true);
    await wait(COMMIT_ARRIVAL_ABSORB_MS + 30);
    expect(commitArrivalAbsorbs(r), 'past the window: the move').to.eq(false);
    endCommitBreath(r);
    expect(r.armed).to.eq(false);
    leaveCommit(r);
  });

  it('a GATE stands (an entry, a late preview): unpainted — absorbed however late — until the gate lets go', async () => {
    const r = createCommitArrival('test');
    const band = document.createElement('div');
    band.setAttribute('data-cursor-pending', 'entry');
    const root = document.createElement('div');
    band.appendChild(root);
    document.body.appendChild(band);
    arriveAtCommit(r, () => root, {opening: false});
    await nextTick();
    await wait(COMMIT_ARRIVAL_ABSORB_MS + 60);
    expect(r.arrival?.paintedAt, 'the pose is still gated').to.eq(undefined);
    expect(commitArrivalAbsorbs(r)).to.eq(true);
    expect(commitArrivalDiag().leftMs, 'the harness is told to wait').to.be.greaterThan(0);
    band.removeAttribute('data-cursor-pending');
    await wait(10);
    await tick();
    expect(r.arrival?.paintedAt, 'the gate let go — painted').to.not.eq(undefined);
    leaveCommit(r);
    band.remove();
  });

  it('an OPEN with everything seeded: the decision settle is a floor under the window', async () => {
    const r = createCommitArrival('test');
    arriveAtCommit(r, () => undefined, {opening: true});
    await nextTick();
    await tick();
    await wait(COMMIT_ARRIVAL_ABSORB_MS + 10);
    expect(commitArrivalAbsorbs(r), 'past the ring, inside the opening settle').to.eq(true);
    leaveCommit(r);
  });

  it('the cursor LEFT the commit row: nothing is absorbed, no breath, nothing left for the harness', () => {
    const r = createCommitArrival('test');
    arriveAtCommit(r, () => undefined, {opening: true});
    leaveCommit(r);
    expect(commitArrivalAbsorbs(r)).to.eq(false);
    expect(r.armed).to.eq(false);
    expect(commitArrivalDiag().leftMs).to.eq(0);
  });

  it('a later arrival supersedes an earlier one (a stale paint does nothing)', async () => {
    const r = createCommitArrival('test');
    arriveAtCommit(r, () => undefined, {opening: false});
    const first = r.seq;
    arriveAtCommit(r, () => undefined, {opening: true});
    expect(r.seq).to.be.greaterThan(first);
    await nextTick();
    await tick();
    expect(r.arrival?.settleUntil, 'the second arrival stands').to.be.greaterThan(0);
    leaveCommit(r);
  });

  it('reduced motion: the pose paints, NO breath — the inertia gate stays', async () => {
    setReduceMotionOverride(true);
    const r = createCommitArrival('test');
    arriveAtCommit(r, () => undefined, {opening: false});
    await nextTick();
    await tick();
    expect(r.arrival?.paintedAt).to.not.eq(undefined);
    expect(r.armed, 'no breath in reduced motion').to.eq(false);
    expect(commitArrivalAbsorbs(r), 'the window is a safety, not motion').to.eq(true);
    leaveCommit(r);
  });
});
