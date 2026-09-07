import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import type {Color} from '@/common/Color';
import {
  pushWorkspaceFrame, resetWorkspaceStack, serializeWorkspaceStack, workspaceFrameEpoch,
  workspaceFrameIndex, workspaceFrameOuterIndex, workspaceFrameRenders, workspaceStackState,
} from '@/client/console/consoleWorkspaceStack';
import {
  deltaRewardPickState, enterDeltaRewardPick, resetDeltaRewardPick,
} from '@/client/console/hydroFlow/deltaRewardEntry';
import {
  deltaBlockadePickState, enterDeltaBlockadePick, resetDeltaBlockadePick, resolveDeltaBlockadePick,
} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import {
  deltaEspionagePickState, enterDeltaEspionagePick, resetDeltaEspionagePick,
} from '@/client/console/hydroFlow/deltaEspionageEntry';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import type {DeltaBlockadeProjectionModel} from '@/common/models/DeltaBlockadeModel';

/**
 * A SECOND HYDRO DESCENT NESTS — never truncates.
 *
 * The 2026-09-06 collapse (Dutch Mountains → stage-7 reuse pick → Modular
 * Floodgates' blockade step): the three delta pick bridges capture their
 * answer by pushing a `hydro` frame, and an UNDECLARED same-kind push used to
 * be treated as a re-entry — the standing frame updated in place and
 * EVERYTHING above it truncated (the reward pick's frame overwritten, the
 * repeat-pick frame destroyed, its bridge cancelled under a live composer),
 * while the pick's own `resetHydroPlan` threw the outer role's drafts away.
 *
 * A workspace KIND is a SCREEN, not a purpose: the same screen serves many
 * roles per invocation. So a second descent now STACKS (`nest: true` — the
 * by-kind readers resolve to the deepest frame, the kind's flow epoch is not
 * bumped, the nested frame never serializes) and the door SUSPENDS the outer
 * role's module state, restoring it on every exit through the bridge's one
 * reset funnel.
 */
const PROJECTION: DeltaBlockadeProjectionModel = {
  owner: 'red' as Color,
  targets: [{color: 'blue' as Color, position: 3, legal: true}],
} as unknown as DeltaBlockadeProjectionModel;

function seatOuterChain(): void {
  pushWorkspaceFrame({
    kind: 'card-actions', subject: CardName.DUTCH_MOUNTAINS, stage: '',
    phase: 'configure', serves: [], anchor: {type: 'always'},
  });
  // The DM reward pick's own hydro frame (what `enterDeltaRewardPick` pushes).
  pushWorkspaceFrame({
    kind: 'hydro', subject: '', stage: 'Reward selection',
    phase: 'configure', serves: [], anchor: {type: 'always'}, overlay: true,
  });
  // The stage-7 reuse browser standing over it.
  pushWorkspaceFrame({
    kind: 'repeat-pick', subject: '', stage: 'Repeat action',
    phase: 'configure', serves: [], anchor: {type: 'always'}, overlay: true,
  });
}

function stackKinds(): ReadonlyArray<string> {
  return workspaceStackState.frames.map((f) => f.kind);
}

describe('the hydro-descent NESTING (a second descent stacks, never truncates)', () => {
  beforeEach(() => {
    resetWorkspaceStack();
    resetDeltaRewardPick();
    resetDeltaBlockadePick();
    resetDeltaEspionagePick();
    resetHydroPlan();
    consoleHydroUi.repeatResult = undefined;
  });
  afterEach(() => {
    resetDeltaRewardPick();
    resetDeltaBlockadePick();
    resetDeltaEspionagePick();
    resetHydroPlan();
    consoleHydroUi.repeatResult = undefined;
    resetWorkspaceStack();
  });

  it('the blockade pick NESTS over a standing hydro chain — nothing is truncated', () => {
    seatOuterChain();
    const epochBefore = workspaceFrameEpoch('hydro');

    enterDeltaBlockadePick({source: CardName.MODULAR_FLOODGATES, projection: PROJECTION},
      () => undefined, () => undefined);

    expect(deltaBlockadePickState.active, 'the pick opened').is.true;
    expect(stackKinds()).to.deep.eq(['card-actions', 'hydro', 'repeat-pick', 'hydro']);
    expect(workspaceStackState.frames[1].stage, 'the outer hydro frame is untouched')
      .to.eq('Reward selection');
    expect(workspaceStackState.frames[3].nested, 'the instrument frame is NESTED').is.true;
    // The by-kind readers see the DEEPEST role — the instrument on screen.
    expect(workspaceFrameIndex('hydro')).to.eq(3);
    expect(workspaceFrameOuterIndex('hydro'), 'the flow-owning frame is still addressable').to.eq(1);
    expect(workspaceFrameRenders('hydro')).is.true;
    // A borrowed instrument never bumps the kind's flow identity.
    expect(workspaceFrameEpoch('hydro')).to.eq(epochBefore);
  });

  it('the resolve pops ONLY the nested frame and RESTORES the outer role\'s state', () => {
    seatOuterChain();
    // The outer role (the reward pick) holds drafts the player already made.
    hydroNetworkState.selectedPosition = 7;
    hydroNetworkState.planChoices = {2: 1};
    hydroNetworkState.planPicks = {9: CardName.BIRDS};

    enterDeltaBlockadePick({source: CardName.MODULAR_FLOODGATES, projection: PROJECTION},
      () => undefined, () => undefined);
    // The instrument opened on a CLEAN slate…
    expect(hydroNetworkState.selectedPosition).to.eq(-1);
    expect(hydroNetworkState.planChoices).to.deep.eq({});

    resolveDeltaBlockadePick({target: 'blue' as Color});

    // …and the exit restored the outer role exactly.
    expect(stackKinds()).to.deep.eq(['card-actions', 'hydro', 'repeat-pick']);
    expect(hydroNetworkState.selectedPosition).to.eq(7);
    expect(hydroNetworkState.planChoices).to.deep.eq({2: 1});
    expect(hydroNetworkState.planPicks).to.deep.eq({9: CardName.BIRDS});
    expect(workspaceStackState.frames[1].stage).to.eq('Reward selection');
  });

  it('a DOUBLE reset never takes the outer hydro frame', () => {
    seatOuterChain();
    enterDeltaBlockadePick({source: CardName.MODULAR_FLOODGATES, projection: PROJECTION},
      () => undefined, () => undefined);

    resetDeltaBlockadePick();
    resetDeltaBlockadePick(); // a watcher racing a teardown

    expect(stackKinds()).to.deep.eq(['card-actions', 'hydro', 'repeat-pick']);
  });

  it('the reward pick nests the same way (self-nesting DM inside a copy)', () => {
    seatOuterChain();
    enterDeltaRewardPick({source: CardName.DUTCH_MOUNTAINS, claimable: [3]},
      () => undefined, () => undefined);
    expect(deltaRewardPickState.active).is.true;
    expect(stackKinds()).to.deep.eq(['card-actions', 'hydro', 'repeat-pick', 'hydro']);
    resetDeltaRewardPick();
    expect(stackKinds()).to.deep.eq(['card-actions', 'hydro', 'repeat-pick']);
  });

  it('the espionage pick nests the same way', () => {
    seatOuterChain();
    enterDeltaEspionagePick({
      source: CardName.CORPORATE_ESPIONAGE,
      projection: PROJECTION as never,
    }, () => undefined, () => undefined);
    expect(deltaEspionagePickState.active).is.true;
    expect(stackKinds()).to.deep.eq(['card-actions', 'hydro', 'repeat-pick', 'hydro']);
  });

  it('the MANDATORY standalone door opens on a free stack as its own root', () => {
    enterDeltaBlockadePick({
      source: CardName.MODULAR_FLOODGATES, projection: PROJECTION, mandatory: true,
    }, () => undefined, () => undefined);
    expect(deltaBlockadePickState.active).is.true;
    expect(workspaceFrameIndex('hydro')).to.eq(0);
  });

  it('a NESTED instrument frame never serializes — a reload lands on the outer flow', () => {
    seatOuterChain();
    enterDeltaBlockadePick({source: CardName.MODULAR_FLOODGATES, projection: PROJECTION},
      () => undefined, () => undefined);

    const stored = serializeWorkspaceStack();
    expect(stored.frames.map((f) => f.kind)).to.deep.eq(['card-actions', 'hydro', 'repeat-pick']);
  });
});
