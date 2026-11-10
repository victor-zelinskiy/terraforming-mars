import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree} from '@/client/console/kernel/flowScope';
import {
  CLAIM_ARRIVAL_SAFETY_MS, CLAIM_BEAT_SAFETY_MS, CLAIM_HOST_GONE_GRACE_MS, CLAIM_SAFETY_MS,
} from '@/client/console/consoleWorkspaceClaim';
import {
  claimWorkspaceOutcome, lastOutcomeReleaseStack, markWorkspaceOutcomeAnswerIn, markWorkspaceOutcomeArrivalDone,
  markWorkspaceOutcomeArrivalFlown, markWorkspaceOutcomeBeatDone, markWorkspaceOutcomePresenting, rehomeWorkspaceOutcome,
  releaseWorkspaceOutcome, resetWorkspaceOutcome, retainWorkspaceOutcomeForNextBatch, setWorkspaceOutcomeServingProbe,
  workspaceOutcomeArrivalPending, workspaceOutcomeBeatPending, workspaceOutcomeClaimed, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {
  collapseWorkspaceStack, enterWorkspace, goBoardHome, pushWorkspaceFrame, resetWorkspaceStack, restoreWorkspaceStack,
  resumeStackFromBoard, yieldStackForStagedPlay,
} from '@/client/console/consoleWorkspaceStack';

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

/**
 * THE CLAIM'S LIFE IN TIME (architecture v2, lifecycle 1) — its three backstops are states with a bound, and it is
 * bound to its host frame's scope: the field class «a claim outlived its host» (Hi-Tech Lab), and the regression of
 * its first fix (the host stood ASIDE — the Hydronetwork's copied Mars Nomads), are the two specs at the top.
 */
describe('workspace outcome claim · its life in time', () => {
  let clock: ManualFlowClock;
  let warn: typeof console.warn;
  let warned: Array<string>;

  beforeEach(() => {
    resetWorkspaceOutcome();
    resetWorkspaceStack();
    clock = createManualClock(0);
    setFlowClock(clock);
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
  });
  afterEach(() => {
    setWorkspaceOutcomeServingProbe(undefined);
    resetWorkspaceOutcome();
    resetWorkspaceStack();
    setFlowClock(undefined);
    console.warn = warn;
  });

  describe('a claim never outlives its host', () => {
    it('HI-TECH LAB: the workspace leaves, the claim stood — it is released the moment the grace is over, and says so', async () => {
      enterWorkspace('card-actions');
      claimWorkspaceOutcome('card-actions', 'Hi-Tech Lab', ['draw', 'pick'], 0, 1);
      goBoardHome();
      expect(workspaceOutcomeClaimed(), 'inside the grace a re-entry would re-bind it').to.eq(true);
      clock.advance(CLAIM_HOST_GONE_GRACE_MS - 1);
      expect(workspaceOutcomeClaimed()).to.eq(true);
      clock.advance(1);
      expect(workspaceOutcomeClaimed()).to.eq(false);
      expect(lastOutcomeReleaseStack).to.contain('host-gone');
      expect(warned).to.deep.eq(['[workspace-outcome] the claim of «card-actions» (Hi-Tech Lab [draw,pick]) outlived its host — released; its question presents on its own surface']);
    });

    it('…even a SERVING one: a host that is gone has no zone coming back', async () => {
      enterWorkspace('card-actions');
      claimWorkspaceOutcome('card-actions', 'Hi-Tech Lab', ['draw', 'pick']);
      setWorkspaceOutcomeServingProbe(() => true);
      goBoardHome();
      clock.advance(CLAIM_HOST_GONE_GRACE_MS);
      expect(workspaceOutcomeClaimed()).to.eq(false);
    });

    it('THE THREE HOMES: a host parked, or aside for its own board step, is not gone — the claim stands for as long as the player aims', async () => {
      enterWorkspace('hydro');
      claimWorkspaceOutcome('hydro', 'Mars Nomads', ['draw', 'pick'], 0, 0, 'chain');
      markWorkspaceOutcomePresenting();
      yieldStackForStagedPlay();
      clock.advance(60_000);
      expect(workspaceOutcomeClaimed(), 'aside for the board').to.eq(true);
      resumeStackFromBoard();
      collapseWorkspaceStack();
      clock.advance(60_000);
      expect(workspaceOutcomeClaimed(), 'in the park').to.eq(true);
      restoreWorkspaceStack();
      expect(workspaceOutcomeState.host).to.eq('hydro');
      expect(warned).to.deep.eq([]);
    });

    it('a workspace re-entered inside the grace re-binds the claim', async () => {
      enterWorkspace('card-actions');
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
      goBoardHome();
      clock.advance(CLAIM_HOST_GONE_GRACE_MS - 100);
      enterWorkspace('card-actions');
      clock.advance(CLAIM_HOST_GONE_GRACE_MS * 4);
      expect(workspaceOutcomeClaimed()).to.eq(true);
      // …and the NEW frame's end is the claim's event again.
      markWorkspaceOutcomePresenting();
      goBoardHome();
      clock.advance(CLAIM_HOST_GONE_GRACE_MS);
      expect(workspaceOutcomeClaimed()).to.eq(false);
    });

    it('a claim placed a line BEFORE its frame is pushed is bound when the frame stands', async () => {
      claimWorkspaceOutcome('hand', 'Some Card', ['draw', 'pick'], 0, 0, 'chain');
      enterWorkspace('hand');
      markWorkspaceOutcomePresenting();
      clock.advance(60_000);
      expect(workspaceOutcomeClaimed()).to.eq(true);
    });

    it('a claim for a host that never stands is released at the grace (the orphan put in on purpose — the e2e control)', async () => {
      claimWorkspaceOutcome('card-actions', 'Hi-Tech Lab', ['draw', 'pick'], 0, 1, 'card');
      clock.advance(CLAIM_HOST_GONE_GRACE_MS);
      expect(workspaceOutcomeClaimed()).to.eq(false);
      expect(warned.filter((line) => line.includes('outlived its host')).length, 'released ONCE').to.eq(1);
    });

    it('REHOME binds the claim to its new host: the old host leaving no longer ends it, the new one does', async () => {
      pushWorkspaceFrame({kind: 'start', subject: '', stage: '', phase: 'committed', serves: [], anchor: {type: 'phase', phase: 'start'}});
      pushWorkspaceFrame({kind: 'hand', subject: '', stage: '', phase: 'configure', serves: [], anchor: {type: 'always'}});
      claimWorkspaceOutcome('hand', 'Eccentric Sponsor', ['draw', 'pick'], 0, 0, 'chain');
      markWorkspaceOutcomePresenting();
      rehomeWorkspaceOutcome('start', '[data-embed-slot="start"]');
      // The hosted hand step unmounts the moment the card lands — the flow does not end with it.
      goBoardHome();
      clock.advance(60_000);
      expect(workspaceOutcomeClaimed()).to.eq(true);
      expect(workspaceOutcomeState.host).to.eq('start');
    });
  });

  describe('the three backstops are states with a bound', () => {
    beforeEach(() => enterWorkspace('card-actions'));

    it('«claimed, and nothing came»: released at the safety', () => {
      claimWorkspaceOutcome('card-actions', 'Some Card', ['deck-check']);
      clock.advance(CLAIM_SAFETY_MS - 1);
      expect(workspaceOutcomeClaimed()).to.eq(true);
      clock.advance(1);
      expect(workspaceOutcomeClaimed()).to.eq(false);
      expect(lastOutcomeReleaseStack).to.contain('claim-safety');
    });

    it('a claim that SERVES is never released by its own safety — and is, once the serving ends', () => {
      let serving = true;
      setWorkspaceOutcomeServingProbe(() => serving);
      claimWorkspaceOutcome('card-actions', 'Some Card', ['pick']);
      clock.advance(CLAIM_SAFETY_MS * 3);
      expect(workspaceOutcomeClaimed(), 'the player is still being asked').to.eq(true);
      expect(workspaceOutcomeState.stage).to.eq('awaiting');
      serving = false;
      clock.advance(CLAIM_SAFETY_MS);
      expect(workspaceOutcomeClaimed()).to.eq(false);
    });

    it('presenting DISARMS the safety — a long read never expires the claim under the player', () => {
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
      markWorkspaceOutcomePresenting();
      clock.advance(CLAIM_SAFETY_MS * 10);
      expect(workspaceOutcomeClaimed()).to.eq(true);
      expect(workspaceOutcomeState.stage).to.eq('presenting');
    });

    it('a REFUSED release keeps re-asking: «a refusal is a wait, never a wedge» — while presenting too', () => {
      let serving = true;
      setWorkspaceOutcomeServingProbe(() => serving);
      claimWorkspaceOutcome('card-actions', 'Some Card', ['pick']);
      markWorkspaceOutcomePresenting();
      expect(releaseWorkspaceOutcome('embed-fell')).to.eq(false);
      clock.advance(CLAIM_SAFETY_MS * 2);
      expect(workspaceOutcomeClaimed()).to.eq(true);
      expect(workspaceOutcomeState.stage, 'still presenting').to.eq('presenting');
      serving = false;
      clock.advance(CLAIM_SAFETY_MS);
      expect(workspaceOutcomeClaimed(), 'nobody was left to release it — its own bound did').to.eq(false);
    });

    it('the EXECUTION BEAT is pending until it is marked done or its backstop', () => {
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
      expect(workspaceOutcomeBeatPending()).to.eq(true);
      clock.advance(CLAIM_BEAT_SAFETY_MS - 1);
      expect(workspaceOutcomeBeatPending()).to.eq(true);
      clock.advance(1);
      expect(workspaceOutcomeBeatPending()).to.eq(false);
      // A launch counts the backstop from the FLIGHT (the duplicate card of «Передовые лаборатории»).
      markWorkspaceOutcomeArrivalFlown();
      expect(workspaceOutcomeBeatPending()).to.eq(true);
      clock.advance(CLAIM_BEAT_SAFETY_MS - 1);
      expect(workspaceOutcomeBeatPending()).to.eq(true);
      markWorkspaceOutcomeBeatDone();
      expect(workspaceOutcomeBeatPending()).to.eq(false);
    });

    it('the ARRIVAL gate: shut for a card outcome, armed from the answer, re-armed from the presenting, opened by the hand-over or its backstop', () => {
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw', 'pick']);
      expect(workspaceOutcomeArrivalPending()).to.eq(true);
      // Not timed before the answer: an honest wait on a slow server is not the failure the backstop guards.
      clock.advance(CLAIM_ARRIVAL_SAFETY_MS * 2);
      expect(workspaceOutcomeArrivalPending()).to.eq(true);
      markWorkspaceOutcomeAnswerIn();
      clock.advance(CLAIM_ARRIVAL_SAFETY_MS - 1);
      markWorkspaceOutcomePresenting();
      clock.advance(CLAIM_ARRIVAL_SAFETY_MS - 1);
      expect(workspaceOutcomeArrivalPending(), 'restarted from the presenting').to.eq(true);
      clock.advance(1);
      expect(workspaceOutcomeArrivalPending()).to.eq(false);
    });

    it('the hand-over opens the gate and leaves no timer', () => {
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
      markWorkspaceOutcomeAnswerIn();
      markWorkspaceOutcomePresenting();
      markWorkspaceOutcomeBeatDone();
      markWorkspaceOutcomeArrivalDone();
      expect(workspaceOutcomeArrivalPending()).to.eq(false);
      expect(clock.pending(), 'presenting, beat over, arrival open: nothing is timed').to.eq(0);
    });

    it('RETAIN re-arms the same lease for the next batch: awaiting again, the gate shut again, the safety running', () => {
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
      markWorkspaceOutcomeAnswerIn();
      markWorkspaceOutcomePresenting();
      markWorkspaceOutcomeArrivalDone();
      retainWorkspaceOutcomeForNextBatch(2);
      expect(workspaceOutcomeState.stage).to.eq('awaiting');
      expect(workspaceOutcomeArrivalPending()).to.eq(true);
      expect(workspaceOutcomeState.expectedCards).to.eq(2);
      clock.advance(CLAIM_SAFETY_MS);
      expect(workspaceOutcomeClaimed(), 'a queued batch that never came is «claimed and nothing came» again').to.eq(false);
    });

    it('a release ends the run: no bound of it fires afterwards, and a new claim is a new run', () => {
      claimWorkspaceOutcome('card-actions', 'First', ['draw', 'pick']);
      markWorkspaceOutcomeAnswerIn();
      expect(releaseWorkspaceOutcome('drawn-complete', {force: true})).to.eq(true);
      expect(clock.pending()).to.eq(0);
      claimWorkspaceOutcome('card-actions', 'Second', ['draw']);
      expect(workspaceOutcomeState.sourceCard).to.eq('Second');
      expect(workspaceOutcomeBeatPending(), 'the previous flight never satisfies the next').to.eq(true);
      clock.advance(CLAIM_SAFETY_MS - 1);
      expect(workspaceOutcomeClaimed()).to.eq(true);
    });

    it('the claim is a scope on the flow tree, with its state', () => {
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
      expect(dumpFlowTree().some((line) => line.includes('claim:card-actions/Some Card#') && line.includes('awaiting'))).to.eq(true);
      releaseWorkspaceOutcome('done', {force: true});
      expect(dumpFlowTree().some((line) => line.includes('claim:card-actions/Some Card#'))).to.eq(false);
    });
  });

  it('flushes nothing asynchronously: every mirror is written in the call that caused it', async () => {
    enterWorkspace('card-actions');
    claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
    markWorkspaceOutcomePresenting();
    expect(workspaceOutcomeState.stage).to.eq('presenting');
    await flush();
    expect(workspaceOutcomeState.stage).to.eq('presenting');
  });
});
