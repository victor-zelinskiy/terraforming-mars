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
    availableSteelSubstitute: 0,
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

  it('focusReach lets a SELECTION overlay focus past the affordable spend (espionage owner reward)', () => {
    // No preview at all (the play composer's context) → maxSpend 0: without
    // the reach the destination cell (current+1) clamps back to the marker.
    const clamped = buildHydroModel(input({preview: undefined, selectedPosition: 1}));
    expect(clamped.selectedPosition).eq(0);
    const reached = buildHydroModel(input({preview: undefined, selectedPosition: 1, focusReach: 1}));
    expect(reached.selectedPosition).eq(1);
    // The reach widens FOCUS only — nothing movement-legal appears with it.
    expect(reached.maxSpend).eq(0);
    expect(reached.canConfirm).eq(false);
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

  /**
   * ⚠️ THE PICK IS PRE-COLLECTED, NEVER A COMMIT REQUIREMENT.
   *
   * This used to assert the opposite («the reward can't be skipped → confirm is
   * BLOCKED») and that assertion was the bug: advancing without stopping to
   * configure the landed stage's reward is a legal move, and the pick is not
   * lost by it — the SERVER defers the same SelectCard either way, and the
   * console embeds that prompt in the workspace that made the move. Gating the
   * commit on it TRAPPED the player: the CTA could not fire and the only live
   * affordance left was the picker.
   */
  it('does NOT gate confirm on a pos-9 animal target preselection', () => {
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
    // The stage still ASKS — that is what the pre-select row is for …
    expect(without.mustSelectCard).eq(true);
    // … but the advance itself stays confirmable. (The console warns once and
    // takes a second press at face value.)
    expect(without.canConfirm).eq(true);
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

/** A preview whose server plan pays every crossed stage (the modifier) —
 *  shared by the traversal describe AND the ordered-plan rows below. */
function surgePreview(energy: number, overrides: Partial<DeltaTrackPreviewModel> = {}): DeltaTrackPreviewModel {
  const base = fullPreview(energy, overrides);
  return {
    ...base,
    traversalModifierCard: 'Delta Surge' as DeltaTrackPreviewModel['traversalModifierCard'],
    destinations: base.destinations.map((d) => ({
      ...d,
      traversal: Array.from({length: d.steps}, (_, i) => {
        const position = i + 1;
        if (position === d.position) {
          return {position, rewarded: true};
        }
        return position === 10 || position === 11 ?
          {position, rewarded: false, skipped: 'vp-step' as const} :
          {position, rewarded: true};
      }),
    })),
  };
}

describe('buildHydroModel — the MULTI-REWARD traversal (Delta Surge)', () => {
  it('a one-step move stays the historical shape (no traversal surface)', () => {
    const m = buildHydroModel(input({preview: surgePreview(3), selectedPosition: 1}));
    expect(m.traversalActive).eq(false);
    expect(m.traversalStages).deep.eq([]);
    expect(m.traversalModifierCard).eq('Delta Surge');
  });

  it('a multi-step move builds the ordered stage plan and lights the route cells', () => {
    const m = buildHydroModel(input({preview: surgePreview(4), selectedPosition: 4}));
    expect(m.traversalActive).eq(true);
    expect(m.traversalStages.map((s) => s.position)).deep.eq([1, 2, 3, 4]);
    expect(m.traversalStages.map((s) => s.ask)).deep.eq(['choice', 'choice', 'none', 'none']);
    expect(m.traversalStages[3].isDestination).eq(true);
    // Nothing is standing-rule-skipped under the modifier.
    expect(m.skippedStages).deep.eq([]);
    const route = m.stages.filter((s) => s.state === 'route');
    expect(route.every((s) => s.routeRewarded)).eq(true);
    expect(route.every((s) => !s.willSkipReward)).eq(true);
  });

  it('the commit is GATED on every crossed choice; target picks stay waivable', () => {
    const open = buildHydroModel(input({preview: surgePreview(4), selectedPosition: 4}));
    expect(open.canConfirm, 'choices at 1 and 2 unmade').eq(false);
    const made = buildHydroModel(input({
      preview: surgePreview(4), selectedPosition: 4,
      planChoices: {1: 0, 2: 1},
    }));
    expect(made.canConfirm).eq(true);
  });

  it('the crossed 2 VP cell is EXCLUDED and named — the destination VP stays a plan stage', () => {
    const m = buildHydroModel(input({preview: surgePreview(11), selectedPosition: 11, planChoices: {1: 0, 2: 0}}));
    expect(m.traversalExcludedVp).eq(true);
    expect(m.traversalStages.some((s) => s.position === 10), 'crossed 10 never pays').eq(false);
    expect(m.traversalStages.at(-1)?.position).eq(11);
    const cell10 = m.stages[10];
    expect(cell10.routeExcluded).eq(true);
    expect(cell10.routeRewarded).eq(false);
  });

  it('per-position drafts resolve their own stages (picks validated against the shared lists)', () => {
    const m = buildHydroModel(input({
      preview: surgePreview(9, {
        reuseActionCards: ['Viron' as never],
        animalTargetCards: ['Birds' as never],
      }),
      selectedPosition: 9,
      planChoices: {1: 0, 2: 0},
      planPicks: {7: 'Viron' as never, 9: 'Ants' as never},
    }));
    const seven = m.traversalStages.find((s) => s.position === 7);
    const nine = m.traversalStages.find((s) => s.position === 9);
    expect(seven?.pick).eq('Viron');
    expect(seven?.mustSelect).eq(true);
    // A draft not in the SHARED eligible list silently drops (stale pick).
    expect(nine?.pick).eq(undefined);
    expect(nine?.mustSelect).eq(true);
  });

  it('the presentation cursor overrides the viewer position (marker + states), never other players', () => {
    const m = buildHydroModel(input({
      preview: surgePreview(4),
      players: [viewer({position: 4}), {color: 'blue', name: 'B', position: 2, isViewer: false, isMarsBot: false, stops: []}],
      visualViewerPosition: 1,
      selectedPosition: 4,
    }));
    expect(m.currentPosition).eq(1);
    expect(m.stages[1].markers.some((x) => x.isViewer)).eq(true);
    expect(m.stages[4].markers.some((x) => x.isViewer)).eq(false);
    expect(m.stages[2].markers.some((x) => !x.isViewer), 'the opponent stays put').eq(true);
  });
});

/**
 * THE ORDERED RESOURCE PLAN IN THE MODEL — the payment step and the Decision
 * Rail agree through these fields: the commitment (server-served cost), the
 * mix sweep's verdict, the clamped dial bounds (clamp = the auto-preserve),
 * the named reserve, the explicit conflict that gates the commit, and the
 * greyed browser candidates. Server twin: `deltaAdvancePlan.spec.ts`.
 */
describe('buildHydroModel — the ordered resource plan', () => {
  const DC = 'Development Center' as never;
  const costs = (c: Record<string, Partial<import('../../../../src/common/Units').Units>>) =>
    c as import('../../../../src/common/models/DeltaTrackPreviewModel').DeltaTrackPreviewModel['reuseActionCosts'];

  it('THE BUG CASE: the movement payment starves the pre-selected action → explicit conflict, commit gated', () => {
    // 8 energy; 7 steps to the repeat stage; the chosen action needs 2 energy
    // at its own point. 8 − 7 = 1 < 2 — no composition exists.
    const m = buildHydroModel(input({
      preview: fullPreview(8, {
        reuseActionCards: [DC],
        reuseActionCosts: costs({'Development Center': {energy: 2}}),
      }),
      selectedPosition: 7,
      selectedCard: DC,
    }));
    expect(m.planCommitment?.card).eq(DC);
    expect(m.planCommitment?.cost).deep.eq({energy: 2});
    expect(m.planConflict?.position).eq(7);
    expect(m.planConflict?.resource).eq('energy');
    expect(m.canConfirm, 'a promise the plan cannot keep gates the commit').eq(false);
    // The browser greys the same candidate for the same reason.
    expect(m.reuseInfeasibleCards).deep.eq([{name: DC, resource: 'energy'}]);
  });

  it('DELTA WORKS auto-preserve: the dial\'s lower clamp rises to the mix that keeps the action fed, and the reserve is named', () => {
    // 8 energy + 2 substitute steel; 7 steps; the action needs 2 energy.
    // Energy-first (steel 0) starves it; steel 1 leaves exactly 2.
    const m = buildHydroModel(input({
      preview: fullPreview(8, {
        availableSteelSubstitute: 2,
        reuseActionCards: [DC],
        reuseActionCosts: costs({'Development Center': {energy: 2}}),
      }),
      selectedPosition: 7,
      selectedCard: DC,
    }));
    expect(m.planConflict).eq(undefined);
    // base min steel is 0 (energy covers the price) — the PLAN raises it.
    expect(m.minSteelForSpend, 'clamped up to the feasible window').eq(1);
    expect(m.maxSteelForSpend).eq(2);
    expect(m.reservedEnergyForAction, 'the protected energy is named').eq(1);
    expect(m.canConfirm).eq(true);
  });

  it('the browser greys ONLY the candidates no composition can feed — before any pick is made', () => {
    const m = buildHydroModel(input({
      preview: fullPreview(8, {
        reuseActionCards: [DC, 'Birds' as never],
        reuseActionCosts: costs({'Development Center': {energy: 2}}),
      }),
      selectedPosition: 7,
    }));
    // No commitment yet → no conflict, the commit stays open…
    expect(m.planCommitment).eq(undefined);
    expect(m.canConfirm).eq(true);
    // …but the infeasible candidate is already graded for the browser.
    expect(m.reuseInfeasibleCards).deep.eq([{name: DC, resource: 'energy'}]);
  });

  it('a TRAVERSAL commitment is fed by an EARLIER chosen gain — and starves when the choice changes', () => {
    const surged = (picks: Record<number, unknown>, choices: Record<number, number>) => buildHydroModel(input({
      preview: surgePreview(7, {
        reuseActionCards: [DC],
        reuseActionCosts: costs({'Development Center': {steel: 1}}),
      }),
      selectedPosition: 7,
      planPicks: picks as never,
      planChoices: choices,
    }));
    // Stage 1's steel alternative funds the stage-7 action (path order).
    const fed = surged({7: DC}, {1: 0, 2: 0});
    expect(fed.planCommitment?.position).eq(7);
    expect(fed.planConflict).eq(undefined);
    expect(fed.canConfirm).eq(true);
    // The plants alternative guarantees no steel — the same plan conflicts.
    const starved = surged({7: DC}, {1: 1, 2: 0});
    expect(starved.planConflict?.position).eq(7);
    expect(starved.planConflict?.resource).eq('steel');
    expect(starved.canConfirm).eq(false);
  });
});

describe('the track HISTORY speaks about every player, and tells a paid crossing from a miss', () => {
  /*
   * THE BUG. Under a traversal modifier («Нагонная волна» / Delta Surge) a stage
   * the marker goes straight THROUGH still pays. The stop list held only
   * landings, so the model had two readings — «stopped here» and «not in the
   * list» — and a crossed-but-paid stage fell into the second: the track marked
   * seven stages the player had just been paid for as «Прошёл мимо — без
   * награды». The fact is server-authoritative (`DeltaStop.crossed`), because
   * whether a modifier was in the tableau AT THE TIME is not in the view and the
   * card can leave.
   */
  function bot(overrides: Partial<HydroPlayerPos> = {}): HydroPlayerPos {
    return {color: 'neutral', name: 'Bot', position: 0, isViewer: false, isMarsBot: true, stops: [], ...overrides};
  }

  it('a CROSSED-and-paid stage is a reward taken, never a miss', () => {
    const m = buildHydroModel(input({
      players: [viewer({
        position: 7,
        stops: [
          {position: 7, generation: 3},                  // the landing
          {position: 5, generation: 3, crossed: true},   // paid in passing
        ],
      })],
      preview: fullPreview(3, {currentPosition: 7}),
      selectedPosition: 5,
    }));
    expect(m.stages[5].crossedByViewer, 'stage 5 was paid in passing').to.eq(true);
    expect(m.stages[5].skippedByViewer, 'and is NOT a miss').to.eq(false);
    expect(m.stages[5].rewardedByViewer, 'nor a landing — the two are different facts').to.eq(false);
    expect(m.viewerStatusAtDetails).to.eq('crossed');
  });

  it('a crossing with NO payment still reads as the miss it is', () => {
    // No modifier: the marker went through and nothing was recorded.
    const m = buildHydroModel(input({
      players: [viewer({position: 7, stops: [{position: 7, generation: 3}]})],
      preview: fullPreview(3, {currentPosition: 7}),
      selectedPosition: 5,
    }));
    expect(m.stages[5].skippedByViewer).to.eq(true);
    expect(m.stages[5].crossedByViewer).to.eq(false);
    expect(m.viewerStatusAtDetails).to.eq('passed');
  });

  it('a LANDING is still a landing (old saves carry no `crossed` at all)', () => {
    const m = buildHydroModel(input({
      players: [viewer({position: 7, stops: [{position: 3, generation: 1}, {position: 7, generation: 3}]})],
      preview: fullPreview(3, {currentPosition: 7}),
      selectedPosition: 3,
    }));
    expect(m.stages[3].rewardedByViewer).to.eq(true);
    expect(m.stages[3].crossedByViewer).to.eq(false);
    expect(m.viewerStatusAtDetails).to.eq('rewarded');
  });

  /*
   * ── THE FOCUSED STAGE'S ROSTER ──────────────────────────────────────────
   *
   * WHERE THIS READING LIVES IS PART OF THE CONTRACT. The track's cells carry
   * exactly one thing about a player: their MARKER, one per player, in the one
   * position that player stands in. What HAPPENED on a cell — who took its
   * reward, who was paid for crossing it, who leapt over it, who is standing on
   * it now — is read in the stage panel, for the cell the cursor is on.
   *
   * Painting per-player history marks onto the cells was tried and reverted:
   * eleven cells × N players of coloured pips turns the track (whose one job is
   * «where is everybody») into a chart, and it makes one player look like
   * several tokens at once.
   */
  describe('the focused stage roster', () => {
    it('names every player who has been here — the MarsBot included', () => {
      // The track used to speak about the viewer only, so the bot left no trace
      // on the stages it had walked: a dot that teleports rather than somebody
      // moving along the same track.
      const at = (pos: number) => buildHydroModel(input({
        players: [
          viewer({position: 6, stops: [{position: 6, generation: 2}, {position: 4, generation: 2, crossed: true}]}),
          bot({position: 3}),
        ],
        preview: fullPreview(3, {currentPosition: 6}),
        selectedPosition: pos,
      })).focusRoster.map((t) => `${t.color}:${t.status}`);
      // Cell 2: both have gone past it — the viewer with nothing, the bot too.
      expect(at(2)).to.deep.equal(['red:passed', 'neutral:passed']);
      // Cell 3: the bot STANDS there; the viewer walked through.
      expect(at(3)).to.deep.equal(['red:passed', 'neutral:current']);
      // Cell 4: the viewer was PAID in passing; the bot has not reached it.
      expect(at(4)).to.deep.equal(['red:crossed']);
      // Cell 6: the viewer stands there.
      expect(at(6)).to.deep.equal(['red:current']);
    });

    it('a stage NOBODY has reached lists nobody (never a roster of «not yet»)', () => {
      const rosterAt = (pos: number) => buildHydroModel(input({
        players: [viewer({position: 2}), bot({position: 1})],
        preview: fullPreview(3, {currentPosition: 2}),
        selectedPosition: pos,
      })).focusRoster;
      expect(rosterAt(9)).to.deep.equal([]);
      expect(rosterAt(2).length, 'but a reached one does').to.be.greaterThan(0);
    });

    it('the VIEWER reads first, whatever the seating order', () => {
      const m = buildHydroModel(input({
        players: [bot({position: 4}), viewer({position: 4})],
        preview: fullPreview(3, {currentPosition: 4}),
        selectedPosition: 4,
      }));
      expect(m.focusRoster[0].isViewer, 'the viewer leads').to.eq(true);
      expect(m.focusRoster.length).to.eq(2);
    });

    it('every player has EXACTLY ONE marker, in exactly ONE position', () => {
      // The invariant the track itself must keep: a cell shows tokens, and a
      // player is one token. (What made this look false was the history marks,
      // which are gone — but the property is worth pinning, because the model
      // is what the cells render.)
      const m = buildHydroModel(input({
        players: [viewer({position: 6, stops: [{position: 3, generation: 1}]}), bot({position: 3})],
        preview: fullPreview(3, {currentPosition: 6}),
      }));
      const seats = m.stages.flatMap((st, pos) => st.markers.map((mk) => `${mk.color}@${pos}`));
      expect(seats.sort()).to.deep.equal(['neutral@3', 'red@6']);
    });
  });
});
