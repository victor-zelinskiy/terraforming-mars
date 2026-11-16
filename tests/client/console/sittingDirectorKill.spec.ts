import {expect} from 'chai';
import {setReduceMotionOverride} from '@/client/utils/reducedMotion';
import {
  killSittingMotion, playSittingStage, resetSittingDirector, SittingDirectorContext, sittingMotionActive,
} from '@/client/console/parliament/sittingDirector';
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import type {SittingBeat} from '@/client/console/parliament/sittingBeats';

/*
 * WAIT GRAPH R4 — A KILL ENDS THE WAIT IT CUT (docs/claude/console/wait-graph-inventory.md).
 *
 * `killSittingMotion` used to drop the module's run pointer WITHOUT resolving the run's promise: the awaiting
 * `playSittingStage` — and the section's `runWalk` above it — stayed suspended for the section's life, its `finally`
 * never ran and `walking` stood raised, so every later walk was swallowed as «owed». A kill now RESOLVES the killed
 * run (keyed on that run), and the play it cut reports `killed` — never playing on into a stage a newer play owns.
 *
 * The run under test is the reward page's quiet dwell under reduced motion: a single beat with its own hold, the
 * smallest run the director plays (`.con-sit__panel--on [data-sit-quiet]` — a page whose whole content is a sentence).
 */
function quietRoot(): HTMLElement {
  const root = document.createElement('div');
  const panel = document.createElement('div');
  panel.className = 'con-sit__panel--on';
  const quiet = document.createElement('div');
  quiet.setAttribute('data-sit-quiet', '');
  panel.appendChild(quiet);
  root.appendChild(panel);
  return root;
}

function ctx(): SittingDirectorContext {
  return {root: quietRoot()} as unknown as SittingDirectorContext;
}

/** Resolves with the promise's value, or `'pending'` if it has not settled after a few microtask turns. */
async function settledOrPending<T>(p: Promise<T>): Promise<T | 'pending'> {
  let out: T | 'pending' = 'pending';
  void p.then((v) => {
    out = v;
  });
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  return out;
}

function sittingHolds(): number {
  return activeAnimationHoldLabels().filter((label) => label.startsWith('parliament-sitting')).length;
}

describe('sitting director — wait graph R4: a kill RESOLVES the run it cut', () => {
  beforeEach(() => {
    resetSittingDirector();
    setReduceMotionOverride(true);
  });
  afterEach(() => {
    resetSittingDirector();
    setReduceMotionOverride(false);
  });

  it('a play cut mid-beat resolves `killed` — its awaiting caller proceeds and its `finally` runs', async () => {
    const play = playSittingStage('reward', [], ctx(), {compact: false});
    expect(await settledOrPending(play), 'the dwell is still playing').eq('pending');
    expect(sittingMotionActive()).is.true;
    killSittingMotion();
    expect(await settledOrPending(play), 'the killed run resolved — nobody waits on it forever').eq('killed');
    expect(sittingMotionActive(), 'nothing stays posed').is.false;
    expect(sittingHolds(), 'the run\'s hold let go').eq(0);
  });

  it('a NEWER play cuts the one in front: the old one resolves `killed` (never plays on into the new one\'s stage)', async () => {
    const first = playSittingStage('reward', [], ctx(), {compact: false});
    const second = playSittingStage('reward', [], ctx(), {compact: false});
    expect(await settledOrPending(first), 'the same stage replayed — still told apart by the play\'s own identity').eq('killed');
    expect(await settledOrPending(second)).eq('pending');
    expect(sittingMotionActive(), 'the newer play owns the stage').is.true;
    resetSittingDirector();
    expect(await settledOrPending(second)).eq('killed');
  });

  it('the section\'s unmount (`resetSittingDirector`) resolves the run too', async () => {
    const play = playSittingStage('reward', [], ctx(), {compact: false});
    resetSittingDirector();
    expect(await settledOrPending(play)).eq('killed');
  });

  it('a page with nothing to play settles at once (`settled`), no run, no hold', async () => {
    const root = document.createElement('div');
    const play = playSittingStage('verdict', [], {root} as unknown as SittingDirectorContext, {compact: false});
    expect(await settledOrPending(play)).eq('settled');
    expect(sittingHolds()).eq(0);
  });

  /*
   * AN ENACTMENT CUT MID-RUN TELLS ITS REST (CI 2026-11-16, `console-parliament-sitting` tv-4k, 3 / 3): the walk notes a
   * page played BEFORE it plays it, so «свернуть» landing inside the enactment (a two-core runner reached it before the
   * B; a fast one was still on the verdict) brought the sitting back PAST the page — and the government, still awaiting
   * the new card, read «Starting rule» for the rest of the sitting. The cut now releases the enactment's holds.
   */
  it('a play of the ENACTMENT cut mid-run releases its holds — the government governs, nothing awaits', async () => {
    setReduceMotionOverride(false);
    resetParliamentHolds();
    parliamentHolds.govAwaits = 'enacted-1';
    parliamentHolds.govBefore = {enacted: undefined} as never;
    const enact: SittingBeat = {kind: 'enact', stage: 'enact', id: 'enact', compact: false} as SittingBeat;
    const play = playSittingStage('enact', [enact], {root: document.createElement('div'), agendaTold: true} as unknown as SittingDirectorContext,
      {compact: false});
    expect(await settledOrPending(play), 'the enactment is on its way (its first gap)').eq('pending');
    expect(parliamentHolds.govAwaits, 'the government still awaits the card').eq('enacted-1');
    killSittingMotion();
    expect(await settledOrPending(play)).eq('killed');
    expect(parliamentHolds.govAwaits, 'the cut told the rest: the new law governs').eq(undefined);
    expect(parliamentHolds.govBefore, 'the old government let go').eq(undefined);
    resetParliamentHolds();
  });

  it('…but a play that ENDED is not cut: a later kill leaves the holds a newer page seeded', async () => {
    const root = document.createElement('div');
    const done = playSittingStage('verdict', [], {root} as unknown as SittingDirectorContext, {compact: false});
    expect(await settledOrPending(done)).eq('settled');
    resetParliamentHolds();
    parliamentHolds.govAwaits = 'enacted-2';
    killSittingMotion();
    expect(parliamentHolds.govAwaits, 'nothing was cut — nothing is told').eq('enacted-2');
    resetParliamentHolds();
  });
});
