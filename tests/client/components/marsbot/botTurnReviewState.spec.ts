import {expect} from 'chai';
import {SpaceId} from '@/common/Types';
import {
  botTurnReviewState,
  setBotReviewPeek,
  resetBotTurnReview,
} from '@/client/components/marsbot/botTurnReviewState';

describe('botTurnReviewState — show-on-map peek', () => {
  afterEach(() => {
    // Also stops the persistent highlight pulse (via closeBotTurnReview).
    resetBotTurnReview();
  });

  it('setBotReviewPeek(true, spaceIds) enters peek over ALL referenced cells', () => {
    // Problem B: a turn that placed several tiles peeks EVERY one, not the first.
    const spaces: ReadonlyArray<SpaceId> = ['05', '07'];
    setBotReviewPeek(true, spaces);
    expect(botTurnReviewState.peek).to.be.true;
    expect([...botTurnReviewState.peekSpaceIds]).to.deep.equal(['05', '07']);
  });

  it('setBotReviewPeek(false) leaves peek and clears the cells', () => {
    setBotReviewPeek(true, ['05']);
    setBotReviewPeek(false);
    expect(botTurnReviewState.peek).to.be.false;
    expect(botTurnReviewState.peekSpaceIds).to.have.length(0);
  });

  it('an empty space list never enters peek', () => {
    setBotReviewPeek(true, []);
    expect(botTurnReviewState.peek).to.be.false;
    expect(botTurnReviewState.peekSpaceIds).to.have.length(0);
  });
});
