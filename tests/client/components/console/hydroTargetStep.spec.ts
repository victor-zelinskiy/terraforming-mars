import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {buildHydroTargetModel, hydroPresentedTargetModel} from '@/client/console/hydroFlow/hydroTargetStep';

function card(name: CardName, resources = 0): CardModel {
  return {name, resources} as CardModel;
}

const PLAYERS = [
  {name: 'Viewer', color: 'blue', tableau: [{name: CardName.BIRDS}, {name: CardName.FISH}, {name: CardName.PETS}]},
  {name: 'Rival', color: 'red', tableau: [{name: CardName.LIVESTOCK}]},
];

describe('hydroTargetStep', () => {
  it('builds the shared selector model off the SERVER eligibility list', () => {
    const model = buildHydroTargetModel({
      eligible: [CardName.BIRDS, CardName.FISH],
      tableau: [card(CardName.BIRDS, 3), card(CardName.FISH, 0), card(CardName.PETS, 5)],
      players: PLAYERS,
      viewerColor: 'blue',
      ask: 'Choose a card to receive the animals',
      typeOf: () => CardType.ACTIVE,
    });
    expect(model.contract.targetCount).eq(2);
    expect(model.contract.ask).eq('Choose a card to receive the animals');
    // The viewer's own tableau is the only owner group here.
    expect(model.owners).lengthOf(1);
    expect(model.owners[0].self).eq(true);
    expect(model.owners[0].candidates.map((c) => c.cardName)).deep.eq([CardName.BIRDS, CardName.FISH]);
  });

  it('every candidate answers «сейчас → станет» with the honest +2', () => {
    const model = buildHydroTargetModel({
      eligible: [CardName.BIRDS, CardName.FISH],
      tableau: [card(CardName.BIRDS, 3), card(CardName.FISH, 0)],
      players: PLAYERS,
      viewerColor: 'blue',
      ask: 'ask',
      typeOf: () => CardType.ACTIVE,
    });
    const birds = model.owners[0].candidates.find((c) => c.cardName === CardName.BIRDS);
    const fish = model.owners[0].candidates.find((c) => c.cardName === CardName.FISH);
    expect(birds?.preview[0]?.impacts[0]).to.include({from: 3, to: 5, icon: 'animal'});
    // ZERO included: an empty legal target still answers «сколько там сейчас».
    expect(fish?.preview[0]?.impacts[0]).to.include({from: 0, to: 2});
  });

  it('an eligible name missing from the live tableau is dropped, never invented', () => {
    const model = buildHydroTargetModel({
      eligible: [CardName.BIRDS, CardName.LIVESTOCK],
      tableau: [card(CardName.BIRDS, 1)],
      players: PLAYERS,
      viewerColor: 'blue',
      ask: 'ask',
      typeOf: () => CardType.ACTIVE,
    });
    expect(model.owners[0].candidates.map((c) => c.cardName)).deep.eq([CardName.BIRDS]);
  });

  it('the presented model freezes the pre-commit count and ticks per touchdown', () => {
    const live = card(CardName.BIRDS, 9); // the server already committed +2
    expect(hydroPresentedTargetModel(CardName.BIRDS, 7, live, 0).resources,
      'frozen at the before value until anything lands').eq(7);
    expect(hydroPresentedTargetModel(CardName.BIRDS, 7, live, 1).resources).eq(8);
    expect(hydroPresentedTargetModel(CardName.BIRDS, 7, live, 2).resources).eq(9);
    // The tally can never overshoot the granted amount.
    expect(hydroPresentedTargetModel(CardName.BIRDS, 7, live, 5).resources).eq(9);
    // A missing live model still presents the honest baseline.
    expect(hydroPresentedTargetModel(CardName.BIRDS, 7, undefined, 0).resources).eq(7);
  });
});
