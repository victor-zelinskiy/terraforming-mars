import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  HydroCommitRecord, advanceHydroCommitPhase, beginHydroCommit, closeHydroStep, hydroDraftFresh,
  hydroFlowState, hydroPhaseOf, hydroResolutionBusyOf, hydroWorkspaceBackVerb, hydroWorkspacePhase,
  hydroWorkspaceRestorePlan, noteHydroDraftTouched, openHydroStep, resetHydroFlow,
  resolutionKindFor, rollbackHydroCommit, setHydroCeremonyActive, setHydroRepeatBridge,
} from '@/client/console/hydroFlow/consoleHydroFlow';

function commitRec(over: Partial<Omit<HydroCommitRecord, 'phase'>> = {}): Omit<HydroCommitRecord, 'phase'> {
  return {
    kind: 'plain',
    fromPosition: 0,
    toPosition: 3,
    spend: 3,
    spendSteel: 0,
    rewardChoice: undefined,
    selectedCard: undefined,
    composedRepeat: false,
    targetBefore: undefined,
    rewardLines: [],
    vp: undefined,
    stageNameKey: 'Terran Hydro Standards',
    ...over,
  };
}

describe('consoleHydroFlow', () => {
  beforeEach(() => resetHydroFlow());
  // Module state is bundle-shared in mochapack — a leaked commit would poison
  // every later spec (an open flow keeps its holds and phases live).
  after(() => resetHydroFlow());

  it('maps the landed position onto its resolution kind', () => {
    expect(resolutionKindFor(10, {composedRepeat: false, selectedCard: undefined})).eq('ceremony');
    expect(resolutionKindFor(11, {composedRepeat: false, selectedCard: undefined})).eq('ceremony');
    expect(resolutionKindFor(5, {composedRepeat: false, selectedCard: undefined})).eq('deck-draw');
    expect(resolutionKindFor(7, {composedRepeat: true, selectedCard: CardName.VIRON})).eq('repeat');
    expect(resolutionKindFor(7, {composedRepeat: false, selectedCard: CardName.VIRON})).eq('repeat');
    // No candidate at all → the reward fizzles server-side: a plain advance.
    expect(resolutionKindFor(7, {composedRepeat: false, selectedCard: undefined})).eq('plain');
    expect(resolutionKindFor(9, {composedRepeat: false, selectedCard: CardName.BIRDS})).eq('card-resource');
    expect(resolutionKindFor(9, {composedRepeat: false, selectedCard: undefined})).eq('plain');
    expect(resolutionKindFor(3, {composedRepeat: false, selectedCard: undefined})).eq('plain');
  });

  it('derives the workspace phase from the flow state', () => {
    expect(hydroPhaseOf({step: undefined, repeatBridge: false, commit: undefined}, false)).eq('browse');
    expect(hydroPhaseOf({step: 'reward', repeatBridge: false, commit: undefined}, false)).eq('configure');
    expect(hydroPhaseOf({step: undefined, repeatBridge: true, commit: undefined}, false)).eq('configure');
    const moving: HydroCommitRecord = {...commitRec(), phase: 'moving'};
    expect(hydroPhaseOf({step: undefined, repeatBridge: false, commit: moving}, false)).eq('executing');
    const resolving: HydroCommitRecord = {...commitRec(), phase: 'resolving'};
    // A transient beat with nothing to answer absorbs input…
    expect(hydroPhaseOf({step: undefined, repeatBridge: false, commit: resolving}, false)).eq('executing');
    // …but a STANDING follow-up decision makes it the collapsible phase.
    expect(hydroPhaseOf({step: undefined, repeatBridge: false, commit: resolving}, true)).eq('committed');
    const result: HydroCommitRecord = {...commitRec(), phase: 'result'};
    expect(hydroPhaseOf({step: undefined, repeatBridge: false, commit: result}, false)).eq('completing');
  });

  it('B follows the phase: close → back → none → collapse', () => {
    expect(hydroWorkspaceBackVerb(false)).eq('close');
    openHydroStep('reward');
    expect(hydroWorkspaceBackVerb(false)).eq('back');
    beginHydroCommit(commitRec({kind: 'deck-draw', toPosition: 5, spend: 5}));
    expect(hydroWorkspaceBackVerb(false), 'moving absorbs').eq('none');
    advanceHydroCommitPhase('resolving');
    expect(hydroWorkspaceBackVerb(true), 'a standing follow-up may collapse').eq('collapse');
    advanceHydroCommitPhase('result');
    expect(hydroWorkspaceBackVerb(false), 'the result hold absorbs').eq('none');
  });

  it('the commit boundary closes every pre-select step', () => {
    openHydroStep('target');
    setHydroRepeatBridge(true);
    beginHydroCommit(commitRec());
    expect(hydroFlowState.step).eq(undefined);
    expect(hydroFlowState.repeatBridge).eq(false);
    expect(hydroFlowState.commit?.phase).eq('moving');
    // Past the boundary nothing re-opens a pre-select.
    openHydroStep('reward');
    expect(hydroFlowState.step).eq(undefined);
  });

  it('the commit phase is forward-only', () => {
    beginHydroCommit(commitRec());
    advanceHydroCommitPhase('resolving');
    expect(hydroFlowState.commit?.phase).eq('resolving');
    // A stray late signal can never resurrect a spent beat.
    advanceHydroCommitPhase('moving' as never);
    expect(hydroFlowState.commit?.phase).eq('resolving');
    advanceHydroCommitPhase('result');
    expect(hydroFlowState.commit?.phase).eq('result');
    advanceHydroCommitPhase('resolving');
    expect(hydroFlowState.commit?.phase).eq('result');
  });

  it('a server refusal rolls the flow back to the reversible side', () => {
    openHydroStep('reward');
    beginHydroCommit(commitRec());
    setHydroCeremonyActive(true);
    rollbackHydroCommit();
    expect(hydroFlowState.commit).eq(undefined);
    expect(hydroFlowState.ceremonyActive).eq(false);
    expect(hydroWorkspacePhase(false)).eq('browse');
  });

  it('a draft is fresh only against the exact world version it was composed in', () => {
    expect(hydroDraftFresh('1:2:0'), 'nothing noted yet').eq(false);
    noteHydroDraftTouched('1:2:0');
    expect(hydroDraftFresh('1:2:0')).eq(true);
    expect(hydroDraftFresh('1:3:0'), 'the world moved on').eq(false);
  });

  it('the restore plan is host-scoped and honest', () => {
    expect(hydroWorkspaceRestorePlan({commit: undefined, claimHost: undefined, followUpInteractive: false})).eq('none');
    const c: HydroCommitRecord = {...commitRec({kind: 'deck-draw', toPosition: 5}), phase: 'resolving'};
    expect(hydroWorkspaceRestorePlan({commit: c, claimHost: 'hydro', followUpInteractive: false}),
      'our claim → re-seat the commit scene').eq('seat-commit');
    expect(hydroWorkspaceRestorePlan({commit: c, claimHost: undefined, followUpInteractive: true}),
      'a standing follow-up → re-seat').eq('seat-commit');
    expect(hydroWorkspaceRestorePlan({commit: c, claimHost: 'card-actions', followUpInteractive: false}),
      'a foreign claim is never adopted').eq('fold');
    expect(hydroWorkspaceRestorePlan({commit: c, claimHost: undefined, followUpInteractive: false}),
      'nothing live under the record → fold honestly').eq('fold');
  });

  it('closeHydroStep folds one level and keeps the rest', () => {
    openHydroStep('target');
    closeHydroStep();
    expect(hydroFlowState.step).eq(undefined);
    expect(hydroWorkspacePhase(false)).eq('browse');
  });
});

/**
 * ══ THE WORKSPACE MAY NOT CLOSE BEFORE ITS ANIMATION CHAIN IS OVER ════════
 *
 * The only door out of a committed hydro flow is the RESULT stage, and the
 * only thing that opens it is the FALLING EDGE of this predicate. So «the
 * workspace waits for the animation» is exactly «every way the move is still
 * on screen is a term here» — which is why it is one pure function and not a
 * condition spelled out at the shell's watcher.
 *
 * The defect these pin: a card-granted bonus move used to submit and close in
 * the same breath. Nothing was busy because nothing had been ARMED — the
 * predicate was right, its inputs were empty — so the marker never moved, the
 * reward never flew, and the whole advance happened off screen.
 */
describe('the hydro close gate', () => {
  const QUIET = {
    committed: true, markerGliding: false, rewardHeld: false,
    transfersFlying: false, ceremony: false, followUpInteractive: false,
  };

  /** Each signal on its OWN must hold the flow — a table, so a new one that
   *  someone forgets to add here is a visible gap rather than a silent one. */
  const SIGNALS: ReadonlyArray<[string, keyof typeof QUIET]> = [
    ['the marker is gliding between the stops', 'markerGliding'],
    ['the granted reward is held off the counter', 'rewardHeld'],
    ['the reward chips are in the air', 'transfersFlying'],
    ['the VP ceremony is running', 'ceremony'],
    ['the landed stage is asking something', 'followUpInteractive'],
  ];

  for (const [what, key] of SIGNALS) {
    it(`holds the flow while ${what}`, () => {
      expect(hydroResolutionBusyOf({...QUIET, [key]: true}), key).eq(true);
    });
  }

  it('holds the flow while a TRAVERSAL plan still has legs — its pauses included', () => {
    // A parked stop can momentarily hold no other signal (the marker idle,
    // nothing flying) — the plan itself is what keeps the flow honest.
    expect(hydroResolutionBusyOf({...QUIET, traversalPending: true})).eq(true);
  });

  it('holds the flow while the TAKEN CARD is still flying to the dock', () => {
    // `consoleRevealMode` ends a tick after the take press, ~a second before
    // the card physically lands — the delivery flights are the only signal
    // that spans it, so a repeated action's flow (and a paused traversal's
    // resume) may not conclude over a card still in the air.
    expect(hydroResolutionBusyOf({...QUIET, intakeFlying: true})).eq(true);
  });

  it('releases only when EVERY one of them has settled', () => {
    expect(hydroResolutionBusyOf(QUIET)).eq(false);
  });

  it('says nothing about a flow that has not committed', () => {
    // Before the boundary these signals belong to somebody else's scene.
    expect(hydroResolutionBusyOf({
      ...QUIET, committed: false, markerGliding: true, transfersFlying: true,
    })).eq(false);
  });

  /**
   * THE WALK, in the order the shell drives it. `result` is the phase the
   * command bar offers «Продолжить» on and the only one `finishHydroFlow`
   * accepts — so «the flow cannot be finished early» is «the phase machine
   * cannot reach `result` while the chain is busy».
   */
  it('REGRESSION: the flow cannot reach its result stage while the chain is busy', () => {
    resetHydroFlow();
    beginHydroCommit(commitRec());
    expect(hydroFlowState.commit?.phase).eq('moving');

    // The glide owns the beat: the shell's watcher does not advance here.
    let busy = hydroResolutionBusyOf({...QUIET, markerGliding: true});
    expect(busy, 'gliding').eq(true);
    expect(hydroWorkspacePhase(false), 'a beat in flight, not a destination').eq('executing');

    // The token locks in → the landed stage may pay out.
    advanceHydroCommitPhase('resolving');
    busy = hydroResolutionBusyOf({...QUIET, rewardHeld: true, transfersFlying: true});
    expect(busy, 'the reward is still flying').eq(true);
    // …and the shell only advances on `!busy`, so the phase stays put.
    if (!busy) {
      advanceHydroCommitPhase('result');
    }
    expect(hydroFlowState.commit?.phase, 'still resolving').eq('resolving');

    // Everything has landed — now, and only now, the result stage opens.
    busy = hydroResolutionBusyOf(QUIET);
    expect(busy).eq(false);
    advanceHydroCommitPhase('result');
    expect(hydroFlowState.commit?.phase).eq('result');
    expect(hydroWorkspacePhase(false)).eq('completing');
    resetHydroFlow();
  });
});
