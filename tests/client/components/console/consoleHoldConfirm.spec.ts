import {expect} from 'chai';
import {
  advanceHoldConfirmForTest, beginHoldConfirm, cancelHoldConfirm, HOLD_CONFIRM_MS,
  holdConfirmProgress, holdConfirmState, isHoldConfirmActive,
} from '@/client/console/consoleHoldConfirm';

/**
 * THE SHARED HOLD GATE — «keep the button down to do the thing you cannot
 * undo».
 *
 * It exists because a two-step PRESS is a good gate against a misaimed press
 * and a useless one against a fast press: a player who taps A twice out of
 * habit passes it without ever reading the warning. Everything asserted here is
 * about that promise — a tap cannot complete it, letting go is always a
 * complete cancel, and no environment can commit the action without the ring
 * the player is supposed to be watching.
 */
describe('consoleHoldConfirm (shared hold-to-confirm)', () => {
  afterEach(() => cancelHoldConfirm());

  it('a tap completes nothing — the gate a double press cannot pass', () => {
    let fired = 0;
    beginHoldConfirm('k', () => fired++);
    cancelHoldConfirm('k'); // the release
    beginHoldConfirm('k', () => fired++);
    cancelHoldConfirm('k');
    expect(fired, 'two full press/release cycles are still not a hold').to.eq(0);
    expect(holdConfirmState.key).to.eq('');
  });

  it('completes only after the full duration, and clears itself first', () => {
    let seenKeyAtFire = 'unset';
    beginHoldConfirm('k', () => {
      seenKeyAtFire = holdConfirmState.key;
    });
    advanceHoldConfirmForTest(HOLD_CONFIRM_MS - 50);
    expect(holdConfirmState.key, 'still held just before the end').to.eq('k');
    expect(seenKeyAtFire).to.eq('unset');

    advanceHoldConfirmForTest(60);
    expect(seenKeyAtFire,
      'the callback tears down the surface that armed this — it must not see a live hold').to.eq('');
    expect(holdConfirmState.key).to.eq('');
    expect(holdConfirmState.progress).to.eq(0);
  });

  it('letting go is a complete cancel — no residue, no late fire', () => {
    let fired = 0;
    beginHoldConfirm('k', () => fired++);
    advanceHoldConfirmForTest(HOLD_CONFIRM_MS - 20);
    cancelHoldConfirm('k');
    advanceHoldConfirmForTest(HOLD_CONFIRM_MS * 2);
    expect(fired).to.eq(0);
    expect(holdConfirmProgress('k')).to.eq(0);
  });

  it('an unrelated release cannot disarm somebody else’s hold', () => {
    beginHoldConfirm('mine', () => {});
    cancelHoldConfirm('someone-else');
    expect(isHoldConfirmActive('mine')).to.be.true;
    cancelHoldConfirm(); // the blanket reset (unmount / focus change) always works
    expect(isHoldConfirmActive('mine')).to.be.false;
  });

  it('re-arming the same key restarts the ring (a pad bounce is not «held all along»)', () => {
    let fired = 0;
    beginHoldConfirm('k', () => fired++);
    advanceHoldConfirmForTest(HOLD_CONFIRM_MS - 10);
    beginHoldConfirm('k', () => fired++); // the bounce
    expect(holdConfirmState.progress).to.eq(0);
    advanceHoldConfirmForTest(HOLD_CONFIRM_MS - 10);
    expect(fired, 'the restart means the second press has NOT finished either').to.eq(0);
  });

  it('progress belongs to one key at a time — a stale reader gets zero', () => {
    beginHoldConfirm('k', () => {});
    advanceHoldConfirmForTest(HOLD_CONFIRM_MS / 2);
    expect(holdConfirmProgress('k')).to.be.greaterThan(0.3);
    expect(holdConfirmProgress('other'), 'never leak another surface’s progress').to.eq(0);
  });

  it('an empty key arms nothing (a caller with no identity cannot open the gate)', () => {
    let fired = 0;
    beginHoldConfirm('', () => fired++);
    expect(holdConfirmState.key).to.eq('');
    advanceHoldConfirmForTest(HOLD_CONFIRM_MS * 2);
    expect(fired).to.eq(0);
  });
});
