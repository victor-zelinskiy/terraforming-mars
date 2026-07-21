import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {Resource} from '@/common/Resource';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Pluto} from '../../src/server/colonies/Pluto';
import {Triton} from '../../src/server/colonies/Triton';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

/**
 * The atomic colony-trade reward manifest (ColonyTradeManifestModel) + the
 * trade-tagged reveal-batch merge: ONE trade = ONE manifest on the trader +
 * ONE merged "cards received" batch (income first, then own colony bonuses),
 * with the track reset arriving strictly AFTER every reward resolved.
 */
describe('ColonyTradeManifest', () => {
  let pluto: Pluto;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    pluto = new Pluto();
    [game, player, player2] = testGame(2, {coloniesExtension: true});
    game.colonies.push(pluto);
  });

  it('Pluto trade by an owner: manifest + one merged batch, reset last', () => {
    pluto.addColony(player);
    pluto.addColony(player);
    runAllActions(game); // build bonus draws (2 + 2 cards)

    // The two BUILD bonus batches never merge (no trade tag) and carry no segments.
    expect(player.cardDrawReveals).has.lengthOf(2);
    expect(player.cardDrawReveals[0].tradeSegments).is.undefined;
    player.acknowledgeCardDrawReveals('all');

    pluto.increaseTrack(3); // marker at 5 → trade income = 3 cards
    expect(pluto.trackPosition).eq(5);

    pluto.trade(player);
    runAllActions(game); // income draw + bonus draw #1, pauses at the discard

    const manifest = player.colonyTradeManifest!;
    expect(manifest).is.not.undefined;
    expect(manifest.tradeId).matches(new RegExp(`^${pluto.name}:g\\d+:a\\d+$`));
    expect(manifest.colonyName).eq(pluto.name);
    expect(manifest.trader).eq(player.color);
    expect(manifest.preTradeTrackPosition).eq(5);
    expect(manifest.postTradeTrackPosition).eq(2); // = built colonies
    expect(manifest.tradeIncome).deep.eq({benefit: ColonyBenefit.DRAW_CARDS, quantity: 3});
    expect(manifest.colonyBonus).deep.eq({benefit: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE, quantity: 1});
    expect(manifest.bonusRecipients).deep.eq([{color: player.color, cubes: 2}]);

    // Income (3) + own bonus draw #1 (1) merged into ONE batch with segments.
    expect(player.cardDrawReveals).has.lengthOf(1);
    const batch = player.cardDrawReveals[0];
    expect(batch.cards).has.lengthOf(4);
    expect(batch.source).deep.eq({
      type: 'colony',
      colonyName: pluto.name,
      trade: {tradeId: manifest.tradeId, role: 'income'},
    });
    expect(batch.tradeSegments).deep.eq([{role: 'income', count: 3}, {role: 'bonus', count: 1}]);

    // The track is NOT reset while rewards are still resolving.
    expect(pluto.trackPosition).eq(5);

    // The player acknowledges the reveal (the client always does before the
    // discard prompt is reachable), then resolves both draw→discard pairs.
    player.acknowledgeCardDrawReveals('all');
    const discard1 = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    discard1.cb([discard1.cards[0]]);
    runAllActions(game);

    // Bonus draw #2 starts a NEW batch (the merged one was acknowledged).
    expect(player.cardDrawReveals).has.lengthOf(1);
    expect(player.cardDrawReveals[0].tradeSegments).deep.eq([{role: 'bonus', count: 1}]);
    const discard2 = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    discard2.cb([discard2.cards[0]]);
    runAllActions(game);

    // Only now — after every reward — the track resets to the colony count.
    expect(pluto.trackPosition).eq(2);
    // The manifest is still available for the response serialization.
    expect(player.colonyTradeManifest?.tradeId).eq(manifest.tradeId);
  });

  it('a still-pending merged batch keeps absorbing same-trade draws', () => {
    pluto.addColony(player);
    runAllActions(game);
    player.acknowledgeCardDrawReveals('all');

    pluto.trade(player);
    runAllActions(game); // income (1 @ position 1) + bonus draw #1 merged

    expect(player.cardDrawReveals).has.lengthOf(1);
    expect(player.cardDrawReveals[0].tradeSegments).deep.eq([{role: 'income', count: 1}, {role: 'bonus', count: 1}]);
    expect(pluto.trackPosition).eq(1);

    const discard = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    discard.cb([discard.cards[0]]);
    runAllActions(game);
    expect(pluto.trackPosition).eq(1); // reset target = 1 built colony
  });

  it('resource colony (Triton): manifest carries the resolved resource grant', () => {
    const triton = new Triton();
    game.colonies.push(triton);
    triton.addColony(player2);
    runAllActions(game);
    triton.increaseTrack(3); // marker at 4 → income 3 titanium

    triton.trade(player);
    runAllActions(game);

    const manifest = player.colonyTradeManifest!;
    expect(manifest.colonyName).eq(triton.name);
    expect(manifest.preTradeTrackPosition).eq(4);
    expect(manifest.postTradeTrackPosition).eq(1);
    expect(manifest.tradeIncome).deep.eq({benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 3, resource: Resource.TITANIUM});
    expect(manifest.colonyBonus).deep.eq({benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 1, resource: Resource.TITANIUM});
    expect(manifest.bonusRecipients).deep.eq([{color: player2.color, cubes: 1}]);
    expect(player.titanium).eq(3);
    expect(player2.titanium).to.be.greaterThanOrEqual(4); // build 3 + bonus 1
    expect(triton.trackPosition).eq(1);
    // A pure-resource trade queues no card reveal.
    expect(player.cardDrawReveals).has.lengthOf(0);
  });

  it('selfish trade redirects every cube to the trader', () => {
    const triton = new Triton();
    game.colonies.push(triton);
    triton.addColony(player2);
    runAllActions(game);

    triton.trade(player, {selfishTrade: true});
    runAllActions(game);

    expect(player.colonyTradeManifest?.bonusRecipients).deep.eq([{color: player.color, cubes: 1}]);
  });

  it('a partial trade (no colony bonuses) never overwrites the real manifest', () => {
    const triton = new Triton();
    game.colonies.push(triton);
    triton.trade(player);
    runAllActions(game);
    const real = player.colonyTradeManifest!;
    expect(real).is.not.undefined;

    // The COPY_TRADE shape: income only, no bonuses, no track decrease.
    pluto.trade(player, {giveColonyBonuses: false, decreaseTrackAfterTrade: false, usesTradeFleet: false});
    runAllActions(game);

    expect(player.colonyTradeManifest?.tradeId).eq(real.tradeId);
    player.acknowledgeCardDrawReveals('all');
  });

  it('no track decrease → post equals pre', () => {
    const triton = new Triton();
    game.colonies.push(triton);
    triton.increaseTrack(2);

    triton.trade(player, {decreaseTrackAfterTrade: false});
    runAllActions(game);

    const manifest = player.colonyTradeManifest!;
    expect(manifest.preTradeTrackPosition).eq(3);
    expect(manifest.postTradeTrackPosition).eq(3);
    expect(triton.trackPosition).eq(3);
  });

  it('an exhausted deck yields no reveal batch while the manifest stays honest', () => {
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;

    pluto.trade(player);
    runAllActions(game);

    const manifest = player.colonyTradeManifest!;
    expect(manifest.tradeIncome).deep.eq({benefit: ColonyBenefit.DRAW_CARDS, quantity: 1});
    // Nothing was drawn → no batch; the client's card wave counts follow the
    // batches (the actual), not the manifest quantity (the plan).
    expect(player.cardDrawReveals).has.lengthOf(0);
    expect(player.cardsInHand).has.lengthOf(0);
  });
});
