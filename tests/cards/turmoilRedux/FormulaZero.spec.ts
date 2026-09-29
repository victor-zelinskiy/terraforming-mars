import {expect} from 'chai';
import {FormulaZero} from '../../../src/server/cards/turmoilRedux/FormulaZero';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Payment} from '../../../src/common/inputs/Payment';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectPayment} from '../../../src/server/inputs/SelectPayment';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR08 — FORMULA ZERO: the Security Fleet twin (store a fighter, 1 VP per
 * fighter) with a 1 M€ action and a 2-Science requirement. The first card of
 * the set whose action is paid in M€, whose VP count its own resource, and
 * whose tag is Mars.
 *
 * Every rule reading of the card file's header is pinned here: the scan's MIN
 * box is the requirement (the only TAG is Mars), the automatic «Need 1 more M€»
 * reason, the flat cost chip for an ordinary player and the pre-collected
 * payment step for Helion (from `actionPreview`'s generic `spend.megacredits`
 * rule), VP per fighter, and the resource surviving a save.
 */
describe('FormulaZero', () => {
  let card: FormulaZero;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new FormulaZero();
    [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    player.playedCards.push(card);
  });

  const scienceTags = (n: number) => fakeCard({name: `${n} science tags` as CardName, tags: Array(n).fill(Tag.SCIENCE)});

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.FORMULA_ZERO);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(5);
    // The scan's two atoms sit in the MIN box — the requirement; the corner planet is the only tag.
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.resourceType).eq(CardResource.FIGHTER);
    expect(card.metadata.cardNumber).eq('TR08');
    expect(card.requirements).has.lengthOf(1);
    expect(card.requirements[0]).to.include({tag: Tag.SCIENCE, count: 2});
    expect(card.victoryPoints).deep.eq({resourcesHere: {}});
    // No trigger: no card-played hook, no forecast twin.
    const hooks = card as unknown as {onCardPlayed?: unknown, cardPlayedForecast?: unknown};
    expect(hooks.onCardPlayed).is.undefined;
    expect(hooks.cardPlayedForecast).is.undefined;
  });

  describe('the requirement — 2 science tags', () => {
    beforeEach(() => {
      player.playedCards.remove(card);
      player.cardsInHand.push(card);
      player.megaCredits = 20;
    });

    it('is refused with 1 science tag, and the reason IS the printed requirement', () => {
      player.playedCards.push(scienceTags(1));
      expect(player.canPlay(card)).is.false;
      const reasons = unplayableReasons(player, card);
      expect(reasons.some((r) => r.requirement === true), JSON.stringify(reasons)).is.true;
    });

    it('is playable with 2 science tags', () => {
      player.playedCards.push(scienceTags(2));
      expect(player.canPlay(card)).is.true;
      expect(unplayableReasons(player, card)).deep.eq([]);
    });
  });

  describe('the action — pay 1 M€, store 1 fighter', () => {
    it('is unavailable without M€, and the automatic reason names the M€ deficit', () => {
      player.megaCredits = 0;
      expect(card.canAct(player)).is.false;
      expect(actionUnavailableReasons(player, card)).deep.eq([{type: 'megacredits', message: 'Need ${0} more M€', params: ['1']}]);
    });

    it('spends exactly 1 M€ and stores exactly 1 fighter ON THIS CARD, without a prompt', () => {
      player.megaCredits = 3;
      player.heat = 4;
      expect(card.canAct(player)).is.true;
      // Through the REAL blue-action door, so the action runs inside its own event scope.
      const door = cast(player.playActionCard(), SelectCard);
      expect(door.cards.map((c) => c.name)).to.include(CardName.FORMULA_ZERO);
      door.cb([card]);
      runAllActions(game);
      expect(player.popWaitingFor(), 'an ordinary player is never asked how to pay').is.undefined;
      expect(player.megaCredits).eq(2);
      expect(player.heat).eq(4);
      expect(card.resourceCount).eq(1);
    });

    it('the preview is DECLARATIVE: a flat 1 M€ cost chip and a +1 fighter gain chip «on this card», no steps', () => {
      player.megaCredits = 3;
      const preview = actionPreview(player, card);
      expect(preview.kind).eq('declarative');
      if (preview.kind !== 'declarative') {
        return;
      }
      expect(preview.branches).has.lengthOf(1);
      const branch = preview.branches[0];
      expect(branch.effects.find((e) => e.direction === 'cost')).deep.include({icon: 'megacredits', amount: 1, current: 3, resulting: 2});
      expect(branch.effects.find((e) => e.direction === 'gain')).deep.include({icon: 'fighter', amount: 1, current: 0, resulting: 1, note: 'on this card'});
      expect(branch.steps).deep.eq([]);
    });

    describe('Helion — heat is money, so the 1 M€ becomes a payment CHOICE', () => {
      beforeEach(() => {
        player.canUseHeatAsMegaCredits = true;
        player.megaCredits = 0;
        player.heat = 2;
      });

      it('the preview carries the payment step FIRST and drops the flat M€ chip (the generic actionPreview rule)', () => {
        expect(card.canAct(player)).is.true;
        const preview = actionPreview(player, card);
        const branch = preview.branches[0];
        const first = branch.steps[0];
        expect(first?.kind === 'input' && first.input.type === 'payment', JSON.stringify(branch.steps)).is.true;
        if (first?.kind === 'input' && first.input.type === 'payment') {
          expect(first.input.amount).eq(1);
          expect(first.input.paymentOptions.heat).is.true;
        }
        expect(branch.effects.some((e) => e.direction === 'cost' && e.icon === 'megacredits'), 'the widget states the cost').is.false;
        expect(branch.effects.find((e) => e.direction === 'gain')).deep.include({icon: 'fighter', amount: 1});
      });

      it('the action leaves a SelectPayment; paying 1 heat stores the fighter', () => {
        card.action(player);
        runAllActions(game);
        const selectPayment = cast(player.popWaitingFor(), SelectPayment);
        selectPayment.cb(Payment.of({heat: 1}));
        runAllActions(game);
        expect(player.heat).eq(1);
        expect(player.megaCredits).eq(0);
        expect(card.resourceCount).eq(1);
      });
    });
  });

  describe('victory points and tags', () => {
    it('1 VP per fighter here: 0 / 1 / 3 fighters → 0 / 1 / 3', () => {
      for (const n of [0, 1, 3]) {
        card.resourceCount = n;
        expect(card.getVictoryPoints(player), `${n} fighters`).eq(n);
      }
    });

    it('the Mars tag is an ordinary tag: it never counts as science', () => {
      expect(player.tags.count(Tag.MARS)).eq(1);
      expect(player.tags.count(Tag.SCIENCE)).eq(0);
    });
  });

  describe('save / reload', () => {
    it('the stored fighters survive serialization and still score', () => {
      card.resourceCount = 2;
      const serialized = player.serialize();
      expect(serialized.playedCards.find((c) => c.name === CardName.FORMULA_ZERO)?.resourceCount).eq(2);
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(player.id);
      const reloadedCard = again.playedCards.get(CardName.FORMULA_ZERO) as IProjectCard | undefined;
      expect(reloadedCard?.resourceCount).eq(2);
      expect(reloadedCard?.getVictoryPoints(again)).eq(2);
    });
  });
});
