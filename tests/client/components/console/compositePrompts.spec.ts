import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {AndOptionsModel, ShiftAresGlobalParametersModel} from '@/common/models/PlayerInputModel';
import {
  budgetBlockedKey, budgetTotal, budgetValid, forcedAllocation, maxOntoLane, stepLane, stepsUp,
  BudgetLane, BudgetRule,
} from '@/client/console/budgetLanes';
import {
  aresResponse, aresResulting, aresThresholdRows, spendHeatLanes, spendHeatResponse,
  venusBaseCount, venusBonusLanes, venusBonusResponse,
} from '@/client/console/compositePrompts';

/*
 * THE THREE PROMPTS THAT USED TO FALL THROUGH TO THE DESKTOP MODAL.
 *
 * Two of them (the Venus alt-track bonus, Stormcraft's spend-heat) are IN
 * SCOPE and had a premium desktop modal and no console-native one; the third
 * (the planetary-event thresholds) had none either. All three now have their
 * own surfaces, and everything those surfaces decide lives here — so the rules
 * are pinned without mounting a component.
 *
 * The load-bearing half is SUBMISSION BYTE-PARITY: an `and` is zipped
 * POSITIONALLY by the server, so a reordered array is a silently wrong answer
 * rather than an error.
 */

const HEAT_LANES: Array<BudgetLane> = [
  {key: 'heat', iconClass: '', label: 'Heat', weight: 1, max: 10},
  {key: 'floaters', iconClass: '', label: 'Floaters', weight: 2, max: 4},
];

describe('budgetLanes (the shared distribution engine)', () => {
  describe('EXACT — the Venus bonus: place all of it, never more', () => {
    const rule: BudgetRule = {kind: 'exact', target: 3};
    const lanes = venusBonusLanes(3, {megacredits: 44});

    it('a step is refused once the budget is spent', () => {
      let state = maxOntoLane(lanes, {}, rule, 'megacredits');
      expect(budgetTotal(lanes, state)).to.eq(3);
      state = stepLane(lanes, state, rule, 'steel', 1);
      expect(budgetTotal(lanes, state), 'the target can never be overshot').to.eq(3);
    });

    it('is valid only ON the target, and says why when it is not', () => {
      expect(budgetValid(lanes, {}, rule)).to.be.false;
      expect(budgetBlockedKey(lanes, {}, rule)).to.eq('Distribute the whole bonus');
      expect(budgetValid(lanes, {megacredits: 1, plants: 2}, rule)).to.be.true;
      expect(budgetBlockedKey(lanes, {megacredits: 1, plants: 2}, rule)).is.undefined;
    });

    it('the lanes are capped by the BUDGET, not by what the player owns', () => {
      // The stock rides along for the «44 → 46» readout and caps nothing: this
      // is a gain, and a cap borrowed from your stock is a limit that isn't one.
      expect(lanes.every((l) => l.max === 3)).to.be.true;
      expect(lanes.find((l) => l.key === 'megacredits')?.available).to.eq(44);
    });
  });

  describe('COVER — Stormcraft: reach the bill, and never overpay', () => {
    const rule: BudgetRule = {kind: 'cover', target: 5};

    it('a floater may cover the final 1 heat — the last step MAY overshoot', () => {
      // 3 heat + 1 floater = 6 ≥ 5, and neither step can be taken back.
      expect(stepsUp(HEAT_LANES, {heat: 3}, rule, 'floaters')).to.eq(1);
      expect(budgetValid(HEAT_LANES, {heat: 3, floaters: 1}, rule)).to.be.true;
    });

    it('…and overshoots outright when nothing cheaper can cover it', () => {
      const noHeat: Array<BudgetLane> = [
        {key: 'heat', iconClass: '', label: 'Heat', weight: 1, max: 0},
        {key: 'floaters', iconClass: '', label: 'Floaters', weight: 2, max: 4},
      ];
      // 3 floaters = 6 for a 5 bill: wasteful, but it is the ONLY way to pay.
      expect(maxOntoLane(noHeat, {}, rule, 'floaters')).to.deep.eq({floaters: 3});
      expect(budgetValid(noHeat, {floaters: 3}, rule)).to.be.true;
    });

    it('…but a step that could be TAKEN BACK is an overpayment', () => {
      // The server's own two rules, stated once over lanes:
      //   4 heat + 1 floater → drop a heat and 5 is still covered
      //     ("You cannot overspend heat");
      //   1 heat + 3 floaters → drop a floater and 5 is still covered
      //     ("You cannot overspend floaters").
      expect(budgetValid(HEAT_LANES, {heat: 4, floaters: 1}, rule)).to.be.false;
      expect(budgetBlockedKey(HEAT_LANES, {heat: 4, floaters: 1}, rule)).to.eq('Remove a step — this overpays');
      expect(budgetValid(HEAT_LANES, {heat: 1, floaters: 3}, rule)).to.be.false;
      expect(budgetValid(HEAT_LANES, {heat: 5, floaters: 1}, rule)).to.be.false;
    });

    it('under the bill is under the bill', () => {
      expect(budgetValid(HEAT_LANES, {heat: 4}, rule)).to.be.false;
      expect(budgetBlockedKey(HEAT_LANES, {heat: 4}, rule)).to.eq('Not enough to cover the cost');
    });

    it('MAX pours only what the bill still needs', () => {
      expect(maxOntoLane(HEAT_LANES, {}, rule, 'heat')).to.deep.eq({heat: 5});
      expect(maxOntoLane(HEAT_LANES, {}, rule, 'floaters')).to.deep.eq({floaters: 3});
    });

    it('ONE way to pay is pre-filled — a forced bill is a confirmation', () => {
      const onlyHeat: Array<BudgetLane> = [
        {key: 'heat', iconClass: '', label: 'Heat', weight: 1, max: 5},
        {key: 'floaters', iconClass: '', label: 'Floaters', weight: 2, max: 0},
      ];
      expect(forcedAllocation(onlyHeat, rule)).to.deep.eq({heat: 5});
      // With a real choice it stays empty — the player decides.
      expect(forcedAllocation(HEAT_LANES, rule)).is.undefined;
    });
  });
});

describe('spend heat (Stormcraft)', () => {
  const prompt = {
    type: 'and', title: 'Select how to spend 6 heat', buttonLabel: 'Save',
    spendHeatPrompt: {amount: 6},
    options: [
      {type: 'amount', title: 'Heat', buttonLabel: 'Spend heat', min: 0, max: 8, maxByDefault: false},
      {type: 'amount', title: 'Floaters', buttonLabel: 'Spend floaters', min: 0, max: 3, maxByDefault: false},
    ],
  } as unknown as AndOptionsModel;

  it('reads the caps from the SERVER, so no offered step can be rejected', () => {
    const lanes = spendHeatLanes(prompt);
    expect(lanes.map((l) => [l.key, l.max, l.weight])).to.deep.eq([['heat', 8, 1], ['floaters', 3, 2]]);
  });

  it('answers in the server’s own option ORDER (an `and` is zipped positionally)', () => {
    const lanes = spendHeatLanes(prompt);
    expect(spendHeatResponse(lanes, {heat: 2, floaters: 2})).to.deep.eq({
      type: 'and', responses: [{type: 'amount', amount: 2}, {type: 'amount', amount: 2}],
    });
  });

  it('an unpicked lane still sends 0 — never a short array', () => {
    const lanes = spendHeatLanes(prompt);
    expect(spendHeatResponse(lanes, {heat: 6})).to.deep.eq({
      type: 'and', responses: [{type: 'amount', amount: 6}, {type: 'amount', amount: 0}],
    });
  });
});

describe('the Venus alt-track bonus', () => {
  it('the BASE bonus answers as the bare six-amount `and`', () => {
    const meta = {kind: 'standard', baseCount: 2} as const;
    expect(venusBaseCount(meta, undefined)).to.eq(2);
    expect(venusBonusResponse(meta, {plants: 2}, undefined, undefined)).to.deep.eq({
      type: 'and',
      responses: [
        {type: 'amount', amount: 0}, // megacredits
        {type: 'amount', amount: 0}, // steel
        {type: 'amount', amount: 0}, // titanium
        {type: 'amount', amount: 2}, // plants
        {type: 'amount', amount: 0}, // energy
        {type: 'amount', amount: 0}, // heat
      ],
    });
  });

  it('the FINAL step folds the wild into the budget when taken as standard', () => {
    const meta = {kind: 'final', baseCount: 2, wildCardTargets: [CardName.TARDIGRADES]} as const;
    expect(venusBaseCount(meta, 'asStandard'), 'base + the wild').to.eq(3);
    expect(venusBaseCount(meta, 'onCard'), 'the wild left the budget').to.eq(2);
  });

  it('…and answers as the right OR branch, each with its own payload', () => {
    const meta = {kind: 'final', baseCount: 2, wildCardTargets: [CardName.TARDIGRADES]} as const;
    // Branch 1 = GainResources(base + 1).
    expect(venusBonusResponse(meta, {heat: 3}, 'asStandard', undefined)).to.deep.eq({
      type: 'or', index: 1,
      response: {type: 'and', responses: [0, 0, 0, 0, 0, 3].map((amount) => ({type: 'amount', amount}))},
    });
    // Branch 0 = AndOptions(SelectCard wild-on-card, GainResources(base)) —
    // the card FIRST, matching how the server built the branch.
    expect(venusBonusResponse(meta, {heat: 2}, 'onCard', CardName.TARDIGRADES)).to.deep.eq({
      type: 'or', index: 0,
      response: {
        type: 'and',
        responses: [
          {type: 'card', cards: [CardName.TARDIGRADES]},
          {type: 'and', responses: [0, 0, 0, 0, 0, 2].map((amount) => ({type: 'amount', amount}))},
        ],
      },
    });
  });
});

describe('the planetary-event thresholds', () => {
  const model = (available: Record<string, boolean>) => ({
    type: 'aresGlobalParameters', title: 'Adjust', buttonLabel: 'Save',
    aresData: {
      includeHazards: true,
      milestoneResults: [],
      hazardData: {
        erosionOceanCount: {threshold: 3, available: available.a ?? true},
        removeDustStormsOceanCount: {threshold: 6, available: available.b ?? true},
        severeErosionTemperature: {threshold: -6, available: available.c ?? true},
        severeDustStormOxygen: {threshold: 8, available: available.d ?? true},
      },
    },
  } as unknown as ShiftAresGlobalParametersModel);

  it('a threshold that ALREADY fired is history, not a disabled choice', () => {
    const rows = aresThresholdRows(model({b: false, d: false}));
    expect(rows.map((r) => r.key)).to.deep.eq(['lowOceanDelta', 'temperatureDelta']);
  });

  it('temperature moves TWO degrees per step; the rest move one', () => {
    const rows = aresThresholdRows(model({}));
    const temp = rows.find((r) => r.key === 'temperatureDelta')!;
    const ocean = rows.find((r) => r.key === 'lowOceanDelta')!;
    expect(aresResulting(temp, 1)).to.eq(-4);
    expect(aresResulting(temp, -1)).to.eq(-8);
    expect(aresResulting(ocean, 1)).to.eq(4);
  });

  it('every row states its CONSEQUENCE, not just a number', () => {
    expect(aresThresholdRows(model({})).every((r) => r.effectKey !== '')).to.be.true;
  });

  it('ALL FOUR deltas are always sent — a hidden row sends 0', () => {
    expect(aresResponse({temperatureDelta: -1})).to.deep.eq({
      type: 'aresGlobalParameters',
      response: {lowOceanDelta: 0, highOceanDelta: 0, temperatureDelta: -1, oxygenDelta: 0},
    });
  });
});
