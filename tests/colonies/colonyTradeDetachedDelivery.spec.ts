import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {AerialMappers} from '../../src/server/cards/venusNext/AerialMappers';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {Pluto} from '../../src/server/colonies/Pluto';
import {Titan} from '../../src/server/colonies/Titan';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

/**
 * DETACHED DELIVERY of colony bonuses (Colony.isDetachedBonusDelivery):
 * a colony bonus paid to a player OTHER than the trader queues at
 * BACK_OF_THE_LINE — after the trade's own finalizer — so the trader's own
 * chain (income, their own cube's bonus, their mandatory prompts, the track
 * reset) NEVER waits on an opponent's answer. The trader resolves first
 * (tabletop convention: simultaneous effects, active player first), the reset
 * commits, and only then do the other recipients' interactive bonuses ask.
 */
describe('colonyTradeDetachedDelivery', () => {
  describe('Pluto (draw 1, then discard 1)', () => {
    let pluto: Pluto;
    let game: IGame;
    let player: TestPlayer;
    let player2: TestPlayer;
    let player3: TestPlayer;

    beforeEach(() => {
      pluto = new Pluto();
      [game, player, player2, player3] = testGame(3, {coloniesExtension: true});
      game.colonies.push(pluto);
    });

    it('opponent placed first: the trader still resolves first, the reset commits before the opponent is asked', () => {
      pluto.addColony(player2); // opponent's cube is in slot 1
      pluto.addColony(player); // the trader's cube is in slot 2
      runAllActions(game); // build-bonus draws (2 each)
      player.acknowledgeCardDrawReveals('all');
      player2.acknowledgeCardDrawReveals('all');

      pluto.increaseTrack(3); // marker at 5 → income = 3 cards
      expect(pluto.trackPosition).eq(5);

      pluto.trade(player);
      runAllActions(game);

      // The TRADER's chain runs first despite the opponent's earlier slot:
      // income (3) + the trader's own bonus draw (1) in ONE merged batch, and
      // the trader's mandatory discard is the queue's first pause.
      expect(player.cardDrawReveals).has.lengthOf(1);
      expect(player.cardDrawReveals[0].tradeSegments).deep.eq([
        {role: 'income', count: 3}, {role: 'bonus', count: 1},
      ]);
      player.acknowledgeCardDrawReveals('all');
      const traderDiscard = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
      expect(traderDiscard.discardPrompt?.colonyBonus).deep.eq({colonyName: pluto.name, index: 1, total: 1});

      // The opponent has been asked NOTHING and drawn NOTHING yet.
      expect(player2.getWaitingFor()).is.undefined;
      expect(player2.cardDrawReveals).is.empty;

      traderDiscard.cb([traderDiscard.cards[0]]);
      runAllActions(game);

      // The trader's chain is COMPLETE: the reset is committed…
      expect(pluto.trackPosition).eq(2);
      expect(player.getWaitingFor()).is.undefined;

      // …while the opponent's detached delivery is only NOW resolving: their
      // bonus card was drawn behind the finalizer and their discard is the
      // pending input.
      expect(player2.cardDrawReveals).has.lengthOf(1);
      const opponentDiscard = cast(player2.popWaitingFor(), SelectCard<IProjectCard>);
      expect(opponentDiscard.discardPrompt?.colonyBonus).deep.eq({colonyName: pluto.name, index: 1, total: 1});
      opponentDiscard.cb([opponentDiscard.cards[0]]);
      runAllActions(game);

      expect(player2.getWaitingFor()).is.undefined;
      expect(pluto.trackPosition).eq(2);
    });

    it('a trade with only foreign cubes: the reset commits first, then each recipient resolves per cube, in slot order', () => {
      pluto.addColony(player2);
      pluto.addColony(player3);
      pluto.addColony(player2); // player2 owns cubes 1 and 3
      runAllActions(game);
      player2.acknowledgeCardDrawReveals('all');
      player3.acknowledgeCardDrawReveals('all');

      pluto.increaseTrack(2); // marker at 5 → income = 3 cards
      expect(pluto.trackPosition).eq(5);

      pluto.trade(player);
      runAllActions(game);

      // The trader (no cube here) got the income and is DONE — the reset is
      // already committed although not a single foreign bonus is answered.
      expect(player.cardDrawReveals).has.lengthOf(1);
      expect(player.cardDrawReveals[0].tradeSegments).deep.eq([{role: 'income', count: 3}]);
      expect(player.getWaitingFor()).is.undefined;
      expect(pluto.trackPosition).eq(3);

      // player2's FIRST cube resolves fully (draw → discard) before their
      // second, and before player3 is asked at all.
      const p2first = cast(player2.popWaitingFor(), SelectCard<IProjectCard>);
      expect(p2first.discardPrompt?.colonyBonus).deep.eq({colonyName: pluto.name, index: 1, total: 2});
      expect(player3.getWaitingFor()).is.undefined;
      expect(player3.cardDrawReveals).is.empty;
      p2first.cb([p2first.cards[0]]);
      runAllActions(game);

      const p2second = cast(player2.popWaitingFor(), SelectCard<IProjectCard>);
      expect(p2second.discardPrompt?.colonyBonus).deep.eq({colonyName: pluto.name, index: 2, total: 2});
      p2second.cb([p2second.cards[0]]);
      runAllActions(game);

      const p3discard = cast(player3.popWaitingFor(), SelectCard<IProjectCard>);
      expect(p3discard.discardPrompt?.colonyBonus).deep.eq({colonyName: pluto.name, index: 1, total: 1});
      p3discard.cb([p3discard.cards[0]]);
      runAllActions(game);

      expect(player3.getWaitingFor()).is.undefined;
    });

    it('an opponent whose hand cannot offer a choice auto-discards without pausing anybody', () => {
      pluto.addColony(player2);
      runAllActions(game);
      // Empty the opponent's hand: the build bonus drew 2, throw them away.
      player2.cardsInHand.length = 0;
      player2.acknowledgeCardDrawReveals('all');

      pluto.increaseTrack(3);
      pluto.trade(player);
      runAllActions(game);

      // Their bonus card was drawn and auto-discarded (hand ≤ 1) — no prompt,
      // no freeze, the queue drained to the end.
      expect(player2.getWaitingFor()).is.undefined;
      expect(player.getWaitingFor()).is.undefined;
      expect(pluto.trackPosition).eq(1);
    });
  });

  describe('Titan (add floaters to a card)', () => {
    let titan: Titan;
    let game: IGame;
    let player: TestPlayer;
    let player2: TestPlayer;

    beforeEach(() => {
      titan = new Titan();
      [game, player, player2] = testGame(2, {coloniesExtension: true});
      game.colonies.push(titan);
    });

    it('the trader answers their own two picks contiguously; the opponent is asked only after the reset', () => {
      // Placement floaters auto-apply while each player has ONE candidate…
      const p2Mappers = new AerialMappers();
      player2.playCard(p2Mappers);
      titan.addColony(player2); // opponent's cube is in slot 1
      runAllActions(game);
      const mappers = new AerialMappers();
      player.playCard(mappers);
      titan.addColony(player); // the trader's cube is in slot 2
      runAllActions(game);
      // …then a second floater card each makes every later pick a REAL prompt.
      const p2Dirigibles = new Dirigibles();
      player2.playCard(p2Dirigibles);
      const dirigibles = new Dirigibles();
      player.playCard(dirigibles);

      const tradePosition = titan.trackPosition;
      titan.trade(player);
      runAllActions(game);

      // Pick 1 — the trader's OWN colony bonus (1 floater), inline in the
      // trade's chain. The opponent has not been asked.
      const bonusPick = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
      expect(player2.getWaitingFor()).is.undefined;
      const beforeBonus = mappers.resourceCount;
      bonusPick.cb([mappers]);
      runAllActions(game);
      expect(mappers.resourceCount).eq(beforeBonus + 1);

      // Pick 2 — the trader's TRADE INCOME target, still contiguous (this is
      // the preview's promised order: colonyBonus → tradeReward).
      const rewardPick = cast(player.popWaitingFor(), SelectCard<IProjectCard>);
      expect(player2.getWaitingFor()).is.undefined;
      const incomeQuantity = titan.metadata.trade.quantity[tradePosition];
      const beforeReward = dirigibles.resourceCount;
      rewardPick.cb([dirigibles]);
      runAllActions(game);
      expect(dirigibles.resourceCount).eq(beforeReward + incomeQuantity);

      // The trader's chain is over: reset committed, nothing pending on them —
      // and only NOW does the opponent's detached floater pick ask.
      expect(titan.trackPosition).eq(2);
      expect(player.getWaitingFor()).is.undefined;
      const opponentPick = cast(player2.popWaitingFor(), SelectCard<IProjectCard>);
      const beforeOpponent = p2Dirigibles.resourceCount;
      opponentPick.cb([p2Dirigibles]);
      runAllActions(game);
      expect(p2Dirigibles.resourceCount).eq(beforeOpponent + 1);
      expect(player2.getWaitingFor()).is.undefined;
    });
  });
});
