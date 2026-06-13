import {expect} from 'chai';
import {testGame} from '../../TestingUtils';
import {Research} from '../../../src/server/cards/base/Research';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {HousePrinting} from '../../../src/server/cards/prelude/HousePrinting';
import {SelfReplicatingRobots} from '../../../src/server/cards/promo/SelfReplicatingRobots';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {EarthOffice} from '../../../src/server/cards/base/EarthOffice';
import {SerializedCard} from '../../../src/server/SerializedCard';
import {CardName} from '../../../src/common/cards/CardName';
import {cast} from '../../../src/common/utils/utils';

describe('SelfReplicatingRobots', () => {
  let card: SelfReplicatingRobots;
  let player: TestPlayer;

  beforeEach(() => {
    card = new SelfReplicatingRobots();
    [/* game */, player] = testGame(1);
  });

  it('Can not play', () => {
    expect(card.canPlay(player)).is.not.true;
  });

  it('Should play', () => {
    player.playedCards.push(new Research());
    expect(card.canPlay(player)).is.true;
  });

  it('Should act', () => {
    player.playedCards.push(card);
    expect(card.canAct(player)).is.not.true;

    player.cardsInHand.push(new EarthOffice());
    expect(card.canAct(player)).is.not.true;

    player.cardsInHand.push(new HousePrinting());
    expect(card.canAct(player)).is.true;
  });

  it('act', () => {
    const earthOffice = new EarthOffice();
    player.cardsInHand.push(earthOffice);
    player.cardsInHand.push(new HousePrinting());

    // A LONE executable option auto-resolves to the bare SelectCard (no
    // OrOptions wrapper) — the convention the action-preview batch submit
    // relies on (otherwise the pre-collected link pick left a redundant
    // follow-up "select card to link" prompt).
    const action = cast(card.action(player), SelectCard<IProjectCard>);
    action.cb([action.cards[0]]);
    expect(card.targetCards[0].resourceCount).to.eq(2);
    expect(player.cardsInHand).deep.eq([earthOffice]);
    expect(card.targetCards).has.lengthOf(1);

    // Again a single option (nothing linkable left in hand → only "double").
    const action2 = cast(card.action(player), SelectCard<IProjectCard>);
    action2.cb([action2.cards[0]]);
    expect(card.targetCards[0].resourceCount).to.eq(4);
  });

  it('act - both branches available -> OrOptions with stable order', () => {
    // A hosted card AND a linkable hand card → the full OrOptions, double
    // first, link second (the order actionPreview's orBranches mirrors).
    const housePrinting = new HousePrinting();
    housePrinting.resourceCount = 2;
    card.targetCards.push(housePrinting);
    player.cardsInHand.push(new HousePrinting());

    const action = cast(card.action(player), OrOptions);
    expect(action.options).has.lengthOf(2);

    const double = cast(action.options[0], SelectCard<IProjectCard>);
    expect(double.cards[0].name).eq(CardName.HOUSE_PRINTING);
    double.cb([double.cards[0]]);
    expect(card.targetCards[0].resourceCount).to.eq(4);

    const link = cast(action.options[1], SelectCard<IProjectCard>);
    link.cb([link.cards[0]]);
    expect(card.targetCards).has.lengthOf(2);
    expect(card.targetCards[1].resourceCount).to.eq(2);
    expect(player.cardsInHand).is.empty;
  });

  it('serialization', () => {
    const housePrinting = new HousePrinting();
    housePrinting.resourceCount = 4;
    card.targetCards.push(housePrinting);

    const serialized: SerializedCard = {name: CardName.SELF_REPLICATING_ROBOTS};
    card.serialize(serialized);
    expect(serialized).deep.eq({
      'name': 'Self-replicating Robots',
      'targetCards': [
        {
          'card': {
            'name': 'House Printing',
          },
          'resourceCount': 4,
        },
      ],
    });

    const deserialized = new SelfReplicatingRobots();
    deserialized.deserialize(serialized);
    expect(deserialized.targetCards).has.length(1);
    const deserializedTargetCard = deserialized.targetCards[0];
    expect(deserializedTargetCard.name).eq(CardName.HOUSE_PRINTING);
    expect(deserializedTargetCard.resourceCount).eq(4);
  });
});
