import {expect} from 'chai';
import {buildHydroModel, HydroModelInput, HydroPlayerPos} from '../../../../src/client/components/hydronetwork/hydroNetworkModel';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '../../../../src/common/models/DeltaTrackPreviewModel';
import {Tag} from '../../../../src/common/cards/Tag';

function dest(steps: number, opts: Partial<DeltaTrackDestination> = {}): DeltaTrackDestination {
  return {
    steps,
    position: steps, // viewer starts at position 0 in these tests
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

// A preview from position 0 covering the WHOLE track (1..11), with `energy`
// affordable steps; the rest legal-by-tags but unaffordable.
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
  return {color: 'red', name: 'Red', position: 0, isViewer: true, isMarsBot: false, stops: [], ...overrides};
}

function input(overrides: Partial<HydroModelInput> = {}): HydroModelInput {
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

describe('buildHydroModel (iteration 2)', () => {
  it('defaults the selection to a SINGLE step (nearest area, never auto-jumps)', () => {
    const m = buildHydroModel(input()); // energy 3, maxLegal 3
    expect(m.defaultSpend).eq(1);
    expect(m.selectedPosition).eq(1);
    expect(m.mode).eq('plan');
    expect(m.selectedSpend).eq(1);
    // The player can still raise the spend up to the energy-bounded max.
    expect(m.stepperMax).eq(3);
  });

  it('previews a distant stage beyond energy (click), confirm blocked', () => {
    const m = buildHydroModel(input({preview: fullPreview(2), selectedPosition: 7}));
    expect(m.mode).eq('plan');
    expect(m.selectedSpend).eq(7);
    expect(m.destination?.affordable).eq(false);
    expect(m.destination?.energyDeficit).eq(5);
    expect(m.canConfirm).eq(false);
    // The stepper is still energy-bounded.
    expect(m.stepperMax).eq(2);
    expect(m.maxSpend).eq(11);
  });

  it('blocks confirm on missing tags but still previews', () => {
    const m = buildHydroModel(input({
      selectedPosition: 3,
      preview: fullPreview(5, {
        maxLegalSteps: 1,
        destinations: [
          dest(1), dest(2, {legal: false, missingTags: [Tag.POWER]}), dest(3, {legal: false, missingTags: [Tag.POWER, Tag.EARTH]}),
          ...Array.from({length: 8}, (_v, i) => dest(i + 4, {legal: false, missingTags: [Tag.POWER]})),
        ],
      }),
    }));
    expect(m.destination?.legal).eq(false);
    expect(m.canConfirm).eq(false);
    expect(m.stages[3].missingTags).deep.eq([Tag.POWER, Tag.EARTH]);
  });

  it('requires a reward choice on a choice stage', () => {
    expect(buildHydroModel(input({selectedPosition: 1, rewardChoice: undefined})).canConfirm).eq(false);
    expect(buildHydroModel(input({selectedPosition: 1, rewardChoice: 0})).canConfirm).eq(true);
  });

  it('confirms a legal affordable fixed-reward destination', () => {
    const m = buildHydroModel(input({selectedPosition: 3}));
    expect(m.targetNeedsChoice).eq(false);
    expect(m.canConfirm).eq(true);
  });

  it('lists ALL skipped intermediate rewards on a jump', () => {
    const m = buildHydroModel(input({preview: fullPreview(5), selectedPosition: 5}));
    expect(m.skippedStages.map((s) => s.position)).deep.eq([1, 2, 3, 4]);
  });

  it('switches to details mode for a passed/current position', () => {
    const m = buildHydroModel(input({
      preview: fullPreview(3, {currentPosition: 4, maxPreviewSteps: 7, maxEnergySteps: 3, maxLegalSteps: 3,
        destinations: Array.from({length: 7}, (_v, i) => dest(i + 1, {position: 5 + i}))}),
      players: [viewer({position: 4, stops: [{position: 2, generation: 1, choice: 1}, {position: 4, generation: 2}]})],
      selectedPosition: 2,
    }));
    expect(m.mode).eq('details');
    expect(m.detailsStage?.position).eq(2);
    expect(m.viewerStatusAtDetails).eq('rewarded');
    expect(m.viewerChoiceAtDetails).eq(1);
  });

  it('marks viewer rewarded vs skipped stages from stops', () => {
    const m = buildHydroModel(input({
      preview: fullPreview(2, {currentPosition: 5, maxPreviewSteps: 6, maxEnergySteps: 2, maxLegalSteps: 2,
        destinations: Array.from({length: 6}, (_v, i) => dest(i + 1, {position: 6 + i}))}),
      players: [viewer({position: 5, stops: [{position: 5, generation: 1}]})], // jumped 0 → 5
      selectedPosition: 8,
    }));
    // Stopped on 5 (current), jumped over 1..4 (skipped).
    expect(m.stages[5].state).eq('current');
    expect(m.stages[1].skippedByViewer).eq(true);
    expect(m.stages[3].skippedByViewer).eq(true);
    expect(m.stages[5].rewardedByViewer).eq(false); // current, not a past reward badge
  });

  it('builds per-player stage history in details mode', () => {
    const m = buildHydroModel(input({
      preview: fullPreview(1, {currentPosition: 3, maxPreviewSteps: 8, maxEnergySteps: 1, maxLegalSteps: 1,
        destinations: Array.from({length: 8}, (_v, i) => dest(i + 1, {position: 4 + i}))}),
      players: [
        viewer({position: 3, stops: [{position: 2, generation: 1, choice: 0}, {position: 3, generation: 2}]}),
        {color: 'blue', name: 'Blue', position: 5, isViewer: false, isMarsBot: false, stops: [{position: 5, generation: 2}]},
      ],
      selectedPosition: 2,
    }));
    expect(m.mode).eq('details');
    const byColor = new Map(m.detailsHistory.map((h) => [h.color, h]));
    expect(byColor.get('red')?.status).eq('rewarded');
    expect(byColor.get('red')?.choice).eq(0);
    expect(byColor.get('blue')?.status).eq('passed'); // reached past 2 without a stop there
    // Viewer is listed first.
    expect(m.detailsHistory[0].isViewer).eq(true);
  });

  it('flags an occupied VP slot and the jump-over', () => {
    const m = buildHydroModel(input({
      preview: fullPreview(5, {currentPosition: 9, maxPreviewSteps: 2, maxEnergySteps: 2, maxLegalSteps: 2,
        destinations: [dest(1, {position: 10, occupied: true, legal: false}), dest(2, {position: 11, jumpedOverVp2: true})]}),
      players: [viewer({position: 9}), {color: 'blue', name: 'Blue', position: 10, isViewer: false, isMarsBot: false, stops: [{position: 10, generation: 3}]}],
      selectedPosition: 11,
    }));
    expect(m.stages[10].occupiedByOther).eq(true);
    expect(m.destination?.jumpedOverVp2).eq(true);
    expect(m.canConfirm).eq(true);
  });

  it('targetVisitors: surfaces reward-takers (stood / stopped & moved on) AND pass-throughs at the target', () => {
    const m = buildHydroModel(input({
      preview: fullPreview(3), // viewer at 0
      players: [
        viewer({position: 0}),
        // Standing at 2 now (took the reward on landing, choice 1) → 'current'.
        {color: 'blue', name: 'Blue', position: 2, isViewer: false, isMarsBot: false, stops: [{position: 2, generation: 1, choice: 1}]},
        // Stopped at 2 in gen 1 (choice 0), has since moved on to 4 → 'rewarded'.
        {color: 'red', name: 'Red', position: 4, isViewer: false, isMarsBot: false, stops: [{position: 2, generation: 1, choice: 0}, {position: 4, generation: 2}]},
        // Leapt OVER 2 (no stop there), now at 5 → 'passed' (took no reward).
        {color: 'green', name: 'Green', position: 5, isViewer: false, isMarsBot: false, stops: [{position: 5, generation: 1}]},
      ],
      selectedPosition: 2, // plan target
    }));
    expect(m.mode).eq('plan');
    const byColor = new Map(m.targetVisitors.map((v) => [v.color, v]));
    expect(byColor.get('blue')).deep.include({status: 'current', choice: 1});
    expect(byColor.get('red')).deep.include({status: 'rewarded', choice: 0});
    expect(byColor.get('green')?.status).eq('passed');
    // Reward-takers are listed before pass-throughs.
    expect(m.targetVisitors[m.targetVisitors.length - 1].status).eq('passed');
  });

  it('targetVisitors is empty in details mode (own current / past cells use the full history)', () => {
    const m = buildHydroModel(input({
      players: [viewer({position: 0}), {color: 'blue', name: 'Blue', position: 0, isViewer: false, isMarsBot: false, stops: []}],
      selectedPosition: 0, // == current → details mode
    }));
    expect(m.mode).eq('details');
    expect(m.targetVisitors.length).eq(0);
  });

  it('the START is never «not reached» — everyone begins there', () => {
    // Every marker stands on position 0 at setup, so the start can only read
    // «Сейчас здесь» (still there) or «Пройден» (already advanced past it) —
    // never «Ещё не достиг», and never «Прошёл мимо — без награды» (the start
    // grants no reward to miss).
    const m = buildHydroModel(input({
      players: [
        viewer({position: 0}),
        {color: 'blue', name: 'MarsBot', position: 4, isViewer: false, isMarsBot: true, stops: []},
      ],
      selectedPosition: 0, // == current → details mode
    }));
    expect(m.mode).eq('details');
    expect(m.viewerStatusAtDetails).eq('current');
    const byColor = new Map(m.detailsHistory.map((h) => [h.color, h]));
    expect(byColor.get('red')?.status).eq('current'); // viewer still at the start
    expect(byColor.get('blue')?.status).eq('passed'); // departed — never 'not-reached'
  });

  it('the MarsBot (no reward stops) reads its CURRENT position as «current», not «passed»', () => {
    // The bot advanced to 5 without any stop records (it never takes a Delta
    // reward). Its current position must read «Сейчас здесь», and its traversed
    // stages must carry isMarsBot so the UI shows «Пройден», never «Прошёл мимо».
    const m = buildHydroModel(input({
      preview: fullPreview(3), // viewer at 0, can preview the whole track
      players: [
        viewer({position: 0}),
        {color: 'blue', name: 'MarsBot', position: 5, isViewer: false, isMarsBot: true, stops: []},
      ],
      selectedPosition: 5, // plan target = the bot's current position
    }));
    const bot = m.targetVisitors.find((v) => v.color === 'blue');
    expect(bot?.status).eq('current'); // NOT 'passed'
    expect(bot?.isMarsBot).eq(true);

    // Details mode: a stage the bot advanced THROUGH (3 < 5, no stop) → 'passed'
    // but flagged isMarsBot so the label reads «Пройден», not «Прошёл мимо».
    const at3 = buildHydroModel(input({
      preview: fullPreview(3, {currentPosition: 5}), // viewer at 5
      players: [
        viewer({position: 5}),
        {color: 'blue', name: 'MarsBot', position: 5, isViewer: false, isMarsBot: true, stops: []},
      ],
      selectedPosition: 3, // <= viewer current → details mode, per-stage history
    }));
    const botAt3 = at3.detailsHistory.find((h) => h.color === 'blue');
    expect(botAt3?.status).eq('passed');
    expect(botAt3?.isMarsBot).eq(true);
  });

  it('gates confirm on a pos-9 animal target preselection (mandatory — no skip)', () => {
    const base = input({
      preview: fullPreview(1, {
        currentPosition: 8, maxLegalSteps: 1, maxEnergySteps: 1, maxPreviewSteps: 3,
        destinations: [dest(1, {position: 9}), dest(2, {position: 10}), dest(3, {position: 11})],
        animalTargetCards: ['Birds' as never],
      }),
      players: [viewer({position: 8})],
      selectedPosition: 9,
    });
    const without = buildHydroModel(base);
    expect(without.needsCardSelect).eq('animal-target');
    expect(without.mustSelectCard).eq(true);
    // The reward can't be skipped (rules) → confirm is BLOCKED until a card is picked.
    expect(without.canConfirm).eq(false);
    const withCard = buildHydroModel({...base, selectedCard: 'Birds' as never});
    expect(withCard.selectedCard).eq('Birds');
    expect(withCard.canConfirm).eq(true);
  });

  it('does not require a pick when no eligible cards exist (reward fizzles)', () => {
    const m = buildHydroModel(input({
      preview: fullPreview(1, {
        currentPosition: 8, maxLegalSteps: 1, maxEnergySteps: 1, maxPreviewSteps: 3,
        destinations: [dest(1, {position: 9}), dest(2, {position: 10}), dest(3, {position: 11})],
        animalTargetCards: [],
      }),
      players: [viewer({position: 8})],
      selectedPosition: 9,
    }));
    expect(m.needsCardSelect).eq('animal-target');
    expect(m.mustSelectCard).eq(false);
    expect(m.canConfirm).eq(true); // may advance; the reward simply fizzles
  });

  it('handles no preview (details on current stage)', () => {
    const m = buildHydroModel({
      preview: undefined,
      players: [viewer({position: 4})],
      viewerColor: 'red',
      selectedCard: undefined,
      selectedPosition: -1,
      rewardChoice: undefined,
      actionAvailable: false,
    });
    expect(m.maxSpend).eq(0);
    expect(m.mode).eq('details');
    expect(m.canConfirm).eq(false);
  });
});
