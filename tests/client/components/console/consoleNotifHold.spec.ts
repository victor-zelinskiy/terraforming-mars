import {expect} from 'chai';
import {
  NOTIF_HOLD_MS,
  beginNotifHold,
  cancelNotifHold,
  consumeNotifHoldRelease,
  notifHoldActiveFor,
  notifHoldState,
  resetNotifHold,
} from '@/client/console/consoleNotifHold';

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('consoleNotifHold (press-and-hold X on a console toast)', () => {
  beforeEach(() => resetNotifHold());
  afterEach(() => resetNotifHold());

  it('exposes a fixed positive hold threshold (input ergonomics, never motion-scaled)', () => {
    expect(NOTIF_HOLD_MS).to.be.greaterThan(0);
  });

  it('a release BEFORE the threshold is a TAP: cancel reports the in-flight hold, nothing fires', async () => {
    let fired = 0;
    beginNotifHold('n1', () => fired++, 30);
    expect(notifHoldActiveFor('n1')).to.be.true;
    expect(notifHoldState.noteId).to.eq('n1');

    expect(cancelNotifHold()).to.be.true; // the release was a tap
    expect(notifHoldState.noteId).to.be.undefined;
    await tick(45);
    expect(fired).to.eq(0); // the timer died with the cancel
    expect(consumeNotifHoldRelease()).to.be.false; // nothing completed
  });

  it('a hold past the threshold fires ONCE and marks its trailing release consumed', async () => {
    let fired = 0;
    beginNotifHold('n1', () => fired++, 10);
    await tick(25);
    expect(fired).to.eq(1);
    expect(notifHoldState.noteId).to.be.undefined; // the fill is over
    // The release edge that ends the completed hold belongs to the hold
    // system — consumed exactly once, then edges route normally again.
    expect(cancelNotifHold()).to.be.false; // nothing in flight anymore
    expect(consumeNotifHoldRelease()).to.be.true;
    expect(consumeNotifHoldRelease()).to.be.false;
  });

  it('a new begin supersedes the previous timer (only the fresh hold can fire)', async () => {
    let firstFired = 0;
    let secondFired = 0;
    beginNotifHold('n1', () => firstFired++, 10);
    beginNotifHold('n2', () => secondFired++, 10);
    expect(notifHoldActiveFor('n1')).to.be.false;
    expect(notifHoldActiveFor('n2')).to.be.true;
    await tick(25);
    expect(firstFired).to.eq(0);
    expect(secondFired).to.eq(1);
  });

  it('a fresh begin clears a stale unconsumed release (a lost keyup can only eat one edge)', async () => {
    beginNotifHold('n1', () => {}, 10);
    await tick(25); // completed → a release consume is pending
    beginNotifHold('n2', () => {}, 30);
    expect(consumeNotifHoldRelease()).to.be.false; // the stale flag died with the new begin
    expect(cancelNotifHold()).to.be.true;
  });

  it('reset clears the timer, the reactive state and the pending consume (game-switch boundary)', async () => {
    let fired = 0;
    beginNotifHold('n1', () => fired++, 10);
    resetNotifHold();
    expect(notifHoldState.noteId).to.be.undefined;
    await tick(25);
    expect(fired).to.eq(0);

    beginNotifHold('n2', () => {}, 5);
    await tick(20); // completed → pending consume
    resetNotifHold();
    expect(consumeNotifHoldRelease()).to.be.false;
  });
});
