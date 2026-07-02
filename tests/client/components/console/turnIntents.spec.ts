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
import {cycleSection, stepIndex} from '@/client/console/consoleRouter';
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
});
