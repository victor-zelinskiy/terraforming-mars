import {expect} from 'chai';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {noteSittingRise, sittingRiseOwed, sittingRiseStood} from '../../src/client/console/parliament/sittingRise';

/*
 * A SITTING ON ITS WAY UP COVERS THE BOARD (the soft gates): the response that RAN the sitting is applied over the
 * board home, so the law's board story waits for the sitting's own world beat. Only that response says so — a first
 * view (a reload), a frame inside a standing sitting and a view of another generation say nothing.
 */
function view(generation: number, sitting?: {generation: number, step: string}): PlayerViewModel {
  return {
    game: {generation, parliament: sitting === undefined ? {} : {phase: {generation: sitting.generation, step: sitting.step, final: false}}},
    thisPlayer: {color: 'blue'},
  } as unknown as PlayerViewModel;
}

describe('sittingRise — the sitting on its way up covers the board', () => {
  afterEach(() => sittingRiseStood());

  it('the response that ran the sitting (no sitting before, the viewer\'s after) covers the board until it stands', () => {
    noteSittingRise(view(1), view(2, {generation: 1, step: 'done'}));
    expect(sittingRiseOwed()).to.be.true;
    sittingRiseStood();
    expect(sittingRiseOwed()).to.be.false;
  });

  it('a first view (a reload) owes nothing', () => {
    noteSittingRise(undefined, view(2, {generation: 1, step: 'done'}));
    expect(sittingRiseOwed()).to.be.false;
  });

  it('a frame inside a sitting that already stands owes nothing (the sitting is on screen)', () => {
    noteSittingRise(view(1, {generation: 1, step: 'effects'}), view(2, {generation: 1, step: 'done'}));
    expect(sittingRiseOwed()).to.be.false;
  });

  it('a view of another generation is no baseline — nothing is owed', () => {
    noteSittingRise(view(3), view(3, {generation: 2, step: 'done'}));
    expect(sittingRiseOwed()).to.be.false;
  });

  it('a response with no sitting owes nothing', () => {
    noteSittingRise(view(1), view(1));
    expect(sittingRiseOwed()).to.be.false;
  });
});
