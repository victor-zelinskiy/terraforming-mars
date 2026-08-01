import {expect} from 'chai';
import * as motion from '@/client/console/consoleHandStageMotion';

/**
 * THE PERSISTENT-HERO director — the contract half that is testable without a
 * layout engine. The visual half (the transfer flight, the isolation fade,
 * the group cascade) is GSAP over live geometry and is verified by hand; what
 * must never regress silently is the STATE the shell depends on: the input
 * gate, the no-strand completion paths, and the absence of the two rejected
 * motion models.
 */
describe('consoleHandStageMotion — the PERSISTENT HERO contract', () => {
  afterEach(() => motion.resetHandStageMotion());

  /**
   * The CAMERA model transformed the whole grid; the OCCLUSION BRIDGE hid the
   * card under a plane. Both are deleted, not parked as fallbacks — a helper
   * quietly re-exported is a helper someone will quietly call.
   */
  it('the rejected models are GONE — no camera solver, no bridge, no origin register', () => {
    const m = motion as unknown as Record<string, unknown>;
    expect(m['solveCameraShot']).to.eq(undefined);
    expect(m['armHandStageOrigin']).to.eq(undefined);
    expect(m['createBridge']).to.eq(undefined);
  });

  it('the input gate opens unlocked, and a reset can never leave it locked', () => {
    expect(motion.handStageTransitioning()).to.eq(false);
    motion.resetHandStageMotion();
    expect(motion.handStageTransitioning()).to.eq(false);
  });

  /**
   * The HERO FLIGHT holds the gate for exactly its own lifetime — released on
   * resolve AND on reject (a transfer that dies must never freeze the pad).
   */
  it('guardHandHeroFlight locks for the flight and releases on BOTH outcomes', async () => {
    let resolve: () => void = () => {};
    const flight = new Promise<void>((r) => {
      resolve = r;
    });
    const guarded = motion.guardHandHeroFlight(flight);
    expect(motion.handStageTransitioning()).to.eq(true);
    resolve();
    await guarded;
    expect(motion.handStageTransitioning()).to.eq(false);

    let reject: (e: Error) => void = () => {};
    const failing = new Promise<void>((_r, rj) => {
      reject = rj;
    });
    const guardedFail = motion.guardHandHeroFlight(failing).catch(() => undefined);
    expect(motion.handStageTransitioning()).to.eq(true);
    reject(new Error('flight died'));
    await guardedFail;
    expect(motion.handStageTransitioning()).to.eq(false);
  });

  /**
   * A hook on unmeasurable geometry (a pick bridge hiding the section, a
   * teardown mid-flow) must complete SYNCHRONOUSLY and leave no lock behind:
   * a stranded `done()` freezes the Vue transition, and a stranded lock
   * freezes the pad — both are worse than no animation at all.
   */
  it('a hook on unmeasurable geometry completes synchronously and never locks input', () => {
    const el = document.createElement('div'); // detached → offsetParent null
    let entered = false;
    motion.handStageEnterHook(el, () => {
      entered = true;
    });
    expect(entered).to.eq(true);
    expect(motion.handStageTransitioning()).to.eq(false);

    let left = false;
    motion.handStageLeaveHook(el, () => {
      left = true;
    });
    expect(left).to.eq(true);
    expect(motion.handStageTransitioning()).to.eq(false);
  });

  it('cancelled-pair hooks are safe on a bare element (no episode, no grid)', () => {
    const el = document.createElement('div');
    motion.handStageEnterCancelledHook(el);
    motion.handStageLeaveCancelledHook(el);
    expect(motion.handStageTransitioning()).to.eq(false);
  });

  it('heroCommitLift dresses any element without throwing (the ring class lands)', () => {
    const el = document.createElement('div');
    motion.heroCommitLift(el);
    expect(el.classList.contains('con-exit-proxy--commit')).to.eq(true);
  });
});
