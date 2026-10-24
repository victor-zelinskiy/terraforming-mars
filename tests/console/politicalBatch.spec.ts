import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Payment} from '../../src/common/inputs/Payment';
import {buildPoliticalBatch} from '../../src/client/console/politicalBatch';
import type {ConsolePlayPickResult} from '../../src/client/console/consolePlayPick';

/*
 * THE WIRE FORM OF A POLITICAL COMMIT (Turmoil Redux «один фреймворк»): the card composer answers a party's / the
 * enacted law's action as the action menu's own option — the forms the party composer sent, byte for byte (its specs'
 * wire assertions, carried over when it was deleted): the bare option, the copied action's pick with its own answers
 * behind it (R&D Funding RX26), the law's play addressed to the law with the card's answers behind it (RX36).
 */
const LAW = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';
const NOTHING_COMPOSED = {branchIndex: -1, preResponses: [], optionResponse: undefined, stepResponses: []};

function composedPlay(over: Partial<ConsolePlayPickResult> = {}): ConsolePlayPickResult {
  return {
    cardName: CardName.GRASS,
    payment: Payment.of({megacredits: 11}),
    branchIndex: -1,
    preResponses: [],
    optionResponse: undefined,
    stepResponses: [],
    cost: 11,
    scene: {},
    ...over,
  };
}

describe('buildPoliticalBatch (the one batch of a political commit)', () => {
  it('a bare commit answers the menu option', () => {
    expect(buildPoliticalBatch({menuIndex: 3, answer: 'option', branchIndex: -1, optionResponse: undefined, stepResponses: []}))
      .to.deep.eq([{type: 'or', index: 3, response: {type: 'option'}}]);
  });

  it('a COPIED action (R&D Funding): the pick inside the menu branch — a lone answer stays one response', () => {
    expect(buildPoliticalBatch({
      menuIndex: 0, answer: 'direct', branchIndex: -1, optionResponse: undefined, stepResponses: [],
      repeat: {chosenCard: CardName.TARDIGRADES, composed: NOTHING_COMPOSED},
    })).to.deep.eq([{type: 'or', index: 0, response: {type: 'card', cards: [CardName.TARDIGRADES]}}]);
  });

  it('…and the copied action\'s own composed answers ride behind it, as a BATCH', () => {
    expect(buildPoliticalBatch({
      menuIndex: 0, answer: 'direct', branchIndex: -1, optionResponse: undefined, stepResponses: [],
      repeat: {chosenCard: CardName.REGOLITH_EATERS, composed: {branchIndex: 1, preResponses: [], optionResponse: undefined, stepResponses: []}},
    })).to.deep.eq([
      {type: 'or', index: 0, response: {type: 'card', cards: [CardName.REGOLITH_EATERS]}},
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });

  it('a LAW\'S PLAY (Live Experiments): the menu option, the card ADDRESSED to the law, then the card\'s own answers', () => {
    expect(buildPoliticalBatch({
      menuIndex: 0, answer: 'option', branchIndex: -1, optionResponse: undefined, stepResponses: [],
      lawPlay: {resolution: LAW, play: composedPlay({stepResponses: [{type: 'card', cards: [CardName.TARDIGRADES]}]})},
    })).to.deep.eq([
      {type: 'or', index: 0, response: {type: 'option'}},
      {type: 'projectCard', card: CardName.GRASS, payment: Payment.of({megacredits: 11}), for: {source: {kind: 'resolution', resolution: LAW}, role: 'projectCard'}},
      {type: 'card', cards: [CardName.TARDIGRADES]},
    ]);
  });

  it('…the bill\'s payment (a step of the branch) stands BEFORE the card — the server asks the bill first', () => {
    const pay = {type: 'payment', payment: Payment.of({megacredits: 6})};
    const batch = buildPoliticalBatch({
      menuIndex: 0, answer: 'option', branchIndex: -1, optionResponse: undefined, stepResponses: [pay],
      lawPlay: {resolution: LAW, play: composedPlay()},
    }) as Array<{type: string}>;
    expect(batch.map((r) => r.type)).to.deep.eq(['or', 'payment', 'projectCard']);
  });

  it('a composed REPEAT rides the law\'s batch behind the play (Project Inspection through the law)', () => {
    const batch = buildPoliticalBatch({
      menuIndex: 0, answer: 'option', branchIndex: -1, optionResponse: undefined, stepResponses: [],
      lawPlay: {resolution: LAW, play: composedPlay({composed: {repeat: {chosenCard: CardName.TARDIGRADES, nodeIndex: 0, composed: NOTHING_COMPOSED}}})},
    }) as Array<{type: string, cards?: ReadonlyArray<string>}>;
    expect(batch.some((r) => r.type === 'card' && r.cards?.[0] === CardName.TARDIGRADES), 'the repeat\'s pick rides the batch').to.be.true;
  });

  it('a direct prompt with no answer builds nothing (the gate never lets it through)', () => {
    expect(buildPoliticalBatch({menuIndex: 0, answer: 'direct', branchIndex: -1, optionResponse: undefined, stepResponses: []})).to.deep.eq([]);
  });
});
