import {expect} from 'chai';
import {buildHydroModel, HydroModelInput, HydroPlayerPos} from '../../../../src/client/components/hydronetwork/hydroNetworkModel';
import {destinationAt, gradeDestination, hydroPlanReasons} from '../../../../src/client/components/hydronetwork/hydroReasons';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '../../../../src/common/models/DeltaTrackPreviewModel';
import {Tag} from '../../../../src/common/cards/Tag';
import {CardName} from '../../../../src/common/cards/CardName';

function dest(steps: number, opts: Partial<DeltaTrackDestination> = {}): DeltaTrackDestination {
  return {
    steps,
    position: steps,
    legal: true,
    affordable: true,
    energyDeficit: 0,
    occupied: false,
    jumpedOverVp2: false,
    requiredTags: [],
    wildCoveredTags: [],
    missingTags: [],
    ...opts,
  };
}

function fullPreview(energy: number, overrides: Partial<DeltaTrackPreviewModel> = {}): DeltaTrackPreviewModel {
  const destinations: Array<DeltaTrackDestination> = [];
  for (let steps = 1; steps <= 11; steps++) {
    destinations.push(dest(steps, {affordable: steps <= energy, energyDeficit: Math.max(0, steps - energy)}));
  }
  return {
    currentPosition: 0,
    availableEnergy: energy,
    usedThisGeneration: false,
    atEndOfTrack: false,
    maxLegalSteps: Math.min(energy, 11),
    maxEnergySteps: Math.min(energy, 11),
    maxPreviewSteps: 11,
    destinations,
    reuseActionCards: [],
    animalTargetCards: [],
    ...overrides,
  };
}

function viewer(overrides: Partial<HydroPlayerPos> = {}): HydroPlayerPos {
  return {color: 'red', name: 'Red', position: 0, isViewer: true, stops: [], ...overrides};
}

function modelInput(overrides: Partial<HydroModelInput> = {}): HydroModelInput {
  return {
    preview: fullPreview(3),
    players: [viewer()],
    viewerColor: 'red',
    selectedPosition: -1,
    rewardChoice: undefined,
    selectedCard: undefined,
    actionAvailable: true,
    ...overrides,
  };
}

function reasonsFor(overrides: Partial<HydroModelInput> = {}, opts: {occupantName?: string} = {}) {
  const input = modelInput(overrides);
  const model = buildHydroModel(input);
  return hydroPlanReasons({
    model,
    preview: input.preview,
    actionAvailable: input.actionAvailable,
    rewardChoice: input.rewardChoice,
    occupantName: opts.occupantName,
  });
}

describe('hydroPlanReasons', () => {
  it('a confirmable stage has NO reasons (the CTA is live)', () => {
    expect(reasonsFor({selectedPosition: 3})).deep.eq([]);
  });

  it('missing preview → a loading gate, never a generic block', () => {
    const rs = reasonsFor({preview: undefined});
    expect(rs.map((r) => r.kind)).deep.eq(['loading']);
  });

  it('end of track is the single terminal reason', () => {
    const rs = reasonsFor({preview: fullPreview(3, {atEndOfTrack: true})});
    expect(rs.map((r) => r.kind)).deep.eq(['end-of-track']);
  });

  it('used-this-generation supersedes everything else', () => {
    const rs = reasonsFor({preview: fullPreview(0, {usedThisGeneration: true}), actionAvailable: false, selectedPosition: 5});
    expect(rs.map((r) => r.kind)).deep.eq(['used-this-generation']);
  });

  it('names EVERY missing tag with its icon key', () => {
    const rs = reasonsFor({
      selectedPosition: 3,
      preview: fullPreview(5, {
        maxLegalSteps: 1,
        destinations: [
          dest(1), dest(2, {legal: false, missingTags: [Tag.POWER]}),
          dest(3, {legal: false, missingTags: [Tag.POWER, Tag.EARTH]}),
          ...Array.from({length: 8}, (_v, i) => dest(i + 4, {legal: false, missingTags: [Tag.POWER]})),
        ],
      }),
    });
    const tags = rs.filter((r) => r.kind === 'missing-tag');
    expect(tags.map((r) => r.tag)).deep.eq([Tag.POWER, Tag.EARTH]);
    expect(tags.every((r) => r.blocking)).eq(true);
  });

  it('energy deficit is concrete: need N, you have M', () => {
    const rs = reasonsFor({selectedPosition: 7, preview: fullPreview(2)});
    expect(rs.map((r) => r.kind)).deep.eq(['energy-deficit']);
    expect(rs[0].params).deep.eq([7, 2]);
  });

  it('zero energy reads as "no energy", not as a deficit equation', () => {
    const rs = reasonsFor({selectedPosition: 1, preview: fullPreview(0), actionAvailable: false});
    expect(rs.map((r) => r.kind)).deep.eq(['no-energy']);
  });

  it('an occupied finish slot names the occupant', () => {
    const preview = fullPreview(11, {
      destinations: [
        ...Array.from({length: 9}, (_v, i) => dest(i + 1)),
        dest(10, {legal: false, occupied: true}),
        dest(11),
      ],
    });
    const rs = reasonsFor({selectedPosition: 10, preview}, {occupantName: 'Ivan'});
    expect(rs[0].kind).eq('vp-occupied');
    expect(rs[0].params).deep.eq(['Ivan']);
  });

  it('not-your-turn shows ONLY when a legal+affordable move exists', () => {
    // A real waiting-for-turn case: moves exist but the action is absent.
    const withMoves = reasonsFor({selectedPosition: 1, actionAvailable: false});
    expect(withMoves.map((r) => r.kind)).deep.eq(['not-your-turn']);
    // No legal move at all (tags): the per-stage reason explains it instead.
    const noMoves = reasonsFor({
      selectedPosition: 1,
      actionAvailable: false,
      preview: fullPreview(5, {
        maxLegalSteps: 0,
        destinations: Array.from({length: 11}, (_v, i) => dest(i + 1, {legal: false, missingTags: [Tag.BUILDING]})),
      }),
    });
    expect(noMoves.map((r) => r.kind)).deep.eq(['missing-tag']);
  });

  it('multiple simultaneous blockers are ALL surfaced (turn + tags + energy)', () => {
    const rs = reasonsFor({
      selectedPosition: 5,
      actionAvailable: false,
      preview: fullPreview(2, {
        maxLegalSteps: 1,
        destinations: [
          dest(1), dest(2),
          ...Array.from({length: 9}, (_v, i) => dest(i + 3, {
            legal: false, missingTags: [Tag.SCIENCE],
            affordable: i + 3 <= 2, energyDeficit: Math.max(0, i + 3 - 2),
          })),
        ],
      }),
    });
    expect(rs.map((r) => r.kind)).deep.eq(['not-your-turn', 'missing-tag', 'energy-deficit']);
  });

  it('a clean stage gates on the bonus choice, then the card pick', () => {
    const choice = reasonsFor({selectedPosition: 1});
    expect(choice.map((r) => r.kind)).deep.eq(['choose-bonus']);
    expect(choice[0].blocking).eq(false);
    expect(reasonsFor({selectedPosition: 1, rewardChoice: 0})).deep.eq([]);

    const pick = reasonsFor({
      selectedPosition: 7,
      preview: fullPreview(8, {reuseActionCards: [CardName.IRONWORKS]}),
    });
    expect(pick.map((r) => r.kind)).deep.eq(['choose-card']);
    expect(pick[0].blocking).eq(false);
  });

  it('a blocked stage never nags about its bonus', () => {
    const rs = reasonsFor({selectedPosition: 1, preview: fullPreview(0), actionAvailable: false});
    expect(rs.some((r) => r.kind === 'choose-bonus')).eq(false);
  });

  it('details mode (current / passed stage) is informational — no reasons', () => {
    expect(reasonsFor({selectedPosition: 0})).deep.eq([]);
  });
});

describe('gradeDestination / destinationAt', () => {
  it('grades: tags > occupancy > energy > ok', () => {
    expect(gradeDestination(dest(1, {missingTags: [Tag.BUILDING], occupied: true, affordable: false}))).eq('blocked');
    expect(gradeDestination(dest(1, {occupied: true, affordable: false}))).eq('occupied');
    expect(gradeDestination(dest(1, {affordable: false, energyDeficit: 1}))).eq('needs-energy');
    expect(gradeDestination(dest(1))).eq('ok');
  });

  it('destinationAt maps an absolute position onto the step list', () => {
    const preview = fullPreview(3);
    expect(destinationAt(preview, 0)).eq(undefined);
    expect(destinationAt(preview, 1)?.steps).eq(1);
    expect(destinationAt(preview, 11)?.steps).eq(11);
    expect(destinationAt(undefined, 3)).eq(undefined);
  });
});
