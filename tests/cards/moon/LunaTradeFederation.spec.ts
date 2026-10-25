import {expect} from 'chai';
import {IGame} from '../../../src/server/IGame';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {LunaTradeFederation} from '../../../src/server/cards/moon/LunaTradeFederation';
import {MoonExpansion} from '../../../src/server/moon/MoonExpansion';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {Units} from '../../../src/common/Units';
import {Tag} from '../../../src/common/cards/Tag';

describe('LunaTradeFederation', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  let lunaTradeFederation: LunaTradeFederation;

  beforeEach(() => {
    [game, player, player2] = testGame(2, {moonExpansion: true});
    lunaTradeFederation = new LunaTradeFederation();
  });

  it('play', () => {
    expect(player.canUseTitaniumAsMegacredits).is.false;
    player.playCorporationCard(lunaTradeFederation);
    runAllActions(game);
    expect(player.titanium).eq(10);
    expect(player.megaCredits).eq(15);
    expect(player.canUseTitaniumAsMegacredits).is.true;
  });

  it('onTilePlaced', () => {
    player.playedCards.push(lunaTradeFederation);

    MoonExpansion.addRoadTile(player, 'm07');
    expect(player.production.asUnits()).deep.eq(Units.of({}));

    MoonExpansion.addMineTile(player, 'm08');
    expect(player.production.asUnits()).deep.eq(Units.of({titanium: 1}));

    MoonExpansion.addRoadTile(player2, 'm09');
    expect(player.production.asUnits()).deep.eq(Units.of({titanium: 1}));

    MoonExpansion.addMineTile(player2, 'm10');
    expect(player.production.asUnits()).deep.eq(Units.of({titanium: 1}));
  });

  it('can use titanium to pay for space project cards as normal', () => {
    player.playedCards.push(lunaTradeFederation);
    lunaTradeFederation.play(player);
    expect(player.canUseTitaniumAsMegacredits).is.true;

    const card = fakeCard({cost: 10, tags: [Tag.SPACE]});
    player.megaCredits = 6;
    player.titanium = 1;

    expect(player.canAfford(player.affordOptionsForCard(card))).is.false;

    player.megaCredits = 7;
    player.titanium = 1;
    expect(player.canAfford(player.affordOptionsForCard(card))).is.true;
  });

  it('can use titanium to pay for non-space project cards at a discount', () => {
    player.playedCards.push(lunaTradeFederation);
    lunaTradeFederation.play(player);
    expect(player.canUseTitaniumAsMegacredits).is.true;

    const card = fakeCard({cost: 10, tags: [Tag.MICROBE]});
    player.megaCredits = 7;
    player.titanium = 1;

    expect(player.spendableMegacredits()).eq(9);
    expect(player.canAfford(player.affordOptionsForCard(card))).is.false;

    player.megaCredits = 8;
    player.titanium = 1;
    expect(player.spendableMegacredits()).eq(10);
    expect(player.canAfford(player.affordOptionsForCard(card))).is.true;

    player.megaCredits = 8;
    player.titanium = 3;
    expect(player.spendableMegacredits()).eq(14);

    player.increaseTitaniumValue();

    expect(player.spendableMegacredits()).eq(17);
  });

  it('can use titanium for other purchases', () => {

  });
});
