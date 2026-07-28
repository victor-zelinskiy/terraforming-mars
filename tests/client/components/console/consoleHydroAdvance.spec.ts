import {expect} from 'chai';
import {hydroAdvanceResponses} from '@/client/console/consoleHydroAdvance';
import {CardName} from '@/common/cards/CardName';

const ACTIVATE = {type: 'or', index: 3, response: {type: 'option'}};

/**
 * The console «Укрепить гидросеть» batch. The stage-7 COMPOSED repeat must
 * append the ProjInsp/Viron-parity tail (`[{card:[chosen]}, ...composed]`);
 * a STALE composition (the plan's card moved on) must degrade to the bare
 * card pick — the follow-ups then arrive as native sequential tasks.
 */
describe('hydroAdvanceResponses (console advance batch)', () => {
  it('a bare advance → activate + the deltaProject amount', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 2, rewardChoice: undefined})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 2},
    ]);
  });

  it('a CHOICE stage (pos 1/2) appends the OR pick', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 1, rewardChoice: 1})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });

  it('a card-pick stage WITHOUT a composition (pos 9 / bare pos 7) appends the card pick only', () => {
    expect(hydroAdvanceResponses(ACTIVATE, {spend: 3, rewardChoice: undefined, selectedCard: CardName.PETS})).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 3},
      {type: 'card', cards: [CardName.PETS]},
    ]);
  });

  it('the COMPOSED stage-7 repeat appends the byte-parity tail (card pick + branch slot + steps)', () => {
    const stepResp = {type: 'player', player: 'red'};
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      selectedCard: CardName.SEARCH_FOR_LIFE,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: 2, preResponses: [{type: 'and'}], optionResponse: undefined, stepResponses: [stepResp]},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
      {type: 'card', cards: [CardName.SEARCH_FOR_LIFE]},
      {type: 'and'},
      {type: 'or', index: 2, response: {type: 'option'}},
      stepResp,
    ]);
  });

  it('a STALE composition (chosenCard ≠ the plan card) degrades to the bare card pick', () => {
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
      selectedCard: CardName.PETS,
      repeat: {
        chosenCard: CardName.SEARCH_FOR_LIFE,
        nodeIndex: 0,
        composed: {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []},
      },
    });
    expect(out).to.deep.equal([
      ACTIVATE,
      {type: 'deltaProject', amount: 1},
      {type: 'card', cards: [CardName.PETS]},
    ]);
  });

  it('a composition with NO selected card sends no tail at all (the reward fizzled)', () => {
    const out = hydroAdvanceResponses(ACTIVATE, {
      spend: 1,
      rewardChoice: undefined,
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
});
