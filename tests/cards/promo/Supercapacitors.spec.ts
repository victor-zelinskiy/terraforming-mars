import {expect} from 'chai';
import {Supercapacitors} from '../../../src/server/cards/promo/Supercapacitors';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {doWait, forceGenerationEnd, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectAmount} from '../../../src/server/inputs/SelectAmount';
import {cast} from '../../../src/common/utils/utils';

describe('Supercapacitors', () => {
  let card: Supercapacitors;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Supercapacitors();
    [game, player] = testGame(2);
  });

  it('When player has no energy, go straight to selecting cards', () => {
    cast(player.popWaitingFor(), undefined);
    player.production.override({energy: 1, heat: 2});
    player.playedCards.push(card);
    player.energy = 0;
    forceGenerationEnd(game);
    runAllActions(game);

    // Select cards for next generation
    cast(player.popWaitingFor(), SelectCard);
    // Production still occurs.
    expect(player.energy).eq(1);
    expect(player.heat).eq(2);
    // Nothing was converted, so there is no transition snapshot.
    expect(player.energyHeatConversion).to.be.undefined;
  });


  it('Behavior when player has energy', () => {
    cast(player.popWaitingFor(), undefined);
    player.playedCards.push(card);
    player.production.override({energy: 2, heat: 3});
    player.energy = 5;
    player.heat = 0;
    forceGenerationEnd(game);
    runAllActions(game);

    doWait(player, SelectAmount, (selectAmount) => {
      expect(selectAmount.max).eq(5);
      // The premium client keys its layout + source dock off these structural
      // markers — never off the (translatable) title.
      expect(selectAmount.options?.conversion).deep.eq({from: 'energy', to: 'heat'});
      expect(selectAmount.choiceContext?.source).deep.eq({kind: 'card', card: card.name});
      selectAmount.cb(4);
    });

    expect(player.energy).eq(3); // 5 - 4 + 2 (production)
    expect(player.heat).eq(7); // 0 + 4 + 3 (production);

    // The player-chosen conversion is snapshotted for the transition animation,
    // capturing the stocks BEFORE the conversion (production income is added
    // afterwards in finishProductionPhase, so the client can't derive it).
    expect(player.energyHeatConversion).to.deep.include({amount: 4, energyBefore: 5, heatBefore: 0});

    // Select cards for next generation
    cast(player.popWaitingFor(), SelectCard);
  });

  it('Choosing 0 converts nothing and leaves NO transition snapshot (no empty ceremony)', () => {
    cast(player.popWaitingFor(), undefined);
    player.playedCards.push(card);
    player.production.override({energy: 1, heat: 1});
    player.energy = 2;
    player.heat = 3;
    forceGenerationEnd(game);
    runAllActions(game);

    doWait(player, SelectAmount, (selectAmount) => {
      expect(selectAmount.min).eq(0);
      selectAmount.cb(0);
    });

    // Energy kept, production still added on both counters.
    expect(player.energy).eq(3); // 2 - 0 + 1
    expect(player.heat).eq(4); // 3 + 0 + 1
    // A zero conversion is a refusal — the client must not get a snapshot to
    // animate (that would be the "empty ceremony" / double-count bug).
    expect(player.energyHeatConversion).to.be.undefined;
    cast(player.popWaitingFor(), SelectCard);
  });
});
