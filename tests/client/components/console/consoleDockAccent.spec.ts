import {expect} from 'chai';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  ACCENT_MAX_MS, beginDockIntakeAccent, dockIntakeAccentActive, dockIntakeAccentLabels,
  holdDockIntakeAccent, resetDockIntakeAccent,
} from '@/client/console/handDock/consoleDockAccent';

/**
 * THE DOCK'S COMPACT POSE MUST BE UNBREAKABLE.
 *
 * The accent (cards arriving → the pack stands FULL) used to be derived from
 * four booleans owned by four different directors. Any one of them sticking
 * pinned the accent ON — which silently disabled the COMPACT pose for the rest
 * of the game, and that is exactly what shipped: the hand-reveal director sets
 * `holdSlots = true` before it measures, and a section change in that window
 * latched it forever.
 *
 * A lease can leak too — so the contract under test is that a leak CANNOT
 * outlive its ceiling. The worst case must be «full for a few seconds too
 * long», never «compact is dead».
 */
describe('consoleDockAccent — the intake accent is a BOUNDED lease', () => {
  afterEach(() => resetDockIntakeAccent());

  it('is off at rest', () => {
    expect(dockIntakeAccentActive()).to.eq(false);
    expect(dockIntakeAccentLabels()).to.deep.eq([]);
  });

  it('holds while a lease lives and releases with it', () => {
    const release = beginDockIntakeAccent('intake');
    expect(dockIntakeAccentActive()).to.eq(true);
    release();
    expect(dockIntakeAccentActive()).to.eq(false);
  });

  it('releasing twice is harmless (an idempotent release)', () => {
    const release = beginDockIntakeAccent('intake');
    release();
    release();
    expect(dockIntakeAccentActive()).to.eq(false);
  });

  /** Overlapping presentations are normal: an intake landing while the hand
   *  opens. The pose returns only when the LAST one is done. */
  it('nests — the accent survives until the last lease releases', () => {
    const a = beginDockIntakeAccent('hand-open');
    const b = beginDockIntakeAccent('hand-intake');
    expect(dockIntakeAccentLabels()).to.deep.eq(['hand-open', 'hand-intake']);
    a();
    expect(dockIntakeAccentActive(), 'still held by the second').to.eq(true);
    b();
    expect(dockIntakeAccentActive()).to.eq(false);
  });

  it('releases out of order without stranding the count', () => {
    const a = beginDockIntakeAccent('a');
    const b = beginDockIntakeAccent('b');
    b();
    a();
    expect(dockIntakeAccentActive()).to.eq(false);
  });

  /** THE LOAD-BEARING GUARANTEE: a lease nobody releases still expires. */
  it('a LEAKED lease expires on its own ceiling', async () => {
    // The ceiling is an OWNED timer of the flow kernel (architecture v2): the spec drives the kernel's clock.
    const clock = createManualClock(0);
    setFlowClock(clock);
    const warn = console.warn;
    console.warn = () => {};
    try {
      beginDockIntakeAccent('leaked'); // release deliberately dropped
      expect(dockIntakeAccentActive()).to.eq(true);
      clock.advance(ACCENT_MAX_MS - 1);
      expect(dockIntakeAccentActive(), 'armed with the ceiling — not a millisecond earlier').to.eq(true);
      clock.advance(1); // the ceiling elapses
      expect(dockIntakeAccentActive(), 'the leak released itself').to.eq(false);
      expect(clock.pending(), 'nothing of the lease is left on the clock').to.eq(0);
    } finally {
      console.warn = warn;
      setFlowClock(undefined);
    }
  });

  it('holdDockIntakeAccent releases on BOTH outcomes', async () => {
    await holdDockIntakeAccent('ok', Promise.resolve(1));
    expect(dockIntakeAccentActive(), 'released after resolve').to.eq(false);

    await holdDockIntakeAccent('boom', Promise.reject(new Error('flight died')))
      .catch(() => undefined);
    expect(dockIntakeAccentActive(), 'released after reject').to.eq(false);
  });

  it('a reset clears everything (a new game inherits nothing)', () => {
    beginDockIntakeAccent('one');
    beginDockIntakeAccent('two');
    resetDockIntakeAccent();
    expect(dockIntakeAccentActive()).to.eq(false);
    expect(dockIntakeAccentLabels()).to.deep.eq([]);
  });
});
