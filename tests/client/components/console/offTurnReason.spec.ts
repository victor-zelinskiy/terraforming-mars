import {expect} from 'chai';
import {awaitingViewerInput, handPlayWindowClosed, offTurnReason, viewerHasPassed, NOT_YOUR_TURN, FINISH_CURRENT_ACTION, PASSED_THIS_GENERATION} from '@/client/console/offTurnReason';
import {PlayerViewModel} from '@/common/models/PlayerModel';

// The ONE shared off-turn reason contract every console surface funnels through
// (the turn menu / LT wheel / std projects / milestones-awards / colony trade /
// hand block). PURE — runs under the server runner.
describe('offTurnReason (console off-turn reason contract)', () => {
  it('awaitingViewerInput: the viewer\'s own waitingFor being set IS "the server awaits me"', () => {
    expect(awaitingViewerInput({waitingFor: {type: 'or'}} as unknown as PlayerViewModel)).to.be.true;
    expect(awaitingViewerInput({waitingFor: undefined} as unknown as PlayerViewModel)).to.be.false;
  });

  it('mid a mandatory decision (awaiting) → «finish your current action first»', () => {
    expect(offTurnReason(true)).to.eq(FINISH_CURRENT_ACTION);
    expect(FINISH_CURRENT_ACTION).to.eq('Finish your current action first');
  });

  it('genuine opponent turn (not awaiting) → «not your turn»', () => {
    expect(offTurnReason(false)).to.eq(NOT_YOUR_TURN);
    expect(NOT_YOUR_TURN).to.eq('Not your turn to take any actions');
  });

  it('a seat that PASSED this generation (the pass, or a play that counts as one — P80) is told so, never «not your turn»', () => {
    expect(offTurnReason(false, true)).to.eq(PASSED_THIS_GENERATION);
    expect(PASSED_THIS_GENERATION).to.eq('You have passed this generation');
    expect(offTurnReason(false, false)).to.eq(NOT_YOUR_TURN);
    // A prompt owed to the viewer outranks the pass (a later phase's question): finish it first.
    expect(offTurnReason(true, true)).to.eq(FINISH_CURRENT_ACTION);
  });

  it('viewerHasPassed reads the server\'s own list of passed seats', () => {
    const view = (passed: ReadonlyArray<string>) => ({thisPlayer: {color: 'red'}, game: {passedPlayers: passed}}) as unknown as PlayerViewModel;
    expect(viewerHasPassed(view(['red']))).to.be.true;
    expect(viewerHasPassed(view(['blue']))).to.be.false;
    expect(viewerHasPassed(view([]))).to.be.false;
  });

  describe('handPlayWindowClosed — when the turn note joins a hand card\'s own reasons', () => {
    it('the action menu standing IS the open window, even when the server offers no play (nothing in hand is playable)', () => {
      expect(handPlayWindowClosed({playOffered: false, atActionMenu: true, actionBlocked: false})).to.be.false;
      expect(handPlayWindowClosed({playOffered: true, atActionMenu: true, actionBlocked: false})).to.be.false;
    });

    it('no play offered away from the menu (an opponent\'s turn, a mandatory sub-prompt): closed', () => {
      expect(handPlayWindowClosed({playOffered: false, atActionMenu: false, actionBlocked: false})).to.be.true;
    });

    it('a top-level play-from-hand prompt is an open window', () => {
      expect(handPlayWindowClosed({playOffered: true, atActionMenu: false, actionBlocked: false})).to.be.false;
    });

    it('a decision already owed closes it whatever else stands', () => {
      expect(handPlayWindowClosed({playOffered: true, atActionMenu: true, actionBlocked: true})).to.be.true;
      expect(handPlayWindowClosed({playOffered: false, atActionMenu: true, actionBlocked: true})).to.be.true;
    });
  });
});
