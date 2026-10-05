import {expect} from 'chai';
import {AuroraStation} from '../../../src/server/cards/turmoilRedux/AuroraStation';
import {WaterHauling} from '../../../src/server/cards/turmoilRedux/WaterHauling';
import {UnmiLiner} from '../../../src/server/cards/turmoilRedux/UnmiLiner';
import {NovaCity} from '../../../src/server/cards/turmoilRedux/NovaCity';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {AutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {FloatingHabs} from '../../../src/server/cards/venusNext/FloatingHabs';
import {Stratopolis} from '../../../src/server/cards/venusNext/Stratopolis';
import {FloaterTechnology} from '../../../src/server/cards/colonies/FloaterTechnology';
import {VenusTradeHub} from '../../../src/server/cards/prelude2/VenusTradeHub';
import {Pets} from '../../../src/server/cards/base/Pets';
import {ImmigrantCity} from '../../../src/server/cards/base/ImmigrantCity';
import {Mayor} from '../../../src/server/milestones/Mayor';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {Game} from '../../../src/server/Game';
import {PlayerInput} from '../../../src/server/PlayerInput';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Server} from '../../../src/server/models/ServerModel';
import {potentialActions} from '../../../src/server/models/potentialActions';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {isCompatibleWith} from '../../../src/server/cards/CardFactorySpec';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {Luna} from '../../../src/server/colonies/Luna';
import {Triton} from '../../../src/server/colonies/Triton';
import {Titan} from '../../../src/server/colonies/Titan';
import {VenusRedux, VENUS_REDUX_NO_FLOATER_HOLDER_REASON} from '../../../src/server/colonies/VenusRedux';
import {FLEET_DOCK_BUSY_REASON, fleetDockOffers, isFleetDocked} from '../../../src/server/colonies/FleetDock';
import {buildFleetDockPreview} from '../../../src/server/colonies/colonyTradePreview';
import {AutomaColonies} from '../../../src/server/automa/AutomaColonies';
import {TRADE_FLEET_ICON} from '../../../src/server/colonies/tradeFleetGain';
import {COLONIZATION_FUNDING_ID} from '../../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {CardResource} from '../../../src/common/CardResource';
import {SpaceName} from '../../../src/common/boards/SpaceName';
import {TileType} from '../../../src/common/TileType';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {SelectColonyModel} from '../../../src/common/models/PlayerInputModel';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {fleetDockEffectNode} from '../../../src/client/console/colonyTrade/fleetDockModel';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';

/**
 * TR27 — AURORA STATION: the THIRD fleet dock («карта-причал»), the first
 * whose reward ASKS — two floaters onto a Venus card of the player's choosing,
 * then +1 M€ production — and a city on its own cell beside the Venus track.
 * The class's own contract (the question as one object for the preview and
 * the landing, the batch, the park, the stale pick) is pinned on a stand-in
 * dock in tests/colonies/FleetDock.spec.ts and held for every manifest dock by
 * tests/colonies/FleetDockManifest.spec.ts; here every rule reading of the
 * card file's header (1–16) is pinned on the real card, through the real doors.
 */
const AURORA = CardName.AURORA_STATION;
const U = PartyName.UNITY;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: AuroraStation};

/** A two-seat Redux + Venus Next table under a QUIET government, the card PLAYED by p1, two quiet colonies. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
  game.colonies = [new Luna(), new Triton()];
  const card = new AuroraStation();
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

/** Answer the trade action: the chosen path + a destination (the station by default). */
function trade(t: Table, path: (o: PlayerInput) => boolean, destination: InputResponse = {type: 'colony', fleetDock: AURORA}): void {
  const action = tradeAction(t.p1)!;
  const pay = cast(action.options[0], OrOptions);
  const index = pay.options.findIndex(path);
  expect(index, 'the payment path is on offer').greaterThanOrEqual(0);
  t.p1.defer(action.process({type: 'and', responses: [{type: 'or', index, response: {type: 'option'}}, destination]}, t.p1));
  runAllActions(t.game);
}

/** The root of the trade's chain — the action sourced by the station. */
function rootOf(game: IGame): number {
  const roots = game.events.events.filter((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === AURORA);
  return roots[roots.length - 1].id;
}

describe('AuroraStation', () => {
  describe('the card as printed', () => {
    it('a blue card for 14 with Venus + City + Space under Unity\'s plate, floaters 1 VP / 2, TR27', () => {
      const card = new AuroraStation();
      expect(card.name).eq(AURORA);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(14);
      expect(card.tags).deep.eq([Tag.VENUS, Tag.CITY, Tag.SPACE]);
      expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem').eq(U);
      expect(card.requirements).has.length(1);
      expect(card.resourceType).eq(CardResource.FLOATER);
      expect(card.victoryPoints).deep.eq({resourcesHere: {}, per: 2});
      expect(card.metadata.cardNumber).eq('TR27');
      expect(card.metadata.description).eq('Requires Unity to be ruling or that you have 2 delegates there. Place a city tile NEXT TO THE VENUS TRACK.');
      expect(card.behavior).deep.eq({city: {space: SpaceName.AURORA_STATION}});
    });

    it('the effect row: ▲* : TWO floater icons with the Venus bubble, then the M€ production plate', () => {
      const node = fleetDockEffectNode(new AuroraStation().metadata.renderData);
      expect(node, 'the fleet has a ▲ to land on').is.not.undefined;
      const result = (node!.rows[node!.rows.length - 1] ?? []).filter((item) => isICardRenderItem(item) || (item as {is?: string}).is !== undefined);
      const items = result.filter((item) => isICardRenderItem(item)) as Array<ICardRenderItem>;
      const floaters = items.filter((item) => item.type === CardRenderItemType.RESOURCE && item.resource === CardResource.FLOATER);
      expect(floaters, 'two icons, never «2 [floater]»').has.lengthOf(2);
      expect(floaters.map((item) => [item.amount <= 1, item.secondaryTag]), 'one unit per icon, each with the Venus bubble').deep.eq([[true, Tag.VENUS], [true, Tag.VENUS]]);
      const flat = JSON.stringify(node);
      expect(flat).contains('production');
      expect(flat).contains(CardRenderItemType.MEGACREDITS);
      expect(JSON.stringify(new AuroraStation().metadata.renderData)).contains('Effect: Once per generation, when you trade, you can send the trade fleet to this card to add 2 floaters to ANY VENUS CARD and increase your M€ production 1 step.');
    });

    it('stands in the Redux manifest behind BOTH gates — Colonies and Venus Next (never `turmoil`)', () => {
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = manifest.projectCards[AURORA]!;
      expect(new entry.Factory().name).eq(AURORA);
      expect(entry.compatibility).deep.eq(['colonies', 'venus']);
    });

    it('a fleet dock whose reward ASKS, with NO blocker, declaring the state a save keeps — and no fleet of its own', () => {
      const card = new AuroraStation();
      expect(card.fleetDock.rewardBlockedReason, 'rule 6: the card is always its own candidate').is.undefined;
      expect(card.fleetDock.rewardTarget, 'the question is a step the class reads').is.not.undefined;
      expect(card.fleetDock.previewFollowUps, 'the class derives the follow-up from the target').is.undefined;
      expect(card.data).deep.eq({dockedGeneration: -1});
      expect(card.behavior?.colonies, 'rule 3: no trade fleet').is.undefined;
    });
  });

  describe('rule 1 — the requirement is a condition of the PLAY', () => {
    function handTable(): {game: IGame, p1: TestPlayer, parliament: Parliament, card: AuroraStation} {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.GREENS, U, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      const card = new AuroraStation();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      return {game, p1, parliament, card};
    }

    it('neither road: unplayable with Unity\'s NAMED reason, and only it', () => {
      const t = handTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Unity rules: playable; two delegates on its resolution: playable', () => {
      const t = handTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      const u = handTable();
      seatEnacted(u.parliament, quietResolutionOf(U));
      expect(u.p1.canPlay(u.card)).is.true;
    });

    it('once played the dock works whoever rules', () => {
      const t = table();
      expect(t.parliament.access(t.p1, U).satisfiesRequirement).is.false;
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.card.resourceCount).eq(2);
    });
  });

  describe('rule 2 — the city lands on its OWN cell beside the Venus track', () => {
    function played(arrange: (p1: TestPlayer) => void = () => {}): Table {
      const t = table();
      t.p1.playedCards.remove(t.card);
      seatEnacted(t.parliament, quietResolutionOf(U));
      arrange(t.p1);
      t.p1.megaCredits = 14;
      t.p1.cardsInHand.push(t.card);
      t.p1.playCard(t.card);
      runAllActions(t.game);
      return t;
    }

    it('a real city of the player on the cell `80`, off Mars, with no placement bonus and no question', () => {
      const t = played();
      const space = t.game.board.getSpaceOrThrow(SpaceName.AURORA_STATION);
      expect(space.tile?.tileType).eq(TileType.CITY);
      expect(space.player?.id).eq(t.p1.id);
      expect(space.bonus).deep.eq([]);
      expect(t.game.board.getCitiesOffMars(t.p1).map((s) => s.id)).deep.eq([SpaceName.AURORA_STATION]);
      expect(t.game.board.getCitiesOnMars(t.p1)).deep.eq([]);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect([t.p1.megaCredits, t.p1.steel, t.p1.titanium, t.p1.plants, t.p1.cardsInHand.length], 'nothing granted by the cell').deep.eq([14, 0, 0, 0, 0]);
    });

    it('counted wherever cities off Mars are (Nova City: 2 VP) and by every count of cities (Mayor) — never by a reading of MARS (TR15)', () => {
      const nova = new NovaCity();
      const census = new MartianCensus();
      const t = played((p1) => p1.playedCards.push(nova, census));
      expect(nova.getVictoryPoints(t.p1), 'FAQ p.18 — any city that is not on Mars').eq(2);
      expect(new Mayor().getScore(t.p1)).eq(1);
      expect(census.resourceCount, 'Martian Census counts cities ON Mars only').eq(0);
    });

    it('«a city is placed» triggers fire by their own predicates: Pets +1 animal, Immigrant City +1 M€ production', () => {
      const pets = new Pets();
      const immigrant = new ImmigrantCity();
      const t = played((p1) => p1.playedCards.push(pets, immigrant));
      expect(pets.resourceCount).eq(1);
      expect(t.p1.production.megacredits).eq(1);
    });

    it('the city is the CARD\'s: a second copy cannot be played onto the taken cell', () => {
      const t = played();
      const twin = new AuroraStation();
      t.p1.cardsInHand.push(twin);
      t.p1.megaCredits = 14;
      expect(t.p1.canPlay(twin)).is.false;
    });
  });

  describe('rules 5–7 — the reward in the printed order, the question only where there is a choice', () => {
    it('ONE holder (the card itself): the preview names it with «0 → 2» and its points; the landing asks nothing; floaters, then production', () => {
      const t = table();
      const preview = buildFleetDockPreview(t.p1, t.card);
      expect(preview.effects).deep.eq([
        {direction: 'gain', icon: 'floater', amount: 2, note: 'to a card'},
        {direction: 'gain', icon: 'megacredits', amount: 1, current: 0, resulting: 1, note: 'production'},
      ]);
      expect(preview.followUps).deep.eq([{
        kind: 'cardTarget', role: 'tradeReward', resource: CardResource.FLOATER, amount: 2, auto: AURORA,
        vpSteps: {[AURORA]: [{from: 0, to: 0}, {from: 0, to: 1}]}, lost: false,
      }]);
      t.p1.energy = 3;
      const from = t.game.events.events.length;
      trade(t, byIcon('energy'));
      expect(t.p1.getWaitingFor(), 'no question after the fleet has landed').is.undefined;
      expect(t.card.resourceCount).eq(2);
      expect(t.p1.production.megacredits).eq(1);
      const types = t.game.events.events.slice(from).filter((e) => e.source?.kind === 'card' && e.source.card === AURORA).map((e) => e.type);
      expect(types.indexOf('card-resource-changed'), 'the floaters land').greaterThan(-1);
      expect(types.indexOf('production-changed'), 'the production comes AFTER the floaters').greaterThan(types.indexOf('card-resource-changed'));
    });

    it('TWO holders: the trade asks — the card first among the candidates, the source THIS card; both floaters on the chosen one, then production', () => {
      const t = table();
      const habs = new FloatingHabs();
      t.p1.playedCards.push(habs);
      const target = buildFleetDockPreview(t.p1, t.card).followUps[0];
      expect(target).deep.include({kind: 'cardTarget', amount: 2, lost: false});
      expect(target.kind === 'cardTarget' ? target.pick?.cards.map((c) => c.name) : undefined).deep.eq([AURORA, CardName.FLOATING_HABS]);
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      const ask = cast(t.p1.getWaitingFor(), SelectCard);
      expect(ask.choiceContext?.source).deep.eq({kind: 'card', card: AURORA});
      expect(t.p1.production.megacredits, 'nothing past the question before its answer').eq(0);
      t.p1.process({type: 'card', cards: [CardName.FLOATING_HABS]});
      runAllActions(t.game);
      expect(habs.resourceCount).eq(2);
      expect(t.card.resourceCount).eq(0);
      expect(t.p1.production.megacredits).eq(1);
    });

    it('rule 7 — the target chosen before the confirm rides the SAME submit: the batch lands whole', () => {
      const t = table();
      const habs = new FloatingHabs();
      t.p1.playedCards.push(habs);
      t.p1.energy = 3;
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const tradeIndex = menu.options.findIndex((o) => o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
      const pay = cast(cast(menu.options[tradeIndex], AndOptions).options[0], OrOptions);
      replayBatch(t.p1, [
        {type: 'or', index: tradeIndex, response: {type: 'and', responses: [
          {type: 'or', index: pay.options.findIndex(byIcon('energy')), response: {type: 'option'}},
          {type: 'colony', fleetDock: AURORA},
        ]}},
        {type: 'card', cards: [CardName.FLOATING_HABS]},
      ]);
      expect(t.p1.getWaitingFor()?.type, 'no question is left standing').not.eq('card');
      expect(habs.resourceCount).eq(2);
      expect(t.p1.production.megacredits).eq(1);
    });
  });

  describe('rule 8 — 1 VP per 2 floaters ON THIS card, whoever put them there', () => {
    it('0 / 1 / 2 / 3 floaters → 0 / 0 / 1 / 1 VP', () => {
      const t = table();
      [0, 1, 2, 3].forEach((count, i) => {
        t.card.resourceCount = count;
        expect(t.card.getVictoryPoints(t.p1), `${count} floaters`).eq([0, 0, 1, 1][i]);
      });
    });

    it('a Titan trade, Floater Technology and Stratopolis\' action all count the card among their targets', () => {
      const t = table();
      t.p1.playedCards.push(new FloatingHabs());
      // Floater Technology: «add 1 floater to ANOTHER card» — any floater holder.
      const tech = new FloaterTechnology();
      t.p1.playedCards.push(tech);
      tech.action(t.p1);
      runAllActions(t.game);
      const techPick = cast(t.p1.popWaitingFor(), SelectCard);
      expect(techPick.cards.map((c) => c.name)).to.include(AURORA);
      // Stratopolis: «2 floaters to ANY Venus card».
      const strato = new Stratopolis();
      t.p1.playedCards.push(strato);
      strato.action(t.p1);
      runAllActions(t.game);
      const stratoPick = cast(t.p1.popWaitingFor(), SelectCard);
      expect(stratoPick.cards.map((c) => c.name)).to.include(AURORA);
      stratoPick.cb([t.card]);
      expect(t.card.getVictoryPoints(t.p1)).eq(1);
      // Titan's trade income lands floaters on any floater card.
      const titan = new Titan();
      t.game.colonies = [titan];
      titan.isActive = true;
      titan.trackPosition = 3;
      t.p1.energy = 3;
      trade(t, byIcon('energy'), {type: 'colony', colonyName: titan.name});
      const titanPick = cast(t.p1.getWaitingFor(), SelectCard);
      expect(titanPick.cards.map((c) => c.name)).to.include(AURORA);
    });
  });

  describe('rule 9 — the card holds floaters for every reader: the Redux Venus at positions 3–5', () => {
    it('with no floater card the trade is refused by name; the station lifts the refusal', () => {
      const [game, p1] = testGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(PartyName.INDUSTRIALISTS));
      const venus = new VenusRedux();
      game.colonies = [venus];
      venus.trackPosition = 3;
      expect(venus.tradeBlockedReason(p1)).eq(VENUS_REDUX_NO_FLOATER_HOLDER_REASON);
      p1.playedCards.push(new AuroraStation());
      expect(venus.tradeBlockedReason(p1)).is.undefined;
    });
  });

  describe('rule 4 — the dock is the class\'s', () => {
    it('a trade with NO open colony; once per generation; the berth free again next generation', () => {
      const t = table();
      t.game.colonies.forEach((colony) => colony.visitor = t.p2.id);
      t.p1.colonies.setFleetSize(2);
      t.p1.energy = 6;
      expect(t.p1.colonies.canTrade()).is.true;
      trade(t, byIcon('energy'));
      expect(isFleetDocked(t.card, t.game.generation)).is.true;
      expect(fleetDockOffers(t.p1)[0]).deep.include({available: false, reason: FLEET_DOCK_BUSY_REASON});
      expect(tradeAction(t.p1), 'no colony open and the berth taken: no destination left, nothing to pay for').is.undefined;
      expect(t.p1.energy, 'the second fee stayed').eq(3);
      t.game.generation++;
      t.p1.colonies.returnTradeFleets();
      expect(fleetDockOffers(t.p1)[0]).deep.include({available: true});
    });

    it('only the owner; it IS a trade (the quest counts it, Venus Trade Hub pays)', () => {
      const t = table();
      t.p2.energy = 3;
      expect((cast(tradeAction(t.p2)!.options[1], SelectColony).toModel(t.p2) as SelectColonyModel).fleetDocks).is.undefined;
      t.parliament.quest = {definition: {goal: {kind: 'trade'}, count: 2}, source: 'starter', generation: t.game.generation, progress: new Map()};
      t.p1.playedCards.push(new VenusTradeHub());
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.parliament.questProgressOf(t.p1)).eq(1);
      expect(t.p1.megaCredits).eq(3);
    });
  });

  describe('rule 10 — a free door is a free reward', () => {
    it('the Unity action', () => {
      const t = table();
      seatEnacted(t.parliament, COLONIZATION_FUNDING_ID);
      trade(t, byParty(U));
      expect(t.parliament.partyActionUsesLeft(t.p1, U)).eq(0);
      expect(t.card.resourceCount).eq(2);
      expect(t.p1.production.megacredits).eq(1);
    });

    it('Automated Convoys\' mech (TR66)', () => {
      const t = table();
      const convoys = new AutomatedConvoys();
      convoys.resourceCount = 1;
      t.p1.playedCards.push(convoys);
      expect(convoys.action(t.p1)).is.undefined;
      const pick = cast(t.game.deferredActions.pop()!.execute(), SelectColony);
      t.p1.defer(pick.process({type: 'colony', fleetDock: AURORA}));
      runAllActions(t.game);
      expect(convoys.resourceCount).eq(0);
      expect(t.card.resourceCount).eq(2);
    });
  });

  describe('rule 11 — three docks in one tableau', () => {
    it('three places, three stamps; `potentialTradeCount` = min(colonies + free docks, free fleets)', () => {
      const t = table();
      t.p1.playedCards.push(new WaterHauling(), new UnmiLiner());
      t.p1.colonies.setFleetSize(4);
      t.p1.energy = 9;
      expect(fleetDockOffers(t.p1).map((o) => [o.card.name, o.available])).deep.eq([
        [AURORA, true], [CardName.WATER_HAULING, true], [CardName.UNMI_LINER, true],
      ]);
      expect(potentialActions(t.p1).colonyTrades, '2 colonies + 3 docks, 4 fleets').eq(4);
      trade(t, byIcon('energy'));
      expect(fleetDockOffers(t.p1).map((o) => o.available)).deep.eq([false, true, true]);
      expect(potentialActions(t.p1).colonyTrades, '2 colonies + 2 docks, 3 fleets').eq(3);
    });
  });

  it('rule 12 — the card is not an action', () => {
    const t = table();
    expect((t.card as unknown as {action?: unknown}).action).is.undefined;
    expect(t.p1.getPlayableActionCards().map((c) => c.name)).does.not.include(AURORA);
  });

  describe('rule 13 — save / load', () => {
    it('the stamp, the floaters and the tile survive a round trip', () => {
      const t = table();
      t.game.board.getSpaceOrThrow(SpaceName.AURORA_STATION).tile = {tileType: TileType.CITY, card: AURORA};
      t.game.board.getSpaceOrThrow(SpaceName.AURORA_STATION).player = t.p1;
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      const loaded = Game.deserialize(structuredClone(t.game.serialize()));
      const p1 = loaded.getPlayerById(t.p1.id);
      const card = p1.playedCards.get(AURORA)!;
      expect(card.data).deep.eq({dockedGeneration: loaded.generation});
      expect(card.resourceCount).eq(2);
      expect(loaded.board.getSpaceOrThrow(SpaceName.AURORA_STATION).tile?.tileType).eq(TileType.CITY);
    });

    it('mid-question nothing is saved — the last save is the one before the action, and the trade replays whole from it', () => {
      const t = table();
      t.p1.playedCards.push(new FloatingHabs());
      t.p1.energy = 3;
      const beforeTheAction = structuredClone(t.game.serialize());
      trade(t, byIcon('energy'));
      cast(t.p1.getWaitingFor(), SelectCard);
      const loaded = Game.deserialize(beforeTheAction);
      const p1 = loaded.getPlayerById(t.p1.id);
      const card = p1.playedCards.get(AURORA)!;
      expect(isFleetDocked(card, loaded.generation), 'the berth is free again').is.false;
      expect(p1.colonies.usedTradeFleets).eq(0);
      expect(card.resourceCount).eq(0);
      expect(p1.production.megacredits).eq(0);
    });

    it('a save made before the card existed (no cell 80) is playable after the load', () => {
      const t = table();
      t.p1.playedCards.remove(t.card);
      seatEnacted(t.parliament, quietResolutionOf(U));
      const serialized = t.game.serialize();
      serialized.board.spaces = serialized.board.spaces.filter((space) => space.id !== SpaceName.AURORA_STATION);
      const loaded = Game.deserialize(serialized);
      const p1 = loaded.getPlayerById(t.p1.id);
      const card = new AuroraStation();
      p1.megaCredits = 14;
      p1.cardsInHand.push(card);
      expect(p1.canPlay(card)).is.true;
      p1.playCard(card);
      runAllActions(loaded);
      expect(loaded.board.getCitiesOffMars(p1).map((space) => space.id)).deep.eq([SpaceName.AURORA_STATION]);
    });
  });

  it('rule 14 — MarsBot trades past it; a human at the bot\'s table plays it as ever', () => {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, venusNextExtension: true});
    game.playerIsFinishedWithResearchPhase(human);
    human.popWaitingFor();
    game.phase = Phase.ACTION;
    const card = new AuroraStation();
    human.playedCards.push(card);
    human.energy = 3;
    const t: Table = {game, p1: human, p2: human, parliament: game.parliament!, card};
    trade(t, byIcon('energy'));
    expect(card.resourceCount).eq(2);
    bot.megaCredits = 5;
    expect(AutomaColonies.botTrade(game)).is.true;
    expect(game.events.events.filter((e) => e.type === 'fleet-docked')).has.lengthOf(1);
  });

  describe('rule 15 — the journal: ONE chain under the card, no line twice', () => {
    it('the headline, the fee, «[fleet] −1», «+2 [floater]» on the card, «+1 M€ production»', () => {
      const t = table();
      t.p1.energy = 3;
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const tradeIndex = menu.options.findIndex((o) => o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
      const pay = cast(cast(menu.options[tradeIndex], AndOptions).options[0], OrOptions);
      t.p1.process({type: 'or', index: tradeIndex, response: {type: 'and', responses: [
        {type: 'or', index: pay.options.findIndex(byIcon('energy')), response: {type: 'option'}},
        {type: 'colony', fleetDock: AURORA},
      ]}});
      runAllActions(t.game);
      const root = rootOf(t.game);
      const header = t.game.gameLog.find((m) => m.correlationId === root && m.role === 'root-action');
      expect(header?.message).eq('${0} sent a trade fleet to ${1}');
      expect(header?.data[header.data.length - 1]).deep.eq({type: LogMessageDataType.CARD, value: AURORA});
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, t.p1.color);
      const chips = rows.flatMap((row) => row.chips.map((chip) => `${chip.icon} ${chip.text}`));
      expect(chips.filter((c) => c === `${TRADE_FLEET_ICON} −1`), 'the fleet once').has.lengthOf(1);
      expect(chips.filter((c) => c.toLowerCase().startsWith('floater')), 'the floaters once').deep.eq([`${CardResource.FLOATER} +2`]);
      expect(rows.find((row) => row.bucket === 'payment')?.chips).deep.eq([{icon: 'energy', text: '−3'}]);
      expect(chain.filter((e) => e.type === 'production-changed'), 'the production once').has.lengthOf(1);
    });

    it('a rival sees the fleet on the card and the floaters it holds', () => {
      const t = table();
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      const seen = Server.getPlayerModel(t.p2).players.find((p) => p.color === t.p1.color)!.tableau.find((c) => c.name === AURORA)!;
      expect(seen.fleetDocked).eq(t.p1.color);
      expect(seen.resources).eq(2);
    });
  });

  describe('rule 16 — without Venus Next the card is not in the deck and its cell is not on the board', () => {
    it('Redux + Colonies, no Venus: the gate refuses the card and the board lays no cell `80`', () => {
      const [game] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      const entry = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!.projectCards[AURORA]!;
      expect(isCompatibleWith(entry, game.gameOptions)).is.false;
      expect(game.board.spaces.some((space) => space.id === SpaceName.AURORA_STATION)).is.false;
      expect(game.projectDeck.drawPile.some((card) => card.name === AURORA)).is.false;
    });

    it('with Venus Next the cell exists — beside the four Venus Next cities, never hosted', () => {
      const [game] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
      const ids = game.board.spaces.map((space) => space.id);
      expect(ids).to.include.members([SpaceName.LUNA_METROPOLIS, SpaceName.DAWN_CITY, SpaceName.STRATOPOLIS, SpaceName.MAXWELL_BASE, SpaceName.AURORA_STATION]);
    });

    it('Venus Next without Redux: no cell either', () => {
      const [game] = testGame(2, {coloniesExtension: true, venusNextExtension: true});
      expect(game.board.spaces.some((space) => space.id === SpaceName.AURORA_STATION)).is.false;
    });
  });
});
