import {expect} from 'chai';
import {SmallAnimals} from '../../../src/server/cards/base/SmallAnimals';
import {BioPrintingFacility} from '../../../src/server/cards/promo/BioPrintingFacility';
import {Fish} from '../../../src/server/cards/base/Fish';
import {testGame} from '../../TestGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Resource} from '../../../src/common/Resource';
import {TestPlayer} from '../../TestPlayer';
import {cast} from '@/common/utils/utils';

describe('BioPrintingFacility', () => {
  let card: BioPrintingFacility;
  let player: TestPlayer;

  beforeEach(() => {
    card = new BioPrintingFacility();
    [/* game */, player] = testGame(2);
    player.playedCards.push(card);
  });

  it('Should play', () => {
    cast(card.play(player), undefined);
  });


  it('Can not act', () => {
    player.energy = 1;
    expect(card.canAct(player)).is.not.true;
  });

  it('Can act', () => {
    player.energy = 3;
    expect(card.canAct(player));
  });

  it('Should act - single target', () => {
    const smallanimals = new SmallAnimals();
    player.playedCards.push(smallanimals);
    player.energy = 2;

    // The animal branch is now ALWAYS a SelectCard (even for one candidate) so the
    // player always picks WHERE the animal goes (matches the premium target picker).
    const action = cast(card.action(player), OrOptions);
    expect(action.options).has.lengthOf(2);

    action.options[0].cb([smallanimals]);
    expect(smallanimals.resourceCount).to.eq(1);

    action.options[1].cb();
    expect(player.plants).to.eq(2);
  });

  it('Should act - multiple targets', () => {
    const smallanimals = new SmallAnimals();
    const fish = new Fish();
    player.playedCards.push(smallanimals, fish);
    player.energy = 2;

    const action = cast(card.action(player), OrOptions);
    expect(action.options).has.lengthOf(2);

    action.options[0].cb([smallanimals]);
    expect(smallanimals.resourceCount).to.eq(1);

    action.options[0].cb([fish]);
    expect(fish.resourceCount).to.eq(1);
  });

  it('actionPreview: animal branch pre-collects the destination card; plants branch is simple', () => {
    const smallanimals = new SmallAnimals();
    player.playedCards.push(smallanimals);
    player.energy = 2;

    const preview = card.actionPreview(player);
    expect(preview.branches).has.lengthOf(2);
    // Branch 0 = add-animal (runtime OrOptions index 0), with the target card pre-
    // collected as its OrOptions `optionInput` (a SelectCard). Branch 1 = gain-plants.
    const animal = preview.branches[0];
    const plants = preview.branches[1];
    expect(animal.available).is.true;
    expect(animal.index).to.eq(0);
    expect(animal.optionInput?.type).to.eq('card');
    // The single animal card is offered (no-autoselect: shown even for one candidate).
    expect((animal.optionInput as {cards: ReadonlyArray<{name: string}>}).cards.map((c) => c.name))
      .to.deep.eq([smallanimals.name]);
    expect(plants.available).is.true;
    expect(plants.index).to.eq(1);
    expect(plants.optionInput).is.undefined;
    // Both branches spend 2 energy; only the animal branch adds a card resource.
    expect(animal.effects.some((e) => e.icon === 'animal' && e.note === 'to a card')).is.true;
    expect(plants.effects.some((e) => e.icon === Resource.PLANTS && e.direction === 'gain')).is.true;
  });

  it('actionPreview: with NO animal card the animal branch is disabled with a reason', () => {
    player.energy = 2;
    const preview = card.actionPreview(player);
    const animal = preview.branches[0];
    expect(animal.available).is.false;
    expect(animal.unavailableReason).to.eq('No card to add an animal to');
    // Only the plants branch is available → it auto-resolves (no branch pick).
    expect(preview.branches[1].available).is.true;
    expect(preview.branches[1].index).to.eq(-1);
  });
});
