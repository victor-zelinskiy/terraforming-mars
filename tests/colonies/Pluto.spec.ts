import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Pluto} from '../../src/server/colonies/Pluto';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

describe('Pluto', () => {
  let pluto: Pluto;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    pluto = new Pluto();
    [game, player, player2] = testGame(2, {coloniesExtension: true});
    game.colonies.push(pluto);
  });

  it('Should build', () => {
    pluto.addColony(player);
    runAllActions(game); // Draw cards
    expect(player.cardsInHand).has.lengthOf(2);
  });

  it('Should trade', () => {
    pluto.trade(player);
    runAllActions(game); // Draw cards
    expect(player.cardsInHand).has.lengthOf(1);
  });

  it('Should give trade bonus', () => {
    pluto.addColony(player);
    runAllActions(game); // Draw a card
    expect(player.cardsInHand).has.lengthOf(2);

    pluto.trade(player2);
    runAllActions(game); // Draw a card
    expect(player.cardsInHand).has.lengthOf(3);

    const input = cast(player.getWaitingFor(), SelectCard<IProjectCard>);
    input.cb([input.cards[0]]); // Discard a card

    runAllActions(game);

    expect(player.cardsInHand).has.lengthOf(2);
    expect(player2.cardsInHand).has.lengthOf(1);
  });

  // FORK BEHAVIOUR (colonyBonusBatching.ts): a recipient's cubes resolve their
  // colony bonus as ONE payout — draw one card per cube, then answer a SINGLE
  // discard-N prompt — instead of upstream's draw→discard→draw→discard pairing.
  // The player therefore sees everything the trade pays before choosing what to
  // throw away, and the console presents it as one coherent reward (#4536 was
  // about ordering the DRAW before the DISCARD, which still holds).
  it('two cubes: ONE merged draw + ONE discard-2 prompt (never a pair per cube)', () => {
    pluto.addColony(player);
    pluto.addColony(player);
    runAllActions(game);
    expect(player.cardsInHand).has.lengthOf(4);

    pluto.trade(player2);
    runAllActions(game);

    // Both bonus cards are in hand BEFORE anything must be discarded.
    const selectCard = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(player.cardsInHand).has.lengthOf(6);
    expect(selectCard.config.min).to.eq(2);
    expect(selectCard.config.max).to.eq(2);
    // The prompt carries the structural marker the console reveal modal reads
    // to host this discard as the closing step of the same payout.
    expect(selectCard.colonyBonusDiscard).to.deep.eq({colonyName: ColonyName.PLUTO, count: 2});

    selectCard.cb([selectCard.cards[0], selectCard.cards[1]]);
    expect(player.cardsInHand).has.lengthOf(4);

    // …and there is no SECOND discard prompt hiding behind it.
    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
  });

  it('one cube: still a single-card discard (the ordinary case is unchanged)', () => {
    pluto.addColony(player);
    runAllActions(game);
    expect(player.cardsInHand).has.lengthOf(2);

    pluto.trade(player2);
    runAllActions(game);

    const selectCard = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(selectCard.config.min).to.eq(1);
    expect(selectCard.config.max).to.eq(1);
    expect(selectCard.colonyBonusDiscard).to.deep.eq({colonyName: ColonyName.PLUTO, count: 1});
    selectCard.cb([selectCard.cards[0]]);
    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
  });
});
