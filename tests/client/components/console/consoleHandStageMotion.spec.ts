import {expect} from 'chai';
import * as motion from '@/client/console/consoleHandStageMotion';

/**
 * THE OCCLUSION BRIDGE director — the contract half that is testable without a
 * layout engine. The visual half (the unfold, the sweep, the fold) is GSAP over
 * live geometry and is verified by hand; what must never regress silently is
 * the STATE the rest of the shell depends on: the input gate, the no-strand
 * completion paths, and the absence of the two motion models this replaced.
 */
describe('consoleHandStageMotion — the OCCLUSION BRIDGE contract', () => {
  afterEach(() => motion.resetHandStageMotion());

  /**
   * The FLIGHT model dragged the card across the viewport; the CAMERA model
   * transformed the whole grid. Both are deleted, not parked as fallbacks —
   * a solver quietly re-exported is a solver someone will quietly call.
   */
  it('the CAMERA model is gone — no solver is exported any more', () => {
    expect((motion as unknown as Record<string, unknown>)['solveCameraShot']).to.eq(undefined);
    expect((motion as unknown as Record<string, unknown>)['CameraBox']).to.eq(undefined);
  });

  it('the input gate opens unlocked, and a reset can never leave it locked', () => {
    expect(motion.handStageTransitioning()).to.eq(false);
    motion.resetHandStageMotion();
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

  it('cancelled-pair hooks are safe on a bare element (no bridge, no episode)', () => {
    const el = document.createElement('div');
    motion.handStageEnterCancelledHook(el);
    motion.handStageLeaveCancelledHook(el);
    expect(motion.handStageTransitioning()).to.eq(false);
  });

  it('the armed origin is a plain register — arming with undefined is a no-op, not a throw', () => {
    motion.armHandStageOrigin(undefined);
    motion.armHandStageOrigin({left: 10, top: 20, width: 160, height: 230});
    motion.resetHandStageMotion();
  });
});
