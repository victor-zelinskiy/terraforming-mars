import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  HydroCommitRecord, advanceHydroCommitPhase, beginHydroCommit, closeHydroStep, hydroDraftFresh,
  hydroFlowState, hydroPhaseOf, hydroWorkspaceBackVerb, hydroWorkspacePhase,
  hydroWorkspaceRestorePlan, noteHydroDraftTouched, openHydroStep, resetHydroFlow,
  resolutionKindFor, rollbackHydroCommit, setHydroCeremonyActive, setHydroRepeatBridge,
} from '@/client/console/hydroFlow/consoleHydroFlow';

function commitRec(over: Partial<Omit<HydroCommitRecord, 'phase'>> = {}): Omit<HydroCommitRecord, 'phase'> {
  return {
    kind: 'plain',
    fromPosition: 0,
    toPosition: 3,
    spend: 3,
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
