import {expect} from 'chai';
import {AutomatedConvoys, TradeWithAutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {Message} from '../../../src/common/logs/Message';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cast} from '../../../src/common/utils/utils';
import {formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR66 — AUTOMATED CONVOYS: ONE action, two variants (DP11's shape), and the
 * second variant is the trade's SECOND DOOR (TFLP's shape), paid through the
 * card's own `IColonyTrader`. Every rule reading of the card file is pinned.
 */
describe('AutomatedConvoys', () => {
  let card: AutomatedConvoys;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new AutomatedConvoys();
    [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.colonies = [new Luna(), new Triton()];
    player.playedCards.push(card);
  });

  /** Take the card's action; the trade variant defers its colony pick. */
  function pickColony(): SelectColony {
    const selectColony = cast(game.deferredActions.peek()!.execute(), SelectColony);
    game.deferredActions.pop();
    return selectColony;
  }

  function tradeBranch() {
    return card.actionPreview(player).branches[1];
  }

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.AUTOMATED_CONVOYS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(9);
    expect(card.tags).deep.eq([Tag.SPACE]);
    expect(card.resourceType).eq(CardResource.MECH);
    expect(card.metadata.cardNumber).eq('TR66');
    // The MIN box beside the cost is empty on the scan.
    expect(card.requirements).is.empty;
  });

  describe('variant A — pay 2 energy, store 2 mechs', () => {
    it('with 1 energy the branch is blocked by energy', () => {
      player.energy = 1;
      const branch = card.actionPreview(player).branches[0];
      expect(branch.available).is.false;
      expect(branch.unavailableReason).eq('Not enough energy');
    });

    it('spends exactly 2 energy and stores exactly 2 mechs here, on the event stream, with no prompt left', () => {
      player.energy = 2;
      player.megaCredits = 7;
      // No mech → the trade variant is dead, so A IS the whole action.
      const door = cast(player.playActionCard(), SelectCard);
      expect(door.cards.map((c) => c.name)).to.include(CardName.AUTOMATED_CONVOYS);
      expect(door.cb([card])).is.undefined;
      runAllActions(game);
      expect(player.energy).eq(0);
      expect(card.resourceCount).eq(2);
      expect(player.megaCredits).eq(7);
      expect(game.deferredActions).has.lengthOf(0);
      const gained = game.events.events.filter((e) =>
        (e.impact.cardResources ?? []).some((cr) => cr.target === CardName.AUTOMATED_CONVOYS && cr.amount === 2 && cr.cardResource === CardResource.MECH));
      expect(gained.length, 'one card-resource event for the stored mechs').eq(1);
    });
  });

  describe('variant B — the blocked trade names the ACTUAL blocker', () => {
    beforeEach(() => {
      card.resourceCount = 1;
    });

    it('no mech on this card', () => {
      card.resourceCount = 0;
      expect(tradeBranch().available).is.false;
      expect(tradeBranch().unavailableReason).eq('No mechs on this card');
    });

    it('every trade fleet is out', () => {
      player.colonies.usedTradeFleets = player.colonies.getFleetSize();
      expect(tradeBranch().unavailableReason).eq('No trade fleet available');
    });

    it('a trade embargo', () => {
      game.tradeEmbargo = true;
      expect(tradeBranch().unavailableReason).eq('Trade embargo is in effect');
    });

    it('no colony open for trade', () => {
      game.colonies = [];
      expect(tradeBranch().unavailableReason).eq('No colony available to trade with');
    });
  });

  describe('both variants live', () => {
    beforeEach(() => {
      player.energy = 2;
      card.resourceCount = 3;
    });

    it('the action is an OrOptions A, B — the printed row order — marked as this card\'s choice', () => {
      const or = cast(card.action(player), OrOptions);
      expect(or.options).has.lengthOf(2);
      expect(or.options.map((o) => o.title)).deep.eq([
        'Pay 2 energy to add 2 mechs to this card',
        'Spend 1 mech from this card to trade for free',
      ]);
      expect(or.choiceContext?.source.card).eq(CardName.AUTOMATED_CONVOYS);
    });

    it('B trades through the shared trader: 1 mech, a fleet spent, the action marked used, the income paid, logged', () => {
      const or = cast(card.action(player), OrOptions);
      expect(or.options[1].cb()).is.undefined;
      const selectColony = pickColony();
      expect(selectColony.buttonLabel).eq('trade');
      const luna = selectColony.colonies.find((c) => c.name === new Luna().name)!;
      const fleetsBefore = player.colonies.usedTradeFleets;
      selectColony.cb(luna);
      runAllActions(game);

      expect(card.resourceCount).eq(2);
      expect(player.energy).eq(2);
      expect(player.colonies.usedTradeFleets).eq(fleetsBefore + 1);
      expect(player.actionsThisGeneration.has(CardName.AUTOMATED_CONVOYS)).is.true;
      expect(player.megaCredits).eq(2); // Luna at its first income step
      expect(game.gameLog.some((m) => formatMessage(m).includes('spent 1 mech to trade with'))).is.true;
      // One use, both doors: the fee leaves the colonies menu too.
      expect(new TradeWithAutomatedConvoys(player).canUse()).is.false;
    });
  });

  describe('the collapse — one live variant IS the action', () => {
    it('only A: the mechs arrive with no prompt', () => {
      player.energy = 2;
      card.resourceCount = 1;
      game.tradeEmbargo = true;
      expect(card.action(player)).is.undefined;
      expect(card.resourceCount).eq(3);
      expect(player.energy).eq(0);
    });

    it('only B: straight to the colony pick', () => {
      player.energy = 1;
      card.resourceCount = 1;
      expect(card.action(player)).is.undefined;
      expect(pickColony().buttonLabel).eq('trade');
    });
  });

  describe('canAct ⇔ at least one variant, and the dead action names ONE blocker', () => {
    const cases: Array<[energy: number, mechs: number, tradeOpen: boolean, canAct: boolean]> = [
      [2, 0, true, true],
      [1, 1, true, true],
      [2, 1, false, true],
      [1, 0, true, false],
      [1, 1, false, false],
    ];
    for (const [energy, mechs, tradeOpen, expected] of cases) {
      it(`energy ${energy}, mechs ${mechs}, trade ${tradeOpen ? 'open' : 'closed'} → ${expected}`, () => {
        player.energy = energy;
        card.resourceCount = mechs;
        game.tradeEmbargo = !tradeOpen;
        expect(card.canAct(player)).eq(expected);
      });
    }

    it('no mech and too little energy → the energy', () => {
      player.energy = 1;
      expect(actionUnavailableReasons(player, card)).deep.eq([{type: 'resource', message: 'Not enough energy', resource: 'energy'}]);
    });

    it('a mech in hand but the trade closed → what closed it, not the energy', () => {
      player.energy = 1;
      card.resourceCount = 1;
      player.colonies.usedTradeFleets = player.colonies.getFleetSize();
      expect(actionUnavailableReasons(player, card)).deep.eq([{type: 'rule', message: 'No trade fleet available'}]);
    });
  });

  describe('the first door — the colonies menu\'s fee picker', () => {
    const tradeAction = () => cast(player.getActions().options.find((o) => o.title === 'Trade with a colony tile'), AndOptions);
    /** The fee picker's mech row, found by its structural identity — never the label. */
    const mechPath = (pay: OrOptions) => pay.options.find((o) => (o as SelectOption).metadata?.card === CardName.AUTOMATED_CONVOYS);

    it('offers the mech path, dressed and naming its card', () => {
      card.resourceCount = 2;
      const pay = cast(tradeAction().options[0], OrOptions);
      const mech = mechPath(pay);
      expect(mech, 'the mech path must be offered').is.not.undefined;
      expect((mech!.title as Message).message).eq('Pay 1 mech (use ${0} action)');
      expect(new TradeWithAutomatedConvoys(player).optionMetadata()).deep.eq({
        kind: 'resourceRemoval',
        icon: 'mech',
        amount: 1,
        card: CardName.AUTOMATED_CONVOYS,
        resource: {current: 2, resulting: 1},
      });
    });

    it('with 0 mechs the path stays VISIBLE, disabled with its reason', () => {
      player.megaCredits = 9; // another path keeps the trade on offer
      const pay = cast(tradeAction().options[0], OrOptions);
      const disabled = pay.disabledOptions.find((o) => o.metadata?.card === CardName.AUTOMATED_CONVOYS);
      expect(disabled?.reason).eq('No mechs on this card');
    });

    it('after the card\'s action this generation → «already used»', () => {
      card.resourceCount = 2;
      player.megaCredits = 9;
      player.actionsThisGeneration.add(CardName.AUTOMATED_CONVOYS);
      const pay = cast(tradeAction().options[0], OrOptions);
      const disabled = pay.disabledOptions.find((o) => o.metadata?.card === CardName.AUTOMATED_CONVOYS);
      expect(disabled?.reason).eq('This card\'s action was already used this generation');
    });

    it('not owning the card → no option to explain', () => {
      player.playedCards.remove(card);
      expect(new TradeWithAutomatedConvoys(player).disabledReason()).is.undefined;
    });

    it('paying through the menu takes the mech and trades', () => {
      card.resourceCount = 1;
      const action = tradeAction();
      const pay = cast(action.options[0], OrOptions);
      mechPath(pay)!.cb(undefined);
      const selectColony = cast(action.options[1], SelectColony);
      selectColony.cb(selectColony.colonies.find((c) => c.name === new Luna().name)!);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(player.megaCredits).eq(2);
      expect(player.actionsThisGeneration.has(CardName.AUTOMATED_CONVOYS)).is.true;
    });
  });

  describe('the preview', () => {
    it('two branches in the printed order; A carries the energy cost and the +2 here, B the trade step', () => {
      player.energy = 3;
      card.resourceCount = 1;
      const preview = card.actionPreview(player);
      expect(preview.kind).eq('bespoke');
      expect(preview.branches.map((b) => b.title)).deep.eq([
        'Pay 2 energy to add 2 mechs to this card',
        'Spend 1 mech from this card to trade for free',
      ]);
      const [a, b] = preview.branches;
      expect(a.effects.find((e) => e.direction === 'cost')).deep.include({icon: 'energy', amount: 2, current: 3, resulting: 1});
      expect(a.effects.find((e) => e.direction === 'gain')).deep.include({icon: 'mech', amount: 2, current: 1, resulting: 3, note: 'on this card'});
      expect(b.effects).deep.eq([{direction: 'cost', icon: 'mech', amount: 1, current: 1, resulting: 0, note: 'on this card'}]);
      expect(b.steps).deep.eq([{kind: 'colonyTrade', card: CardName.AUTOMATED_CONVOYS}]);
    });
  });

  describe('the mechs here are NOT money', () => {
    it('the payment unit reads EVA Mechs only', () => {
      card.resourceCount = 3;
      expect(player.getSpendable('mechs')).eq(0);
      const eva = new EvaMechs();
      eva.resourceCount = 2;
      player.playedCards.push(eva);
      expect(player.getSpendable('mechs')).eq(2);
    });
  });

  describe('save / reload', () => {
    it('the stored mechs survive serialization', () => {
      card.resourceCount = 2;
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(player.id);
      const reloadedCard = again.playedCards.get(CardName.AUTOMATED_CONVOYS) as IProjectCard | undefined;
      expect(reloadedCard?.resourceCount).eq(2);
    });
  });
});
