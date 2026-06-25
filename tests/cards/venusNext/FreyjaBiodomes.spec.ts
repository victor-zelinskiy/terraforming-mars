import {expect} from 'chai';
import {ICard} from '../../../src/server/cards/ICard';
import {Extremophiles} from '../../../src/server/cards/venusNext/Extremophiles';
import {FreyjaBiodomes} from '../../../src/server/cards/venusNext/FreyjaBiodomes';
import {VenusianAnimals} from '../../../src/server/cards/venusNext/VenusianAnimals';
import {IGame} from '../../../src/server/IGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {Resource} from '../../../src/common/Resource';
import {TestPlayer} from '../../TestPlayer';
import {setVenusScaleLevel} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {cast} from '@/common/utils/utils';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';

describe('FreyjaBiodomes', () => {
  let card: FreyjaBiodomes;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new FreyjaBiodomes();
    [game, player] = testGame(2);
  });

  it('Can not play without energy production', () => {
    setVenusScaleLevel(game, 10);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Can not play if Venus requirement not met', () => {
    player.production.add(Resource.ENERGY, 1);
    setVenusScaleLevel(game, 8);
    expect(card.canPlay(player)).is.not.true;
  });

  it('Should play - single target', () => {
    const card2 = new Extremophiles();
    player.playedCards.push(card2);

    player.production.add(Resource.ENERGY, 1);
    setVenusScaleLevel(game, 10);
    expect(card.canPlay(player)).is.true;

    // Always asks which card, even with a single Venus target.
    const action = cast(card.play(player), SelectCard<ICard>);
    expect(action.cards).has.lengthOf(1);
    action.cb([card2]);
    expect(player.production.energy).to.eq(0);
    expect(player.production.megacredits).to.eq(2);
    expect(card2.resourceCount).to.eq(2);
  });

  it('Should play - multiple targets', () => {
    const card2 = new Extremophiles();
    const card3 = new VenusianAnimals();
    player.production.add(Resource.ENERGY, 1);
    player.playedCards.push(card2, card3);

    const action = cast(card.play(player), SelectCard<ICard>);

    action.cb([card2]);
    expect(player.production.energy).to.eq(0);
    expect(player.production.megacredits).to.eq(2);
    expect(card2.resourceCount).to.eq(2);
  });

  it('Should play - no target (2 microbes/animals silently dropped)', () => {
    player.production.add(Resource.ENERGY, 1);
    setVenusScaleLevel(game, 10);
    // No Venus card can hold the 2 resources → bespokePlay adds nothing; the
    // production change still applies (the declarative behavior on play()).
    cast(card.play(player), undefined);
    expect(player.production.energy).to.eq(0);
    expect(player.production.megacredits).to.eq(2);
  });

  it('cardPlayPreview: no eligible Venus card → a WARNING step (no silent loss)', () => {
    player.production.add(Resource.ENERGY, 1);
    setVenusScaleLevel(game, 10);
    const branch = cardPlayPreview(player, card).branches[0];
    expect(branch.steps).has.length(1);
    expect(branch.steps[0].kind).eq('note');
    expect((branch.steps[0] as {noteKind?: string}).noteKind).eq('warning');
  });

  it('cardPlayPreview: with an eligible Venus card → a target picker (no warning)', () => {
    player.production.add(Resource.ENERGY, 1);
    setVenusScaleLevel(game, 10);
    player.playedCards.push(new VenusianAnimals());
    const branch = cardPlayPreview(player, card).branches[0];
    expect(branch.steps.some((s) => s.kind === 'input' && s.input.type === 'card')).is.true;
    expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning')).is.false;
  });
});
