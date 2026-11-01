import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {preselectedDiscardsOf} from '@/client/console/cardDiscard/preselectedDiscards';
import {
  abortCardDiscard, armCardDiscard, cardDiscardDeparted, cardDiscardTransaction, detectCardDiscard,
} from '@/client/console/cardDiscard/consoleCardDiscard';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/**
 * P86 — THE PLAY'S CARD PRICE (PL-1128, P68's door carried to the play composer). The pure half: which discards a
 * composer pre-selected (read off the step's SERVER marker, paired with its captured answer — ONE reader for the
 * action composer and the play composer), and the transaction's DEPARTURE signal the play's hero lifts on (the
 * fourth shipment of `shipPrice`: the packet has LEFT the dock — never its touchdown).
 */
describe('preselectedDiscards — the play\'s card price', () => {
  const discardStep = (cards: ReadonlyArray<CardName>): ActionPreviewStep => ({
    kind: 'input',
    input: {
      type: 'card', title: 'Select 1 card(s) to discard', buttonLabel: 'Discard', min: 1, max: 1,
      cards: cards.map((name) => ({name})),
      discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: CardName.UNEXPECTED_APPLICATION}},
    } as unknown as SelectCardModel,
  });
  const plainStep: ActionPreviewStep = {
    kind: 'input',
    input: {type: 'card', title: 'Choose a card', buttonLabel: 'Select', min: 1, max: 1, cards: [{name: CardName.BIRDS}]} as unknown as SelectCardModel,
  };

  it('a marked card step + its captured answer → one discard with the step\'s own marker', () => {
    const out = preselectedDiscardsOf([discardStep([CardName.TARDIGRADES, CardName.HOUSE_PRINTING])], {0: {type: 'card', cards: [CardName.TARDIGRADES]}});
    expect(out).has.length(1);
    expect(out[0].names).deep.eq([CardName.TARDIGRADES]);
    expect(out[0].meta.source).deep.eq({kind: 'card', card: CardName.UNEXPECTED_APPLICATION});
  });

  it('an UNMARKED card step is never a discard (a target pick stays a target pick)', () => {
    expect(preselectedDiscardsOf([plainStep], {0: {type: 'card', cards: [CardName.BIRDS]}})).deep.eq([]);
  });

  it('nothing answered, or an empty answer, arms nothing', () => {
    expect(preselectedDiscardsOf([discardStep([CardName.TARDIGRADES])], {})).deep.eq([]);
    expect(preselectedDiscardsOf([discardStep([CardName.TARDIGRADES])], {0: {type: 'card', cards: []}})).deep.eq([]);
  });

  it('the step index pairs each answer with ITS step (a plain pick beside the discard)', () => {
    const out = preselectedDiscardsOf([plainStep, discardStep([CardName.LICHEN])], {
      0: {type: 'card', cards: [CardName.BIRDS]},
      1: {type: 'card', cards: [CardName.LICHEN]},
    });
    expect(out.map((d) => d.names)).deep.eq([[CardName.LICHEN]]);
  });
});

describe('cardDiscardDeparted — the hero lifts on the packet\'s DEPARTURE', () => {
  afterEach(() => {
    abortCardDiscard();
  });

  it('no transaction: resolves at once (nothing to wait for)', async () => {
    await cardDiscardDeparted();
  });

  it('an armed, detected discard: pending until the scene ends; an abort releases the waiter (never a wedge)', async () => {
    armCardDiscard({names: [CardName.TARDIGRADES], sources: [], meta: undefined, fromDock: true});
    const view = {cardsInHand: []} as unknown as PlayerViewModel;
    expect(detectCardDiscard(view)?.names).deep.eq([CardName.TARDIGRADES]);
    let left = false;
    const departed = cardDiscardDeparted().then(() => {
      left = true;
    });
    await Promise.resolve();
    expect(left, 'still standing in the dock').is.false;
    expect(cardDiscardTransaction.active).is.true;
    abortCardDiscard();
    await departed;
    expect(left).is.true;
  });
});
