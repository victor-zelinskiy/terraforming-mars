import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import type {DeltaAdvanceOffer} from '@/common/models/DeltaBonusPromptModel';
import {
  beginCardDeltaAdvance, cardDeltaAdvanceCard, cardDeltaAdvanceOffer,
  clearCardDeltaAdvance, deltaAdvanceEntryState, deltaAdvancePrefix,
  deltaAdvancePlanDraftOf, deltaAdvancePlanResponse,
} from '@/client/console/hydroFlow/deltaAdvanceEntry';
import {hydroAdvanceBatch, hydroAdvanceResponses} from '@/client/console/consoleHydroAdvance';
import {hydroAdvanceCopy, hydroBonusCopy} from '@/client/console/hydroFlow/hydroBonusOffer';

function offer(overrides: Partial<DeltaAdvanceOffer> = {}): DeltaAdvanceOffer {
  return {
    source: CardName.STORM_SURGE_BARRIER,
    steps: 1,
    fromPosition: 2,
    toPosition: 3,
    energyCost: 1,
    waivesTag: false,
    ...overrides,
  };
}

describe('the card-entry Hydronetwork move (Storm Surge Barrier)', () => {
  afterEach(() => {
    // Module state is BUNDLE-SHARED — a lock left standing would make every
    // later spec believe the track is serving a card.
    clearCardDeltaAdvance();
  });

  describe('the entry lock', () => {
    it('is empty until a card opens the door', () => {
      expect(cardDeltaAdvanceCard()).to.eq('');
      expect(cardDeltaAdvanceOffer()).is.undefined;
    });

    it('carries the card, its branch index and the SERVER offer', () => {
      beginCardDeltaAdvance(CardName.STORM_SURGE_BARRIER, 1, offer());
      expect(cardDeltaAdvanceCard()).to.eq(CardName.STORM_SURGE_BARRIER);
      expect(deltaAdvanceEntryState.branchIndex).to.eq(1);
      expect(cardDeltaAdvanceOffer()).to.deep.eq(offer());
    });

    it('is fully released — a stale offer can never outlive its card', () => {
      beginCardDeltaAdvance(CardName.STORM_SURGE_BARRIER, 1, offer());
      clearCardDeltaAdvance();
      expect(cardDeltaAdvanceCard()).to.eq('');
      expect(cardDeltaAdvanceOffer()).is.undefined;
      expect(deltaAdvanceEntryState.branchIndex).to.eq(-1);
    });
  });

  describe('the batch prefix', () => {
    it('wraps the activate pick through the live action-menu path', () => {
      expect(deltaAdvancePrefix([3], CardName.STORM_SURGE_BARRIER, 1)).to.deep.eq([
        {type: 'or', index: 3, response: {type: 'card', cards: [CardName.STORM_SURGE_BARRIER]}},
        {type: 'or', index: 1, response: {type: 'option'}},
      ]);
    });

    it('nests every layer of a deeper path, innermost first', () => {
      expect(deltaAdvancePrefix([2, 5], CardName.STORM_SURGE_BARRIER, 0)).to.deep.eq([
        {type: 'or', index: 2, response: {
          type: 'or', index: 5, response: {type: 'card', cards: [CardName.STORM_SURGE_BARRIER]},
        }},
        {type: 'or', index: 0, response: {type: 'option'}},
      ]);
    });

    it('emits NO branch wrapper when the server collapsed the lone variant', () => {
      expect(deltaAdvancePrefix([3], CardName.STORM_SURGE_BARRIER, -1)).to.deep.eq([
        {type: 'or', index: 3, response: {type: 'card', cards: [CardName.STORM_SURGE_BARRIER]}},
      ]);
    });
  });

  describe('the commit batch', () => {
    const prefix = () => deltaAdvancePrefix([3], CardName.STORM_SURGE_BARRIER, 1);

    it('is the prefix, the step, and NOTHING else on a plain stage', () => {
      expect(hydroAdvanceBatch(prefix(), 1, {spend: 1, rewardChoice: undefined})).to.deep.eq([
        ...prefix(),
        {type: 'deltaProject', amount: 1},
      ]);
    });

    it('mounts the landed stage reward choice on the MOVE step (the invocation plan)', () => {
      // Nothing stage-level rides the response stream any more — the plan is
      // `answers` on the `{deltaProject}` step, consumed by the server's own
      // reward resolution (the positional stream had three silent-loss modes).
      expect(hydroAdvanceBatch(prefix(), 1, {spend: 1, rewardChoice: 1, toPosition: 3})).to.deep.eq([
        ...prefix(),
        {type: 'deltaProject', amount: 1, answers: [{position: 3, rewardChoice: 1}]},
      ]);
    });

    it('mounts the landed stage card pick on the MOVE step', () => {
      expect(hydroAdvanceBatch(prefix(), 1, {
        spend: 1, rewardChoice: undefined, selectedCard: CardName.SEARCH_FOR_LIFE, toPosition: 3,
      })).to.deep.eq([
        ...prefix(),
        {type: 'deltaProject', amount: 1, answers: [{position: 3, selectedCard: CardName.SEARCH_FOR_LIFE}]},
      ]);
    });

    it('degrades HONESTLY without a landing address: no plan, so the server re-asks', () => {
      // A single-landing answer needs `toPosition` to become a plan entry —
      // without it the move goes out bare and the stage's own prompt returns.
      // A dropped answer costs one extra question, never the reward.
      expect(hydroAdvanceBatch(prefix(), 1, {spend: 1, rewardChoice: 1})).to.deep.eq([
        ...prefix(),
        {type: 'deltaProject', amount: 1},
      ]);
    });

    it('is the SAME assembler the player own advance uses', () => {
      // The two ways onto the track differ ONLY in how the move is authorised;
      // from the `{deltaProject, amount}` step on they are the same server code,
      // so they must be the same bytes.
      const activate = {type: 'or', index: 4, response: {type: 'option'}};
      const payload = {spend: 2, rewardChoice: 0, selectedCard: CardName.SEARCH_FOR_LIFE};
      expect(hydroAdvanceResponses(activate, payload))
        .to.deep.eq(hydroAdvanceBatch([activate], payload.spend, payload));
    });

    it('keeps the track DISTANCE and the price as separate quantities', () => {
      // A card charges its own whole-move toll, never the standard per-step
      // price — so the step count is passed explicitly, never read off `spend`.
      const batch = hydroAdvanceBatch(prefix(), 1, {spend: 5, rewardChoice: undefined});
      expect(batch[batch.length - 1]).to.deep.eq({type: 'deltaProject', amount: 1});
    });
  });

  describe('the plan\'s own answer (a repeat plan\'s landing pre-select)', () => {
    it('folds a reward CHOICE into the move step\'s invocation plan', () => {
      expect(deltaAdvancePlanResponse(offer(), {position: 3, rewardChoice: 1})).to.deep.eq(
        {type: 'deltaProject', amount: 1, answers: [{position: 3, rewardChoice: 1}]});
    });

    it('folds a picked TARGET card the same way', () => {
      expect(deltaAdvancePlanResponse(offer(), {position: 3, selectedCard: CardName.PETS})).to.deep.eq(
        {type: 'deltaProject', amount: 1, answers: [{position: 3, selectedCard: CardName.PETS}]});
    });

    it('the answer\'s position is the OFFER\'s destination, never the draft\'s', () => {
      // The draft is the pick surface's record; the wire address is the move.
      const r = deltaAdvancePlanResponse(offer({toPosition: 5}), {position: 3, rewardChoice: 0});
      expect(r?.answers?.[0].position).to.eq(5);
    });

    it('an unanswered draft resolves to NOTHING — never an empty answer on the wire', () => {
      expect(deltaAdvancePlanResponse(offer(), {position: 3})).is.undefined;
    });

    it('reads the capture back as the draft (one source of truth for the row + re-open)', () => {
      const response = deltaAdvancePlanResponse(offer(), {position: 3, rewardChoice: 1});
      expect(deltaAdvancePlanDraftOf(response)).to.deep.eq(
        {position: 3, rewardChoice: 1, selectedCard: undefined});
      expect(deltaAdvancePlanDraftOf(undefined)).is.undefined;
      expect(deltaAdvancePlanDraftOf({type: 'deltaProject', amount: 1})).is.undefined;
    });
  });

  describe('the working-zone copy', () => {
    it('names the source card and states that the generation own advance survives', () => {
      const copy = hydroAdvanceCopy(offer(), 'card-entry');
      expect(copy.bodyParams).to.deep.eq([CardName.STORM_SURGE_BARRIER]);
      expect(copy.bodyKey).to.contain('${0}');
      expect(copy.bodyKey).to.contain('1 energy');
      expect(copy.bodyKey).to.contain('Your usual advance this generation stays available.');
    });

    it('offers NO refusal — B is the way out of a move nobody demanded', () => {
      expect(hydroAdvanceCopy(offer(), 'card-entry').skipKey).to.eq('');
      expect(hydroAdvanceCopy(offer(), 'prompt').skipKey).to.eq('Skip');
    });

    it('carries NO confirm verb at all — the primary is the decision\'s, one vocabulary for every door', () => {
      // The parity law: the copy explains the source; the CTA is named by
      // `hydroNextInteraction` («Выберите награду» / «Укрепить гидросеть»)
      // identically for the player's own advance and for every card door.
      expect('confirmKey' in (hydroAdvanceCopy(offer(), 'card-entry') as object)).to.eq(false);
      expect('confirmKey' in (hydroAdvanceCopy(offer(), 'prompt') as object)).to.eq(false);
    });

    it('hands ONE WORD up to the crumb, and not the root noun', () => {
      // The SUBDIVISION, never the act: «ДЕЙСТВИЯ КАРТ › <карта> › ГИДРОСЕТЬ».
      const stage = hydroAdvanceCopy(offer(), 'card-entry').stageKey;
      expect(stage).to.eq('Hydronetwork');
      expect(stage.split(' ')).to.have.length(1);
    });

    it('leaves the standing-prompt shape untouched', () => {
      const meta = {...offer({source: CardName.DYNAMIC_OCEAN_BARRIER, energyCost: 0}), advanceIndex: 0, skipIndex: 1};
      expect(hydroBonusCopy(meta)).to.deep.eq(hydroAdvanceCopy(meta, 'prompt'));
      expect(hydroBonusCopy(meta).stageKey).to.eq('BONUS STEP');
    });
  });
});
