import {expect} from 'chai';
import {
  TradeWithVeynonDynamics, VEYNON_MECH_TITLE, VEYNON_TRADE_TITLE, VeynonDynamics,
} from '../../../src/server/cards/turmoilRedux/VeynonDynamics';
import {AutomatedConvoys, TradeWithAutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {WaterHauling} from '../../../src/server/cards/turmoilRedux/WaterHauling';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {Europa} from '../../../src/server/colonies/Europa';
import {IColony} from '../../../src/server/colonies/IColony';
import {buildColonyTradePreview} from '../../../src/server/colonies/colonyTradePreview';
import {IncreaseColonyTrack} from '../../../src/server/deferredActions/IncreaseColonyTrack';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {trackTop} from '../../../src/common/colonies/ColonyMetadata';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Message} from '../../../src/common/logs/Message';
import {cast} from '../../../src/common/utils/utils';
import {formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR85 — VEYNON DYNAMICS: 36 M€ + 1 titanium production + a mech here, Jovian + Venus; «when you trade with a colony
 * track, you may first increase it 1 step» (Trade Envoys' `tradeOffset`); «add 1 mech resource to ANY card, OR spend
 * 1 mech from here to trade for free» (the shared card door). Every rule reading of the card file's header is pinned.
 */
describe('VeynonDynamics', () => {
  let card: VeynonDynamics;
  let game: IGame;
  let player: TestPlayer;
  let luna: IColony;

  beforeEach(() => {
    [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    luna = new Luna();
    game.colonies = [luna, new Triton()];
    card = new VeynonDynamics();
    player.playCorporationCard(card);
    runAllActions(game);
    game.phase = Phase.ACTION;
  });

  /** The deferred destination pick of the trade door. */
  function pickColony(): SelectColony {
    const selectColony = cast(game.deferredActions.peek()!.execute(), SelectColony);
    game.deferredActions.pop();
    return selectColony;
  }

  describe('rule 1 — the printed card', () => {
    it('a corporation of 36 M€, Jovian + Venus, mechs, no VP and no first action', () => {
      expect(card.name).eq(CardName.VEYNON_DYNAMICS);
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(36);
      expect(card.tags).deep.eq([Tag.JOVIAN, Tag.VENUS]);
      expect(card.resourceType).eq(CardResource.MECH);
      expect(card.victoryPoints).is.undefined;
      expect(card.firstAction).is.undefined;
      expect(card.metadata.cardNumber).eq('TR85');
      expect(card.resourceRole).deep.eq({kind: 'trade', price: 1});
    });

    it('the eighth registry row — every new corporation is authored — and the Colonies mark', () => {
      expect(newCorporationCardNumber(CardName.VEYNON_DYNAMICS)).eq('TR85');
      expect(TURMOIL_REDUX_NEW_CORPORATIONS.every((row) => row.authored !== undefined)).is.true;
      expect(TURMOIL_REDUX_NEW_CORPORATIONS).has.lengthOf(8);
      expect(TURMOIL_REDUX_CARD_MANIFEST.corporationCards?.[CardName.VEYNON_DYNAMICS]?.compatibility).eq('colonies');
    });
  });

  describe('rule 2 — the play', () => {
    it('36 M€, +1 titanium production, 1 mech here, one standing track step', () => {
      expect(player.megaCredits).eq(36);
      expect(player.production.titanium).eq(1);
      expect(card.resourceCount).eq(1);
      expect(player.colonies.tradeOffset).eq(1);
    });
  });

  describe('rule 3 — the effect: Trade Envoys\' step, one plan', () => {
    it('a trade with Luna reads its income one step further (a same-kind reach advances without asking)', () => {
      const plan = luna.tradeTrackPlan(player);
      expect(plan.steps).eq(1);
      const before = player.megaCredits;
      luna.trade(player);
      runAllActions(game);
      expect(luna.trackPosition).eq(0, 'the trade resets the track after the income');
      const withoutStep = new Luna();
      const [, other] = testGame(1);
      withoutStep.trade(other);
      expect(player.megaCredits - before).is.greaterThan(other.megaCredits, 'the income came from the advanced cell');
    });

    it('a colony whose landings pay different things ASKS — N steps, then «don\'t» (the «you may»)', () => {
      const europa = new Europa();
      game.colonies.push(europa);
      const plan = europa.tradeTrackPlan(player);
      expect(plan.ask).is.true;
      expect(plan.steps).eq(1);
      expect(plan.minSteps).eq(0);
      europa.trade(player);
      const ask = game.deferredActions.peek();
      expect(ask).instanceOf(IncreaseColonyTrack);
      const or = cast(ask!.execute(), OrOptions);
      expect(or.options).has.lengthOf(2);
      expect(or.options[1].title).eq('Don\'t increase colony track');
    });

    it('the preview reads the SAME plan the trade executes', () => {
      const europa = new Europa();
      game.colonies.push(europa);
      const preview = buildColonyTradePreview(player, europa);
      expect(preview.track).deep.include({current: europa.trackPosition, steps: 1, willAsk: true});
    });

    it('sums with a path\'s own step (the Unity path) — one server sum', () => {
      expect(luna.tradeTrackPlan(player, 1).steps).eq(2);
    });

    it('at the top of the track there is nothing to raise', () => {
      luna.trackPosition = trackTop(luna.metadata);
      expect(luna.tradeTrackPlan(player).steps).eq(0);
    });

    it('a fleet dock has no track: B sent to Water Hauling asks no track question and moves no track', () => {
      player.playedCards.push(new WaterHauling());
      const or = cast(card.action(player), OrOptions);
      or.options[1].cb();
      const pick = pickColony();
      expect(pick.fleetDocks?.map((d) => d.card)).deep.eq([CardName.WATER_HAULING]);
      const tracks = game.colonies.map((c) => c.trackPosition);
      player.defer(pick.process({type: 'colony', fleetDock: CardName.WATER_HAULING}));
      runAllActions(game);
      expect(card.resourceCount, 'the mech paid for the dock trade').eq(0);
      expect(game.colonies.map((c) => c.trackPosition)).deep.eq(tracks);
      expect(player.getWaitingFor()).not.instanceOf(OrOptions, 'no «increase the track» question');
    });

    it('a selfish trade (Coordinated Raid) reads no offset', () => {
      luna.trackPosition = 1;
      const before = player.megaCredits;
      luna.trade(player, {selfishTrade: true});
      runAllActions(game);
      const [, other] = testGame(1);
      const plain = new Luna();
      plain.trackPosition = 1;
      plain.trade(other, {selfishTrade: true});
      runAllActions(other.game);
      expect(player.megaCredits - before).eq(other.megaCredits);
    });
  });

  describe('rule 4 — variant A: a mech to ANY card', () => {
    it('A is always live — this card holds mechs — and with B dead it IS the action: the pick, never auto-applied', () => {
      card.resourceCount = 0;
      expect(card.canAct(player)).is.true;
      expect(card.action(player)).is.undefined;
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.VEYNON_DYNAMICS], 'one candidate — shown, not applied');
      expect(card.resourceCount).eq(0);
      pick.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(1);
    });

    it('every mech holder of the player\'s is a candidate', () => {
      card.resourceCount = 0;
      const eva = new EvaMechs();
      player.playedCards.push(eva);
      card.action(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.VEYNON_DYNAMICS, CardName.EVA_MECHS]);
      pick.cb([eva]);
      runAllActions(game);
      expect(eva.resourceCount).eq(1);
    });
  });

  describe('rule 5 — variant B: the trade\'s second door', () => {
    it('both live → OrOptions A, B — the printed order — marked as this card\'s choice', () => {
      const or = cast(card.action(player), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([VEYNON_MECH_TITLE, VEYNON_TRADE_TITLE]);
      expect(or.choiceContext?.source.card).eq(CardName.VEYNON_DYNAMICS);
    });

    it('B: 1 mech, a fleet spent, the action marked used, the track stepped, the income paid, logged', () => {
      const or = cast(card.action(player), OrOptions);
      or.options[1].cb();
      const selectColony = pickColony();
      expect(selectColony.buttonLabel).eq('trade');
      const fleetsBefore = player.colonies.usedTradeFleets;
      const mcBefore = player.megaCredits;
      selectColony.cb(selectColony.colonies.find((c) => c.name === luna.name)!);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(player.colonies.usedTradeFleets).eq(fleetsBefore + 1);
      expect(player.actionsThisGeneration.has(CardName.VEYNON_DYNAMICS)).is.true;
      expect(player.megaCredits).is.greaterThan(mcBefore + 2, 'Luna paid from the stepped cell, not its first');
      expect(game.gameLog.some((m) => formatMessage(m).includes('spent 1 mech to trade with'))).is.true;
      expect(new TradeWithVeynonDynamics(player).canUse()).is.false;
    });

    for (const [label, arrange, reason] of [
      ['no mech here', () => card.resourceCount = 0, 'No mechs on this card'],
      ['every fleet out', () => player.colonies.usedTradeFleets = player.colonies.getFleetSize(), 'No trade fleet available'],
      ['an embargo', () => game.tradeEmbargo = true, 'Trade embargo is in effect'],
    ] as const) {
      it(`B blocked by ${label} — ONE named blocker, the card's premise first`, () => {
        arrange();
        const b = card.actionPreview(player).branches[1];
        expect(b.available).is.false;
        expect(b.unavailableReason).eq(reason);
      });
    }

    it('the mech blocker outranks the trade gate', () => {
      card.resourceCount = 0;
      game.tradeEmbargo = true;
      expect(card.actionPreview(player).branches[1].unavailableReason).eq('No mechs on this card');
    });
  });

  describe('rule 5 — the first door: the colonies menu\'s fee picker', () => {
    const tradeAction = () => cast(player.getActions().options.find((o) => o.title === 'Trade with a colony tile'), AndOptions);
    const mechPath = (pay: OrOptions) => pay.options.find((o) => (o as SelectOption).metadata?.card === CardName.VEYNON_DYNAMICS);

    it('offers «1 mech (Veynon Dynamics action)», dressed and naming its card', () => {
      const pay = cast(tradeAction().options[0], OrOptions);
      const mech = mechPath(pay);
      expect(mech).is.not.undefined;
      expect((mech!.title as Message).message).eq('Pay 1 mech (use ${0} action)');
      expect(new TradeWithVeynonDynamics(player).optionMetadata()).deep.eq({
        kind: 'resourceRemoval', icon: 'mech', amount: 1, card: CardName.VEYNON_DYNAMICS, resource: {current: 1, resulting: 0},
      });
    });

    it('without a mech the path stays VISIBLE, disabled with its reason', () => {
      card.resourceCount = 0;
      player.megaCredits = 9;
      const pay = cast(tradeAction().options[0], OrOptions);
      expect(pay.disabledOptions.find((o) => o.metadata?.card === CardName.VEYNON_DYNAMICS)?.reason).eq('No mechs on this card');
    });

    it('after the action this generation (either variant) → «already used»', () => {
      player.actionsThisGeneration.add(CardName.VEYNON_DYNAMICS);
      player.megaCredits = 9;
      const pay = cast(tradeAction().options[0], OrOptions);
      expect(pay.disabledOptions.find((o) => o.metadata?.card === CardName.VEYNON_DYNAMICS)?.reason)
        .eq('This card\'s action was already used this generation');
    });
  });

  describe('rule 6 — isolation', () => {
    it('the mechs here are not money', () => {
      card.resourceCount = 3;
      expect(player.getSpendable('mechs')).eq(0);
    });

    it('beside Automated Convoys: two paths, each naming its own card', () => {
      const convoys = new AutomatedConvoys();
      convoys.resourceCount = 1;
      player.playedCards.push(convoys);
      const pay = cast(cast(player.getActions().options.find((o) => o.title === 'Trade with a colony tile'), AndOptions).options[0], OrOptions);
      const cards = pay.options.map((o) => (o as SelectOption).metadata?.card).filter((c) => c !== undefined);
      expect(cards).to.include.members([CardName.AUTOMATED_CONVOYS, CardName.VEYNON_DYNAMICS]);
      expect(new TradeWithAutomatedConvoys(player).canUse()).is.true;
      expect(new TradeWithVeynonDynamics(player).canUse()).is.true;
    });
  });

  describe('rule 7 — the preview is the execution', () => {
    it('A: «+1 mech to a card» and the pick; B: the mech here and the trade step naming this card', () => {
      const preview = card.actionPreview(player);
      expect(preview.branches.map((b) => b.title)).deep.eq([VEYNON_MECH_TITLE, VEYNON_TRADE_TITLE]);
      const [a, b] = preview.branches;
      expect(a.available).is.true;
      expect(a.effects).deep.eq([{direction: 'gain', icon: 'mech', amount: 1, note: 'to a card'}]);
      expect(a.steps.map((s) => s.kind)).deep.eq(['input']);
      expect(b.effects).deep.eq([{direction: 'cost', icon: 'mech', amount: 1, current: 1, resulting: 0, note: 'on this card'}]);
      expect(b.steps).deep.eq([{kind: 'colonyTrade', card: CardName.VEYNON_DYNAMICS}]);
    });
  });

  describe('rule 8 — save / reload', () => {
    it('the mechs, the standing step and the used action survive', () => {
      card.resourceCount = 2;
      player.actionsThisGeneration.add(CardName.VEYNON_DYNAMICS);
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const again = reloaded.getPlayerById(player.id);
      expect(again.tableau.get(CardName.VEYNON_DYNAMICS)?.resourceCount).eq(2);
      expect(again.colonies.tradeOffset).eq(1);
      expect(again.actionsThisGeneration.has(CardName.VEYNON_DYNAMICS)).is.true;
    });
  });
});
