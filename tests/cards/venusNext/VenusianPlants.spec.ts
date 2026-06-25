import {expect} from 'chai';
import {setVenusScaleLevel} from '../../TestingUtils';
import {Thermophiles} from '../../../src/server/cards/venusNext/Thermophiles';
import {VenusianAnimals} from '../../../src/server/cards/venusNext/VenusianAnimals';
import {VenusianPlants} from '../../../src/server/cards/venusNext/VenusianPlants';
import {IGame} from '../../../src/server/IGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {cast} from '@/common/utils/utils';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';

describe('VenusianPlants', () => {
  let card: VenusianPlants;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new VenusianPlants();
    [game, player] = testGame(2);
  });

  it('Can not play', () => {
    setVenusScaleLevel(game, 14);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Should play - multiple targets', () => {
    setVenusScaleLevel(game, 16);
    expect(card.canPlay(player)).is.true;

    const card2 = new Thermophiles();
    const card3 = new VenusianAnimals();
    player.playedCards.push(card2, card3);

    const action = cast(card.play(player), SelectCard);
    action.cb([card2]);

    expect(card2.resourceCount).to.eq(1);
    expect(game.getVenusScaleLevel()).to.eq(18);
  });

  it('Should play - single target', () => {
    const card2 = new Thermophiles();
    player.playedCards.push(card2);
    setVenusScaleLevel(game, 16);

    // Always asks which card, even with a single Venus target.
    const action = cast(card.play(player), SelectCard);
    expect(action.cards).has.lengthOf(1);
    action.cb([card2]);
    expect(card2.resourceCount).to.eq(1);
    expect(game.getVenusScaleLevel()).to.eq(18);
  });

  it('Should play - no target (microbe/animal silently dropped)', () => {
    setVenusScaleLevel(game, 16);
    // No Venus card can hold a microbe/animal → bespokePlay adds nothing; the card
    // is still played for Venus +1 (raised by the declarative behavior on play()).
    cast(card.play(player), undefined);
  });

  it('cardPlayPreview: no eligible Venus card → a WARNING step (no silent loss)', () => {
    setVenusScaleLevel(game, 16);
    const branch = cardPlayPreview(player, card).branches[0];
    // The microbe/animal would be lost — the modal warns instead of staying mute.
    expect(branch.steps).has.length(1);
    expect(branch.steps[0].kind).eq('note');
    expect((branch.steps[0] as {noteKind?: string}).noteKind).eq('warning');
    // The Venus parameter chip still describes the on-play impact.
    expect(branch.effects.some((e) => e.icon === 'venus')).is.true;
  });

  it('cardPlayPreview: with an eligible Venus card → a target picker (no warning)', () => {
    setVenusScaleLevel(game, 16);
    player.playedCards.push(new VenusianAnimals()); // holds animals, Venus tag
    const branch = cardPlayPreview(player, card).branches[0];
    expect(branch.steps.some((s) => s.kind === 'input' && s.input.type === 'card')).is.true;
    expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning')).is.false;
  });
});
