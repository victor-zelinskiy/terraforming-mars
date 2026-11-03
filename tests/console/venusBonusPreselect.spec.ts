import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {PlayerInputModel, VenusBonusPromptMeta} from '../../src/common/models/PlayerInputModel';
import {
  VENUS_SPREAD_LANES, venusBonusSummary, venusPartAnswered, venusPreselectArm, venusPreselectResponse, venusSpreadAmount,
  venusWhenHolds, venusWildAsks, venusWildCandidates,
} from '../../src/client/console/venusBonus/venusBonusPreselect';
import {
  VENUS_GRID_COLS, VenusInnerFocus, trimVenusSpread, venusInnerBar, venusInnerBlocked, venusInnerCards, venusInnerFootHints, venusInnerNav,
  venusInnerOpen, venusInnerPress, venusInnerStageKey,
} from '../../src/client/console/venusBonus/venusBonusInner';
import {ActionPreviewBranch} from '../../src/common/models/ActionPreviewModel';
import {branchChoices, orderedStepResponses, venusBonusChoices} from '../../src/client/console/consoleActionComposer';
import {venusBonusResponse} from '../../src/client/console/compositePrompts';
import {playChoiceMode} from '../../src/client/console/consolePlayCardComposer';

/*
 * THE VENUS BONUS, PRE-SELECTED (P89 · ledgers EL / EM) — the pure half every host stands on: ONE composer row for the
 * whole bonus, the INNER step (the 30 % wild's OR, its card, the fixed 2 × 3 grid and its d-pad), the ONE composed
 * answer (byte-identical to the hosted surface's `venusBonusResponse`), the conditional bonus of an `or` option
 * (PL-1505) and the cell beat's promise. Server runner.
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
  const pick = {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', min: 1, max: 1, cards: targets.map((name) => ({name, resources: 2}))};
  return {
    type: 'or', title: 'wild', venusBonusPrompt: meta,
    options: [{type: 'and', options: [pick, {type: 'and', options: []}]}, {type: 'and', options: []}],
  } as unknown as PlayerInputModel;
}

/** Walk a sequence of presses through the pure model, the host's way. */
function press(
  meta: VenusBonusPromptMeta, start: {parts?: object, focus?: VenusInnerFocus},
  verbs: ReadonlyArray<'primary' | 'back' | 'prevSection' | 'nextSection' | 'nextTab' | 'up' | 'down' | 'left' | 'right' | {pick: CardName}>,
) {
  let parts = (start.parts ?? {}) as Parameters<typeof venusInnerPress>[1];
  let focus = start.focus ?? venusInnerOpen(meta, parts);
  let exit: string | undefined;
  for (const v of verbs) {
    if (v === 'up' || v === 'down' || v === 'left' || v === 'right') {
      focus = venusInnerNav(meta, parts, focus, v);
      continue;
    }
    // A in the nested card pick: the host hands in the selector's focused card.
    const r = typeof v === 'object' ? venusInnerPress(meta, parts, focus, 'primary', v.pick) : venusInnerPress(meta, parts, focus, v);
    parts = r.parts;
    focus = r.focus;
    exit = r.exit ?? exit;
  }
  return {parts, focus, exit};
}

describe('venusBonusPreselect', () => {
  it('ONE composer row for the whole bonus — standard or the 30 % finish alike', () => {
    expect(venusBonusChoices(standardInput(2), 3).map((c) => [c.id, c.kind])).deep.eq([['step#3', 'venusBonus']]);
    expect(venusBonusChoices(finalInput([CardName.DIRIGIBLES]), 1).map((c) => [c.id, c.kind])).deep.eq([['step#1', 'venusBonus']]);
  });

  it('a STANDARD bonus: its answer stands only once the sum is exact — byte-identical to the hosted surface', () => {
    const meta = standardInput(2).venusBonusPrompt!;
    expect(venusSpreadAmount(meta, {})).eq(2);
    expect(venusPreselectResponse(meta, {spread: {steel: 1}}), 'one of two placed — the commit is held').is.undefined;
    const parts = {spread: {steel: 1, titanium: 1}};
    expect(venusPreselectResponse(meta, parts)).deep.eq(amounts({steel: 1, titanium: 1}));
    expect(venusPreselectResponse(meta, parts)).deep.eq(venusBonusResponse(meta, parts.spread, undefined, undefined));
  });

  it('the 30 % FINAL: «on a card» needs its card; «a standard resource» adds one to the spread', () => {
    const meta = finalInput([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]).venusBonusPrompt!;
    expect(venusWildAsks(meta)).is.true;
    expect(venusPartAnswered(meta, {wild: {wild: 'onCard'}}, 'wild'), 'on a card, no card yet').is.false;
    expect(venusSpreadAmount(meta, {wild: {wild: 'asStandard'}})).eq(2);
    expect(venusPreselectResponse(meta, {wild: {wild: 'onCard', card: CardName.DIRIGIBLES}, spread: {plants: 1}}))
      .deep.eq({type: 'or', index: 0, response: {type: 'and', responses: [{type: 'card', cards: [CardName.DIRIGIBLES]}, amounts({plants: 1})]}});
    expect(venusPreselectResponse(meta, {wild: {wild: 'asStandard'}, spread: {plants: 2}}))
      .deep.eq({type: 'or', index: 1, response: amounts({plants: 2})});
    expect(venusWildCandidates(finalInput([CardName.DIRIGIBLES]))?.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES]);
  });

  it('the 30 % FINAL with NO holder: no OR at all — the bare spread of base + 1', () => {
    const meta = finalInput([]).venusBonusPrompt!;
    expect(venusWildAsks(meta)).is.false;
    expect(venusInnerOpen(meta, {})).deep.eq({zone: 'lane', index: 0});
    expect(venusSpreadAmount(meta, {})).eq(2);
    expect(venusPreselectResponse(meta, {spread: {heat: 2}})).deep.eq(amounts({heat: 2}));
  });

  it('the row reads the answer back: units in lane order, the wild\'s card', () => {
    expect(venusBonusSummary({spread: {titanium: 1, steel: 2}, wild: {wild: 'onCard', card: CardName.DIRIGIBLES}}))
      .deep.eq({units: [{key: 'steel', n: 2}, {key: 'titanium', n: 1}], card: CardName.DIRIGIBLES});
  });

  it('the cell beat\'s promise: the rows, the raise, PRE-SELECTED — no bonus prompt will stand', () => {
    const meta = standardInput(2).venusBonusPrompt!;
    expect(venusPreselectArm(meta, {spread: {steel: 2, heat: 0}})).deep.eq({units: {steel: 2}, step: {from: 16, to: 20}, preselected: true});
  });
});

describe('venusBonusInner · the inner pre-select', () => {
  it('the grid is FIXED: 2 rows × 3 — ↑↓ change the row keeping the column, ←→ never wrap', () => {
    const meta = standardInput(2).venusBonusPrompt!;
    expect(VENUS_GRID_COLS).eq(3);
    const at = (index: number): VenusInnerFocus => ({zone: 'lane', index});
    expect(venusInnerNav(meta, {}, at(1), 'down')).deep.eq(at(4));
    expect(venusInnerNav(meta, {}, at(4), 'up')).deep.eq(at(1));
    expect(venusInnerNav(meta, {}, at(2), 'right'), 'no wrap to the next row').deep.eq(at(2));
    expect(venusInnerNav(meta, {}, at(3), 'left')).deep.eq(at(3));
    expect(venusInnerNav(meta, {}, at(0), 'up'), 'nothing above the grid on a standard bonus').deep.eq(at(0));
    expect(venusInnerNav(meta, {}, at(5), 'down')).deep.eq(at(5));
  });

  it('the 30 % finish: the OR first, «on a card» ONE door under it (the holders are a level of their own), the grid below', () => {
    const meta = finalInput([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS, CardName.FLOATING_HABS]).venusBonusPrompt!;
    expect(venusInnerOpen(meta, {}), 'opens on the OR').deep.eq({zone: 'wild', index: 0});
    expect(venusInnerNav(meta, {}, {zone: 'wild', index: 1}, 'down'), 'no cards before «on a card»: straight to the grid').deep.eq({zone: 'lane', index: 2});
    const onCard = {wild: {wild: 'onCard' as const}};
    expect(venusInnerCards(meta, onCard)).has.lengthOf(3);
    expect(venusInnerNav(meta, onCard, {zone: 'wild', index: 1}, 'down'), 'the door is one cell').deep.eq({zone: 'card', index: 0});
    expect(venusInnerNav(meta, onCard, {zone: 'card', index: 0}, 'right'), 'nothing beside the door').deep.eq({zone: 'card', index: 0});
    expect(venusInnerNav(meta, onCard, {zone: 'card', index: 0}, 'down')).deep.eq({zone: 'lane', index: 0});
    expect(venusInnerNav(meta, onCard, {zone: 'lane', index: 2}, 'up')).deep.eq({zone: 'card', index: 0});
    expect(venusInnerNav(meta, onCard, {zone: 'card', index: 0}, 'up')).deep.eq({zone: 'wild', index: 0});
  });

  it('THE NESTED PICK (the owner, 2026-11-03): «on a card» with no card enters it; A answers with the selector’s card, B is one level back', () => {
    const meta = finalInput([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]).venusBonusPrompt!;
    const entered = press(meta, {}, ['primary']);
    expect(entered.focus, '«on a card» opens the pick at once').deep.eq({zone: 'pick', index: 0});
    expect(venusInnerNav(meta, entered.parts, entered.focus, 'down'), 'the selector walks its own boxes').deep.eq(entered.focus);
    expect(venusInnerPress(meta, entered.parts, entered.focus, 'primary').focus, 'A with nothing focused answers nothing').deep.eq(entered.focus);
    const back = press(meta, {parts: entered.parts, focus: entered.focus}, ['back']);
    expect(back.exit, 'B never leaves the step from the pick').is.undefined;
    expect(back.focus, '…it returns to the door').deep.eq({zone: 'card', index: 0});
    expect(press(meta, {parts: back.parts, focus: back.focus}, ['primary']).focus, 'A on the door enters it again').deep.eq({zone: 'pick', index: 0});
    const bar = venusInnerBar(meta, entered.parts, entered.focus);
    expect(venusInnerFootHints(bar).map((c) => c.label)).deep.eq(['Navigate', 'Choose', 'Inspect', 'Back']);
    expect(venusInnerStageKey(entered.focus), 'the crumb goes one level deeper').eq('Venus bonus · card');
    expect(venusInnerStageKey({zone: 'card', index: 0})).eq('Venus bonus');
  });

  it('A walks the questions in order and LEAVES on the laid-out grid — never before', () => {
    const meta = finalInput([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]).venusBonusPrompt!;
    // «On a card» → the pick; a card → the grid; A places one unit; A again confirms and leaves.
    const r = press(meta, {}, ['primary', {pick: CardName.ATMO_COLLECTORS}, 'primary']);
    expect(r.parts).deep.eq({wild: {wild: 'onCard', card: CardName.ATMO_COLLECTORS}, spread: {megacredits: 1}});
    expect(r.exit, 'laid out, not yet confirmed').is.undefined;
    expect(press(meta, {parts: r.parts, focus: r.focus}, ['primary']).exit).eq('confirm');
  });

  it('a SOLE holder is the answer on «a card» — shown and marked, the cursor goes on to the grid', () => {
    const meta = finalInput([CardName.DIRIGIBLES]).venusBonusPrompt!;
    const r = press(meta, {}, ['primary']);
    expect(r.parts.wild).deep.eq({wild: 'onCard', card: CardName.DIRIGIBLES});
    expect(r.focus.zone).eq('lane');
  });

  it('LB/RB one unit, RT the rest — bounded; «a card» after «a standard resource» trims the spread', () => {
    const meta = finalInput([CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]).venusBonusPrompt!;
    const r = press(meta, {}, ['right', 'primary', 'nextSection', 'nextSection', 'nextSection', 'right', 'nextTab']);
    expect(r.parts.spread, 'two units: one on M€ (LB/RB capped), the rest on steel').deep.eq({megacredits: 2});
    const back = press(meta, {parts: r.parts}, ['up', 'up', 'left', 'primary']);
    expect(back.parts.wild?.wild).eq('onCard');
    expect(back.parts.spread, 'the sum went 2 → 1: the last units give way').deep.eq({megacredits: 1});
    expect(trimVenusSpread({steel: 1, heat: 2}, 1)).deep.eq({steel: 1});
  });

  it('B leaves with the draft kept; the bar names every verb and the open question', () => {
    const meta = standardInput(2).venusBonusPrompt!;
    const r = press(meta, {}, ['nextSection', 'back']);
    expect(r.exit).eq('back');
    expect(r.parts.spread).deep.eq({megacredits: 1});
    expect(venusInnerBlocked(meta, r.parts)).deep.eq({key: 'Left to place: ${0}', params: ['1']});
    const bar = venusInnerBar(meta, r.parts, {zone: 'lane', index: 0});
    expect(bar.primary).deep.eq({label: 'Add one here', enabled: true});
    expect(venusInnerFootHints(bar).map((c) => c.label)).deep.eq(['Navigate', 'Add one here', '−1 / +1', 'The rest', 'Back']);
    const done = venusInnerBar(meta, {spread: {megacredits: 2}}, {zone: 'lane', index: 0});
    expect(done.primary).deep.eq({label: 'Confirm', enabled: true});
    expect(done.pour).is.false;
  });
});

describe('venusBonusPreselect · a bonus ONE option earns (PL-1505 — Atmoscoop)', () => {
  const or = {type: 'or', title: 'param', options: [{type: 'option'}, {type: 'option'}]} as unknown as PlayerInputModel;
  const bonus = standardInput(2);
  const branch = {
    index: -1, title: '', available: true, renderKeys: [], effects: [],
    steps: [{kind: 'input', input: or}, {kind: 'venusBonus', input: bonus, for: {role: 'venusBonus'}, when: {step: 0, option: 1}}],
  } as unknown as ActionPreviewBranch;

  it('the row stands only while the option is the answer', () => {
    expect(venusWhenHolds({step: 0, option: 1}, {})).is.false;
    expect(venusWhenHolds({step: 0, option: 1}, {0: {type: 'or', index: 1, response: {type: 'option'}}})).is.true;
    expect(branchChoices(branch, {}).map((c) => c.kind)).deep.eq(['or']);
    expect(branchChoices(branch, {0: {type: 'or', index: 0, response: {type: 'option'}}}).map((c) => c.kind)).deep.eq(['or']);
    expect(branchChoices(branch, {0: {type: 'or', index: 1, response: {type: 'option'}}}).map((c) => c.kind)).deep.eq(['or', 'venusBonus']);
  });

  it('a stale answer of the bonus never rides the batch once the option changed', () => {
    const steps = {0: {type: 'or', index: 0, response: {type: 'option'}}, 1: amounts({steel: 2})};
    expect(orderedStepResponses(branch, steps)).has.lengthOf(1);
    expect(orderedStepResponses(branch, {...steps, 0: {type: 'or', index: 1, response: {type: 'option'}}})).has.lengthOf(2);
  });
});

describe('venusBonusPreselect · the play sheet', () => {
  it('the bonus row is an INLINE choice of the sheet — never a follow-up that posts nothing', () => {
    const modes = venusBonusChoices(finalInput([CardName.DIRIGIBLES]), 0).map((c) => playChoiceMode(c, new Set(), new Set([CardName.DIRIGIBLES])));
    expect(modes).deep.eq(['inline']);
  });
});
