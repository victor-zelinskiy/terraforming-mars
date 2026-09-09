import {expect} from 'chai';
import {Ants} from '../../src/server/cards/base/Ants';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {TestPlayer} from '../TestPlayer';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {testGame} from '../TestingUtils';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelfReplicatingRobots} from '../../src/server/cards/promo/SelfReplicatingRobots';
import {cast} from '@/common/utils/utils';

describe('AddResourcesToCard', () => {
  let player: TestPlayer;
  let ghgProducingBacteria: GHGProducingBacteria;
  let tardigrades: Tardigrades;
  let ants: Ants;
  let selfReplicatingRobots: SelfReplicatingRobots;

  beforeEach(() => {
    [/* game */, player] = testGame(1);
    ghgProducingBacteria = new GHGProducingBacteria();
    tardigrades = new Tardigrades();
    ants = new Ants();
    selfReplicatingRobots = new SelfReplicatingRobots();
  });

  it('0 cards in hand no action', () => {
    const action = new AddResourcesToCard(player, CardResource.MICROBE, {count: 5});
    expect(action.execute()).is.undefined;
  });

  it('0 resources no action', () => {
    player.playedCards.push(ghgProducingBacteria);
    const action = new AddResourcesToCard(player, CardResource.MICROBE, {count: 0});
    expect(action.execute()).is.undefined;
  });

  it('one card autofill', () => {
    player.playedCards.push(ghgProducingBacteria);
    const selectCard = new AddResourcesToCard(player, CardResource.MICROBE, {count: 5}).execute();
    expect(selectCard).is.undefined;
    expect(ghgProducingBacteria.resourceCount).eq(5);
  });

  it('autoSelect:false asks even with a single card (never applies silently)', () => {
    player.playedCards.push(ghgProducingBacteria);
    const selectCard = cast(
      new AddResourcesToCard(player, CardResource.MICROBE, {count: 5, autoSelect: false}).execute(),
      SelectCard);
    // The player must confirm WHERE — nothing is added behind the board.
    expect(selectCard.cards).has.length(1);
    expect(ghgProducingBacteria.resourceCount).eq(0);
    selectCard.cb([ghgProducingBacteria]);
    expect(ghgProducingBacteria.resourceCount).eq(5);
  });

  it('stamps the premium ADD-RESOURCE reading (amount + icon + per-candidate VP)', () => {
    player.playedCards.push(ghgProducingBacteria, ants);
    ants.resourceCount = 1;
    const selectCard = cast(
      new AddResourcesToCard(player, CardResource.MICROBE, {count: 1, autoSelect: false}).execute(),
      SelectCard);
    const meta = selectCard.resourceGainPrompt;
    expect(meta?.amount).eq(1);
    expect(meta?.cardResource).eq('microbe');
    // Ants scores 1 VP per 2 microbes: 1 → 2 microbes crosses the threshold.
    expect(meta?.vpBox?.[CardName.ANTS]).deep.eq({from: 0, to: 1});
    // A card whose points the resource never moves is ABSENT, never a zero.
    expect(meta?.vpBox?.[CardName.GHG_PRODUCING_BACTERIA]).is.undefined;
    // …and the model the client reads carries it (nesting-safe toModel).
    expect(selectCard.toModel(player).resourceGainPrompt?.amount).eq(1);
  });

  it('many microbe cards', () => {
    player.playedCards.push(ghgProducingBacteria, tardigrades, ants);

    const selectCard = cast(new AddResourcesToCard(player, CardResource.MICROBE).execute(), SelectCard);

    expect(selectCard.cards).has.length(3);
    selectCard.cb([ghgProducingBacteria]);

    expect(ghgProducingBacteria.resourceCount).eq(1);
    expect(tardigrades.resourceCount).eq(0);
    expect(ants.resourceCount).eq(0);
  });

  it('many microbe cards', () => {
    player.playedCards.push(ghgProducingBacteria, tardigrades, ants);

    const selectCard = cast(new AddResourcesToCard(player, CardResource.MICROBE).execute(), SelectCard);

    expect(selectCard.cards).has.length(3);
    selectCard.cb([ghgProducingBacteria]);

    expect(ghgProducingBacteria.resourceCount).eq(1);
    expect(tardigrades.resourceCount).eq(0);
    expect(ants.resourceCount).eq(0);
  });

  it('works with self-replicating robots', () => {
    player.playedCards.push(ghgProducingBacteria, selfReplicatingRobots);
    selfReplicatingRobots.targetCards = [tardigrades];

    const selectCard = cast(new AddResourcesToCard(player, CardResource.MICROBE, {robotCards: true}).execute(), SelectCard);

    expect(selectCard.cards).has.length(2);
    expect(selectCard.cards[0]).eq(ghgProducingBacteria);
    expect(selectCard.cards[1]).eq(tardigrades);

    selectCard.cb([tardigrades]);

    expect(tardigrades.resourceCount).eq(1);
  });

  it('filter works with self-replicating robots', () => {
    player.playedCards.push(ghgProducingBacteria, ants, selfReplicatingRobots);
    selfReplicatingRobots.targetCards = [tardigrades];

    const addResourcesToCard = new AddResourcesToCard(
      player, CardResource.MICROBE, {
        robotCards: true,
        filter: (c) => c.name.endsWith('s'),
      });
    const selectCard = cast(addResourcesToCard.execute(), SelectCard);
    expect(selectCard.cards).has.length(2);
    expect(selectCard.cards[0]).eq(ants);
    expect(selectCard.cards[1]).eq(tardigrades);
    selectCard.cb([tardigrades]);

    expect(tardigrades.resourceCount).eq(1);
  });
});
