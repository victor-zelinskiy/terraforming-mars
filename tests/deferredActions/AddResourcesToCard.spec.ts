import {expect} from 'chai';
import {Ants} from '../../src/server/cards/base/Ants';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {TestPlayer} from '../TestPlayer';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {fakeCard, testGame} from '../TestingUtils';
import {CardType} from '../../src/common/cards/CardType';
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

  // THE PICK OVER A LIST OF KINDS (the shared distribution step's pick shape, Medical Database): the candidates
  // are the holders of ANY of the kinds, each once, and the marker names the kinds and what EACH candidate takes.
  it('a list of one kind is the ordinary pick; several kinds unite the holders and name each candidate\'s own kind', () => {
    const vault = fakeCard({name: 'Data Vault' as CardName, type: CardType.ACTIVE, resourceType: CardResource.DATA});
    player.playedCards.push(ghgProducingBacteria, vault, ants);
    const one = new AddResourcesToCard(player, [CardResource.MICROBE], {count: 1, autoSelect: false});
    expect(one.resourceType).eq(CardResource.MICROBE);
    const onePick = cast(one.execute(), SelectCard);
    expect(onePick.cards).deep.eq([ghgProducingBacteria, ants]);
    expect(onePick.resourceGainPrompt?.cardResource).eq('microbe');
    expect(onePick.resourceGainPrompt?.cardResources).is.undefined;
    expect(onePick.resourceGainPrompt?.cardResourceByCard).is.undefined;
    const two = new AddResourcesToCard(player, [CardResource.DATA, CardResource.MICROBE], {count: 2, autoSelect: false});
    expect(two.resourceType, 'no ONE kind over two').is.undefined;
    const twoPick = cast(two.execute(), SelectCard);
    expect(twoPick.cards).deep.eq([ghgProducingBacteria, vault, ants]);
    expect(twoPick.resourceGainPrompt?.cardResource).is.undefined;
    expect(twoPick.resourceGainPrompt?.cardResources).deep.eq(['data', 'microbe']);
    expect(twoPick.resourceGainPrompt?.cardResourceByCard).deep.eq({[CardName.GHG_PRODUCING_BACTERIA]: 'microbe', 'Data Vault': 'data', [CardName.ANTS]: 'microbe'});
    twoPick.cb([vault]);
    expect(vault.resourceCount, 'the unit landed as the card\'s own kind').eq(2);
    // «Any resource» (undefined) names each candidate's own kind too — the reading of every candidate is honest.
    const any = cast(new AddResourcesToCard(player, undefined, {count: 1, autoSelect: false}).execute(), SelectCard);
    expect(any.resourceGainPrompt?.cardResource).is.undefined;
    expect(any.resourceGainPrompt?.cardResourceByCard).deep.eq({[CardName.GHG_PRODUCING_BACTERIA]: 'microbe', 'Data Vault': 'data', [CardName.ANTS]: 'microbe'});
  });
});
