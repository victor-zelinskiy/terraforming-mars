import {expect} from 'chai';
import {awaitingViewerInput, offTurnReason, NOT_YOUR_TURN, FINISH_CURRENT_ACTION} from '@/client/console/offTurnReason';
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
});
