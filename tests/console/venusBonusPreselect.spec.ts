import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {PlayerInputModel, VenusBonusPromptMeta} from '../../src/common/models/PlayerInputModel';
import {
  VENUS_SPREAD_LANES, venusBonusParts, venusPartAnswered, venusPreselectArm, venusPreselectResponse, venusSpreadAmount,
  venusWildAsks, venusWildChoiceModel, venusWildOfAnswer,
} from '../../src/client/console/venusBonus/venusBonusPreselect';
import {venusBonusChoices} from '../../src/client/console/consoleActionComposer';
import {optionalChoiceOf} from '../../src/client/console/optionalChoice';
import {venusBonusResponse} from '../../src/client/console/compositePrompts';
import {playChoiceMode} from '../../src/client/console/consolePlayCardComposer';

/*
 * THE VENUS BONUS, PRE-SELECTED (P89 · ledger EL) — the pure half both composers stand on: the step's rows (the 30 %
 * wild as its own optional card pick, then the six-lane spread), the spread's sum, the ONE composed answer (byte-
 * identical to the hosted surface's `venusBonusResponse`) and the cell beat's promise. Server runner.
 */
const amounts = (picks: Partial<Record<string, number>>) =>
  ({type: 'and', responses: VENUS_SPREAD_LANES.map((key) => ({type: 'amount', amount: picks[key] ?? 0}))});

function standardInput(base: number): PlayerInputModel {
  const meta: VenusBonusPromptMeta = {kind: 'standard', baseCount: base, step: {from: 16, to: 20}};
  return {type: 'and', title: 'bonus', options: [], venusBonusPrompt: meta} as unknown as PlayerInputModel;
}

function finalInput(targets: ReadonlyArray<CardName>, base = 1): PlayerInputModel {
  const meta: VenusBonusPromptMeta = {kind: 'final', baseCount: base, wildCardTargets: targets, step: {from: 28, to: 30}};
  if (targets.length === 0) {
    return {type: 'and', title: 'bonus', options: [], venusBonusPrompt: meta} as unknown as PlayerInputModel;
  }
  const pick = {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', min: 1, max: 1, cards: targets.map((name) => ({name}))};
  return {
    type: 'or', title: 'wild', venusBonusPrompt: meta,
    options: [{type: 'and', options: [pick, {type: 'and', options: []}]}, {type: 'and', options: []}],
  } as unknown as PlayerInputModel;
}

describe('venusBonusPreselect', () => {
  it('a STANDARD bonus is ONE row — the spread; its answer stands only once the sum is exact', () => {
    const input = standardInput(2);
    const meta = input.venusBonusPrompt!;
    expect(venusBonusParts(meta)).deep.eq(['spread']);
    expect(venusBonusChoices(input, 3).map((c) => [c.id, c.kind, c.venusPart])).deep.eq([['step#3', 'venusBonus', 'spread']]);
    expect(venusSpreadAmount(meta, {})).eq(2);
    expect(venusPreselectResponse(meta, {spread: {steel: 1}}), 'one of two placed — the commit is held').is.undefined;
    expect(venusPartAnswered(meta, {spread: {steel: 1}}, 'spread')).is.false;
    const parts = {spread: {steel: 1, titanium: 1}};
    expect(venusPreselectResponse(meta, parts)).deep.eq(amounts({steel: 1, titanium: 1}));
    expect(venusPreselectResponse(meta, parts), 'byte-identical to the hosted surface').deep.eq(venusBonusResponse(meta, parts.spread, undefined, undefined));
  });

  it('the 30 % FINAL with a holder: the wild is its OWN row — an optional card pick, RT a standard resource instead', () => {
    const input = finalInput([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]);
    const meta = input.venusBonusPrompt!;
    expect(venusWildAsks(meta)).is.true;
    expect(venusBonusChoices(input, 1).map((c) => [c.id, c.kind, c.venusPart])).deep.eq([['step#1:wild', 'or', 'wild'], ['step#1', 'venusBonus', 'spread']]);
    const wild = venusWildChoiceModel(input)!;
    const optional = optionalChoiceOf(wild);
    expect(optional?.pick, 'the one answer is a PICK — the door opens it directly').eq(0);
    expect(optional?.decline.index).eq(1);
    expect(optional?.binary).is.false;
    // The wild decides the spread's sum.
    expect(venusSpreadAmount(meta, {})).eq(1);
    expect(venusSpreadAmount(meta, {wild: {wild: 'asStandard'}})).eq(2);
    expect(venusSpreadAmount(meta, {wild: {wild: 'onCard', card: CardName.DIRIGIBLES}})).eq(1);
    // The answers read back.
    expect(venusWildOfAnswer({type: 'or', index: 0, response: {type: 'card', cards: [CardName.DIRIGIBLES]}})).deep.eq({wild: 'onCard', card: CardName.DIRIGIBLES});
    expect(venusWildOfAnswer({type: 'or', index: 1, response: {type: 'option'}})).deep.eq({wild: 'asStandard'});
    expect(venusWildOfAnswer(undefined)).is.undefined;
    // Both parts or nothing.
    expect(venusPreselectResponse(meta, {spread: {plants: 1}}), 'no wild yet').is.undefined;
    expect(venusPreselectResponse(meta, {wild: {wild: 'onCard', card: CardName.DIRIGIBLES}, spread: {plants: 1}}))
      .deep.eq({type: 'or', index: 0, response: {type: 'and', responses: [{type: 'card', cards: [CardName.DIRIGIBLES]}, amounts({plants: 1})]}});
    expect(venusPreselectResponse(meta, {wild: {wild: 'asStandard'}, spread: {plants: 1}}), 'the wild folded in: one short').is.undefined;
    expect(venusPreselectResponse(meta, {wild: {wild: 'asStandard'}, spread: {plants: 2}}))
      .deep.eq({type: 'or', index: 1, response: amounts({plants: 2})});
  });

  it('the 30 % FINAL with NO holder: no wild row — the bare spread of base + 1 (the server asks the bare `and`)', () => {
    const input = finalInput([]);
    const meta = input.venusBonusPrompt!;
    expect(venusBonusParts(meta)).deep.eq(['spread']);
    expect(venusWildChoiceModel(input)).is.undefined;
    expect(venusSpreadAmount(meta, {})).eq(2);
    expect(venusPreselectResponse(meta, {spread: {heat: 2}})).deep.eq(amounts({heat: 2}));
  });

  it('the cell beat\'s promise: the rows, the raise, PRE-SELECTED — no bonus prompt will stand', () => {
    const meta = standardInput(2).venusBonusPrompt!;
    expect(venusPreselectArm(meta, {spread: {steel: 2, heat: 0}})).deep.eq({units: {steel: 2}, step: {from: 16, to: 20}, preselected: true});
  });
});

describe('venusBonusPreselect · the play sheet', () => {
  it('both rows of the step are INLINE choices of the sheet — never a follow-up that posts nothing', () => {
    const meta: VenusBonusPromptMeta = {kind: 'final', baseCount: 1, wildCardTargets: [CardName.DIRIGIBLES], step: {from: 28, to: 30}};
    const pick = {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', min: 1, max: 1, cards: [{name: CardName.DIRIGIBLES}]};
    const input = {type: 'or', title: 'wild', venusBonusPrompt: meta,
      options: [{type: 'and', options: [pick, {type: 'and', options: []}]}, {type: 'and', options: []}]} as unknown as PlayerInputModel;
    const modes = venusBonusChoices(input, 0).map((c) => playChoiceMode(c, new Set(), new Set([CardName.DIRIGIBLES])));
    expect(modes).deep.eq(['inline', 'inline']);
  });
});
