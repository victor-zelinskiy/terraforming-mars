import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionEffect, ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {
  AT_MAXIMUM_NOTICE, firstAvailableRow, preludePreStepStage, preludeVariantAnswer, preludeVariantOf, preludeVariantReading, preludeVariantRowOf,
  preludeVariantStepResponses, stepVariantFocus,
} from '@/client/console/preludeVariant/preludeVariantModel';

const DRAW: ActionEffect = {direction: 'gain', icon: 'cards', amount: 2, note: 'draw', search: {count: 2, floaterIcon: true}};
const TR: ActionEffect = {direction: 'gain', icon: 'tr', amount: 2, current: 20, resulting: 22};
const FOR = {source: {kind: 'card' as const, card: CardName.ATMOSPHERIC_ENHANCERS}, role: 'or'};

function branch(index: number, title: string, chip: ActionEffect, over: Partial<ActionPreviewBranch> = {}): ActionPreviewBranch {
  return {index, title, available: true, renderKeys: [String(index)], effects: [chip, TR, DRAW], steps: [], for: FOR, ...over};
}

/** P44's preview — three branches, each its parameter chip, the rating, the shared floater search. */
function p44(temperature: ActionEffect = {direction: 'gain', icon: 'temperature', amount: 2, current: -30, resulting: -26}): ActionPreview {
  return {
    kind: 'declarative',
    branches: [
      branch(0, 'Raise temperature 2 steps', temperature),
      branch(1, 'Raise oxygen 2 steps', {direction: 'gain', icon: 'oxygen', amount: 2, current: 0, resulting: 2}),
      branch(2, 'Raise Venus 2 steps', {direction: 'gain', icon: 'venus', amount: 2, current: 0, resulting: 4}),
    ],
  } as unknown as ActionPreview;
}

describe('preludeVariantModel — the «ВАРИАНТ» step (P44)', () => {
  it('rows from the preview: the printed order, each its own chips; what every branch brings is read ONCE', () => {
    const v = preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, p44())!;
    expect(v.rows.map((r) => [r.position, r.branchIndex, r.title])).deep.eq([
      [0, 0, 'Raise temperature 2 steps'], [1, 1, 'Raise oxygen 2 steps'], [2, 2, 'Raise Venus 2 steps'],
    ]);
    expect(v.rows[2].chips.map((c) => c.icon)).deep.eq(['venus', 'tr']);
    expect(v.shared).deep.eq([DRAW]);
  });

  it('a row at its ceiling is OFFERED and says so — never hidden, never refused', () => {
    const v = preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, p44({direction: 'gain', icon: 'temperature', amount: 2, current: 8, resulting: 8}))!;
    expect(v.rows[0].available).is.true;
    expect(v.rows[0].notice).eq(AT_MAXIMUM_NOTICE);
    expect(v.rows[1].notice).is.undefined;
  });

  it('a row the rules refuse is SHOWN with its reason, never answered; the cursor starts on the first takeable row', () => {
    const preview = p44();
    (preview.branches as Array<ActionPreviewBranch>)[0] = branch(-1, 'Raise temperature 2 steps', preview.branches[0].effects[0],
      {available: false, unavailableReason: 'Need ${0} more M€', unavailableReasonParams: ['3']});
    const v = preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, preview)!;
    expect(v.rows[0]).deep.include({available: false, branchIndex: -1, reason: 'Need ${0} more M€', reasonParams: ['3']});
    expect(firstAvailableRow(v)).eq(1);
    expect(preludeVariantAnswer(preview, v.rows[0])).is.undefined;
  });

  it('the answer is ADDRESSED — `{or, index}` stamped with the branch’s own address', () => {
    const preview = p44();
    const v = preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, preview)!;
    expect(preludeVariantAnswer(preview, v.rows[2])).deep.eq({type: 'or', index: 2, response: {type: 'option'}, for: FOR});
  });

  it('nothing to choose: no preview, one branch, or ONE executable branch (the server reduces it)', () => {
    expect(preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, undefined)).is.undefined;
    const one = {kind: 'declarative', branches: [branch(-1, '', DRAW)]} as unknown as ActionPreview;
    expect(preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, one)).is.undefined;
    const preview = p44();
    (preview.branches as Array<ActionPreviewBranch>)[0] = {...preview.branches[0], available: false, index: -1};
    (preview.branches as Array<ActionPreviewBranch>)[1] = {...preview.branches[1], available: false, index: -1};
    expect(preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, preview)).is.undefined;
  });

  it('the queue names the branches before A — the parameters in the printed order, a maxed one marked', () => {
    expect(preludeVariantReading(p44({direction: 'gain', icon: 'temperature', amount: 2, current: 8, resulting: 8}))).deep.eq([
      {icon: 'temperature', maxed: true}, {icon: 'oxygen', maxed: false}, {icon: 'venus', maxed: false},
    ]);
    expect(preludeVariantReading(undefined)).deep.eq([]);
  });

  it('the d-pad walks the column and wraps', () => {
    const v = preludeVariantOf(CardName.ATMOSPHERIC_ENHANCERS, p44())!;
    expect(stepVariantFocus(v, 2, 1)).eq(0);
    expect(stepVariantFocus(v, 0, -1)).eq(2);
  });
});

describe('preludeVariantModel — the «РЕСУРС» pre-step (P50 · FC)', () => {
  const RESOURCE_FOR = {source: {kind: 'card' as const, card: CardName.FOCUSED_ORGANIZATION}, role: 'resource'};
  const WILD: ActionEffect = {direction: 'gain', icon: 'wild', amount: 1, note: 'of your choice'};
  const CARD: ActionEffect = {direction: 'gain', icon: 'cards', amount: 1, note: 'draw'};
  function p50(steps: ReadonlyArray<unknown>): ActionPreview {
    return {
      kind: 'declarative',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [CARD, WILD], steps}],
    } as unknown as ActionPreview;
  }
  const gainStep = {kind: 'input', input: {type: 'resource', title: 't', buttonLabel: 'b', include: ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'], amount: 1}, for: RESOURCE_FOR};

  it('a one-branch play asking «a standard resource» is a pre-step: one row per lane, «+1 [lane]», the rest shared', () => {
    const v = preludeVariantOf(CardName.FOCUSED_ORGANIZATION, p50([gainStep]))!;
    expect(v.kind).eq('resource');
    expect(preludePreStepStage(v)).eq('Resource');
    expect(v.rows.map((r) => r.resource)).deep.eq(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
    expect(v.rows.map((r) => r.choice)).deep.eq([0, 1, 2, 3, 4, 5]);
    expect(v.rows[3].chips).deep.eq([{direction: 'gain', icon: 'plants', amount: 1}]);
    expect(v.shared, 'the «?» is the question, the card is shared').deep.eq([CARD]);
  });

  it('the answer is the step\'s own `resource`, ADDRESSED by the step — and it rides the reward wave', () => {
    const preview = p50([gainStep]);
    const v = preludeVariantOf(CardName.FOCUSED_ORGANIZATION, preview)!;
    const steel = preludeVariantRowOf(v, 1)!;
    expect(preludeVariantAnswer(preview, steel)).deep.eq({type: 'resource', resource: 'steel', for: RESOURCE_FOR});
    expect(preludeVariantStepResponses(steel)).deep.eq({0: {type: 'resource', resource: 'steel'}});
  });

  it('a SPEND «?» is never a play pre-step; a branch with no resource step stays «nothing to choose»', () => {
    const spend = {...gainStep, input: {...gainStep.input, spendAmount: 1}};
    expect(preludeVariantOf(CardName.FOCUSED_ORGANIZATION, p50([spend]))).is.undefined;
    expect(preludeVariantOf(CardName.FOCUSED_ORGANIZATION, p50([]))).is.undefined;
  });
});
