import {expect} from 'chai';
import {
  deltaRewardClaimPlan, deltaRewardDraftOf, deltaRewardStepResponse,
} from '@/client/console/hydroFlow/deltaRewardEntry';
import {CardName} from '@/common/cards/CardName';

/**
 * THE STAGE-REWARD PICK's wire + claim derivations (Dutch Mountains). The
 * response is the composer step's ONE capture; the claim plan is structural
 * off the track configuration — a draw stage promises its keep-pick batch, a
 * plain stage promises nothing.
 */
describe('deltaRewardEntry', () => {
  it('a plain stage claim is position-only — no answer rides along', () => {
    expect(deltaRewardStepResponse({position: 3})).to.deep.equal(
      {type: 'deltaStageReward', position: 3});
  });

  it('a choice stage claim carries the picked alternative', () => {
    expect(deltaRewardStepResponse({position: 2, rewardChoice: 1})).to.deep.equal(
      {type: 'deltaStageReward', position: 2, answer: {position: 2, rewardChoice: 1}});
  });

  it('a target stage claim carries the picked card', () => {
    expect(deltaRewardStepResponse({position: 9, selectedCard: CardName.BIRDS})).to.deep.equal(
      {type: 'deltaStageReward', position: 9, answer: {position: 9, selectedCard: CardName.BIRDS}});
  });

  it('a composed repeat claim carries the action AND its own responses', () => {
    const step = {type: 'card', cards: [CardName.BIRDS]};
    const out = deltaRewardStepResponse({
      position: 7,
      selectedCard: CardName.BIOENGINEERING_ENCLOSURE,
      repeat: {
        chosenCard: CardName.BIOENGINEERING_ENCLOSURE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: [step]},
      },
    });
    expect(out).to.deep.equal({
      type: 'deltaStageReward', position: 7,
      answer: {position: 7, selectedCard: CardName.BIOENGINEERING_ENCLOSURE, repeatResponses: [step]},
    });
  });

  it('a STALE composition (chosenCard ≠ the drafted card) degrades to the bare card answer', () => {
    const out = deltaRewardStepResponse({
      position: 7,
      selectedCard: CardName.VIRON,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    expect(out).to.deep.equal({
      type: 'deltaStageReward', position: 7,
      answer: {position: 7, selectedCard: CardName.VIRON},
    });
  });

  it('the captured response reads back as the summary draft (the capture is the one truth)', () => {
    const resp = deltaRewardStepResponse({position: 9, selectedCard: CardName.BIRDS});
    expect(deltaRewardDraftOf(resp)).to.deep.equal(
      {position: 9, rewardChoice: undefined, selectedCard: CardName.BIRDS});
    expect(deltaRewardDraftOf({type: 'card', cards: []})).to.eq(undefined);
    expect(deltaRewardDraftOf(undefined)).to.eq(undefined);
  });

  describe('the claim plan (structural, off the track configuration)', () => {
    it('the draw stage promises its keep-pick batch', () => {
      expect(deltaRewardClaimPlan({position: 5})).to.deep.equal(
        {kinds: ['draw', 'pick'], expectedCards: 4, scope: 'card'});
    });

    it('a plain or choice stage promises nothing', () => {
      expect(deltaRewardClaimPlan({position: 3})).to.eq(undefined);
      expect(deltaRewardClaimPlan({position: 2, rewardChoice: 0})).to.eq(undefined);
    });

    it('a target stage promises nothing (the resource flight is the presentation)', () => {
      expect(deltaRewardClaimPlan({position: 9, selectedCard: CardName.BIRDS})).to.eq(undefined);
    });

    it('a repeat with no composition promises nothing (its follow-ups arrive as native tasks)', () => {
      expect(deltaRewardClaimPlan({position: 7, selectedCard: CardName.VIRON})).to.eq(undefined);
    });
  });
});
