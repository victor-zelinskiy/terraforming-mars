import {expect} from 'chai';
import {hydroAdvanceResponses, hydroAdvanceTail, repeatComposedResponses} from '@/client/console/consoleHydroAdvance';
import {CardName} from '@/common/cards/CardName';

const ACTIVATE = {type: 'or', index: 3, response: {type: 'option'}};

/**
 * The console «Укрепить гидросеть» batch. Every stage-level pre-answer — the
 * reward choice, the repeated action (its composed nested responses included),
 * the animal target — rides the MOVE step's own `answers` field, consumed by
 * the server's reward resolution itself. The response stream past the move
 * step is EMPTY for the move-step doors: a positional stream had three silent
 * loss modes (parked behind the stage-5 hidden draw, wiped whole by one value
 * refusal, swallowed by the wrong stage's same-shaped prompt), each ending as
 * a re-asked question the player had already answered.
 */
describe('hydroAdvanceResponses (console advance batch)', () => {
  it('a bare advance → activate + the deltaProject amount (byte-identical historical shape)', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 2, rewardChoice: undefined})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 2},
    ]);
  });

  it('a CHOICE stage (pos 1/2) rides the move step as a positioned answer', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 1, rewardChoice: 1, toPosition: 2})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1, answers: [{position: 2, rewardChoice: 1}]},
    ]);
  });

  it('a card-pick stage WITHOUT a composition (pos 9 / bare pos 7) declares the card only', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {
      spend: 3, rewardChoice: undefined, selectedCard: CardName.PETS, toPosition: 9,
    })).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 3, answers: [{position: 9, selectedCard: CardName.PETS}]},
    ]);
  });

  it('the COMPOSED stage-7 repeat declares the card + its OWN responses (no root pick inside)', () => {
    const stepResp = {type: 'player', player: 'red'};
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      selectedCard: CardName.SEARCH_FOR_LIFE,
      toPosition: 7,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: 2, preResponses: [{type: 'and'}], optionResponse: undefined, stepResponses: [stepResp]},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1, answers: [{
        position: 7,
        selectedCard: CardName.SEARCH_FOR_LIFE,
        // The root pick is consumed FROM the answer itself; these are the
        // responses to the prompts the repeated action raises when it runs —
        // byte-identical to what follows the pick in a direct activation.
        repeatResponses: [
          {type: 'and'},
          {type: 'or', index: 2, response: {type: 'option'}},
          stepResp,
        ],
      }]},
    ]);
  });

  it('a STALE composition (chosenCard ≠ the plan card) degrades to the bare card answer', () => {
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      selectedCard: CardName.PETS,
      toPosition: 7,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1, answers: [{position: 7, selectedCard: CardName.PETS}]},
    ]);
  });

  it('a composition with NO selected card declares nothing at all (the reward fizzled)', () => {
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      toPosition: 7,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
    ]);
  });

  it('a DECLINED target reward rides the move step, never an answer', () => {
    // «Если не выбрал, значит не надо»: the player confirmed past the warning
    // with no pick, so the decision travels WITH the move — the server then
    // defers no SelectCard and nothing rises after the confirmed advance.
    expect(hydroAdvanceResponses(ACTIVATE, {
      spend: 1, rewardChoice: undefined, waiveTarget: true, toPosition: 7,
    })).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1, waiveReward: true},
    ]);
  });

  it('an ordinary batch is byte-identical to the historical shape', () => {
    // The keys EXIST only when meaningful — every other batch must keep the
    // exact bytes the server has always received.
    const plain = hydroAdvanceResponses(ACTIVATE, {spend: 2, rewardChoice: undefined});
    expect(Object.keys(plain[1] as object)).to.deep.equal(['type', 'amount']);
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 2, rewardChoice: undefined, waiveTarget: false}))
      .to.deep.equal(plain);
  });

  describe('a MULTI-REWARD traversal (Delta Surge)', () => {
    it('declares the ordered per-stage answers on the move step — path order preserved', () => {
      const batch = hydroAdvanceResponses(ACTIVATE, {
        spend: 4,
        rewardChoice: undefined,
        traversalAnswers: [
          {position: 1, rewardChoice: 0},
          {position: 2, rewardChoice: 1},
        ],
      });
      expect(batch).to.deep.equal([
        ACTIVATE,
        {type: 'deltaProject', amount: 4, answers: [
          {position: 1, rewardChoice: 0},
          {position: 2, rewardChoice: 1},
        ]},
      ]);
    });

    it('a crossed stage-7 composed repeat and a stage-9 pick ride as positioned answers', () => {
      const batch = hydroAdvanceResponses(ACTIVATE, {
        spend: 4,
        rewardChoice: undefined,
        traversalAnswers: [
          {position: 7, selectedCard: CardName.VIRON, repeat: {
            chosenCard: CardName.VIRON,
            nodeIndex: 0,
            composed: {branchIndex: 1, preResponses: [], optionResponse: undefined, stepResponses: []},
          }},
          {position: 9, selectedCard: CardName.BIRDS},
        ],
      });
      expect(batch).to.deep.equal([
        ACTIVATE,
        {type: 'deltaProject', amount: 4, answers: [
          {position: 7, selectedCard: CardName.VIRON, repeatResponses: [
            {type: 'or', index: 1, response: {type: 'option'}},
          ]},
          {position: 9, selectedCard: CardName.BIRDS},
        ]},
      ]);
    });

    it('per-position declines ride the MOVE step as waivedSteps', () => {
      const batch = hydroAdvanceResponses(ACTIVATE, {
        spend: 3,
        rewardChoice: undefined,
        traversalAnswers: [],
        waivedSteps: [7, 9],
      });
      expect(batch).to.deep.equal([
        ACTIVATE,
        {type: 'deltaProject', amount: 3, waivedSteps: [7, 9]},
      ]);
    });

    it('a stage-5 crossing contributes NOTHING (hidden information is asked at the stop)', () => {
      const batch = hydroAdvanceResponses(ACTIVATE, {
        spend: 3,
        rewardChoice: undefined,
        traversalAnswers: [{position: 6}, {position: 7, selectedCard: CardName.VIRON}],
      });
      expect(batch).to.deep.equal([
        ACTIVATE,
        {type: 'deltaProject', amount: 3, answers: [{position: 7, selectedCard: CardName.VIRON}]},
      ]);
    });
  });
});

/** The repeated action's own responses, WITHOUT the root pick — what rides
 *  `DeltaStageAnswer.repeatResponses` (an empty prefix over the one shared
 *  batch builder). */
describe('repeatComposedResponses', () => {
  it('emits pre-responses, the branch wrap and the steps — no card pick', () => {
    const stepResp = {type: 'card', cards: [CardName.PETS]};
    expect(repeatComposedResponses({
      branchIndex: 2, preResponses: [{type: 'and'}], optionResponse: undefined, stepResponses: [stepResp],
    })).to.deep.equal([
      {type: 'and'},
      {type: 'or', index: 2, response: {type: 'option'}},
      stepResp,
    ]);
  });

  it('a branchless single-step composition is just its steps', () => {
    const stepResp = {type: 'card', cards: [CardName.BIRDS]};
    expect(repeatComposedResponses({
      branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: [stepResp],
    })).to.deep.equal([stepResp]);
  });
});

/**
 * ══ THE PROMPT DOOR'S RESPONSE STREAM ═══════════════════════════════════
 *
 * A card-granted offer answers with a bare OrOptions index — there is no move
 * step to carry the invocation plan — and its single-step advance defers its
 * stage's asks inline, where the positional replay is unambiguous. This tail
 * is that door's whole pre-collection and keeps the historical shape.
 */
describe('hydroAdvanceTail (the bonus-offer door)', () => {
  it('carries nothing when the landed stage asks nothing', () => {
    expect(hydroAdvanceTail({spend: 2, rewardChoice: undefined})).to.deep.equal([]);
  });

  it('a CHOICE stage appends the OR pick', () => {
    expect(hydroAdvanceTail({spend: 1, rewardChoice: 1})).to.deep.equal([
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });

  it('carries the COMPOSED repeat tail, not a bare pick', () => {
    const tail = hydroAdvanceTail({
      spend: 0,
      rewardChoice: undefined,
      selectedCard: CardName.VIRON,
      repeat: {
        chosenCard: CardName.VIRON,
        nodeIndex: 0,
        composed: {branchIndex: 1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    // More than the bare `{card:[X]}`: the chosen action's own responses ride
    // along in defer order (ProjInsp/Viron parity).
    expect(tail).to.deep.equal([
      {type: 'card', cards: [CardName.VIRON]},
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });

  it('a STALE composition degrades to the bare card pick', () => {
    expect(hydroAdvanceTail({
      spend: 1,
      rewardChoice: undefined,
      selectedCard: CardName.PETS,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    })).to.deep.equal([
      {type: 'card', cards: [CardName.PETS]},
    ]);
  });
});
