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

    // Income (3) + the FIRST cube's bonus draw (1) merged into ONE batch with
    // segments. Cube 2 has not drawn yet — by the rules it only starts once
    // cube 1's discard is answered.
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
    // discard prompt is reachable), then resolves each cube in turn.
    player.acknowledgeCardDrawReveals('all');
    const discard1 = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(discard1.discardPrompt?.colonyBonus).deep.eq({colonyName: pluto.name, index: 1, total: 2});
    discard1.cb([discard1.cards[0]]);
    runAllActions(game);

    // Cube 2's draw is its OWN batch — the modal reveals it only now.
    expect(player.cardDrawReveals).has.lengthOf(1);
    expect(player.cardDrawReveals[0].tradeSegments).deep.eq([{role: 'bonus', count: 1}]);
    const discard2 = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(discard2.discardPrompt?.colonyBonus).deep.eq({colonyName: pluto.name, index: 2, total: 2});
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

  /**
   * TWO CUBES ON PLUTO — TWO BATCHES, WHATEVER THE CLIENT DOES.
   *
   * «Draw 1, then discard 1» is paid PER CUBE, and by the rules the next
   * colony's card is not revealed until this one is finished. The separation
   * used to rest entirely on the client's fire-and-forget acknowledgement
   * winning a race with its own discard submit: lose it, and the second card
   * was APPENDED to a batch the player had already dismissed (drawn, never
   * shown) — or, worse, to one whose arrival cinematic was still airborne, so
   * the row re-flowed under the flying covers.
   *
   * This spec deliberately NEVER acknowledges: the seal is what must hold.
   */
  it('two Pluto cubes: the second bonus opens its OWN batch (unacknowledged)', () => {
    pluto.addColony(player);
    pluto.addColony(player);
    runAllActions(game); // the two BUILD bonus draws
    player.acknowledgeCardDrawReveals('all');

    pluto.trade(player);
    runAllActions(game);

    // Cycle 1: income + colony 1's bonus card, merged as before — and SEALED.
    expect(player.cardDrawReveals).has.lengthOf(1);
    const first = player.cardDrawReveals[0];
    expect(first.tradeSegments?.map((s) => s.role)).deep.eq(['income', 'bonus']);
    expect(first.sealed, 'the pending mandatory discard closes the batch').is.true;

    const discard1 = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    discard1.cb([discard1.cards[0]]);
    runAllActions(game);

    // Cycle 2 lands with cycle 1 STILL QUEUED (never acked): a NEW batch, and
    // colony 1's cards are untouched.
    expect(player.cardDrawReveals, 'colony 2 opens its own batch').has.lengthOf(2);
    const second = player.cardDrawReveals[1];
    expect(second.id).not.eq(first.id);
    expect(second.cards).has.lengthOf(1);
    expect(second.tradeSegments).deep.eq([{role: 'bonus', count: 1}]);
    expect(first.cards.length, 'the first batch did not grow').eq(
      (first.tradeSegments ?? []).reduce((n, s) => n + s.count, 0));
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
