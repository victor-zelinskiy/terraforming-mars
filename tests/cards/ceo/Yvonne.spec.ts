import {expect} from 'chai';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {forceGenerationEnd} from '../../TestingUtils';

import {Yvonne} from '../../../src/server/cards/ceos/Yvonne';
import {Callisto} from '../../../src/server/colonies/Callisto';
import {Ceres} from '../../../src/server/colonies/Ceres';
import {Triton} from '../../../src/server/colonies/Triton';
import {Pluto} from '../../../src/server/colonies/Pluto';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {CardName} from '../../../src/common/cards/CardName';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {cast} from '../../../src/common/utils/utils';


describe('Yvonne', () => {
  let card: Yvonne;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Yvonne();
    [game, player, player2] = testGame(2, {ceoExtension: true, coloniesExtension: true});

    // Setup some colonies that can be built independently of cards
    const callisto = new Callisto(); // 3 Energy
    const ceres = new Ceres(); // 2 Steel
    const triton = new Triton(); // 1 Titanium

    game.colonies = [callisto, ceres, triton];
    callisto.addColony(player);
    ceres.addColony(player);
    triton.addColony(player);
    callisto.addColony(player2);
    ceres.addColony(player2);
    triton.addColony(player2);

    player.energy = 0;
    player.steel = 0;
    player.titanium = 0;
    player2.energy = 0;
    player2.steel = 0;
    player2.titanium = 0;
  });

  it('Can act', () => {
    expect(card.canAct(player)).is.true;
  });

  it('Takes action', () => {
    // Sanity check before OPG
    expect(player2.energy).eq(0);
    expect(player2.steel).eq(0);
    expect(player2.titanium).eq(0);
    card.action(player);
    game.deferredActions.runAll(() => { });
    expect(player.energy).eq(6);
    expect(player.steel).eq(4);
    expect(player.titanium).eq(2);
  });

  it('Opponents dont get the bonuses', () => {
    // Sanity check before OPG
    expect(player2.energy).eq(0);
    expect(player2.steel).eq(0);
    expect(player2.titanium).eq(0);
    card.action(player);
    game.deferredActions.runAll(() => { });
    expect(player2.energy).eq(0);
    expect(player2.steel).eq(0);
    expect(player2.titanium).eq(0);
  });

  it('every cube pays TWICE and says which payout it is: one cube on Pluto is «1 of 2», then «2 of 2», under Yvonne', () => {
    const pluto = new Pluto();
    game.colonies = [pluto];
    pluto.colonies.push(player.id);
    player.cardsInHand.push(...game.projectDeck.drawN(game, 2) as Array<IProjectCard>);

    card.action(player);
    game.deferredActions.runAll(() => { });
    const first = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(first.discardPrompt?.source).deep.eq({kind: 'card', card: CardName.YVONNE});
    expect(first.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 1, total: 2});
    first.cb([first.cards[0]]);
    game.deferredActions.runAll(() => { });
    const second = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
    expect(second.discardPrompt?.colonyRepeat).deep.eq({colonyName: ColonyName.PLUTO, index: 2, total: 2});
  });

  it('Can only act once per game', () => {
    card.action(player);
    game.deferredActions.runAll(() => { });
    forceGenerationEnd(game);

    expect(card.isDisabled).is.true;
    expect(card.canAct(player)).is.false;
  });
});
