import {expect} from 'chai';
import {
  EXPEDITION_ENERGY_PER_MECH, EXPEDITION_MECHS_ADD_TITLE, EXPEDITION_MECHS_DRAW_TITLE, EXPEDITION_MECHS_ON_PLAY,
  EXPEDITION_MECHS_PER_CARD, ExpeditionMechs,
} from '../../../src/server/cards/turmoilRedux/ExpeditionMechs';
import {FORESTRY_MECHS_ADD_TITLE} from '../../../src/server/cards/turmoilRedux/ForestryMechs';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {MechSports} from '../../../src/server/cards/turmoilRedux/MechSports';
import {MarsArmyMechs} from '../../../src/server/cards/turmoilRedux/MarsArmyMechs';
import {AutomatedConvoys, TradeWithAutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {OlympusConference} from '../../../src/server/cards/base/OlympusConference';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {AutomaResolver} from '../../../src/server/automa/AutomaResolver';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {holderActionGoodOf} from '../../../src/server/cards/holderActionGood';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {AddResourcesToCard} from '../../../src/server/deferredActions/AddResourcesToCard';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR50 — EXPEDITION MECHS: the Scientists' plate, the mechs' SEVENTH holder,
 * and TR40 Forestry Mechs with another B — ONE DECLARATION of the Local
 * Shading class: TR09 / TR40's A (1 energy → a mech here) beside Aerial
 * Mappers' / TR02's B (a stored resource → a card off the deck). Every rule
 * reading of the card file's header is pinned here: the plate's two roads
 * (TR36 does not help), the play's one mech and its four payment lanes, the
 * two variants and what the ENGINE answers for each configuration (both live
 * → `OrOptions`, one live → no question, both dead → the energy first), the
 * draw's deck rules, the mechs here as ordinary mechs that are nobody's money
 * / VP / delegates / trade, the role the console READS off the declaration
 * («1 mech → 1 card»), and the Science tag's neighbours.
 */
const S = PartyName.SCIENTISTS;
const COST = 5;
const EM = CardName.EXPEDITION_MECHS;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: ExpeditionMechs};

/** A two-seat Redux table in the action phase, the Scientists RULING by an enacted card. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  return {game, player, opponent, parliament, card: new ExpeditionMechs()};
}

/** The Reds rule by an enacted card — the Scientists' plate is nobody's by the ruling road. */
function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

/** `n` of `player`'s own cubes on the Scientists' quiet resolution (the lobby's free one first, the rest from the reserve). */
function scientistsCubes(t: Table, n: number): void {
  let slot = t.parliament.slotOf(S);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(S));
    slot = t.parliament.slotOf(S)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(t.player, slot, t.parliament.lobby.has(t.player.id) ? 'lobby' : 'reserve');
  }
}

/** The card on the player's table with `mechs` here and the player at `energy`. */
function owned(t: Table, mechs: number, energy: number): Table {
  t.player.playedCards.push(t.card);
  t.card.resourceCount = mechs;
  t.player.energy = energy;
  return t;
}

/** The blue card's action from the action menu, every deferred step run. */
function act(t: Table): void {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name)).to.include(EM);
  door.cb([t.card]);
  runAllActions(t.game);
}

function holder<T extends ICard>(player: TestPlayer, card: T, count: number): T {
  card.resourceCount = count;
  player.playedCards.push(card);
  return card;
}

describe('ExpeditionMechs', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 5, Science + Building, a mech holder, no VP, the SCIENTISTS\' plate, TR50 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(EM);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the atom, then the roof — the corner\'s order').deep.eq([Tag.SCIENCE, Tag.BUILDING]);
      expect(card.resourceType).eq(CardResource.MECH);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Scientists\' flask — a requirement, not a tag').eq(S);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR50');
      expect(card.metadata.description).eq('Requires the Scientists to be ruling or that you have 2 delegates there. Add 1 mech resource to this card.');
      expect(card.behavior).deep.eq({addResources: EXPEDITION_MECHS_ON_PLAY});
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[EM];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect([EXPEDITION_MECHS_ON_PLAY, EXPEDITION_ENERGY_PER_MECH, EXPEDITION_MECHS_PER_CARD]).deep.eq([1, 1, 1]);
      // No trigger, no hook of its own, no DECLARED role — the role is read off the declaration (below).
      expect((card as ICard).resourceRole, 'no declared role').is.undefined;
      expect((card as ICard).holderActionGood, 'no declared good').is.undefined;
      expect((card as ICard).onCardPlayed, 'no trigger').is.undefined;
      expect((card as ICard).actionUnavailableReason, 'no reason of its own — the declaration\'s automatic ones').is.undefined;
    });

    it('the ACTION is ONE DECLARATION of the Local Shading class: an `or` of two titled variants in the printed order; A is TR40\'s key word for word', () => {
      const action = t.card.actionBehavior;
      expect(action?.or?.autoSelect).is.true;
      expect(EXPEDITION_MECHS_ADD_TITLE).eq(FORESTRY_MECHS_ADD_TITLE);
      expect(action?.or?.behaviors.map((b) => b.title)).deep.eq([EXPEDITION_MECHS_ADD_TITLE, EXPEDITION_MECHS_DRAW_TITLE]);
      expect(action?.or?.behaviors[0]).deep.eq({spend: {energy: 1}, addResources: 1, title: EXPEDITION_MECHS_ADD_TITLE});
      expect(action?.or?.behaviors[1]).deep.eq({spend: {resourcesHere: 1}, drawCard: 1, title: EXPEDITION_MECHS_DRAW_TITLE});
      expect(Object.keys(action ?? {}), 'nothing beside the `or`').deep.eq(['or']);
    });

    it('the face reads the scan: «[energy] → [mech]», «OR», «[mech] → [card]», then the play\'s mech', () => {
      type Node = {is?: string, type?: string, amount?: number, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      const parts = (box: Node, i: number) => (box.rows?.[i] ?? []).filter((n): n is Node => typeof n === 'object');
      const boxes = rows.map((r) => r[0]);
      expect(boxes.map((b) => b.is), 'two action rows split by the OR symbol, then the play\'s item').deep.eq(['effect', 'symbol', 'effect', 'item']);
      expect(parts(boxes[0], 0).map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.ENERGY, 1]]);
      expect(parts(boxes[0], 2).map((n) => n.type)).deep.eq([CardRenderItemType.RESOURCE]);
      expect(parts(boxes[2], 0).map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.RESOURCE, 1]]);
      expect(parts(boxes[2], 2).map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.CARDS, 1]]);
      expect([boxes[3].type, boxes[3].amount]).deep.eq([CardRenderItemType.RESOURCE, EXPEDITION_MECHS_ON_PLAY]);
    });

    it('the structured text prints the requirement, the two action rows of the `or`, and the play\'s own line', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Scientists to be ruling or that you have 2 delegates on its resolution.',
        'Action: Pay 1 energy to add a mech resource to this card.',
        'Action: Spend 1 mech from here to draw a card.',
        'Add 1 mech to this card.',
      ]);
    });

    it('the console reads the holder\'s ROLE off the declaration: «1 mech → 1 card» (A buys the mech, it spends none)', () => {
      expect(holderActionGoodOf(t.card)).deep.eq({spend: 1, good: {kind: 'cards', amount: 1}});
    });
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
    });

    it('the Scientists ruling: playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(S);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0, requirement: true, requirementKey: 'req:party',
      });
      scientistsCubes(t, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: S, current: 1});
      scientistsCubes(t, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s: with one cube the card still reads «1 of 2»', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      scientistsCubes(t, 1);
      expect(t.parliament.hasPartyEffect(t.player, S), 'the Scientists\' EFFECT is the player\'s by the Seat').is.true;
      expect(t.player.canPlay(t.card), 'the requirement is still two').is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: S, current: 1, params: [S, '2']});
    });

    it('checked at the PLAY only: once on the table, the action works whoever rules', () => {
      const u = owned(redsRule(table()), 1, 1);
      expect(u.card.canAct(u.player)).is.true;
    });
  });

  describe('rule 2 — the play: +1 mech on THIS card; paid in M€, steel, Construction Mechs\' mechs and Supercomputer\'s data — never EVA\'s', () => {
    beforeEach(() => {
      t.player.cardsInHand.push(t.card);
    });

    it('the cost is paid, the card is in the tableau with 1 mech, nothing is asked', () => {
      t.player.megaCredits = 20;
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(EM)).eq(t.card);
      expect(t.card.resourceCount).eq(EXPEDITION_MECHS_ON_PLAY);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('the composer promises the one mech as the card\'s own chip', () => {
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].effects.find((e) => e.icon === 'mech')).deep.include({direction: 'gain', amount: EXPEDITION_MECHS_ON_PLAY});
    });

    it('the lanes: steel (Building), `constructionMechs` (Building), `supercomputerData` (Science) open; `mechs` (EVA — Space) stays shut', () => {
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.steel).is.true;
      expect(options.constructionMechs).is.true;
      expect(options.supercomputerData).is.true;
      expect(options.mechs).is.false;
    });

    it('FOUR lanes on one play: 1 steel (2) + 1 Construction mech (5) — overpay is the upstream semantic; 1 data (2) + 1 M€ + 1 steel is exact', () => {
      const construction = holder(t.player, new ConstructionMechs(), 1);
      const supercomputer = holder(t.player, new Supercomputer(), 1);
      t.player.megaCredits = 1;
      t.player.steel = 1;
      t.player.playCard(t.card, Payment.of({megacredits: 1, steel: 1, supercomputerData: 1}));
      runAllActions(t.game);
      expect([t.player.megaCredits, t.player.steel, supercomputer.resourceCount, construction.resourceCount]).deep.eq([0, 0, 0, 1]);
      expect(t.card.resourceCount, 'the play\'s own mech, untouched by the price').eq(EXPEDITION_MECHS_ON_PLAY);
    });

    it('a Construction mech alone (5) pays the whole card; EVA\'s mechs pay nothing (no Space tag)', () => {
      const construction = holder(t.player, new ConstructionMechs(), 1);
      const eva = holder(t.player, new EvaMechs(), 3);
      t.player.megaCredits = 0;
      expect(t.player.canAfford({cost: COST, constructionMechs: true})).is.true;
      t.player.playCard(t.card, Payment.of({constructionMechs: 1}));
      runAllActions(t.game);
      expect(construction.resourceCount).eq(0);
      expect(eva.resourceCount).eq(3);
      expect(t.player.playedCards.get(EM)).eq(t.card);
    });
  });

  describe('rules 3–4 — ONE action, two variants, their availability (what the `or` engine answers)', () => {
    it('both live: an OrOptions in the printed order (A, then B), marked as this card\'s effect choice; the preview\'s two branches index it', () => {
      owned(t, 1, 1);
      // The declarative class DEFERS its question (Local Shading, Aerial Mappers, TR40): the action returns nothing.
      expect(t.card.action(t.player)).is.undefined;
      runAllActions(t.game);
      const or = cast(t.player.popWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([EXPEDITION_MECHS_ADD_TITLE, EXPEDITION_MECHS_DRAW_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: EM});
      expect(or.choiceContext?.mode).eq('effect-choice');
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[0, true], [1, true]]);
      expect(preview.branches.map((b) => b.title)).deep.eq([EXPEDITION_MECHS_ADD_TITLE, EXPEDITION_MECHS_DRAW_TITLE]);
      expect([t.player.energy, t.card.resourceCount, t.player.cardsInHand.length], 'nothing moved by the question itself').deep.eq([1, 1, 0]);
    });

    it('both live, B chosen: the mech leaves, one card from the TOP of the deck lands in the hand', () => {
      owned(t, 1, 1);
      const top = t.game.projectDeck.drawPile[t.game.projectDeck.drawPile.length - 1];
      t.card.action(t.player);
      runAllActions(t.game);
      const or = cast(t.player.popWaitingFor(), OrOptions);
      or.cb(undefined);
      or.options[1].cb(undefined);
      runAllActions(t.game);
      expect([t.player.energy, t.card.resourceCount]).deep.eq([1, 0]);
      expect(t.player.cardsInHand.map((c) => c.name)).deep.eq([top.name]);
    });

    it('A alone (no mech, 1 energy): no prompt — the action IS «1 energy → 1 mech»; the lone branch carries index −1', () => {
      owned(t, 0, 1);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, true], [-1, false]]);
      expect(t.card.action(t.player), 'one live variant is the whole action').is.undefined;
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.player.energy, t.card.resourceCount, t.player.cardsInHand.length]).deep.eq([0, 1, 0]);
    });

    it('B alone (a mech, no energy): no prompt — the mech leaves, one card is drawn', () => {
      owned(t, 1, 0);
      expect(actionPreview(t.player, t.card).branches.map((b) => [b.index, b.available])).deep.eq([[-1, false], [-1, true]]);
      expect(t.card.action(t.player)).is.undefined;
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      expect([t.player.energy, t.card.resourceCount, t.player.cardsInHand.length]).deep.eq([0, 0, 1]);
    });

    it('A at 0 energy is SHOWN disabled with the automatic energy reason; B at 0 mechs with the automatic «on this card» count — never hidden', () => {
      owned(t, 1, 0);
      const a = actionPreview(t.player, t.card).branches[0];
      expect(a.available).is.false;
      expect(a.unavailableReason).eq('Not enough energy');
      expect(a.effects.map((e) => e.icon), 'the refused variant still shows its chips').deep.eq(['energy', 'mech']);

      const u = owned(table(), 0, 1);
      const b = actionPreview(u.player, u.card).branches[1];
      expect(b.available).is.false;
      expect(b.unavailableReason).eq('${0} of ${1} {mech|mechs} on this card');
      expect(b.unavailableReasonParams, '«0 of 1 mech» (PL-197)').deep.eq(['0', '1']);
      expect(b.effects.map((e) => e.icon)).deep.eq(['mech', 'cards']);
    });

    it('the preview of B is DECLARATIVE: a «1 → 0 on this card» cost chip and a «+1 card» gain; A: the energy and the mech «on this card»', () => {
      owned(t, 1, 1);
      const [a, b] = actionPreview(t.player, t.card).branches;
      expect(a.effects[0]).deep.include({direction: 'cost', icon: 'energy', amount: 1, current: 1, resulting: 0});
      expect(a.effects[1]).deep.include({direction: 'gain', icon: 'mech', amount: 1, current: 1, resulting: 2, note: 'on this card'});
      expect(b.effects[0]).deep.include({direction: 'cost', icon: 'mech', amount: 1, current: 1, resulting: 0, note: 'on this card'});
      expect(b.effects[1]).deep.include({direction: 'gain', icon: 'cards', amount: 1});
    });

    describe('both dead — `canAct` is false and the FIRST card-level reason is the energy (the one blocker the player can act on)', () => {
      const cases: Array<[energy: number, mechs: number, canAct: boolean]> = [
        [1, 0, true],
        [0, 1, true],
        [1, 1, true],
        [0, 0, false],
      ];
      for (const [energy, mechs, expected] of cases) {
        it(`energy ${energy}, mechs ${mechs} → ${expected}`, () => {
          owned(t, mechs, energy);
          expect(t.card.canAct(t.player)).eq(expected);
          expect(t.player.getPlayableActionCards().includes(t.card)).eq(expected);
        });
      }

      it('no mech and no energy: the energy first, the mech count second — both named, nothing invented', () => {
        owned(t, 0, 0);
        const reasons = actionUnavailableReasons(t.player, t.card);
        expect(reasons.map((r) => r.message)).deep.eq(['Not enough energy', '${0} of ${1} {mech|mechs} on this card']);
        expect(reasons[0]).deep.include({type: 'resource', resource: Resource.ENERGY, current: 0});
        expect(reasons[1]).deep.include({type: 'count', params: ['0', '1'], current: 0});
        expect(actionPreview(t.player, t.card).branches.map((b) => b.available), 'two branches, both shown').deep.eq([false, false]);
      });
    });

    it('the composed batch [activate, {or: B} with its address] replays WHOLE — nothing asked twice, the card is drawn', () => {
      owned(t, 1, 1);
      const b = actionPreview(t.player, t.card).branches[1];
      expect(b.index).eq(1);
      t.player.takeAction();
      const menu = cast(t.player.getWaitingFor(), OrOptions);
      const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
      expect(perform).gte(0);
      const pick: InputResponse = {type: 'or', index: b.index, response: {type: 'option'}};
      const batch: Array<InputResponse> = [
        {type: 'or', index: perform, response: {type: 'card', cards: [EM]}},
        (b.for === undefined ? pick : {...pick, for: b.for}) as InputResponse,
      ];
      replayBatch(t.player, batch);
      runAllActions(t.game);
      expect([t.player.energy, t.card.resourceCount, t.player.cardsInHand.length]).deep.eq([1, 0, 1]);
      const wf = t.player.getWaitingFor();
      const variantAgain = wf instanceof OrOptions && wf.choiceContext?.source?.kind === 'card' && wf.choiceContext.source.card === EM;
      expect(variantAgain, 'the action is over — the variant was not asked again').is.false;
    });

    it('rule 8 — once per generation: used, the card leaves the playable actions', () => {
      owned(t, 2, 2);
      t.card.action(t.player);
      runAllActions(t.game);
      cast(t.player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      t.player.actionsThisGeneration.add(EM);
      expect(t.player.getPlayableActionCards().includes(t.card)).is.false;
    });
  });

  describe('rule 5 — B\'s card is the engine\'s ordinary draw', () => {
    it('an EMPTY draw pile reshuffles the discard pile first: the card comes from the old discards', () => {
      owned(t, 1, 0);
      const deck = t.game.projectDeck;
      const discards = deck.drawPile.splice(0, deck.drawPile.length);
      deck.discardPile.push(...discards);
      act(t);
      expect(t.card.resourceCount).eq(0);
      expect(t.player.cardsInHand).has.length(1);
      expect(discards.map((c) => c.name)).includes(t.player.cardsInHand[0].name);
    });

    it('NO card anywhere: B is DEAD with the engine\'s named reason «The deck is empty» — the mech is never spent for nothing; A stays live', () => {
      owned(t, 1, 1);
      const deck = t.game.projectDeck;
      deck.drawPile.splice(0, deck.drawPile.length);
      deck.discardPile.splice(0, deck.discardPile.length);
      const [a, b] = actionPreview(t.player, t.card).branches;
      expect([a.available, b.available]).deep.eq([true, false]);
      expect(b.unavailableReason).eq('The deck is empty');
      act(t);
      expect(t.player.getWaitingFor(), 'one live variant — no question').is.undefined;
      expect([t.player.energy, t.card.resourceCount, t.player.cardsInHand.length], 'A ran: the mech was BOUGHT, not spent').deep.eq([0, 2, 0]);
    });
  });

  describe('rule 7 — the journal: A — the energy, then the mech; B — the mech leaves, then the draw', () => {
    it('A: energy 1 → 0, mechs +1, nothing else touched; the two deltas are on the event stream in that order', () => {
      owned(t, 0, 1);
      const before = t.game.events.events.length;
      act(t);
      expect([t.player.energy, t.card.resourceCount, t.player.cardsInHand.length]).deep.eq([0, 1, 0]);
      const events = t.game.events.events.slice(before);
      const energy = events.findIndex((e) => e.impact.stock?.energy === -1);
      const mech = events.findIndex((e) => (e.impact.cardResources ?? []).some((cr) =>
        cr.target === EM && cr.cardResource === CardResource.MECH && cr.amount === 1));
      expect(energy, JSON.stringify(events.map((e) => e.type))).is.gte(0);
      expect(mech, JSON.stringify(events.map((e) => e.type))).is.gt(energy);
      expect(t.player.actionsThisGeneration.has(EM)).is.true;
    });

    it('B: the mech\'s own line, then «drew 1 card» — under the card\'s source', () => {
      owned(t, 1, 0);
      const at = t.game.gameLog.length;
      act(t);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      const spend = lines.findIndex((l) => /1 mech.*Expedition Mechs|removed 1 .*Expedition Mechs/i.test(l));
      const draw = lines.findIndex((l) => /drew 1 card/i.test(l));
      expect(spend, lines.join('\n')).is.gte(0);
      expect(draw, lines.join('\n')).is.gt(spend);
    });
  });

  describe('rule 6 — the mechs here are ORDINARY mechs: nobody\'s money, VP, delegates or trade; every generic «mech to any card» may land here', () => {
    it('three mechs here are 0 on the `mechs` and `constructionMechs` units, 0 VP, nothing for Mech Sports or TR66\'s door', () => {
      owned(t, 3, 0);
      expect(t.player.getSpendable('mechs')).eq(0);
      expect(t.player.getSpendable('constructionMechs')).eq(0);
      expect(t.card.getVictoryPoints(t.player), 'no VP').eq(0);
      const sports = holder(t.player, new MechSports(), 0);
      expect(sports.getVictoryPoints(t.player), 'Mech Sports scores its own mechs only').eq(0);
      holder(t.player, new AutomatedConvoys(), 0);
      expect(new TradeWithAutomatedConvoys(t.player).canUse()).is.false;
    });

    it('a mech holder for every generic «mech to any card» (TR29\'s B, Vesta) — a Vesta trade that picks it makes B live', () => {
      owned(t, 0, 0);
      const {game, player, card} = t;
      expect(new AddResourcesToCard(player, CardResource.MECH, {count: 1}).getCards().map((c) => c.name)).includes(EM);
      const vesta = new Vesta();
      game.colonies = [vesta];
      player.playedCards.push(new MarsArmyMechs());
      vesta.trackPosition = 6; // the 7th cell: 3 units
      expect(card.canAct(player), 'both dead before the trade').is.false;
      vesta.trade(player);
      runAllActions(game);
      const pick = cast(player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([EM, CardName.MARS_ARMY_MECHS]);
      pick.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(3);
      expect(card.canAct(player), 'B is live on Vesta\'s mechs').is.true;
      expect(actionPreview(player, card).branches[1].available).is.true;
    });
  });

  describe('the card\'s OWN tags wake its neighbours', () => {
    it('Science: TR05 Vector Computations takes its data and Olympus Conference its science resource; the card keeps its own mech', () => {
      const vector = holder(t.player, new VectorComputations(), 0);
      const olympus = holder(t.player, new OlympusConference(), 0);
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(vector.resourceCount, 'TR05 answers a Science tag').is.gt(0);
      expect(olympus.resourceCount, 'Olympus Conference answers a Science tag').eq(1);
      expect(t.card.resourceCount).eq(EXPEDITION_MECHS_ON_PLAY);
    });

    it('an opponent\'s play of a science or building tag touches nothing here', () => {
      owned(t, 1, 0);
      t.opponent.playCard(fakeCard({tags: [Tag.SCIENCE, Tag.BUILDING]}) as IProjectCard);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });
  });

  describe('MarsBot', () => {
    it('the bot\'s own science tag is nobody\'s play of this card: nothing moves, nothing is asked', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new ExpeditionMechs();
      card.resourceCount = 1;
      human.playedCards.push(card);
      const hand = human.cardsInHand.length;
      AutomaResolver.resolveTag(game, Tag.SCIENCE);
      runAllActions(game);
      expect(card.resourceCount).eq(1);
      expect(human.cardsInHand.length).eq(hand);
    });
  });

  describe('save / reload', () => {
    it('the stored mechs and the spent action survive serialization', () => {
      owned(t, 4, 0);
      t.player.actionsThisGeneration.add(EM);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      const card = again.playedCards.get(EM) as IProjectCard | undefined;
      expect(card?.resourceCount).eq(4);
      expect(again.actionsThisGeneration.has(EM)).is.true;
    });
  });
});
