import {expect} from 'chai';
import {
  WATER_HAULING_NO_OCEAN_REASON, WATER_HAULING_PLACEMENT_REASON, WaterHauling,
} from '../../../src/server/cards/turmoilRedux/WaterHauling';
import {AutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {VenusTradeHub} from '../../../src/server/cards/prelude2/VenusTradeHub';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {Game} from '../../../src/server/Game';
import {PlayerInput} from '../../../src/server/PlayerInput';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Server} from '../../../src/server/models/ServerModel';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {FLEET_DOCK_BUSY_REASON, fleetDockOffers, isFleetDocked} from '../../../src/server/colonies/FleetDock';
import {buildFleetDockPreview} from '../../../src/server/colonies/colonyTradePreview';
import {AutomaColonies} from '../../../src/server/automa/AutomaColonies';
import {TRADE_FLEET_ICON} from '../../../src/server/colonies/tradeFleetGain';
import {COLONIZATION_FUNDING_ID} from '../../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {MAX_FLEET_SIZE, MAX_OCEAN_TILES} from '../../../src/common/constants';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {SelectColonyModel, SelectSpaceModel} from '../../../src/common/models/PlayerInputModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {cast} from '../../../src/common/utils/utils';
import {questGateOf, quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {maxOutOceans, runAllActions} from '../../TestingUtils';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR06 — WATER HAULING: the first FLEET DOCK («карта-причал»), a card that is
 * a DESTINATION of the trade action. The class's contract is pinned on a
 * stand-in dock in tests/colonies/FleetDock.spec.ts; here every rule reading
 * of the card file's header (1–10) is pinned on the real card, through the
 * real doors.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: WaterHauling};

/** A two-seat Redux table under a QUIET government (the Industrialists: an action-only party), the card PLAYED by p1, two quiet colonies. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
  game.colonies = [new Luna(), new Triton()];
  const card = new WaterHauling();
  p1.playedCards.push(card);
  p1.megaCredits = 0;
  return {game, p1, p2, parliament, card};
}

/** The trade action of the action menu — by its SHAPE (an `and` holding a colony pick), never by its title. */
function tradeAction(player: IPlayer): AndOptions | undefined {
  const found = player.getActions().options.find((o) => o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
  return found === undefined ? undefined : cast(found, AndOptions);
}

const byIcon = (icon: string) => (o: PlayerInput) => (o as SelectOption).metadata?.icon === icon && (o as SelectOption).metadata?.card === undefined && (o as SelectOption).metadata?.party === undefined;
const byParty = (party: PartyName) => (o: PlayerInput) => (o as SelectOption).metadata?.party === party;

/** Answer the trade action: the chosen path + a destination (the dock by default). */
function trade(t: Table, path: (o: PlayerInput) => boolean, destination: InputResponse = {type: 'colony', fleetDock: CardName.WATER_HAULING}): void {
  const action = tradeAction(t.p1)!;
  const pay = cast(action.options[0], OrOptions);
  const index = pay.options.findIndex(path);
  expect(index, 'the payment path is on offer').greaterThanOrEqual(0);
  t.p1.defer(action.process({type: 'and', responses: [{type: 'or', index, response: {type: 'option'}}, destination]}, t.p1));
  runAllActions(t.game);
}

/** The ocean prompt the fleet's landing raised. */
function oceanPrompt(t: Table): SelectSpace {
  return cast(t.p1.getWaitingFor(), SelectSpace);
}

/** Place the ocean on the first offered cell. */
function placeOcean(t: Table): void {
  const prompt = oceanPrompt(t);
  t.p1.process({type: 'space', spaceId: prompt.spaces[0].id});
  runAllActions(t.game);
}

function oceans(game: IGame): number {
  return game.board.getOceanSpaces().length;
}

describe('WaterHauling', () => {
  describe('the card as printed', () => {
    it('is a blue card for 12 with Earth + Space, no requirement, no VP, TR06 — «[trade]* : [ocean]» over «[trade fleet]»', () => {
      const card = new WaterHauling();
      expect(card.name).eq(CardName.WATER_HAULING);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(12);
      expect(card.tags).deep.eq([Tag.EARTH, Tag.SPACE]);
      expect(card.requirements).is.empty;
      expect(card.victoryPoints).is.undefined;
      expect(card.metadata.cardNumber).eq('TR06');
      expect(card.metadata.description).eq('Gain an extra trade fleet.');
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      const flat = JSON.stringify(rows);
      expect(flat).contains('Effect: Once per generation, when you trade, you can send the trade fleet to this card to place an ocean tile.');
      // The effect row: the TRADE glyph with the asterisk, the colon, an ocean tile — in that order.
      expect(flat.indexOf(`"type":"${CardRenderItemType.TRADE}"`)).greaterThan(-1);
      expect(flat.indexOf(`"type":"${CardRenderItemType.OCEANS}"`)).greaterThan(flat.indexOf(`"type":"${CardRenderItemType.TRADE}"`));
      // The on-play row: ONE fleet marker (never the trade glyph).
      const last = rows[rows.length - 1].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(last.map((item) => item.type)).deep.eq([CardRenderItemType.TRADE_FLEET]);
    });

    it('it is a fleet dock, and declares the state a save keeps', () => {
      const card = new WaterHauling();
      expect(card.fleetDock).is.not.undefined;
      expect(Object.prototype.hasOwnProperty.call(card, 'data'), 'the deserializer restores only a declared field').is.true;
      expect(card.data).deep.eq({dockedGeneration: -1});
    });
  });

  describe('rule 10 — «gain an extra trade fleet»', () => {
    it('playing it: fleets 1 → 2, the cost paid, the preview said so', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const card = new WaterHauling();
      p1.cardsInHand.push(card);
      p1.megaCredits = 12;
      const preview = cardPlayPreview(p1, card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches[0].effects).deep.include({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1, current: 1, resulting: 2});
      expect(preview.branches[0].steps.filter((s) => s.kind === 'note')).deep.eq([]);
      p1.playCard(card, Payment.of({megacredits: 12}));
      runAllActions(game);
      expect(p1.colonies.getFleetSize()).eq(2);
      expect(p1.megaCredits).eq(0);
      expect(p1.playedCards.get(CardName.WATER_HAULING)).is.not.undefined;
    });

    it('at the cap of four the gain is a NAMED loss — before the play and after it', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const card = new WaterHauling();
      p1.colonies.setFleetSize(MAX_FLEET_SIZE);
      const preview = cardPlayPreview(p1, card);
      expect(preview.branches[0].effects).deep.include({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1, current: 4, resulting: 4, note: 'limit'});
      const warning = preview.branches[0].steps.find((s) => s.kind === 'note') as {noteKind?: string, skipped?: {label: string}} | undefined;
      expect(warning?.noteKind).eq('warning');
      expect(warning?.skipped?.label).eq('Gain a trade fleet');
      p1.playCard(card);
      runAllActions(game);
      expect(p1.colonies.getFleetSize()).eq(4);
      const skipped = game.events.events.filter((e) => e.type === 'effect-skipped');
      expect(skipped.map((e) => e.impact.skipped)).deep.eq([
        {label: 'Gain a trade fleet', reason: 'Your trade fleet is already at its maximum', effect: {direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1}},
      ]);
    });
  });

  describe('rule 1 — the dock is a destination of every door of the trade', () => {
    it('the trade action\'s pick carries the dock beside the colonies (the `fleetDocks` marker)', () => {
      const t = table();
      t.p1.energy = 3;
      const pick = cast(tradeAction(t.p1)!.options[1], SelectColony);
      const model = pick.toModel(t.p1) as SelectColonyModel;
      expect(model.coloniesModel.map((c) => c.name)).deep.eq(t.game.colonies.map((c) => c.name));
      expect(model.fleetDocks).deep.eq([{
        card: CardName.WATER_HAULING,
        available: true,
        effects: [
          {direction: 'gain', icon: 'oceans', amount: 1, current: 0, resulting: 1},
          {direction: 'gain', icon: 'tr', amount: 1, current: t.p1.terraformRating, resulting: t.p1.terraformRating + 1},
        ],
      }]);
      // …and the wire model the client reads carries it nested inside the action menu.
      t.p1.takeAction();
      expect(JSON.stringify(Server.getPlayerModel(t.p1).waitingFor)).contains('"fleetDocks":[{"card":"Water Hauling","available":true');
    });

    it('Automated Convoys\' door (TR66) offers it too, and the mech pays for the trade with the card', () => {
      const t = table();
      const convoys = new AutomatedConvoys();
      convoys.resourceCount = 1;
      t.p1.playedCards.push(convoys);
      expect(convoys.action(t.p1), 'no energy: the trade variant is the whole action').is.undefined;
      const pick = cast(t.game.deferredActions.pop()!.execute(), SelectColony);
      expect((pick.toModel(t.p1) as SelectColonyModel).fleetDocks?.map((d) => [d.card, d.available])).deep.eq([[CardName.WATER_HAULING, true]]);
      t.p1.defer(pick.process({type: 'colony', fleetDock: CardName.WATER_HAULING}));
      runAllActions(t.game);
      expect(convoys.resourceCount).eq(0);
      expect(t.p1.actionsThisGeneration.has(CardName.AUTOMATED_CONVOYS)).is.true;
      placeOcean(t);
      expect(oceans(t.game)).eq(1);
    });
  });

  describe('rules 2, 3, 6, 8 — the trade with the card, by each standard path', () => {
    const PATHS: ReadonlyArray<{name: string, arrange: (p: TestPlayer) => void, icon: string, left: (p: TestPlayer) => number}> = [
      {name: '3 energy', arrange: (p) => p.energy = 3, icon: 'energy', left: (p) => p.energy},
      {name: '3 titanium', arrange: (p) => p.titanium = 3, icon: 'titanium', left: (p) => p.titanium},
      {name: '9 M€', arrange: (p) => p.megaCredits = 9, icon: 'megacredits', left: (p) => p.megaCredits},
    ];

    for (const path of PATHS) {
      it(`${path.name}: exactly the fee, one fleet on the card, no colony involved, then an ordinary ocean sourced by the card`, () => {
        const t = table();
        path.arrange(t.p1);
        const tr = t.p1.terraformRating;
        trade(t, byIcon(path.icon));

        // The fee — the path's, in full, and nothing else.
        expect(path.left(t.p1)).eq(0);
        // The fleet — one, on the card.
        expect(t.p1.colonies.usedTradeFleets).eq(1);
        expect(isFleetDocked(t.card, t.game.generation)).is.true;
        expect(t.game.events.events.filter((e) => e.type === 'fleet-docked').map((e) => e.target)).deep.eq([{card: CardName.WATER_HAULING}]);
        // No colony took part: no visitor, no income, no track moved.
        expect(t.game.colonies.map((c) => c.visitor)).deep.eq([undefined, undefined]);
        expect(t.game.colonies.map((c) => c.trackPosition)).deep.eq([1, 1]);
        expect(t.p1.colonyTradeManifest, 'no colony reward manifest').is.undefined;

        // The ocean is OWED: a committed placement, sourced by the card.
        const prompt = oceanPrompt(t);
        expect(prompt.sourceCard).eq(CardName.WATER_HAULING);
        expect(prompt.placementContext).deep.eq({cancellable: false, reason: WATER_HAULING_PLACEMENT_REASON, source: {kind: 'card', card: CardName.WATER_HAULING}});
        const model = Server.getPlayerModel(t.p1).waitingFor as SelectSpaceModel;
        expect(model.sourceCard).eq(CardName.WATER_HAULING);
        expect(oceans(t.game), 'nothing is placed before the player points').eq(0);
        expect(t.p1.terraformRating).eq(tr);

        placeOcean(t);
        expect(oceans(t.game)).eq(1);
        expect(t.p1.terraformRating).eq(tr + 1);
        // The tile and its TR join the trade's chain, under the card.
        const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.WATER_HAULING)!;
        expect(root.category).eq('colony');
        const chain = t.game.events.events.filter((e) => e.correlationId === root.id);
        expect(chain.some((e) => e.type === 'tile-placed')).is.true;
        expect(chain.find((e) => e.type === 'tr-changed')?.impact.tr).eq(1);
      });
    }

    it('the fee honours a trade discount: 2 energy under −1', () => {
      const t = table();
      t.p1.colonies.tradeDiscount = 1;
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.energy).eq(1);
      expect(oceanPrompt(t).sourceCard).eq(CardName.WATER_HAULING);
    });

    it('Venus Trade Hub pays its +3 M€ — it IS a trade', () => {
      const t = table();
      t.p1.playedCards.push(new VenusTradeHub());
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.megaCredits).eq(3);
    });

    it('the track offset has nothing to act on: Trading Colony\'s +1 asks nothing and moves nothing', () => {
      const t = table();
      t.p1.colonies.tradeOffset = 1;
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.getWaitingFor(), 'the only prompt is the ocean').instanceOf(SelectSpace);
      expect(t.game.colonies.map((c) => c.trackPosition)).deep.eq([1, 1]);
    });
  });

  describe('rule 4 — once per generation: the berth', () => {
    it('a second attempt in the same generation is refused with the reason, and NOTHING is paid', () => {
      const t = table();
      t.p1.colonies.setFleetSize(2);
      t.p1.energy = 6;
      trade(t, byIcon('energy'));
      placeOcean(t);
      expect(t.p1.energy).eq(3);

      const model = cast(tradeAction(t.p1)!.options[1], SelectColony).toModel(t.p1) as SelectColonyModel;
      expect(model.fleetDocks).deep.include.members([{card: CardName.WATER_HAULING, available: false, reason: FLEET_DOCK_BUSY_REASON, effects: model.fleetDocks![0].effects}]);
      expect(() => trade(t, byIcon('energy'))).to.throw(FLEET_DOCK_BUSY_REASON);
      expect(t.p1.energy, 'the fee stayed').eq(3);
      expect(t.p1.colonies.usedTradeFleets).eq(1);
      expect(oceans(t.game)).eq(1);
    });

    it('…while a COLONY trade by the second fleet goes through as ever — the extra fleet\'s whole point', () => {
      const t = table();
      t.p1.colonies.setFleetSize(2);
      t.p1.energy = 6;
      trade(t, byIcon('energy'));
      placeOcean(t);
      trade(t, byIcon('energy'), {type: 'colony', colonyName: t.game.colonies[0].name});
      expect(t.p1.energy).eq(0);
      expect(t.p1.colonies.usedTradeFleets).eq(2);
      expect(t.game.colonies[0].visitor).eq(t.p1.id);
      expect(t.p1.megaCredits).eq(2); // Luna's first income step
    });

    it('the next generation the berth is free and the public flag is gone', () => {
      const t = table();
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      placeOcean(t);
      const played = () => Server.getPlayerModel(t.p2).players.find((p) => p.color === t.p1.color)!.tableau.find((c) => c.name === CardName.WATER_HAULING)!;
      expect(played().fleetDocked, 'public: a rival sees the fleet on the card').is.true;
      // The generation turns: the fleets come home, the stamp is simply stale.
      t.game.generation++;
      t.p1.colonies.returnTradeFleets();
      expect(played().fleetDocked).is.undefined;
      expect(fleetDockOffers(t.p1)[0]).deep.include({available: true});
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(oceanPrompt(t).sourceCard).eq(CardName.WATER_HAULING);
    });
  });

  describe('rule 5 — a trade with no open colony', () => {
    it('every colony visited, the dock free: `canTrade` is true and the pick offers ZERO colonies and the dock', () => {
      const t = table();
      t.game.colonies.forEach((colony) => colony.visitor = t.p2.id);
      t.p1.energy = 3;
      expect(t.p1.colonies.canTrade()).is.true;
      const model = cast(tradeAction(t.p1)!.options[1], SelectColony).toModel(t.p1) as SelectColonyModel;
      expect(model.coloniesModel).deep.eq([]);
      expect(model.fleetDocks?.map((d) => [d.card, d.available])).deep.eq([[CardName.WATER_HAULING, true]]);
      trade(t, byIcon('energy'));
      placeOcean(t);
      expect(oceans(t.game)).eq(1);
    });

    it('no free fleet: the trade is unavailable for the old reason — the dock changes nothing', () => {
      const t = table();
      t.p1.energy = 3;
      t.p1.colonies.usedTradeFleets = t.p1.colonies.getFleetSize();
      expect(t.p1.colonies.tradeBlockedReason()).eq('No trade fleet available');
      expect(tradeAction(t.p1)).is.undefined;
    });
  });

  describe('rule 7 — no ocean tile left', () => {
    it('the dock is unavailable with its reason, the trade through it is refused BEFORE the fee', () => {
      const t = table();
      maxOutOceans(t.p1);
      expect(oceans(t.game)).eq(MAX_OCEAN_TILES);
      t.p1.megaCredits = 0;
      t.p1.energy = 3;
      const tr = t.p1.terraformRating;
      expect(fleetDockOffers(t.p1)[0]).deep.include({available: false, reason: WATER_HAULING_NO_OCEAN_REASON});
      expect(buildFleetDockPreview(t.p1, t.card)).deep.include({available: false, reason: WATER_HAULING_NO_OCEAN_REASON});
      expect(() => trade(t, byIcon('energy'))).to.throw(WATER_HAULING_NO_OCEAN_REASON);
      expect(t.p1.energy, 'the fee stayed').eq(3);
      expect(t.p1.colonies.usedTradeFleets, 'the fleet stayed').eq(0);
      expect(t.p1.terraformRating).eq(tr);
      expect(isFleetDocked(t.card, t.game.generation)).is.false;
    });

    it('…and with every colony visited too the trade is simply off', () => {
      const t = table();
      maxOutOceans(t.p1);
      t.game.colonies.forEach((colony) => colony.visitor = t.p2.id);
      t.p1.energy = 3;
      expect(t.p1.colonies.canTrade()).is.false;
    });
  });

  describe('rules 6 and 8 — the Parliament counts it', () => {
    it('the «trade N times» quest counts the trade with the card', () => {
      const t = table();
      t.parliament.quest = {definition: {goal: {kind: 'trade'}, count: 2}, source: 'starter', generation: t.game.generation, progress: new Map()};
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.parliament.questProgressOf(t.p1)).eq(1);
      placeOcean(t);
      expect(t.parliament.questProgressOf(t.p1), 'once').eq(1);
    });

    it('a «gain 1 TR» quest is closed by the ocean — and its gate stands AFTER the placement', () => {
      const t = table();
      t.parliament.quest = {definition: {goal: {kind: 'tr'}, count: 1}, source: 'starter', generation: t.game.generation, progress: new Map()};
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(questGateOf(t.p1), 'the fleet has landed; the TR is still ahead').is.undefined;
      expect(t.p1.getWaitingFor()).instanceOf(SelectSpace);
      placeOcean(t);
      expect(t.parliament.quest?.completedBy).eq(t.p1.id);
      expect(questGateOf(t.p1), 'the gate rises once the ocean is down').is.not.undefined;
    });

    it('the ruling Greens pay their 2 M€ for the ocean\'s TR', () => {
      const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      expect(parliament.rulingParty(), 'a fresh table: the Greens').eq(PartyName.GREENS);
      game.colonies = [new Luna(), new Triton()];
      const card = new WaterHauling();
      p1.playedCards.push(card);
      const t: Table = {game, p1, p2, parliament, card};
      p1.megaCredits = 0;
      p1.energy = 3;
      trade(t, byIcon('energy'));
      const prompt = oceanPrompt(t);
      // A cell with no bonus of its own, so the M€ below is the Greens' alone.
      const bare = prompt.spaces.find((space) => space.bonus.length === 0) ?? prompt.spaces[0];
      const before = p1.megaCredits;
      p1.process({type: 'space', spaceId: bare.id});
      runAllActions(game);
      expect(p1.megaCredits - before).eq(2);
    });

    it('the Unity action: the dock is free, the use is spent, no track step is asked', () => {
      const t = table();
      seatEnacted(t.parliament, COLONIZATION_FUNDING_ID);
      expect(t.parliament.hasPartyEffect(t.p1, PartyName.UNITY), 'Unity rules — its action is everyone\'s').is.true;
      trade(t, byParty(PartyName.UNITY));
      expect(t.parliament.partyActionUsesLeft(t.p1, PartyName.UNITY)).eq(0);
      expect(t.p1.megaCredits).eq(0);
      expect(t.p1.getWaitingFor(), 'the ocean, never a track question').instanceOf(SelectSpace);
      placeOcean(t);
      expect(oceans(t.game)).eq(1);
    });
  });

  describe('rule 9 — only the owner; MarsBot trades past it', () => {
    it('a rival never sees the dock among THEIR destinations', () => {
      const t = table();
      t.p2.energy = 3;
      const model = cast(tradeAction(t.p2)!.options[1], SelectColony).toModel(t.p2) as SelectColonyModel;
      expect(model.fleetDocks).is.undefined;
      expect(() => cast(tradeAction(t.p2)!.options[1], SelectColony).process({type: 'colony', fleetDock: CardName.WATER_HAULING})).to.throw(/Fleet dock Water Hauling not found/);
    });

    it('at a MarsBot table the human trades with the card and the bot\'s own trade never touches it', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.playerIsFinishedWithResearchPhase(human);
      human.popWaitingFor();
      game.phase = Phase.ACTION;
      const card = new WaterHauling();
      human.playedCards.push(card);
      human.energy = 3;
      const t: Table = {game, p1: human, p2: human, parliament: game.parliament!, card};
      trade(t, byIcon('energy'));
      expect(isFleetDocked(card, game.generation)).is.true;
      placeOcean(t);
      expect(oceans(game)).eq(1);
      // The bot trades with a COLONY tile, by its own rule — the card is not one of its candidates.
      bot.megaCredits = 5;
      const visitedBefore = game.colonies.filter((c) => c.visitor !== undefined).length;
      expect(AutomaColonies.botTrade(game)).is.true;
      expect(game.colonies.filter((c) => c.visitor !== undefined).length).eq(visitedBefore + 1);
      expect(game.events.events.filter((e) => e.type === 'fleet-docked')).has.lengthOf(1);
    });
  });

  describe('the preview of the trade — read-only, and what the composer shows', () => {
    it('oceans N → N+1, +1 TR, the «place an ocean» note; building it changes nothing', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      const preview = buildFleetDockPreview(t.p1, t.card);
      expect(preview.effects).deep.eq([
        {direction: 'gain', icon: 'oceans', amount: 1, current: 0, resulting: 1},
        {direction: 'gain', icon: 'tr', amount: 1, current: t.p1.terraformRating, resulting: t.p1.terraformRating + 1},
      ]);
      expect(preview.followUps).deep.eq([{kind: 'note', role: 'tradeReward', note: 'placeOcean'}]);
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect(t.game.events.events.length).eq(events);
    });
  });

  describe('what the TABLE is told — the journal row and a rival\'s notification', () => {
    /** The trade taken through the real action menu (the player's own door), the ocean placed. */
    function tradeThroughMenu(t: Table): number {
      t.p1.energy = 3;
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const tradeIndex = menu.options.findIndex((o) => o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
      const pay = cast(cast(menu.options[tradeIndex], AndOptions).options[0], OrOptions);
      const energy = pay.options.findIndex(byIcon('energy'));
      t.p1.process({type: 'or', index: tradeIndex, response: {type: 'and', responses: [
        {type: 'or', index: energy, response: {type: 'option'}},
        {type: 'colony', fleetDock: CardName.WATER_HAULING},
      ]}});
      runAllActions(t.game);
      placeOcean(t);
      return t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.WATER_HAULING)!.id;
    }

    it('ONE chain under the card: the headline, the fleet on the card, the ocean and its TR, the fee', () => {
      const t = table();
      const root = tradeThroughMenu(t);
      const header = t.game.gameLog.find((m) => m.correlationId === root && m.role === 'root-action');
      expect(header?.message).eq('${0} sent a trade fleet to ${1}');
      expect(header?.category).eq('colony');
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      expect(chain.map((e) => e.type)).to.include.members(['action', 'fleet-docked', 'tile-placed', 'tr-changed']);
      const rows = buildEventChildren(chain, root, t.p1.color);
      const fleet = rows.find((row) => row.chips.some((chip) => chip.icon === TRADE_FLEET_ICON));
      expect(fleet?.source, 'the row names the card the fleet went to').deep.eq({kind: 'card', card: CardName.WATER_HAULING});
      expect(fleet?.chips).deep.eq([{icon: TRADE_FLEET_ICON, text: '−1'}]);
      expect(rows.some((row) => row.bucket === 'placement'), 'the ocean is its own placement row').is.true;
      expect(rows.some((row) => row.chips.some((chip) => chip.icon === 'tr' && chip.text === '+1'))).is.true;
      expect(rows.find((row) => row.bucket === 'payment')?.chips).deep.eq([{icon: 'energy', text: '−3'}]);
    });

    it('a rival\'s notification: the headline names the card, the pills carry the ocean\'s TR and the fee, the breakdown the fleet', () => {
      const t = table();
      const root = tradeThroughMenu(t);
      // The headline is the root's own line — its last token is the CARD, so the card says where the fleet went.
      const header = t.game.gameLog.find((m) => m.correlationId === root && m.role === 'root-action')!;
      expect(header.data[header.data.length - 1]).deep.eq({type: LogMessageDataType.CARD, value: CardName.WATER_HAULING});
      const impact = recomputeRootImpact(t.game.events.events, root, t.p1.color, t.p2.color);
      const pills = impact.pillGroups.flatMap((group) => group.chips).map((chip) => `${chip.icon} ${chip.text}`);
      expect(pills).to.include.members(['tr +1', 'energy −3']);
      // The pills are the top-ranked few; the fleet is a row of the breakdown («Перевозка воды: [fleet] −1»).
      expect(impact.childVMs.some((row) => row.chips.some((chip) => chip.icon === TRADE_FLEET_ICON && chip.text === '−1'))).is.true;
      expect(impact.skipped).deep.eq([]);
    });
  });

  it('save / load keeps the fleet on the card, and the berth stays taken', () => {
    const t = table();
    t.p1.energy = 3;
    trade(t, byIcon('energy'));
    placeOcean(t);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    const card = again.playedCards.get(CardName.WATER_HAULING)!;
    expect(card.data).deep.eq({dockedGeneration: live.generation});
    expect(isFleetDocked(card, live.generation)).is.true;
    expect(again.colonies.usedTradeFleets).eq(1);
    expect(fleetDockOffers(again)[0]).deep.include({available: false, reason: FLEET_DOCK_BUSY_REASON});
  });
});
