import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {Politologist} from '../../../src/server/awards/turmoilRedux/Politologist';
import {EventAnalysts} from '../../../src/server/cards/turmoil/EventAnalysts';
import {RedTourismWave} from '../../../src/server/cards/turmoil/RedTourismWave';
import {BannedDelegate} from '../../../src/server/cards/turmoil/BannedDelegate';
import {Birds} from '../../../src/server/cards/base/Birds';
import {PowerPlant} from '../../../src/server/cards/base/PowerPlant';
import {awardManifest} from '../../../src/server/awards/Awards';

describe('Politologist', () => {
  let award: Politologist;
  let player: TestPlayer;

  beforeEach(() => {
    award = new Politologist();
    [/* game */, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  });

  it('counts played cards with a party requirement', () => {
    expect(award.getScore(player)).eq(0);
    player.playedCards.push(new EventAnalysts());
    expect(award.getScore(player)).eq(1);
  });

  it('event cards count', () => {
    player.playedCards.push(new EventAnalysts(), new RedTourismWave());
    expect(award.getScore(player)).eq(2);
  });

  it('only a PARTY requirement counts — a parameter, the chairman or no requirement do not', () => {
    player.playedCards.push(new Birds(), new BannedDelegate(), new PowerPlant());
    expect(award.getScore(player)).eq(0);
  });

  it('a card in hand does not count — only the played ones', () => {
    player.cardsInHand.push(new EventAnalysts());
    expect(award.getScore(player)).eq(0);
  });

  it('is a Turmoil Redux award in every random pool', () => {
    expect(awardManifest.all['Politologist'].compatibility).eq('turmoilRedux');
    expect(awardManifest.all['Politologist'].random).eq('both');
  });
});
