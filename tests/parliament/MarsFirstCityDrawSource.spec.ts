import {expect} from 'chai';
import {testGame} from '../TestGame';
import {addCity, runAllActions} from '../TestingUtils';
import {PartyName} from '../../src/common/turmoil/PartyName';

/**
 * MARS FIRST'S CITY CARD NAMES ITS PARTY (the owner's TV, 2026-11-01): a city placed on a card-bonus cell under a
 * ruling Mars First is ONE batch of two causes — the cell's card and the party's — and the reveal's head read
 * «ПОЛУЧЕНО 2 · КЛЕТКА ПОЛЯ +1» with the party's card belonging to nobody. The party's answer is its PASSIVE, not
 * its action: the draw says so, so the head can read «ПАРТИЯ Марс вперёд +1».
 */
describe('Mars First · the city card names its party', () => {
  it('a city on Mars draws a card sourced {party: Mars First, passive}', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.parliament!.grantPartyEffect(player, PartyName.MARS, 'TestGrant');
    const before = player.cardsInHand.length;
    addCity(player);
    runAllActions(game);
    expect(player.cardsInHand.length - before, 'one card for the city').eq(1);
    const reveal = player.cardDrawReveals[player.cardDrawReveals.length - 1];
    expect(reveal?.segments.map((s) => s.source)).deep.eq([{type: 'party', party: PartyName.MARS, passive: true}]);
  });
});
