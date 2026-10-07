import {expect} from 'chai';
import {Pets} from '../../../src/server/cards/base/Pets';
import {addCity, runAllActions, testGame} from '../../TestingUtils';
import {cast} from '@/common/utils/utils';
import {CardName} from '../../../src/common/cards/CardName';

describe('Pets', () => {
  it('Should play', () => {
    const card = new Pets();
    const [game, player] = testGame(1);
    player.playedCards.push(card);
    cast(card.play(player), undefined);
    player.addResourceTo(card, 4);
    expect(card.getVictoryPoints(player)).to.eq(2);
    addCity(player);
    runAllActions(game);
    expect(card.resourceCount).to.eq(6);
  });

  // Fork: the «tile pays a card» class (cards/tilePayout.ts) — the board plays the record, never a counter's delta.
  it('a city pays THIS card through the class: one record, the placed city the sender', () => {
    const card = new Pets();
    const [game, player, other] = testGame(2);
    player.playedCards.push(card);
    const space = addCity(other);
    runAllActions(game);
    expect(card.resourceCount).to.eq(1);
    const record = game.cardAdjacencyPayouts.at(-1);
    expect(record).deep.include({
      cause: 'tile-placed', color: player.color, card: CardName.PETS, spaceId: space.id, target: CardName.PETS, amount: 1, before: 0,
    });
    expect(record?.neighbours).deep.eq([{spaceId: space.id, units: 1}]);
  });
});
