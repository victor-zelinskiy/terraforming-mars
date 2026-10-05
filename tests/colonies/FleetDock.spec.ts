import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {fakeCard, maxOutOceans, runAllActions} from '../TestingUtils';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';

import {PlayerInput} from '../../src/server/PlayerInput';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {Payment} from '../../src/common/inputs/Payment';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {SelectColonyModel} from '../../src/common/models/PlayerInputModel';
import {cast} from '../../src/common/utils/utils';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {Luna} from '../../src/server/colonies/Luna';
import {Triton} from '../../src/server/colonies/Triton';
import {
  availableFleetDocks, FLEET_DOCK_BUSY_REASON, FleetDock, FleetDockCard, fleetDockBlockedReason, fleetDockOffers, isFleetDocked,
} from '../../src/server/colonies/FleetDock';
import {dockFleet, FleetDockDestination} from '../../src/server/colonies/FleetDockDestination';
import {buildColonyTradePreview, buildFleetDockPreview} from '../../src/server/colonies/colonyTradePreview';
import {tradeFlatBonuses} from '../../src/server/colonies/tradePerformed';
import {TradeWithEnergy} from '../../src/server/player/Colonies';
import {cardsToModel} from '../../src/server/models/ModelUtils';
import {potentialActions} from '../../src/server/models/potentialActions';
import {VenusTradeHub} from '../../src/server/cards/prelude2/VenusTradeHub';
import {CryoSleep} from '../../src/server/cards/colonies/CryoSleep';
import {TitanFloatingLaunchPad} from '../../src/server/cards/colonies/TitanFloatingLaunchPad';
import {AutomatedConvoys} from '../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {DeltaWorks} from '../../src/server/cards/delta/DeltaWorks';
import {DarksideSmugglersUnion} from '../../src/server/cards/moon/DarksideSmugglersUnion';
import {CollegiumCopernicus} from '../../src/server/cards/pathfinders/CollegiumCopernicus';
import {HecateSpeditions} from '../../src/server/cards/underworld/HecateSpeditions';
import * as actionPreviews from '../../src/server/cards/actionPreviews';
import {CardResource} from '../../src/common/CardResource';
import {ColonyTradeFollowUpModel} from '../../src/common/models/ColonyTradePreviewModel';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {Priority} from '../../src/server/deferredActions/Priority';
import {drainBatchTail, parkedBatchTailLength, replayBatch} from '../../src/server/inputs/deferredInputBatch';
import {Ants} from '../../src/server/cards/base/Ants';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Decomposers} from '../../src/server/cards/base/Decomposers';

/**
 * THE FLEET DOCK — the CLASS contract («карта-причал»), on a dock that is not
 * Water Hauling. The stand-in pays the UNMI Liner's shape of reward (TR26: a
 * plain gain, no question), so everything pinned here is the class's, and the
 * next dock inherits it: the offer and its ONE reason, the destination every
 * payment path trades with (the table — each path of `tradeHandlers()` × a
 * dock: exactly its own fee, its own journal line naming the card, the trade
 * performed once), the trade gate with a dock in it, and the preview's parity
 * with the execution.
 */
const DOCK = 'A test fleet dock' as CardName;
const REWARD_BLOCKED = 'The test reward is blocked';

/** A dock whose reward is +1 titanium production (no fee is ever paid in production, so every fee row stays exact). */
function testDock(blocked: () => boolean = () => false): FleetDockCard {
  let card: FleetDockCard | undefined = undefined;
  const fleetDock: FleetDock = {
    rewardBlockedReason: () => blocked() ? REWARD_BLOCKED : undefined,
    previewEffects: (player) => [actionPreviews.productionChange(player, Resource.TITANIUM, 1)],
    receive: (player) => {
      player.production.add(Resource.TITANIUM, 1, {log: true});
    },
  };
  card = fakeCard({name: DOCK, fleetDock, data: {dockedGeneration: -1}}) as IProjectCard & {fleetDock: FleetDock};
  return card;
}

/** The trade action of the action menu — found by its SHAPE (an `and` holding a colony pick), never by its title. */
function tradeAction(player: IPlayer): AndOptions | undefined {
  const found = player.getActions().options.find((o) => o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
  return found === undefined ? undefined : cast(found, AndOptions);
}

function pickOf(action: AndOptions): SelectColony {
  return cast(action.options[1], SelectColony);
}

/** Answer the trade action: the path chosen by `path`, the fleet to the dock. */
function sendFleet(game: IGame, player: TestPlayer, path: (option: PlayerInput) => boolean, dock: CardName = DOCK): void {
  const action = tradeAction(player)!;
  const pay = cast(action.options[0], OrOptions);
  const index = pay.options.findIndex(path);
  expect(index, 'the payment path is on offer').greaterThanOrEqual(0);
  const response: InputResponse = {type: 'and', responses: [{type: 'or', index, response: {type: 'option'}}, {type: 'colony', fleetDock: dock}]};
  player.defer(action.process(response, player));
  runAllActions(game);
}

/** A payment path by the ICON of its metadata (the standard three), by its CARD, or by its party. */
const byIcon = (icon: string) => (o: PlayerInput) => (o as SelectOption).metadata?.icon === icon && (o as SelectOption).metadata?.card === undefined && (o as SelectOption).metadata?.party === undefined;
const byCard = (card: CardName) => (o: PlayerInput) => (o as SelectOption).metadata?.card === card;
const byParty = (party: PartyName) => (o: PlayerInput) => (o as SelectOption).metadata?.party === party;
/** The paths with no metadata (out of the premium scope) are found by the card their title names. */
const byTitleCard = (card: CardName) => (o: PlayerInput) => typeof o.title !== 'string' && o.title.data.some((d) => d.type === LogMessageDataType.CARD && d.value === card);

function docked(game: IGame): number {
  return game.events.events.filter((e) => e.type === 'fleet-docked').length;
}

describe('FleetDock — a card as a destination of the trade', () => {
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let dock: FleetDockCard;

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {coloniesExtension: true});
    game.colonies = [new Luna(), new Triton()];
    dock = testDock();
    player.playedCards.push(dock);
  });

  describe('the offer — every dock of the tableau, with the server\'s verdict and ONE reason', () => {
    it('a free dock is available, with the reward\'s chips', () => {
      const offers = fleetDockOffers(player);
      expect(offers).has.lengthOf(1);
      expect(offers[0]).deep.include({card: dock, available: true});
      expect(offers[0].reason).is.undefined;
      expect(offers[0].effects).deep.eq([{direction: 'gain', icon: Resource.TITANIUM, amount: 1, current: 0, resulting: 1, note: 'production'}]);
      expect(availableFleetDocks(player)).deep.eq([dock]);
    });

    it('occupied × reward: the berth outranks the reward, each alone names itself', () => {
      let rewardBlocked = false;
      const judged = testDock(() => rewardBlocked);
      player.playedCards.remove(dock);
      player.playedCards.push(judged);
      const reasonOf = () => fleetDockBlockedReason(player, judged);
      expect(reasonOf()).is.undefined;
      rewardBlocked = true;
      expect(reasonOf(), 'the reward alone').eq(REWARD_BLOCKED);
      judged.data = {dockedGeneration: game.generation};
      expect(reasonOf(), 'both — the berth is named').eq(FLEET_DOCK_BUSY_REASON);
      rewardBlocked = false;
      expect(reasonOf(), 'the berth alone').eq(FLEET_DOCK_BUSY_REASON);
    });

    it('only the OWNER\'s tableau is read — another seat\'s dock is never a destination', () => {
      expect(fleetDockOffers(opponent)).deep.eq([]);
      expect(availableFleetDocks(opponent)).deep.eq([]);
    });

    it('a card with no data (an older save) is simply a free dock', () => {
      dock.data = undefined;
      expect(isFleetDocked(dock, game.generation)).is.false;
      expect(fleetDockOffers(player)[0].available).is.true;
    });
  });

  describe('the marker — the trade\'s destination pick carries the docks', () => {
    it('`fleetDocks` rides the colony pick of the trade action, beside the colonies', () => {
      player.megaCredits = 9;
      const model = pickOf(tradeAction(player)!).toModel(player) as SelectColonyModel;
      expect(model.coloniesModel.map((c) => c.name)).deep.eq(game.colonies.map((c) => c.name));
      expect(model.fleetDocks).deep.eq([{card: DOCK, available: true, effects: fleetDockOffers(player)[0].effects}]);
    });

    it('an unavailable dock is LISTED with its reason, and an answer naming it is refused with that reason — nothing paid', () => {
      player.megaCredits = 9;
      dock.data = {dockedGeneration: game.generation};
      const action = tradeAction(player)!;
      const model = pickOf(action).toModel(player) as SelectColonyModel;
      expect(model.fleetDocks).deep.eq([{card: DOCK, available: false, reason: FLEET_DOCK_BUSY_REASON, effects: fleetDockOffers(player)[0].effects}]);
      expect(() => sendFleet(game, player, byIcon('megacredits'))).to.throw(FLEET_DOCK_BUSY_REASON);
      expect(player.megaCredits).eq(9);
      expect(player.colonies.usedTradeFleets).eq(0);
      expect(docked(game)).eq(0);
    });

    it('a dock that filled AFTER the prompt was built is refused live, before the fee', () => {
      player.megaCredits = 9;
      const action = tradeAction(player)!;
      dock.data = {dockedGeneration: game.generation};
      const pay = cast(action.options[0], OrOptions);
      const index = pay.options.findIndex(byIcon('megacredits'));
      expect(() => action.process({type: 'and', responses: [{type: 'or', index, response: {type: 'option'}}, {type: 'colony', fleetDock: DOCK}]}, player))
        .to.throw(FLEET_DOCK_BUSY_REASON);
      expect(player.megaCredits).eq(9);
    });

    it('a card that is no dock of this prompt is refused like an unknown colony', () => {
      player.megaCredits = 9;
      expect(() => sendFleet(game, player, byIcon('megacredits'), CardName.ANTS)).to.throw(/Fleet dock Ants not found/);
      expect(player.megaCredits).eq(9);
    });

    it('a colony pick that is NOT a trade\'s destination pick carries no docks and refuses a dock answer', () => {
      const plain = new SelectColony('Select a colony', 'OK', game.colonies);
      expect((plain.toModel(player) as SelectColonyModel).fleetDocks).is.undefined;
      expect(() => plain.process({type: 'colony', fleetDock: DOCK})).to.throw(/Fleet dock .* not found/);
    });
  });

  describe('the destination — each payment path of `tradeHandlers()` × the dock', () => {
    type Row = {
      name: string,
      /** Redux table (the Unity path needs the Parliament). */
      redux?: boolean,
      arrange: (p: TestPlayer, g: IGame) => void,
      path: (option: PlayerInput) => boolean,
      /** A prompt the path defers before the trade (the M€ mix, the Delta Works mix). */
      answer?: (p: TestPlayer, g: IGame) => void,
      /** The journal line of the path — its last token must be the dock CARD. */
      line: string,
      /** Exactly the path's own fee was taken. */
      paid: (p: TestPlayer, g: IGame) => void,
    };

    const ROWS: ReadonlyArray<Row> = [
      {
        name: 'energy — 3 energy',
        arrange: (p) => {
          p.energy = 3;
        },
        path: byIcon('energy'),
        line: '${0} spent ${1} energy to trade with ${2}',
        paid: (p) => expect(p.energy).eq(0),
      },
      {
        name: 'energy under a trade discount (Cryo-Sleep) — 2 energy, the saving recorded against the DOCK',
        arrange: (p) => {
          p.playedCards.push(new CryoSleep());
          p.colonies.tradeDiscount = 1;
          p.energy = 3;
        },
        path: byIcon('energy'),
        line: '${0} spent ${1} energy to trade with ${2}',
        paid: (p, g) => {
          expect(p.energy).eq(1);
          const saved = g.events.events.find((e) => e.impact.tradeDiscountSaved !== undefined);
          expect(saved?.impact.tradeDiscountSaved).deep.eq([{dock: DOCK, resource: 'energy', amount: 1}]);
        },
      },
      {
        name: 'energy with Delta Works — the chosen steel mix',
        arrange: (p) => {
          p.playedCards.push(new DeltaWorks());
          p.energy = 2;
          p.steel = 2;
        },
        path: byIcon('energy'),
        answer: (p, g) => {
          // Answered through the player's own door, so the answer rejoins the trade's chain.
          const mix = cast(p.getWaitingFor(), SelectAmount);
          expect([mix.min, mix.max]).deep.eq([1, 2]);
          p.process({type: 'amount', amount: 2});
          runAllActions(g);
        },
        line: '${0} spent ${1} energy and ${2} steel to trade with ${3}',
        paid: (p) => {
          expect(p.energy).eq(1);
          expect(p.steel).eq(0);
        },
      },
      {
        name: 'titanium — 3 titanium',
        arrange: (p) => {
          p.titanium = 3;
        },
        path: byIcon('titanium'),
        line: '${0} spent ${1} titanium to trade with ${2}',
        paid: (p) => expect(p.titanium).eq(0),
      },
      {
        name: 'M€ — 9 M€, paid automatically',
        arrange: (p) => {
          p.megaCredits = 9;
        },
        path: byIcon('megacredits'),
        line: '${0} spent ${1} M€ to trade with ${2}',
        // 9 for the fee; the flat +3 of the Venus Trade Hub every row carries is the only M€ back.
        paid: (p) => expect(p.megaCredits).eq(3),
      },
      {
        name: 'M€ with heat (Helion) — the DEFERRED payment prompt, answered before the fleet lands',
        arrange: (p) => {
          p.megaCredits = 5;
          p.heat = 6;
          p.canUseHeatAsMegaCredits = true;
        },
        path: byIcon('megacredits'),
        answer: (p, g) => {
          expect(docked(g), 'the fleet waits for the fee').eq(0);
          cast(p.getWaitingFor(), SelectPayment);
          p.process({type: 'payment', payment: {...Payment.EMPTY, megacredits: 5, heat: 4}});
          runAllActions(g);
        },
        line: '${0} spent ${1} M€ to trade with ${2}',
        paid: (p) => {
          expect(p.megaCredits).eq(3);
          expect(p.heat).eq(2);
        },
      },
      {
        name: 'Titan Floating Launch-Pad — 1 floater, the action marked used',
        arrange: (p) => {
          const tflp = new TitanFloatingLaunchPad();
          tflp.resourceCount = 1;
          p.playedCards.push(tflp);
        },
        path: byCard(CardName.TITAN_FLOATING_LAUNCHPAD),
        line: '${0} spent 1 floater to trade with ${1}',
        paid: (p) => {
          expect(p.tableau.get(CardName.TITAN_FLOATING_LAUNCHPAD)?.resourceCount).eq(0);
          expect(p.actionsThisGeneration.has(CardName.TITAN_FLOATING_LAUNCHPAD)).is.true;
        },
      },
      {
        name: 'Automated Convoys — 1 mech, the action marked used',
        arrange: (p) => {
          const convoys = new AutomatedConvoys();
          convoys.resourceCount = 1;
          p.playedCards.push(convoys);
        },
        path: byCard(CardName.AUTOMATED_CONVOYS),
        line: '${0} spent 1 mech to trade with ${1}',
        paid: (p) => {
          expect(p.tableau.get(CardName.AUTOMATED_CONVOYS)?.resourceCount).eq(0);
          expect(p.actionsThisGeneration.has(CardName.AUTOMATED_CONVOYS)).is.true;
        },
      },
      {
        name: 'the Unity action — free, the use recorded, no track step asked',
        redux: true,
        arrange: (p, g) => {
          g.parliament!.grantPartyEffect(p, PartyName.UNITY, 'spec');
        },
        path: byParty(PartyName.UNITY),
        line: '${0} used the ${1} action to trade for free with ${2}',
        paid: (p, g) => {
          expect(g.parliament!.partyActionUsesLeft(p, PartyName.UNITY)).eq(0);
          expect(p.getWaitingFor(), 'there is no track to advance — nothing is asked').is.undefined;
        },
      },
      {
        name: 'Darkside Smugglers\' Union — free, the action marked used',
        arrange: (p) => {
          p.playedCards.push(new DarksideSmugglersUnion());
        },
        path: byTitleCard(CardName.DARKSIDE_SMUGGLERS_UNION),
        line: '${0} used ${1} action to trade with ${2}',
        paid: (p) => expect(p.actionsThisGeneration.has(CardName.DARKSIDE_SMUGGLERS_UNION)).is.true,
      },
      {
        name: 'Collegium Copernicus — 3 data',
        arrange: (p) => {
          const collegium = new CollegiumCopernicus();
          collegium.resourceCount = 3;
          p.playedCards.push(collegium);
        },
        path: byTitleCard(CardName.COLLEGIUM_COPERNICUS),
        line: '${0} spent ${1} data from ${2} to trade with ${3}',
        paid: (p) => expect(p.tableau.get(CardName.COLLEGIUM_COPERNICUS)?.resourceCount).eq(0),
      },
      {
        name: 'Hecate Speditions — 2 supply chain resources',
        arrange: (p) => {
          const hecate = new HecateSpeditions();
          hecate.resourceCount = 2;
          p.playedCards.push(hecate);
        },
        path: byTitleCard(CardName.HECATE_SPEDITIONS),
        line: '${0} spent ${1} ${2} from ${3} to trade with ${4}',
        paid: (p) => expect(p.tableau.get(CardName.HECATE_SPEDITIONS)?.resourceCount).eq(0),
      },
    ];

    for (const row of ROWS) {
      it(row.name, () => {
        const [g, p] = row.redux === true ?
          testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true}) :
          testGame(2, {coloniesExtension: true});
        g.phase = Phase.ACTION;
        g.colonies = [new Luna(), new Triton()];
        const card = testDock();
        // The flat every-trade bonus rides every row: paid ONCE is how «the trade was performed once» is seen.
        p.playedCards.push(card, new VenusTradeHub());
        p.megaCredits = 0;
        row.arrange(p, g);
        const at = g.gameLog.length;

        sendFleet(g, p, row.path);
        row.answer?.(p, g);

        // The fee — exactly the path's own.
        row.paid(p, g);
        // The fleet: one, on the card, spent.
        expect(p.colonies.usedTradeFleets).eq(1);
        expect(isFleetDocked(card, g.generation)).is.true;
        expect(docked(g)).eq(1);
        expect(g.colonies.map((c) => c.visitor), 'no colony took part').deep.eq([undefined, undefined]);
        expect(g.colonies.map((c) => c.trackPosition), 'no track moved').deep.eq([1, 1]);
        // The reward — the card's, once.
        expect(p.production.titanium).eq(1);
        // The trade was performed ONCE: the flat bonus is paid once, and named.
        const flat = g.events.events.filter((e) => e.impact.stock?.megacredits === 3);
        expect(flat).has.lengthOf(1);
        expect(flat[0].source).deep.include({card: CardName.VENUS_TRADE_HUB});
        // The path's own journal line ends on the DOCK CARD — a path never learned it is not a colony.
        const line = g.gameLog.slice(at).find((m) => m.message === row.line);
        expect(line, `the path logs «${row.line}»`).is.not.undefined;
        expect(line!.data[line!.data.length - 1]).deep.eq({type: LogMessageDataType.CARD, value: DOCK});
        // The chain roots at the dock card, in the trade's own category.
        const root = g.events.events.find((e) => e.id === g.events.events.find((d) => d.type === 'fleet-docked')!.correlationId);
        expect(root).deep.include({type: 'action', category: 'colony'});
        expect(root?.source).deep.eq({kind: 'card', card: DOCK, owner: p.color});
      });
    }

    it('the trade action writes the headline «sent a trade fleet to <card>» first', () => {
      player.energy = 3;
      const at = game.gameLog.length;
      sendFleet(game, player, byIcon('energy'));
      const lines = game.gameLog.slice(at).map((m) => m.message);
      expect(lines.slice(0, 2)).deep.eq(['${0} sent a trade fleet to ${1}', '${0} spent ${1} energy to trade with ${2}']);
    });

    it('`fleet-docked` is a journal fact naming the card, under the card\'s source', () => {
      player.energy = 3;
      sendFleet(game, player, byIcon('energy'));
      const event = game.events.events.find((e) => e.type === 'fleet-docked')!;
      expect(event).deep.include({player: player.color, visibility: 'journal'});
      expect(event.target).deep.eq({card: DOCK});
      expect(event.source).deep.eq({kind: 'card', card: DOCK, owner: player.color});
    });

    it('a COLONY trade through the same door is byte-for-byte the old one (headline, fee, visitor)', () => {
      player.energy = 3;
      const at = game.gameLog.length;
      const action = tradeAction(player)!;
      const pay = cast(action.options[0], OrOptions);
      const index = pay.options.findIndex(byIcon('energy'));
      player.defer(action.process({type: 'and', responses: [{type: 'or', index, response: {type: 'option'}}, {type: 'colony', colonyName: game.colonies[0].name}]}, player));
      runAllActions(game);
      expect(game.gameLog.slice(at).map((m) => m.message).slice(0, 2)).deep.eq(['${0} traded with ${1}', '${0} spent ${1} energy to trade with ${2}']);
      expect(game.colonies[0].visitor).eq(player.id);
      expect(player.megaCredits).eq(2); // Luna's first income step
      expect(docked(game)).eq(0);
      expect(isFleetDocked(dock, game.generation)).is.false;
    });

    it('`dockFleet` is the one writer of the state, and the destination refuses nothing on its own account', () => {
      const destination = new FleetDockDestination(dock);
      expect(destination.tradeSource).deep.eq({kind: 'card', card: DOCK});
      expect(destination.tradeBlockedReason(player)).is.undefined;
      dockFleet(player, dock);
      expect(dock.data).deep.eq({dockedGeneration: game.generation});
      expect(destination.tradeBlockedReason(player)).eq(FLEET_DOCK_BUSY_REASON);
    });
  });

  describe('the trade gate with a dock in it', () => {
    it('every colony visited, the dock free → the trade is ON, and its pick is the dock alone', () => {
      game.colonies.forEach((colony) => colony.visitor = opponent.id);
      player.megaCredits = 9;
      expect(player.colonies.tradeBlockedReason()).is.undefined;
      expect(player.colonies.canTrade()).is.true;
      const model = pickOf(tradeAction(player)!).toModel(player) as SelectColonyModel;
      expect(model.coloniesModel).deep.eq([]);
      expect(model.fleetDocks?.map((d) => [d.card, d.available])).deep.eq([[DOCK, true]]);
      sendFleet(game, player, byIcon('megacredits'));
      expect(docked(game)).eq(1);
    });

    it('every colony visited and the dock occupied → the colony reason, as ever', () => {
      game.colonies.forEach((colony) => colony.visitor = opponent.id);
      dock.data = {dockedGeneration: game.generation};
      expect(player.colonies.tradeBlockedReason()).eq('No colony available to trade with');
      expect(tradeAction(player)).is.undefined;
    });

    it('the embargo and the fleet outrank the dock', () => {
      game.colonies.forEach((colony) => colony.visitor = opponent.id);
      player.colonies.usedTradeFleets = player.colonies.getFleetSize();
      expect(player.colonies.tradeBlockedReason()).eq('No trade fleet available');
      player.colonies.usedTradeFleets = 0;
      game.tradeEmbargo = true;
      expect(player.colonies.tradeBlockedReason()).eq('Trade embargo is in effect');
    });

    it('`colonyOnly` asks the historical question — the doors that offer colonies alone never open an empty pick', () => {
      game.colonies.forEach((colony) => colony.visitor = opponent.id);
      expect(player.colonies.canTrade()).is.true;
      expect(player.colonies.canTrade({colonyOnly: true})).is.false;
      expect(player.colonies.tradeBlockedReason({colonyOnly: true})).eq('No colony available to trade with');
      const darkside = new DarksideSmugglersUnion();
      const collegium = new CollegiumCopernicus();
      collegium.resourceCount = 3;
      expect(darkside.canAct(player)).is.false;
      expect(collegium.canAct(player)).is.false;
      game.colonies[0].visitor = undefined;
      expect(darkside.canAct(player)).is.true;
      expect(collegium.canAct(player)).is.true;
    });

    it('a card door that became available through the dock alone OFFERS the dock (Titan Floating Launch-Pad, Automated Convoys)', () => {
      game.colonies.forEach((colony) => colony.visitor = opponent.id);
      const tflp = new TitanFloatingLaunchPad();
      tflp.resourceCount = 1;
      const convoys = new AutomatedConvoys();
      convoys.resourceCount = 1;
      player.playedCards.push(tflp, convoys);
      for (const door of [tflp, convoys]) {
        const branch = door.actionPreview(player).branches.find((b) => b.steps.some((s) => s.kind === 'colonyTrade'))!;
        expect(branch.available, `${door.name}: the trade variant is live`).is.true;
      }
      // Automated Convoys with no energy: the trade variant IS the action — straight to the destination pick.
      expect(convoys.action(player)).is.undefined;
      const pick = cast(game.deferredActions.pop()!.execute(), SelectColony);
      const model = pick.toModel(player) as SelectColonyModel;
      expect(model.coloniesModel).deep.eq([]);
      expect(model.fleetDocks?.map((d) => d.card)).deep.eq([DOCK]);
      player.defer(pick.process({type: 'colony', fleetDock: DOCK}));
      runAllActions(game);
      expect(convoys.resourceCount).eq(0);
      expect(docked(game)).eq(1);
      expect(game.gameLog.some((m) => m.message === '${0} sent a trade fleet to ${1}'), 'a card door has no headline of the action\'s').is.false;
    });

    it('`potentialTradeCount` = min(colonies + available docks, free fleets)', () => {
      player.megaCredits = 30;
      expect(player.colonies.potentialTradeCount(), 'one fleet').eq(1);
      player.colonies.setFleetSize(4);
      expect(player.colonies.potentialTradeCount(), 'two colonies + the dock').eq(3);
      expect(potentialActions(player).colonyTrades).eq(3);
      dock.data = {dockedGeneration: game.generation};
      expect(player.colonies.potentialTradeCount(), 'the dock is occupied').eq(2);
      game.colonies.forEach((colony) => colony.visitor = opponent.id);
      expect(player.colonies.potentialTradeCount()).eq(0);
      dock.data = {dockedGeneration: -1};
      expect(player.colonies.potentialTradeCount(), 'the dock alone').eq(1);
    });
  });

  describe('the generation — the berth frees itself, and the state is public and saved', () => {
    it('`CardModel.fleetDocked` is set while the fleet stands on the card, for every viewer, and absent otherwise', () => {
      expect(cardsToModel(player, [dock])[0].fleetDocked).is.undefined;
      dockFleet(player, dock);
      expect(cardsToModel(player, [dock])[0].fleetDocked, 'the livery is the owner\'s').eq(player.color);
      expect(cardsToModel(opponent, [dock])[0].fleetDocked, 'public — and still the colour of the OWNER, whoever asks').eq(player.color);
      game.generation++;
      expect(cardsToModel(player, [dock])[0].fleetDocked, 'the next generation').is.undefined;
      expect(fleetDockOffers(player)[0].available).is.true;
    });
  });

  describe('the preview — the dock twin of the colony preview', () => {
    it('carries the verdict, the reward\'s chips and the flat bonuses; the payment part IS the colony preview\'s', () => {
      player.megaCredits = 5;
      player.heat = 6;
      player.canUseHeatAsMegaCredits = true;
      player.playedCards.push(new VenusTradeHub());
      const preview = buildFleetDockPreview(player, dock);
      expect(preview).deep.include({card: DOCK, available: true});
      expect(preview.reason).is.undefined;
      expect(preview.effects).deep.eq(fleetDockOffers(player)[0].effects);
      expect(preview.followUps).deep.eq([]);
      expect(preview.flatBonuses).deep.eq(tradeFlatBonuses(player).map((b) => ({card: b.card, resource: b.resource, amount: b.amount})));
      const colony = buildColonyTradePreview(player, game.colonies[0]);
      expect(preview.megacreditsPayment, 'the M€ prompt is the same fact').deep.eq(colony.megacreditsPayment);
      expect(preview.megacreditsPayment?.amount).eq(9);
      expect(preview.energyMix).deep.eq(colony.energyMix);
    });

    it('an unavailable dock says why', () => {
      dock.data = {dockedGeneration: game.generation};
      expect(buildFleetDockPreview(player, dock)).deep.include({available: false, reason: FLEET_DOCK_BUSY_REASON});
    });

    it('PARITY: what the preview promises is what the trade pays (the fee and the chips)', () => {
      player.playedCards.push(new DeltaWorks());
      player.energy = 2;
      player.steel = 2;
      const preview = buildFleetDockPreview(player, dock);
      expect(preview.energyMix).deep.include({cost: new TradeWithEnergy(player).cost, minSteel: 1, maxSteel: 2});
      const promised = preview.effects[0];
      sendFleet(game, player, byIcon('energy'));
      cast(player.getWaitingFor(), SelectAmount);
      player.process({type: 'amount', amount: preview.energyMix!.minSteel});
      runAllActions(game);
      expect(player.energy + player.steel, 'the fee of the mix').eq(4 - preview.energyMix!.cost);
      expect(player.production.titanium, 'the chip\'s resulting value').eq(promised.resulting);
    });

    it('never mutates game state', () => {
      player.megaCredits = 5;
      player.heat = 6;
      player.canUseHeatAsMegaCredits = true;
      const before = JSON.stringify(game.serialize());
      const events = game.events.events.length;
      buildFleetDockPreview(player, dock);
      fleetDockOffers(player);
      expect(JSON.stringify(game.serialize())).eq(before);
      expect(game.events.events.length).eq(events);
    });
  });

  /**
   * A REWARD WITH A QUESTION (TR27 Aurora Station's shape) — the stand-in pays
   * «2 microbes to any card» and THEN +1 titanium production. The class reads
   * the card's ONE built step for the preview and queues the same step at the
   * landing; everything the card pays besides it waits behind the answer.
   */
  describe('a reward with a CARD TARGET — one object for the preview and the landing', () => {
    const ASKING = 'A test dock that asks' as CardName;

    function askingDock(): FleetDockCard {
      const fleetDock: FleetDock = {
        previewEffects: (p) => [actionPreviews.cardResourceGain(CardResource.MICROBE, 2), actionPreviews.productionChange(p, Resource.TITANIUM, 1)],
        rewardTarget: (p) => new AddResourcesToCard(p, CardResource.MICROBE, {count: 2}),
        receive: (p) => {
          p.production.add(Resource.TITANIUM, 1, {log: true});
        },
      };
      return fakeCard({name: ASKING, fleetDock, data: {dockedGeneration: -1}}) as IProjectCard & {fleetDock: FleetDock};
    }

    let asking: FleetDockCard;
    beforeEach(() => {
      player.playedCards.remove(dock);
      asking = askingDock();
      player.playedCards.push(asking);
    });

    function targetOf(): Extract<ColonyTradeFollowUpModel, {kind: 'cardTarget'}> {
      const followUp = buildFleetDockPreview(player, asking).followUps[0];
      expect(followUp?.kind, 'the target leads the follow-ups').eq('cardTarget');
      return followUp as Extract<ColonyTradeFollowUpModel, {kind: 'cardTarget'}>;
    }

    /** The types of the events the landing wrote under the dock card, in order. */
    function landingEvents(from: number): Array<string> {
      return game.events.events.slice(from)
        .filter((e) => e.source?.kind === 'card' && e.source.card === ASKING)
        .map((e) => e.type);
    }

    it('no holder: the preview says LOST, and the landing names the loss and still pays the rest — after it', () => {
      expect(targetOf()).deep.eq({kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 2, lost: true});
      const from = game.events.events.length;
      dockFleet(player, asking);
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      expect(player.production.titanium).eq(1);
      expect(landingEvents(from)).deep.eq(['fleet-docked', 'effect-skipped', 'production-changed']);
    });

    it('ONE holder: the preview names it (`auto`) with its points per unit; the landing asks NOTHING, the microbes land first', () => {
      const ants = new Ants();
      player.playedCards.push(ants);
      expect(targetOf()).deep.eq({
        kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 2, auto: CardName.ANTS,
        vpSteps: {[CardName.ANTS]: [{from: 0, to: 0}, {from: 0, to: 1}]}, lost: false,
      });
      const from = game.events.events.length;
      dockFleet(player, asking);
      runAllActions(game);
      expect(player.getWaitingFor(), 'no question after the fleet has landed').is.undefined;
      expect(ants.resourceCount).eq(2);
      expect(player.production.titanium).eq(1);
      expect(landingEvents(from)).deep.eq(['fleet-docked', 'card-resource-changed', 'production-changed']);
    });

    it('TWO holders: the preview\'s pick IS the live prompt (candidates, order, the dock as its source) — and the rest waits for the answer', () => {
      const ants = new Ants();
      const tardigrades = new Tardigrades();
      player.playedCards.push(ants, tardigrades);
      const target = targetOf();
      expect(target.auto).is.undefined;
      expect(target.pick?.cards.map((c) => c.name)).deep.eq([CardName.ANTS, CardName.TARDIGRADES]);
      expect(Object.keys(target.vpSteps ?? {})).deep.eq([CardName.ANTS, CardName.TARDIGRADES]);
      dockFleet(player, asking);
      runAllActions(game);
      const live = cast(player.getWaitingFor(), SelectCard);
      expect(live.toModel(player), 'one construction, two answers of it').deep.eq(target.pick);
      expect(live.choiceContext?.source, 'the question is THIS dock\'s by structure (serialized with the waitingFor)').deep.eq({kind: 'card', card: ASKING});
      expect(player.production.titanium, 'nothing past the question is paid before it is answered').eq(0);
      player.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect(tardigrades.resourceCount).eq(2);
      expect(ants.resourceCount).eq(0);
      expect(player.production.titanium).eq(1);
    });

    /** The real action menu, the trade answered for the dock, and the target as the batch's tail. */
    function tradeBatch(target: CardName): Array<InputResponse> {
      player.takeAction();
      const menu = cast(player.getWaitingFor(), OrOptions);
      const tradeIndex = menu.options.findIndex((o) => o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
      const pay = cast(cast(menu.options[tradeIndex], AndOptions).options[0], OrOptions);
      const energy = pay.options.findIndex(byIcon('energy'));
      return [
        {type: 'or', index: tradeIndex, response: {type: 'and', responses: [{type: 'or', index: energy, response: {type: 'option'}}, {type: 'colony', fleetDock: ASKING}]}},
        {type: 'card', cards: [target]},
      ];
    }

    it('the batch `[destination, card]` lands whole in ONE submit — no question is left standing', () => {
      game.phase = Phase.ACTION;
      const tardigrades = new Tardigrades();
      player.playedCards.push(new Ants(), tardigrades);
      player.energy = 3;
      replayBatch(player, tradeBatch(CardName.TARDIGRADES));
      expect(player.getWaitingFor()?.type, 'only the next action is asked').not.eq('card');
      expect(tardigrades.resourceCount).eq(2);
      expect(player.production.titanium).eq(1);
      expect(parkedBatchTailLength(player)).eq(0);
    });

    it('PARKED: a question that jumps ahead keeps the target in the park, and it lands on its own prompt after', () => {
      game.phase = Phase.ACTION;
      const tardigrades = new Tardigrades();
      player.playedCards.push(new Ants(), tardigrades);
      player.energy = 3;
      const batch = tradeBatch(CardName.TARDIGRADES);
      game.defer(new SimpleDeferredAction(player, () => new SelectOption('Somebody else asks first'), Priority.COST));
      replayBatch(player, batch);
      cast(player.getWaitingFor(), SelectOption);
      expect(parkedBatchTailLength(player), 'the target is PARKED, not dropped').eq(1);
      expect(tardigrades.resourceCount).eq(0);
      player.process({type: 'option'});
      drainBatchTail(player);
      expect(parkedBatchTailLength(player)).eq(0);
      expect(tardigrades.resourceCount).eq(2);
      expect(player.production.titanium).eq(1);
    });

    it('STALE: a chosen card that stopped being a candidate is dropped, and the question stands LIVE — the dock\'s', () => {
      game.phase = Phase.ACTION;
      const ants = new Ants();
      const tardigrades = new Tardigrades();
      const decomposers = new Decomposers();
      player.playedCards.push(ants, tardigrades, decomposers);
      player.energy = 3;
      const batch = tradeBatch(CardName.DECOMPOSERS);
      player.playedCards.remove(decomposers);
      replayBatch(player, batch);
      const live = cast(player.getWaitingFor(), SelectCard);
      expect(live.cards.map((c) => c.name)).deep.eq([CardName.ANTS, CardName.TARDIGRADES]);
      expect(live.choiceContext?.source).deep.eq({kind: 'card', card: ASKING});
      expect(parkedBatchTailLength(player)).eq(0);
      expect(player.production.titanium).eq(0);
    });

    it('the preview stays READ-ONLY with a target in it', () => {
      player.playedCards.push(new Ants(), new Tardigrades());
      const before = JSON.stringify(game.serialize());
      const queued = game.deferredActions.length;
      buildFleetDockPreview(player, asking);
      expect(JSON.stringify(game.serialize())).eq(before);
      expect(game.deferredActions.length).eq(queued);
    });
  });

  it('the reward\'s blocker is the CARD\'s own: a full ocean board changes nothing for a dock that places none', () => {
    // (The save round-trip needs a card a manifest knows — it is pinned on the real dock, WaterHauling.spec.)
    maxOutOceans(player);
    expect(fleetDockOffers(player)[0].available).is.true;
  });
});
