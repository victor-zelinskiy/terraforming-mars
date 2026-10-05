import {expect} from 'chai';
import {UnmiLiner} from '../../../src/server/cards/turmoilRedux/UnmiLiner';
import {WaterHauling} from '../../../src/server/cards/turmoilRedux/WaterHauling';
import {AutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {VenusTradeHub} from '../../../src/server/cards/prelude2/VenusTradeHub';
import {TerraformingDeal} from '../../../src/server/cards/prelude2/TerraformingDeal';
import {UnitedNationsMarsInitiative} from '../../../src/server/cards/corporation/UnitedNationsMarsInitiative';
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
import {potentialActions} from '../../../src/server/models/potentialActions';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
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
import {PartyHooks} from '../../../src/server/turmoil/parties/PartyHooks';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {MAX_FLEET_SIZE} from '../../../src/common/constants';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {SelectColonyModel} from '../../../src/common/models/PlayerInputModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {LogMessageDataType} from '../../../src/common/logs/LogMessageDataType';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, questGateOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR26 — UNMI LINER: the SECOND fleet dock («карта-причал»), whose reward is
 * the class's plainest — +1 TR, no surface and no question. The class's own
 * contract is pinned on a stand-in dock in tests/colonies/FleetDock.spec.ts
 * (and held for every manifest dock by tests/colonies/FleetDockManifest.spec.ts);
 * here every rule reading of the card file's header (1–11) is pinned on the
 * real card, through the real doors.
 */
const LINER = CardName.UNMI_LINER;
const U = PartyName.UNITY;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: UnmiLiner};

/** A two-seat Redux table under a QUIET government (the Industrialists: an action-only party), the card PLAYED by p1, two quiet colonies. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS));
  game.colonies = [new Luna(), new Triton()];
  const card = new UnmiLiner();
  p1.playedCards.push(card);
  p1.megaCredits = 0;
  return {game, p1, p2, parliament, card};
}

/** The same table under the RULING GREENS (a fresh Redux table's own government): every TR step pays 2 M€. */
function greensTable(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  expect(parliament.rulingParty(), 'a fresh table: the Greens').eq(PartyName.GREENS);
  game.colonies = [new Luna(), new Triton()];
  const card = new UnmiLiner();
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

/** Answer the trade action: the chosen path + a destination (the liner by default). */
function trade(t: Table, path: (o: PlayerInput) => boolean, destination: InputResponse = {type: 'colony', fleetDock: LINER}): void {
  const action = tradeAction(t.p1)!;
  const pay = cast(action.options[0], OrOptions);
  const index = pay.options.findIndex(path);
  expect(index, 'the payment path is on offer').greaterThanOrEqual(0);
  t.p1.defer(action.process({type: 'and', responses: [{type: 'or', index, response: {type: 'option'}}, destination]}, t.p1));
  runAllActions(t.game);
}

/** The root of the trade's chain — the action sourced by `card`. */
function rootOf(game: IGame, card: CardName = LINER): number {
  const roots = game.events.events.filter((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === card);
  return roots[roots.length - 1].id;
}

describe('UnmiLiner', () => {
  describe('the card as printed', () => {
    it('is a blue card for 6 with Earth + Space under Unity\'s plate, no VP, TR26 — «[trade]* : [TR]» over «[trade fleet]»', () => {
      const card = new UnmiLiner();
      expect(card.name).eq(LINER);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(6);
      expect(card.tags).deep.eq([Tag.EARTH, Tag.SPACE]);
      expect(requiredPartyOf(card), 'the MIN plate holds Unity\'s emblem').eq(U);
      expect(card.requirements).has.length(1);
      expect(card.victoryPoints).is.undefined;
      expect(card.metadata.cardNumber).eq('TR26');
      expect(card.metadata.description).eq('Requires Unity to be ruling or that you have 2 delegates there. Gain an extra trade fleet.');
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      const flat = JSON.stringify(rows);
      expect(flat).contains('Effect: Once per generation, when you trade, you can send the trade fleet to this card to gain 1 TR.');
      // The effect row: the TRADE glyph with the asterisk, the colon, the rating — in that order.
      expect(flat.indexOf(`"type":"${CardRenderItemType.TRADE}"`)).greaterThan(-1);
      expect(flat.indexOf(`"type":"${CardRenderItemType.TR}"`)).greaterThan(flat.indexOf(`"type":"${CardRenderItemType.TRADE}"`));
      // The on-play row: ONE fleet marker (never the trade glyph).
      const last = rows[rows.length - 1].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(last.map((item) => item.type)).deep.eq([CardRenderItemType.TRADE_FLEET]);
    });

    it('stands in the Redux manifest behind the Colonies gate (never `turmoil`)', () => {
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = manifest.projectCards[LINER]!;
      expect(new entry.Factory().name).eq(LINER);
      expect(entry.compatibility).eq('colonies');
    });

    it('it is a fleet dock with NO reward blocker and NO question, and declares the state a save keeps', () => {
      const card = new UnmiLiner();
      expect(card.fleetDock).is.not.undefined;
      expect(card.fleetDock.rewardBlockedReason, 'rule 5: the rating has no ceiling and Redux has no Reds tax').is.undefined;
      expect(card.fleetDock.previewFollowUps, 'the reward asks nothing').is.undefined;
      expect(Object.prototype.hasOwnProperty.call(card, 'data'), 'the deserializer restores only a declared field').is.true;
      expect(card.data).deep.eq({dockedGeneration: -1});
    });
  });

  describe('rule 1 — the requirement is a condition of the PLAY', () => {
    /** Three QUIET real resolutions in the voting area: Greens · Unity · Industrialists; the card in hand. */
    function handTable(): {game: IGame, p1: TestPlayer, parliament: Parliament, card: UnmiLiner} {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.GREENS, U, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      const card = new UnmiLiner();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      return {game, p1, parliament, card};
    }

    it('neither road: unplayable with the party class\'s NAMED reason — Unity\'s, and only it', () => {
      const t = handTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [U, '2'], party: U, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('Unity rules: playable', () => {
      const t = handTable();
      seatEnacted(t.parliament, quietResolutionOf(U));
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('two delegates on its resolution: playable', () => {
      const t = handTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'reserve');
      expect(t.p1.canPlay(t.card), 'one delegate is not two').is.false;
      t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('once played the dock works whoever rules: no Unity in the chair, no delegate anywhere', () => {
      const t = table();
      expect(t.parliament.rulingParty()).not.eq(U);
      expect(t.parliament.access(t.p1, U).satisfiesRequirement, 'the seat has no road to Unity at all').is.false;
      t.p1.energy = 3;
      const tr = t.p1.terraformRating;
      trade(t, byIcon('energy'));
      expect(t.p1.terraformRating).eq(tr + 1);
    });
  });

  describe('rule 2 — «gain an extra trade fleet»', () => {
    it('playing it: fleets 1 → 2, the cost paid, the preview said so', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      seatEnacted(game.parliament!, quietResolutionOf(U));
      const card = new UnmiLiner();
      p1.cardsInHand.push(card);
      p1.megaCredits = 6;
      const preview = cardPlayPreview(p1, card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches[0].effects).deep.include({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1, current: 1, resulting: 2});
      expect(preview.branches[0].steps.filter((s) => s.kind === 'note')).deep.eq([]);
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      expect(p1.colonies.getFleetSize()).eq(2);
      expect(p1.megaCredits).eq(0);
      expect(p1.playedCards.get(LINER)).is.not.undefined;
      expect(p1.terraformRating, 'the play itself pays no TR — only a trade with the card does').eq(20);
    });

    it('at the cap of four the gain is a NAMED loss — before the play and after it', () => {
      const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const card = new UnmiLiner();
      p1.colonies.setFleetSize(MAX_FLEET_SIZE);
      const preview = cardPlayPreview(p1, card);
      expect(preview.branches[0].effects).deep.include({direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1, current: 4, resulting: 4, note: 'limit'});
      const warning = preview.branches[0].steps.find((s) => s.kind === 'note') as {noteKind?: string, skipped?: {label: string}} | undefined;
      expect(warning?.noteKind).eq('warning');
      expect(warning?.skipped?.label).eq('Gain a trade fleet');
      p1.playCard(card);
      runAllActions(game);
      expect(p1.colonies.getFleetSize()).eq(4);
      expect(game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped?.label)).deep.eq(['Gain a trade fleet']);
    });
  });

  describe('rule 3 — the card is a destination of every door of the trade', () => {
    it('the trade action\'s pick carries the dock beside the colonies, its chip the rating N → N+1', () => {
      const t = table();
      t.p1.energy = 3;
      const model = cast(tradeAction(t.p1)!.options[1], SelectColony).toModel(t.p1) as SelectColonyModel;
      expect(model.coloniesModel.map((c) => c.name)).deep.eq(t.game.colonies.map((c) => c.name));
      expect(model.fleetDocks).deep.eq([{
        card: LINER,
        available: true,
        effects: [{direction: 'gain', icon: 'tr', amount: 1, current: t.p1.terraformRating, resulting: t.p1.terraformRating + 1}],
      }]);
    });

    const PATHS: ReadonlyArray<{name: string, arrange: (p: TestPlayer) => void, icon: string, left: (p: TestPlayer) => number}> = [
      {name: '3 energy', arrange: (p) => p.energy = 3, icon: 'energy', left: (p) => p.energy},
      {name: '3 titanium', arrange: (p) => p.titanium = 3, icon: 'titanium', left: (p) => p.titanium},
      {name: '9 M€', arrange: (p) => p.megaCredits = 9, icon: 'megacredits', left: (p) => p.megaCredits},
    ];
    for (const path of PATHS) {
      it(`${path.name}: exactly the fee, one fleet on the card, no colony involved, +1 TR at once — nothing is asked`, () => {
        const t = table();
        path.arrange(t.p1);
        const tr = t.p1.terraformRating;
        trade(t, byIcon(path.icon));
        expect(path.left(t.p1), 'the fee — the path\'s, in full, and nothing else').eq(0);
        expect(t.p1.colonies.usedTradeFleets).eq(1);
        expect(isFleetDocked(t.card, t.game.generation)).is.true;
        expect(t.game.events.events.filter((e) => e.type === 'fleet-docked').map((e) => e.target)).deep.eq([{card: LINER}]);
        expect(t.game.colonies.map((c) => c.visitor)).deep.eq([undefined, undefined]);
        expect(t.game.colonies.map((c) => c.trackPosition)).deep.eq([1, 1]);
        expect(t.p1.terraformRating).eq(tr + 1);
        expect(t.p1.getWaitingFor(), 'the reward has no surface and no question').is.undefined;
      });
    }

    it('a trade is possible with NO open colony while the dock is free', () => {
      const t = table();
      t.game.colonies.forEach((colony) => colony.visitor = t.p2.id);
      t.p1.energy = 3;
      expect(t.p1.colonies.canTrade()).is.true;
      const model = cast(tradeAction(t.p1)!.options[1], SelectColony).toModel(t.p1) as SelectColonyModel;
      expect(model.coloniesModel).deep.eq([]);
      expect(model.fleetDocks?.map((d) => [d.card, d.available])).deep.eq([[LINER, true]]);
      const tr = t.p1.terraformRating;
      trade(t, byIcon('energy'));
      expect(t.p1.terraformRating).eq(tr + 1);
    });

    it('once per generation: a second attempt is refused with the class\'s ONE reason and nothing is paid; next generation the berth is free', () => {
      const t = table();
      t.p1.colonies.setFleetSize(2);
      t.p1.energy = 6;
      const tr = t.p1.terraformRating;
      trade(t, byIcon('energy'));
      expect(fleetDockOffers(t.p1)[0]).deep.include({available: false, reason: FLEET_DOCK_BUSY_REASON});
      expect(() => trade(t, byIcon('energy'))).to.throw(FLEET_DOCK_BUSY_REASON);
      expect(t.p1.energy, 'the fee stayed').eq(3);
      expect(t.p1.terraformRating, 'one TR, not two').eq(tr + 1);
      t.game.generation++;
      t.p1.colonies.returnTradeFleets();
      expect(fleetDockOffers(t.p1)[0]).deep.include({available: true});
      trade(t, byIcon('energy'));
      expect(t.p1.terraformRating).eq(tr + 2);
    });

    it('only the owner: a rival never sees the dock among THEIR destinations', () => {
      const t = table();
      t.p2.energy = 3;
      const pick = cast(tradeAction(t.p2)!.options[1], SelectColony);
      expect((pick.toModel(t.p2) as SelectColonyModel).fleetDocks).is.undefined;
      expect(() => pick.process({type: 'colony', fleetDock: LINER})).to.throw(/Fleet dock UNMI Liner not found/);
    });

    it('it IS a trade: the «trade N times» quest counts it and Venus Trade Hub pays its +3 M€', () => {
      const t = table();
      t.parliament.quest = {definition: {goal: {kind: 'trade'}, count: 2}, source: 'starter', generation: t.game.generation, progress: new Map()};
      t.p1.playedCards.push(new VenusTradeHub());
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.parliament.questProgressOf(t.p1)).eq(1);
      expect(t.p1.megaCredits).eq(3);
    });
  });

  describe('rule 4 — the reward is an ordinary +1 TR of the player\'s own action phase, sourced by the card', () => {
    it('a «gain 1 TR» chairman quest is closed by the dock\'s TR', () => {
      const t = table();
      t.parliament.quest = {definition: {goal: {kind: 'tr'}, count: 1}, source: 'starter', generation: t.game.generation, progress: new Map()};
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.parliament.quest?.completedBy).eq(t.p1.id);
      expect(questGateOf(t.p1), 'the gate rises with the trade\'s own answer').is.not.undefined;
    });

    it('the ruling Greens pay their 2 M€ on it — as THEIR effect, inside the trade\'s chain', () => {
      const t = greensTable();
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.megaCredits).eq(2);
      const chain = t.game.events.events.filter((e) => e.correlationId === rootOf(t.game));
      const reaction = chain.find((e) => e.type === 'effect-triggered' && e.source?.kind === 'party');
      expect(reaction?.source).deep.include({kind: 'party', name: PartyName.GREENS});
    });

    it('`trThisGeneration` grows and the UNMI corporation\'s action is live after it', () => {
      const t = table();
      const unmi = new UnitedNationsMarsInitiative();
      t.p1.playedCards.push(unmi);
      t.p1.megaCredits = 3;
      expect(unmi.canAct(t.p1), 'no TR raised yet this generation').is.false;
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.trThisGeneration).eq(1);
      expect(t.p1.hasIncreasedTerraformRatingThisGeneration).is.true;
      expect(unmi.canAct(t.p1)).is.true;
    });

    it('the score breakdown attributes the point to the card', () => {
      const t = table();
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.terraformRatingSources).deep.eq([
        {sourceType: 'card', sourceName: LINER, sourceCardId: LINER, amount: 1, generation: t.game.generation},
      ]);
    });

    it('`onIncreaseTerraformRatingByAnyPlayer` hooks fire (Terraforming Deal: +2 M€)', () => {
      const t = table();
      t.p1.playedCards.push(new TerraformingDeal());
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.megaCredits).eq(2);
    });
  });

  describe('rule 5 — the reward has no blocker', () => {
    it('Turmoil Redux has no Reds tax: under ruling Reds the TR is neither taxed nor lost', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.parliament.rulingParty()).eq(PartyName.REDS);
      expect(PartyHooks.reds01PolicyInEffect(t.p1), 'the classic Reds policy is not this engine\'s').is.false;
      t.p1.megaCredits = 0;
      t.p1.energy = 3;
      const tr = t.p1.terraformRating;
      expect(fleetDockOffers(t.p1)[0]).deep.include({available: true});
      trade(t, byIcon('energy'));
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.p1.megaCredits, 'nothing was charged for the step').eq(0);
      expect(t.p1.getWaitingFor()).is.undefined;
    });
  });

  describe('rule 6 — a free trade is a free TR', () => {
    it('the Unity action: the dock is free, the use is spent, no track step is asked', () => {
      const t = table();
      seatEnacted(t.parliament, COLONIZATION_FUNDING_ID);
      expect(t.parliament.hasPartyEffect(t.p1, U), 'Unity rules — its action is everyone\'s').is.true;
      const tr = t.p1.terraformRating;
      trade(t, byParty(U));
      expect(t.parliament.partyActionUsesLeft(t.p1, U)).eq(0);
      expect(t.p1.megaCredits).eq(0);
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.p1.getWaitingFor(), 'never a track question').is.undefined;
    });

    it('Automated Convoys\' mech (TR66) pays for the trade with the card', () => {
      const t = table();
      const convoys = new AutomatedConvoys();
      convoys.resourceCount = 1;
      t.p1.playedCards.push(convoys);
      const tr = t.p1.terraformRating;
      expect(convoys.action(t.p1), 'no energy: the trade variant is the whole action').is.undefined;
      const pick = cast(t.game.deferredActions.pop()!.execute(), SelectColony);
      expect((pick.toModel(t.p1) as SelectColonyModel).fleetDocks?.map((d) => [d.card, d.available])).deep.eq([[LINER, true]]);
      t.p1.defer(pick.process({type: 'colony', fleetDock: LINER}));
      runAllActions(t.game);
      expect(convoys.resourceCount).eq(0);
      expect(t.p1.terraformRating).eq(tr + 1);
    });
  });

  describe('rule 7 — two docks in one tableau (TR06 + TR26)', () => {
    function twoDocks(): Table & {hauling: WaterHauling} {
      const t = table();
      const hauling = new WaterHauling();
      t.p1.playedCards.push(hauling);
      t.p1.colonies.setFleetSize(3);
      return {...t, hauling};
    }

    it('the pick offers BOTH, each with its own verdict and its own chips', () => {
      const t = twoDocks();
      t.p1.energy = 3;
      const model = cast(tradeAction(t.p1)!.options[1], SelectColony).toModel(t.p1) as SelectColonyModel;
      expect(model.fleetDocks?.map((d) => [d.card, d.available, d.effects.map((e) => e.icon)])).deep.eq([
        [LINER, true, ['tr']],
        [CardName.WATER_HAULING, true, ['oceans', 'tr']],
      ]);
    });

    it('both are served in one generation — by two trades, each with its own fee — and the stamps are independent', () => {
      const t = twoDocks();
      t.p1.energy = 3;
      t.p1.titanium = 3;
      const tr = t.p1.terraformRating;
      trade(t, byIcon('energy'));
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(isFleetDocked(t.card, t.game.generation)).is.true;
      expect(isFleetDocked(t.hauling, t.game.generation), 'the liner\'s fleet says nothing about the other dock').is.false;
      const offers = fleetDockOffers(t.p1);
      expect(offers.map((o) => [o.card.name, o.available])).deep.eq([[LINER, false], [CardName.WATER_HAULING, true]]);

      trade(t, byIcon('titanium'), {type: 'colony', fleetDock: CardName.WATER_HAULING});
      expect(t.p1.energy + t.p1.titanium, 'two fees').eq(0);
      const ocean = cast(t.p1.getWaitingFor(), SelectSpace);
      expect(ocean.sourceCard).eq(CardName.WATER_HAULING);
      t.p1.process({type: 'space', spaceId: ocean.spaces.find((space) => space.bonus.length === 0)!.id});
      runAllActions(t.game);
      expect(t.p1.terraformRating).eq(tr + 2);
      expect(t.p1.colonies.usedTradeFleets).eq(2);
      expect(fleetDockOffers(t.p1).map((o) => o.available)).deep.eq([false, false]);
      // …and the third fleet still reaches a colony.
      expect(t.p1.colonies.canTrade()).is.true;
    });

    it('`potentialTradeCount` = min(open colonies + free docks, free fleets)', () => {
      const t = twoDocks();
      t.p1.energy = 9;
      expect(potentialActions(t.p1).colonyTrades, '2 colonies + 2 docks, 3 fleets').eq(3);
      t.game.colonies.forEach((colony) => colony.visitor = t.p2.id);
      expect(potentialActions(t.p1).colonyTrades, '0 colonies + 2 docks, 3 fleets').eq(2);
      trade(t, byIcon('energy'));
      expect(potentialActions(t.p1).colonyTrades, '0 colonies + 1 dock, 2 fleets').eq(1);
    });
  });

  describe('rule 8 — the card is not an action', () => {
    it('declares none and never stands among the playable card actions', () => {
      const t = table();
      t.p1.energy = 3;
      expect((t.card as unknown as {action?: unknown}).action).is.undefined;
      expect(t.p1.getPlayableActionCards().map((c) => c.name)).does.not.include(LINER);
    });
  });

  describe('rule 10 — MarsBot trades past it', () => {
    it('at a MarsBot table the human trades with the card and the bot\'s own trade never touches it', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.playerIsFinishedWithResearchPhase(human);
      human.popWaitingFor();
      game.phase = Phase.ACTION;
      const card = new UnmiLiner();
      human.playedCards.push(card);
      human.energy = 3;
      const tr = human.terraformRating;
      const t: Table = {game, p1: human, p2: human, parliament: game.parliament!, card};
      trade(t, byIcon('energy'));
      expect(isFleetDocked(card, game.generation)).is.true;
      expect(human.terraformRating).eq(tr + 1);
      bot.megaCredits = 5;
      const visitedBefore = game.colonies.filter((c) => c.visitor !== undefined).length;
      expect(AutomaColonies.botTrade(game)).is.true;
      expect(game.colonies.filter((c) => c.visitor !== undefined).length).eq(visitedBefore + 1);
      expect(game.events.events.filter((e) => e.type === 'fleet-docked')).has.lengthOf(1);
    });
  });

  describe('the preview of the trade — read-only, and what the stage shows', () => {
    it('the rating N → N+1, no follow-up; building it changes nothing', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      const preview = buildFleetDockPreview(t.p1, t.card);
      expect(preview.available).is.true;
      expect(preview.effects).deep.eq([{direction: 'gain', icon: 'tr', amount: 1, current: t.p1.terraformRating, resulting: t.p1.terraformRating + 1}]);
      expect(preview.followUps).deep.eq([]);
      expect(preview.reactions, 'a quiet government: nothing answers the TR').is.undefined;
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect(t.game.events.events.length).eq(events);
    });

    it('under the ruling Greens the preview NAMES their answer before the press — and the trade pays exactly it', () => {
      const t = greensTable();
      const preview = buildFleetDockPreview(t.p1, t.card);
      expect(preview.reactions).has.lengthOf(1);
      const fact = preview.reactions![0];
      expect(fact.source).deep.include({kind: 'party', name: PartyName.GREENS});
      expect(fact.certainty).eq('exact');
      expect(fact.recipient.kind).eq('you');
      expect(fact.effects.map((effect) => [effect.direction, effect.icon, effect.amount, effect.current, effect.resulting]))
        .deep.eq([['gain', 'megacredits', 2, 0, 2]]);
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      expect(t.p1.megaCredits, 'the promise is the payout').eq(2);
    });
  });

  describe('rule 11 — what the TABLE is told: the journal row and a rival\'s notification', () => {
    /** The trade taken through the real action menu (the player's own door). */
    function tradeThroughMenu(t: Table): number {
      t.p1.energy = 3;
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const tradeIndex = menu.options.findIndex((o) => o instanceof AndOptions && o.options.some((sub) => sub instanceof SelectColony));
      const pay = cast(cast(menu.options[tradeIndex], AndOptions).options[0], OrOptions);
      const energy = pay.options.findIndex(byIcon('energy'));
      t.p1.process({type: 'or', index: tradeIndex, response: {type: 'and', responses: [
        {type: 'or', index: energy, response: {type: 'option'}},
        {type: 'colony', fleetDock: LINER},
      ]}});
      runAllActions(t.game);
      return rootOf(t.game);
    }

    it('ONE chain under the card: the headline, the fee, the fleet on the card, +1 TR — and the TR is written ONCE', () => {
      const t = table();
      const logFrom = t.game.gameLog.length;
      const root = tradeThroughMenu(t);
      const header = t.game.gameLog.find((m) => m.correlationId === root && m.role === 'root-action');
      expect(header?.message).eq('${0} sent a trade fleet to ${1}');
      expect(header?.category).eq('colony');
      expect(header?.data[header.data.length - 1]).deep.eq({type: LogMessageDataType.CARD, value: LINER});
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      expect(chain.map((e) => e.type)).to.include.members(['action', 'fleet-docked', 'tr-changed']);
      expect(chain.filter((e) => e.type === 'tr-changed').map((e) => e.impact.tr), 'one typed TR fact').deep.eq([1]);
      // …and no second sentence about the same point: the typed event is the journal's row.
      const lines = t.game.gameLog.slice(logFrom).map((m) => m.message);
      expect(lines.filter((line) => /gained \$\{1\} \$\{2\}/.test(line)), 'no «gained 1 TR» log line beside the event').deep.eq([]);
      const rows = buildEventChildren(chain, root, t.p1.color);
      const fleet = rows.find((row) => row.chips.some((chip) => chip.icon === TRADE_FLEET_ICON));
      expect(fleet?.source, 'the row names the card the fleet went to').deep.eq({kind: 'card', card: LINER});
      expect(fleet?.chips).deep.eq([{icon: TRADE_FLEET_ICON, text: '−1'}]);
      expect(rows.flatMap((row) => row.chips).filter((chip) => chip.icon === 'tr').map((chip) => chip.text), 'the TR reads once').deep.eq(['+1']);
      expect(rows.find((row) => row.bucket === 'payment')?.chips).deep.eq([{icon: 'energy', text: '−3'}]);
    });

    it('under the ruling Greens their answer is a row of its own, by THEIR source', () => {
      const t = greensTable();
      const root = tradeThroughMenu(t);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, t.p1.color);
      // The journal's order is the story's: the card's TR, then the party's answer — an EFFECT row under the party's own name.
      expect(rows.map((row) => [row.bucket, row.source, row.chips])).deep.eq([
        ['card', {kind: 'card', card: LINER}, [{icon: 'tr', text: '+1'}]],
        ['effect', {kind: 'label', label: PartyName.GREENS}, [{icon: 'megacredits', text: '+2'}]],
        ['payment', {kind: 'label', label: 'Payment'}, [{icon: 'energy', text: '−3'}]],
        ['card', {kind: 'card', card: LINER}, [{icon: TRADE_FLEET_ICON, text: '−1'}]],
      ]);
    });

    it('a rival\'s notification: the headline names the card, the pills carry the TR and the fee, the breakdown the fleet', () => {
      const t = table();
      const root = tradeThroughMenu(t);
      const impact = recomputeRootImpact(t.game.events.events, root, t.p1.color, t.p2.color);
      const pills = impact.pillGroups.flatMap((group) => group.chips).map((chip) => `${chip.icon} ${chip.text}`);
      expect(pills).to.include.members(['tr +1', 'energy −3']);
      expect(impact.childVMs.some((row) => row.chips.some((chip) => chip.icon === TRADE_FLEET_ICON && chip.text === '−1'))).is.true;
      expect(impact.skipped).deep.eq([]);
    });

    it('a rival sees the fleet on the card, in its owner\'s livery — and not next generation', () => {
      const t = table();
      t.p1.energy = 3;
      trade(t, byIcon('energy'));
      const played = () => Server.getPlayerModel(t.p2).players.find((p) => p.color === t.p1.color)!.tableau.find((c) => c.name === LINER)!;
      expect(played().fleetDocked).eq(t.p1.color);
      t.game.generation++;
      t.p1.colonies.returnTradeFleets();
      expect(played().fleetDocked).is.undefined;
    });
  });

  it('rule 9 — save / load keeps the fleet on the card, and the berth stays taken', () => {
    const t = table();
    t.p1.energy = 3;
    trade(t, byIcon('energy'));
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    const card = again.playedCards.get(LINER)!;
    expect(card.data).deep.eq({dockedGeneration: live.generation});
    expect(isFleetDocked(card, live.generation)).is.true;
    expect(again.colonies.usedTradeFleets).eq(1);
    expect(fleetDockOffers(again)[0]).deep.include({available: false, reason: FLEET_DOCK_BUSY_REASON});
  });
});
