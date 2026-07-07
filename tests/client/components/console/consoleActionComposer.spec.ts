import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  buildActionBatch,
  branchChoices,
  preChoices,
  canConfirm,
  spendHeatPlan,
  spendHeatStock,
  spendHeatResponse,
  spendHeatValid,
  orderedPreResponses,
  orderedStepResponses,
} from '@/client/console/consoleActionComposer';

function preview(branches: ActionPreview['branches'], preSteps?: ActionPreview['preSteps']): ActionPreview {
  return {card: 'X' as CardName, isCorporation: false, kind: 'bespoke', branches, preSteps};
}

function branch(partial: Partial<ActionPreviewBranch>): ActionPreviewBranch {
  return {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [], ...partial};
}

const AMOUNT_INPUT = {type: 'amount', title: 'Select amount of energy to spend', min: 1, max: 2, maxByDefault: false, icon: 'energy'} as unknown as PlayerInputModel;
const CARD_INPUT = {type: 'card', title: 'Select card', cards: [{name: 'A'}, {name: 'B'}], min: 1, max: 1} as unknown as PlayerInputModel;

describe('consoleActionComposer', () => {
  describe('buildActionBatch (byte-parity with submitCardActionBatch)', () => {
    it('simple activate — just the wrapped pick', () => {
      const batch = buildActionBatch({
        performPath: [2], cardName: 'Solo' as CardName,
        branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: [],
      });
      expect(batch).to.deep.eq([
        {type: 'or', index: 2, response: {type: 'card', cards: ['Solo']}},
      ]);
    });

    it('nested perform path wraps innermost-out', () => {
      const batch = buildActionBatch({
        performPath: [1, 3], cardName: 'Solo' as CardName,
        branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: [],
      });
      expect(batch).to.deep.eq([
        {type: 'or', index: 1, response: {type: 'or', index: 3, response: {type: 'card', cards: ['Solo']}}},
      ]);
    });

    it('branch pick — the optionResponse NESTS INSIDE the branch or-wrap', () => {
      const batch = buildActionBatch({
        performPath: [0], cardName: 'SRR' as CardName,
        branchIndex: 1, preResponses: [], optionResponse: {type: 'card', cards: ['Linked']}, stepResponses: [],
      });
      expect(batch).to.deep.eq([
        {type: 'or', index: 0, response: {type: 'card', cards: ['SRR']}},
        {type: 'or', index: 1, response: {type: 'card', cards: ['Linked']}},
      ]);
    });

    it('branch pick with no direct input — the default {type:option}', () => {
      const batch = buildActionBatch({
        performPath: [0], cardName: 'Catapult' as CardName,
        branchIndex: 0, preResponses: [], optionResponse: undefined, stepResponses: [],
      });
      expect(batch[1]).to.deep.eq({type: 'or', index: 0, response: {type: 'option'}});
    });

    it('lone-branch auto-resolve (index −1) — the BARE direct-input response', () => {
      const batch = buildActionBatch({
        performPath: [0], cardName: 'Shuttles' as CardName,
        branchIndex: -1, preResponses: [], optionResponse: {type: 'amount', amount: 3}, stepResponses: [],
      });
      expect(batch).to.deep.eq([
        {type: 'or', index: 0, response: {type: 'card', cards: ['Shuttles']}},
        {type: 'amount', amount: 3},
      ]);
    });

    it('amount STEP (Hi-Tech Lab) — positional after the (absent) branch slot', () => {
      const batch = buildActionBatch({
        performPath: [0], cardName: 'Hi-Tech Lab' as CardName,
        branchIndex: -1, preResponses: [], optionResponse: undefined,
        stepResponses: [{type: 'amount', amount: 2}],
      });
      expect(batch).to.deep.eq([
        {type: 'or', index: 0, response: {type: 'card', cards: ['Hi-Tech Lab']}},
        {type: 'amount', amount: 2},
      ]);
    });

    it('preSteps replay BEFORE the branch slot (Stormcraft heat)', () => {
      const heat = {type: 'and', responses: [{type: 'amount', amount: 4}, {type: 'amount', amount: 2}]};
      const batch = buildActionBatch({
        performPath: [0], cardName: 'Caretaker' as CardName,
        branchIndex: 0, preResponses: [heat], optionResponse: undefined, stepResponses: [{type: 'card', cards: ['T']}],
      });
      expect(batch).to.deep.eq([
        {type: 'or', index: 0, response: {type: 'card', cards: ['Caretaker']}},
        heat,
        {type: 'or', index: 0, response: {type: 'option'}},
        {type: 'card', cards: ['T']},
      ]);
    });

    it('repeat-action prefix REPLACES the activate pick (Viron handoff)', () => {
      const prefix = [
        {type: 'or', index: 0, response: {type: 'card', cards: ['Viron']}},
        {type: 'card', cards: ['Restricted Area']},
      ];
      const batch = buildActionBatch({
        performPath: [5], // ignored when the prefix is present
        cardName: 'Restricted Area' as CardName,
        prefix,
        branchIndex: -1, preResponses: [], optionResponse: undefined,
        stepResponses: [{type: 'payment', payment: {}}],
      });
      expect(batch).to.deep.eq([...prefix, {type: 'payment', payment: {}}]);
    });
  });

  describe('choice extraction', () => {
    it('an amount input step becomes an amount choice', () => {
      const b = branch({steps: [{kind: 'input', input: AMOUNT_INPUT}]});
      const choices = branchChoices(b);
      expect(choices).to.have.length(1);
      expect(choices[0]).to.include({scope: 'step', index: 0, kind: 'amount'});
    });

    it('a direct optionInput becomes an option-scope choice', () => {
      const b = branch({optionInput: CARD_INPUT});
      const choices = branchChoices(b);
      expect(choices[0]).to.include({scope: 'option', kind: 'card'});
    });

    it('notes and board placements are NOT choices', () => {
      const b = branch({steps: [
        {kind: 'note', noteKind: 'generic'},
        {kind: 'boardPlacement', placementType: 'ocean'},
        {kind: 'input', input: CARD_INPUT},
      ]});
      const choices = branchChoices(b);
      expect(choices).to.have.length(1);
      expect(choices[0].index).to.eq(2); // keeps the ORIGINAL step index
    });

    it('spendHeat preSteps become pre-scope choices', () => {
      const p = preview([branch({})], [{kind: 'spendHeat', input: {type: 'and'} as PlayerInputModel}]);
      const pres = preChoices(p);
      expect(pres).to.have.length(1);
      expect(pres[0]).to.include({scope: 'pre', kind: 'spendHeat'});
    });
  });

  describe('canConfirm (desktop gating mirror)', () => {
    it('requires every input step captured', () => {
      const b = branch({steps: [{kind: 'input', input: AMOUNT_INPUT}]});
      const p = preview([b]);
      expect(canConfirm(p, b, {pre: {}, option: undefined, steps: {}})).to.eq(false);
      expect(canConfirm(p, b, {pre: {}, option: undefined, steps: {0: {type: 'amount', amount: 1}}})).to.eq(true);
    });

    it('requires the optionInput answered', () => {
      const b = branch({optionInput: CARD_INPUT});
      const p = preview([b]);
      expect(canConfirm(p, b, {pre: {}, option: undefined, steps: {}})).to.eq(false);
      expect(canConfirm(p, b, {pre: {}, option: {type: 'card', cards: ['A']}, steps: {}})).to.eq(true);
    });

    it('an unavailable branch never confirms', () => {
      const b = branch({available: false});
      expect(canConfirm(preview([b]), b, {pre: {}, option: undefined, steps: {}})).to.eq(false);
    });

    it('notes do not gate', () => {
      const b = branch({steps: [{kind: 'note', noteKind: 'board'}]});
      expect(canConfirm(preview([b]), b, {pre: {}, option: undefined, steps: {}})).to.eq(true);
    });
  });

  describe('response ordering', () => {
    it('step responses are compacted in steps order', () => {
      const b = branch({steps: [
        {kind: 'input', input: AMOUNT_INPUT},
        {kind: 'note', noteKind: 'generic'},
        {kind: 'input', input: CARD_INPUT},
      ]});
      const out = orderedStepResponses(b, {0: {a: 1}, 2: {b: 2}});
      expect(out).to.deep.eq([{a: 1}, {b: 2}]);
    });

    it('pre responses keep preSteps order', () => {
      const p = preview([branch({})], [
        {kind: 'spendHeat', input: {type: 'and'} as PlayerInputModel},
        {kind: 'spendHeat', input: {type: 'and'} as PlayerInputModel},
      ]);
      const out = orderedPreResponses(p, {1: {second: true}, 0: {first: true}});
      expect(out).to.deep.eq([{first: true}, {second: true}]);
    });
  });

  describe('spend-heat plan (Stormcraft)', () => {
    const input = {
      type: 'and',
      spendHeatPrompt: {amount: 8},
      options: [
        {type: 'amount', min: 0, max: 5, maxByDefault: false}, // heat in stock
        {type: 'amount', min: 0, max: 4, maxByDefault: false}, // floaters
      ],
    } as unknown as PlayerInputModel;

    it('parses the plan + the fewest-floaters default', () => {
      const plan = spendHeatPlan(input);
      expect(plan).to.deep.eq({target: 8, heatMax: 5, floaterMax: 4, minFloaters: 2});
    });

    it('derives stock heat from the floater count', () => {
      const plan = spendHeatPlan(input)!;
      expect(spendHeatStock(plan, 2)).to.eq(4);
      expect(spendHeatStock(plan, 4)).to.eq(0);
    });

    it('validates coverage and ownership', () => {
      const plan = spendHeatPlan(input)!;
      expect(spendHeatValid(plan, 2)).to.eq(true);  // 4 heat + 2 floaters = 8
      expect(spendHeatValid(plan, 1)).to.eq(false); // 6 heat needed > 5 owned
      expect(spendHeatValid(plan, 5)).to.eq(false); // > floaterMax
    });

    it('builds the byte-identical and-response (heat first, floaters second)', () => {
      const plan = spendHeatPlan(input)!;
      expect(spendHeatResponse(plan, 3)).to.deep.eq({
        type: 'and',
        responses: [{type: 'amount', amount: 2}, {type: 'amount', amount: 3}],
      });
    });
  });
});
