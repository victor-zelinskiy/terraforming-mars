import {expect} from 'chai';
import {
  CURSOR_PENDING_MAX_MS, arriveCursor, createCursorArrival, cursorPendingAttr, gateCursorDuringEntry,
  gateCursorUntilAnimationsEnd, holdCursor, releaseCursor, releaseCursorsOnInput, releaseEntryCursorGate, trackCursorArrival,
} from '@/client/console/cursorArrival';
import {setReduceMotionOverride} from '@/client/utils/reducedMotion';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';

/*
 * THE CURSOR ARRIVES — it never appears (TR58). The arrival is a gate on the cursor's POSE, never on input:
 *  · a held cursor stands at rest until its surface's ready signal, then arrives one painted frame later;
 *  · a press during the arrival releases it at once (input never waits for a ring);
 *  · reduced motion has no gate;
 *  · a band surface's entrance gates its root (`data-cursor-pending="entry"`) and lets go after the entrance;
 *  · nothing stays held forever (the backstop names itself).
 */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, PROBE_TICK_FALLBACK_MS + 20));

describe('cursorArrival — the default cursor ARRIVES', () => {
  afterEach(() => {
    setReduceMotionOverride(false);
  });

  it('hold → the pose is gated; arrive → released a painted frame later, never in the same flush', async () => {
    const a = createCursorArrival('test');
    holdCursor(a);
    expect(a.pending).to.eq(true);
    expect(cursorPendingAttr(a)).to.eq('');
    arriveCursor(a);
    expect(a.pending, 'not in the frame of the ready signal').to.eq(true);
    await tick();
    expect(a.pending).to.eq(false);
    expect(cursorPendingAttr(a)).to.eq(undefined);
  });

  it('a stale arrive (a NEW hold in between) never releases the new hold', async () => {
    const a = createCursorArrival('test');
    holdCursor(a);
    arriveCursor(a);
    holdCursor(a); // the surface was re-held before the frame came
    await tick();
    expect(a.pending, 'the second hold stands').to.eq(true);
    releaseCursor(a);
  });

  it('a press during the arrival releases it NOW — but never a hold whose surface is not ready yet', () => {
    const a = createCursorArrival('test');
    const untrack = trackCursorArrival(a);
    holdCursor(a);
    releaseCursorsOnInput();
    expect(a.pending, 'no ready signal yet: the copies still fly — the press waits nothing, the pose stays held').to.eq(true);
    arriveCursor(a);
    releaseCursorsOnInput();
    expect(a.pending, 'ready and arriving: the press IS the arrival').to.eq(false);
    untrack();
  });

  it('reduced motion holds nothing', () => {
    setReduceMotionOverride(true);
    const a = createCursorArrival('test');
    holdCursor(a);
    expect(a.pending).to.eq(false);
  });

  it('a band surface entrance gates its root and lets go after the entrance', async () => {
    const el = document.createElement('div');
    let doneCalls = 0;
    const done = gateCursorDuringEntry(el, () => doneCalls++);
    expect(el.getAttribute('data-cursor-pending')).to.eq('entry');
    done();
    expect(doneCalls).to.eq(1);
    expect(el.getAttribute('data-cursor-pending'), 'still held in the frame the entrance ended').to.eq('entry');
    await tick();
    expect(el.hasAttribute('data-cursor-pending')).to.eq(false);
  });

  it('a press during an entrance releases the entrance gate; a cancelled entrance lets go too', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    gateCursorDuringEntry(el, () => undefined);
    releaseCursorsOnInput();
    expect(el.hasAttribute('data-cursor-pending')).to.eq(false);
    gateCursorDuringEntry(el, () => undefined);
    releaseEntryCursorGate(el);
    expect(el.hasAttribute('data-cursor-pending')).to.eq(false);
    el.remove();
  });

  it('an entrance never touches a gate the surface owns itself (a Vue-bound `[data-cursor-pending=""]`)', () => {
    const el = document.createElement('div');
    el.setAttribute('data-cursor-pending', '');
    releaseEntryCursorGate(el);
    expect(el.getAttribute('data-cursor-pending')).to.eq('');
  });

  it('nothing running → no animation gate', () => {
    const el = document.createElement('div');
    (el as unknown as {getAnimations: () => Array<Animation>}).getAnimations = () => [];
    gateCursorUntilAnimationsEnd(el);
    expect(el.hasAttribute('data-cursor-pending')).to.eq(false);
  });

  it('the backstop is bounded', () => {
    expect(CURSOR_PENDING_MAX_MS).to.be.within(1000, 6000);
  });
});
