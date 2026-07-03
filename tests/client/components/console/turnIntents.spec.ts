import {expect} from 'chai';
import {
  findAwardOptionPath,
  findConvertHeatOption,
  findConvertPlantsOption,
  findEndTurnPath,
  findMilestoneOptionPath,
  findPassPath,
  findPlayProjectCardAction,
  findSellPatentsAction,
  findStandardProjectsAction,
  optionResponseForPath,
  wrapPath,
} from '@/client/console/turnIntents';
import {findPerformActionCard, findTradeColonyContext, findHydroActionPath} from '@/client/console/turnIntents';
import {cycleSection, stepIndex, stepSelectable} from '@/client/console/consoleRouter';
import {cyclePlayer} from '@/client/console/infoModeState';
import type {Color} from '@/common/Color';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

// Synthetic waitingFor trees — only the fields the walkers read.
function or(title: string, options: Array<any>): any {
  return {type: 'or', title, options};
}
function option(title: string): any {
  return {type: 'option', title};
}
function projectCard(title: string, cards: Array<any> = []): any {
  return {type: 'projectCard', title, cards};
}

// The canonical action menu shape (per CLAUDE.md action-detection contracts).
function actionMenu(): any {
  return or('Take your first action', [
    projectCard('Play project card', [{name: 'Birds', isDisabled: false}, {name: 'Zeppelins', isDisabled: true}]),
    projectCard('Standard projects', [{name: 'Power Plant:SP'}]),
    or('Claim a milestone', [option('Terraformer'), option('Mayor')]),
    or('Fund an award (14 M€)', [option('Landlord')]),
    option('Convert 8 heat into temperature'),
    {type: 'space', title: 'Convert 8 plants into greenery'},
    {type: 'card', title: 'Sell patents', cards: []},
    option('Pass for this generation'),
    option('End Turn'),
  ]);
}

describe('turnIntents', () => {
  const wf = actionMenu() as PlayerInputModel;

  it('finds the play-project-card action with its path', () => {
    const found = findPlayProjectCardAction(wf);
    expect(found?.path).to.deep.eq([0]);
    expect(found?.input.cards).to.have.length(2);
  });

  it('a TOP-LEVEL projectCard prompt yields an EMPTY path (bare response)', () => {
    const top = projectCard('Play project card', []) as PlayerInputModel;
    expect(findPlayProjectCardAction(top)?.path).to.deep.eq([]);
  });

  it('finds standard projects / milestones / awards with paths', () => {
    expect(findStandardProjectsAction(wf)?.path).to.deep.eq([1]);
    const ms = findMilestoneOptionPath(wf);
    expect(ms?.path).to.deep.eq([2]);
    expect(ms?.options).to.have.length(2);
    expect(findAwardOptionPath(wf)?.path).to.deep.eq([3]);
  });

  it('finds convert heat / plants / sell patents / pass / end turn', () => {
    expect(findConvertHeatOption(wf)?.path).to.deep.eq([4]);
    expect(findConvertPlantsOption(wf, false)?.path).to.deep.eq([5]);
    expect(findSellPatentsAction(wf)?.path).to.deep.eq([6]);
    expect(findPassPath(wf)).to.deep.eq([7]);
    expect(findEndTurnPath(wf)).to.deep.eq([8]);
  });

  it('descends through WRAPPED menus (initial-action nesting)', () => {
    const wrapped = or('outer', [option('Something'), actionMenu()]) as PlayerInputModel;
    expect(findPassPath(wrapped)).to.deep.eq([1, 7]);
    expect(findMilestoneOptionPath(wrapped)?.path).to.deep.eq([1, 2]);
  });

  it('convert plants falls back to any-space ONLY with the server flag', () => {
    const noTitle = or('menu', [{type: 'space', title: 'Weird placement'}]) as PlayerInputModel;
    expect(findConvertPlantsOption(noTitle, false)).to.eq(undefined);
    expect(findConvertPlantsOption(noTitle, true)?.path).to.deep.eq([0]);
  });

  it('builds byte-identical nested OR responses', () => {
    expect(optionResponseForPath([2, 1])).to.deep.eq({
      type: 'or', index: 2, response: {type: 'or', index: 1, response: {type: 'option'}},
    });
    expect(wrapPath([], {type: 'option'})).to.deep.eq({type: 'option'});
  });

  it('returns undefined on an empty/absent tree', () => {
    expect(findPassPath(undefined)).to.eq(undefined);
    expect(findMilestoneOptionPath(undefined)).to.eq(undefined);
  });

  it('finds the colony-trade AndOptions context (payments + tradeable set)', () => {
    const trade: any = {
      type: 'and', title: 'Trade with a colony tile',
      options: [
        {type: 'or', title: 'Pay trade fee', options: [option('Pay 9 M€'), option('Pay 3 energy')], disabledOptions: [{label: 'x'}]},
        {type: 'colony', title: 'Select colony', coloniesModel: [{name: 'Luna'}, {name: 'Triton'}]},
      ],
    };
    const menu = or('Take your first action', [option('Pass for this generation'), trade]) as PlayerInputModel;
    const ctx = findTradeColonyContext(menu);
    expect(ctx?.path).to.deep.eq([1]);
    expect(ctx?.paymentOptions).to.have.length(2);
    expect(ctx?.disabledPayments).to.have.length(1);
    expect(ctx?.colonies).to.deep.eq(['Luna', 'Triton']);
    expect(findTradeColonyContext(undefined)).to.eq(undefined);
  });

  it('finds the hydro advance path', () => {
    const menu = or('Take your next action', [option('Advance on the Delta Project track')]) as PlayerInputModel;
    expect(findHydroActionPath(menu)).to.deep.eq([0]);
    expect(findHydroActionPath(undefined)).to.eq(undefined);
  });

  it('finds the perform-action SelectCard (card actions category)', () => {
    const menu = or('Take your first action', [
      option('Something'),
      {type: 'card', title: 'Perform an action from a played card', cards: [{name: 'Birds'}]},
    ]) as PlayerInputModel;
    const found = findPerformActionCard(menu);
    expect(found?.path).to.deep.eq([1]);
    expect(found?.model.cards).to.have.length(1);
    expect(findPerformActionCard(undefined)).to.eq(undefined);
  });
});

describe('consoleRouter pure helpers', () => {
  it('cycles sections in a ring', () => {
    expect(cycleSection('board', 1)).to.eq('hand');
    expect(cycleSection('hand', 1)).to.eq('board');
    expect(cycleSection('board', -1)).to.eq('hand');
  });

  it('steps indices without wrapping', () => {
    expect(stepIndex(0, -1, 5)).to.eq(0);
    expect(stepIndex(4, 1, 5)).to.eq(4);
    expect(stepIndex(2, 1, 5)).to.eq(3);
    expect(stepIndex(3, -2, 5)).to.eq(1);
    expect(stepIndex(7, 0, 0)).to.eq(0);
  });

  it('stepSelectable skips group headers in both directions', () => {
    //            [H,  row, row, H,  row]
    const sel = [false, true, true, false, true];
    expect(stepSelectable(1, 1, sel)).to.eq(2);
    expect(stepSelectable(2, 1, sel)).to.eq(4); // hops over the header
    expect(stepSelectable(4, -1, sel)).to.eq(2);
    expect(stepSelectable(1, -1, sel)).to.eq(1); // edge: stays put
    expect(stepSelectable(4, 1, sel)).to.eq(4);
  });

  it('stepSelectable normalizes a header-landed index (step 0)', () => {
    const sel = [false, true, true];
    expect(stepSelectable(0, 0, sel)).to.eq(1);
    expect(stepSelectable(2, 0, sel)).to.eq(2);
    expect(stepSelectable(0, 0, [false, false])).to.eq(0);
    expect(stepSelectable(5, 0, [])).to.eq(0);
  });

  it('cyclePlayer wraps in both directions and tolerates unknowns', () => {
    const colors = ['red', 'green', 'blue'] as Array<Color>;
    expect(cyclePlayer(colors, 'red' as Color, 1)).to.eq('green');
    expect(cyclePlayer(colors, 'blue' as Color, 1)).to.eq('red');
    expect(cyclePlayer(colors, 'red' as Color, -1)).to.eq('blue');
    expect(cyclePlayer(colors, undefined, 1)).to.eq('red');
    expect(cyclePlayer([], 'red' as Color, 1)).to.eq(undefined);
  });
});
