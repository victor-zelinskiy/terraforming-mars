import {expect} from 'chai';
import {buildHydroModel, HydroModelInput} from '../../../../src/client/components/hydronetwork/hydroNetworkModel';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '../../../../src/common/models/DeltaTrackPreviewModel';
import {Tag} from '../../../../src/common/cards/Tag';

function dest(steps: number, opts: Partial<DeltaTrackDestination> = {}): DeltaTrackDestination {
  return {
    steps,
    position: steps, // tests start the viewer at position 0
    legal: true,
    occupied: false,
    jumpedOverVp2: false,
    requiredTags: [],
    wildCoveredTags: [],
    missingTags: [],
    ...opts,
  };
}

function preview(overrides: Partial<DeltaTrackPreviewModel> = {}): DeltaTrackPreviewModel {
  return {
    currentPosition: 0,
    availableEnergy: 3,
    usedThisGeneration: false,
    atEndOfTrack: false,
    maxLegalSteps: 3,
    maxPreviewSteps: 3,
    destinations: [dest(1), dest(2), dest(3)],
    ...overrides,
  };
}

function input(overrides: Partial<HydroModelInput> = {}): HydroModelInput {
  return {
    preview: preview(),
    players: [{color: 'red', position: 0, isViewer: true}],
    viewerColor: 'red',
    selectedSpend: -1,
    rewardChoice: undefined,
    actionAvailable: true,
    ...overrides,
  };
}

describe('buildHydroModel', () => {
  it('defaults the spend to the max legal move', () => {
    const m = buildHydroModel(input());
    expect(m.defaultSpend).eq(3);
    expect(m.selectedSpend).eq(3);
    expect(m.destinationPosition).eq(3);
  });

  it('falls back to the deepest preview when no legal move exists', () => {
    const m = buildHydroModel(input({
      preview: preview({maxLegalSteps: 0, destinations: [dest(1, {legal: false, missingTags: [Tag.BUILDING]}), dest(2, {legal: false, missingTags: [Tag.BUILDING, Tag.POWER]})], maxPreviewSteps: 2}),
    }));
    expect(m.defaultSpend).eq(2);
    expect(m.selectedSpend).eq(2);
  });

  it('clamps the spend to the energy-bounded preview depth', () => {
    expect(buildHydroModel(input({selectedSpend: 99})).selectedSpend).eq(3);
    expect(buildHydroModel(input({selectedSpend: 2})).selectedSpend).eq(2);
  });

  it('exposes the server destination for the chosen spend', () => {
    const m = buildHydroModel(input({selectedSpend: 2}));
    expect(m.destination?.steps).eq(2);
    expect(m.destinationPosition).eq(2);
  });

  it('allows previewing illegal (missing-tag) destinations but blocks confirm', () => {
    const m = buildHydroModel(input({
      selectedSpend: 3,
      preview: preview({
        maxLegalSteps: 1,
        destinations: [dest(1), dest(2, {legal: false, missingTags: [Tag.POWER]}), dest(3, {legal: false, missingTags: [Tag.POWER, Tag.EARTH]})],
      }),
    }));
    expect(m.maxSpend).eq(3); // energy still allows the preview
    expect(m.destination?.legal).eq(false);
    expect(m.canConfirm).eq(false);
  });

  it('requires a reward choice on a choice stage before confirming', () => {
    // Destination position 1 (Dam Foundations) is a steel-or-plants choice.
    const withoutChoice = buildHydroModel(input({selectedSpend: 1, rewardChoice: undefined}));
    expect(withoutChoice.targetNeedsChoice).eq(true);
    expect(withoutChoice.canConfirm).eq(false);
    const withChoice = buildHydroModel(input({selectedSpend: 1, rewardChoice: 0}));
    expect(withChoice.canConfirm).eq(true);
  });

  it('confirms a legal fixed-reward destination', () => {
    const m = buildHydroModel(input({selectedSpend: 3}));
    expect(m.targetNeedsChoice).eq(false);
    expect(m.canConfirm).eq(true);
  });

  it('cannot confirm when the action is not available or already used', () => {
    expect(buildHydroModel(input({selectedSpend: 3, actionAvailable: false})).canConfirm).eq(false);
    expect(buildHydroModel(input({selectedSpend: 3, preview: preview({usedThisGeneration: true})})).canConfirm).eq(false);
  });

  it('lists the intermediate stages whose reward is skipped by a jump', () => {
    const m = buildHydroModel(input({selectedSpend: 3}));
    // Jump 0 → 3 skips positions 1 and 2 (both have rewards).
    expect(m.skippedStages.map((s) => s.position)).deep.eq([1, 2]);
  });

  it('marks current / route / target / reachable states', () => {
    const m = buildHydroModel(input({selectedSpend: 2}));
    const stateAt = (pos: number) => m.stages[pos].state;
    expect(stateAt(0)).eq('current');
    expect(stateAt(1)).eq('route');
    expect(stateAt(2)).eq('target');
    expect(stateAt(3)).eq('reachable');
    expect(stateAt(4)).eq('future');
  });

  it('places player markers and flags an occupied VP slot', () => {
    const m = buildHydroModel(input({
      preview: preview({currentPosition: 9, availableEnergy: 5, maxLegalSteps: 2, maxPreviewSteps: 2, destinations: [dest(1, {position: 10, occupied: true, legal: false}), dest(2, {position: 11, legal: true, jumpedOverVp2: true})]}),
      players: [{color: 'red', position: 9, isViewer: true}, {color: 'blue', position: 10, isViewer: false}],
      selectedSpend: 2,
    }));
    expect(m.stages[10].occupiedByOther).eq(true);
    expect(m.stages[10].markers.map((mk) => mk.color)).deep.eq(['blue']);
    expect(m.stages[9].markers.some((mk) => mk.isViewer)).eq(true);
    // The 5 VP destination remains confirmable (jumping the occupied 2 VP).
    expect(m.destination?.jumpedOverVp2).eq(true);
    expect(m.canConfirm).eq(true);
  });

  it('handles a spectator / no-preview gracefully (track display only)', () => {
    const m = buildHydroModel({
      preview: undefined,
      players: [{color: 'red', position: 4, isViewer: false}, {color: 'blue', position: 7, isViewer: false}],
      viewerColor: undefined,
      selectedSpend: -1,
      rewardChoice: undefined,
      actionAvailable: false,
    });
    expect(m.selectedSpend).eq(0);
    expect(m.canConfirm).eq(false);
    expect(m.stages[4].markers.map((mk) => mk.color)).deep.eq(['red']);
    expect(m.stages[7].markers.map((mk) => mk.color)).deep.eq(['blue']);
  });
});
