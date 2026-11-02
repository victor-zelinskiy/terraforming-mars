import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {
  WILD_LANES, WildChoiceSpec, WildParts, wildBar, wildComplete, wildFootHints, wildLanesShown, wildNav, wildOpen, wildPress,
} from '../../src/client/console/wildChoice/wildChoiceInner';
import {wildBranchPlan, wildComposerSpec, wildPartsFrom, wildRowAnswer} from '../../src/client/console/wildChoice/wildChoiceComposer';

const BLOCK = {chooseWild: 'w', chooseCard: 'c'};

function exclusive(holders: ReadonlyArray<CardName>, off?: string): WildChoiceSpec {
  return {or: off === undefined ? {} : {onCardOff: off}, holders, amount: (w) => w === 'asStandard' ? 1 : 0, exclusive: true, lanes: 'radio'};
}

describe('wildChoiceInner · the EXCLUSIVE choice (P43)', () => {
  it('opens on the OR; nothing is answered and no grid stands before the plate', () => {
    const spec = exclusive([CardName.BIRDS, CardName.DIRIGIBLES]);
    expect(wildOpen(spec, {})).deep.eq({zone: 'wild', index: 0});
    expect(wildLanesShown(spec, {})).is.false;
    expect(wildComplete(spec, {})).is.false;
  });

  it('«on a card» opens the candidates (the grid never), A on a candidate answers and LEAVES', () => {
    const spec = exclusive([CardName.BIRDS, CardName.DIRIGIBLES]);
    const plate = wildPress(spec, {}, {zone: 'wild', index: 0}, 'primary');
    expect(plate.parts.wild).deep.eq({wild: 'onCard'});
    expect(plate.focus).deep.eq({zone: 'card', index: 0});
    expect(wildLanesShown(spec, plate.parts)).is.false;
    const right = wildNav(spec, plate.parts, plate.focus, 'right');
    expect(right).deep.eq({zone: 'card', index: 1});
    expect(wildNav(spec, plate.parts, right, 'down'), 'no grid row under the candidates').deep.eq(right);
    const pick = wildPress(spec, plate.parts, right, 'primary');
    expect(pick.exit).eq('confirm');
    expect(pick.parts.wild).deep.eq({wild: 'onCard', card: CardName.DIRIGIBLES});
    expect(wildComplete(spec, pick.parts)).is.true;
  });

  it('«a standard resource» opens the 2 × 3 RADIO: A on steel answers and leaves; no dial, no bumpers', () => {
    const spec = exclusive([CardName.BIRDS]);
    const plate = wildPress(spec, {}, {zone: 'wild', index: 1}, 'primary');
    expect(plate.parts.wild).deep.eq({wild: 'asStandard'});
    expect(plate.focus.zone).eq('lane');
    const bar = wildBar(spec, plate.parts, plate.focus, BLOCK);
    expect(bar.bumpers).is.undefined;
    expect(wildFootHints(bar).map((h) => h.control)).deep.eq(['dpad', 'confirm', 'back']);
    const steel = WILD_LANES.indexOf('steel');
    const nudged = wildPress(spec, plate.parts, {zone: 'lane', index: steel}, 'nextSection');
    expect(nudged.parts, 'the bumpers do nothing on a radio').deep.eq(plate.parts);
    const pick = wildPress(spec, plate.parts, {zone: 'lane', index: steel}, 'primary');
    expect(pick.exit).eq('confirm');
    expect(pick.parts.spread).deep.eq({steel: 1});
  });

  it('switching the plate drops the other answer — «a card» never keeps a hidden half-answer of the grid', () => {
    const spec = exclusive([CardName.BIRDS, CardName.DIRIGIBLES]);
    const parts: WildParts = {wild: {wild: 'asStandard'}, spread: {steel: 1}};
    const back = wildPress(spec, parts, {zone: 'wild', index: 0}, 'primary');
    expect(back.parts.spread).deep.eq({});
    expect(back.parts.wild).deep.eq({wild: 'onCard'});
  });

  it('a SOLE holder is seeded (shown, the cursor on it) — never applied: the player\'s A confirms it', () => {
    const spec = exclusive([CardName.BIRDS]);
    const plate = wildPress(spec, {}, {zone: 'wild', index: 0}, 'primary');
    expect(plate.parts.wild).deep.eq({wild: 'onCard', card: CardName.BIRDS});
    expect(plate.exit, 'the plate does not leave the step').is.undefined;
    expect(plate.focus).deep.eq({zone: 'card', index: 0});
  });

  it('a refused «on a card» stays on screen, unpressable; the cursor opens on the live plate', () => {
    const spec = exclusive([], 'No card with a resource');
    expect(wildOpen(spec, {})).deep.eq({zone: 'wild', index: 1});
    const press = wildPress(spec, {}, {zone: 'wild', index: 0}, 'primary');
    expect(press.parts).deep.eq({});
    expect(wildBar(spec, {}, {zone: 'wild', index: 0}, BLOCK).primary.enabled).is.false;
  });

  it('B leaves with the draft kept', () => {
    const spec = exclusive([CardName.BIRDS]);
    const parts: WildParts = {wild: {wild: 'onCard', card: CardName.BIRDS}};
    const back = wildPress(spec, parts, {zone: 'card', index: 0}, 'back');
    expect(back.exit).eq('back');
    expect(back.parts).deep.eq(parts);
  });
});

describe('wildChoiceComposer · the composer reads the step off its own state', () => {
  const pick = {
    title: 't', buttonLabel: 'b', type: 'card', min: 1, max: 1,
    cards: [{name: CardName.BIRDS, resources: 1}, {name: CardName.DIRIGIBLES, resources: 2}],
  };
  const branches = [
    {index: 0, title: 'std', available: true, renderKeys: [], effects: [{direction: 'cost', icon: 'science', amount: 1}],
      steps: [{kind: 'input', input: {title: 't', buttonLabel: 'b', type: 'resource', include: ['steel'], amount: 1}}], wildChoice: 'standard'},
    {index: 1, title: 'card', available: true, renderKeys: [], effects: [], steps: [{kind: 'input', input: pick}], wildChoice: 'onCard'},
  ] as unknown as ReadonlyArray<ActionPreviewBranch>;

  it('the plan names both branches and their steps; a pair without the server stamp is no plan', () => {
    expect(wildBranchPlan(branches, [0, 1])).deep.eq({standardPos: 0, cardPos: 1, resourceStep: 0, cardStep: 0});
    expect(wildBranchPlan(branches.map((b) => ({...b, wildChoice: undefined})), [0, 1])).is.undefined;
    expect(wildBranchPlan(branches, [0])).is.undefined;
  });

  it('the spec: candidates from the server\'s pick; a refused card branch is «on a card» disabled with its reason', () => {
    const plan = wildBranchPlan(branches, [0, 1])!;
    expect(wildComposerSpec(plan, branches).holders).deep.eq([CardName.BIRDS, CardName.DIRIGIBLES]);
    const refused = [branches[0], {...branches[1], available: false, steps: []}] as ReadonlyArray<ActionPreviewBranch>;
    expect(wildComposerSpec(plan, refused).or).deep.eq({onCardOff: 'No card with a resource'});
  });

  it('the parts and the row answer are READ BACK from the branch + the captured step answers', () => {
    const plan = wildBranchPlan(branches, [0, 1])!;
    expect(wildPartsFrom(plan, undefined, {})).deep.eq({});
    const std = wildPartsFrom(plan, 0, {0: {type: 'resource', resource: 'steel'}});
    expect(std).deep.eq({wild: {wild: 'asStandard'}, spread: {steel: 1}});
    expect(wildRowAnswer(plan, branches, std)).deep.eq({kind: 'standard', resource: 'steel', amount: 1});
    const card = wildPartsFrom(plan, 1, {0: {type: 'card', cards: [CardName.BIRDS]}});
    expect(wildRowAnswer(plan, branches, card)).deep.eq({kind: 'card', card: CardName.BIRDS, amount: 1});
  });
});
