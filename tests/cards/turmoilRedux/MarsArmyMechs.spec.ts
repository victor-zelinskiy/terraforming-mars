import {expect} from 'chai';
import {MARS_ARMY_MECHS_CENSUS, MarsArmyMechs} from '../../../src/server/cards/turmoilRedux/MarsArmyMechs';
import {
  CensusSpec, censusAction, censusActionPreview, censusActionRows, censusAddReason, censusCanAct, censusGrant,
  censusUnavailableReason, censusVoteReason, DATA_CENSUS,
} from '../../../src/server/cards/turmoilRedux/censusAction';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {AutomatedConvoys, TradeWithAutomatedConvoys} from '../../../src/server/cards/turmoilRedux/AutomatedConvoys';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {POLITICAL_DONATION_NO_DELEGATE_REASON, POLITICAL_DONATION_NO_RESOLUTION_REASON} from '../../../src/server/cards/turmoilRedux/PoliticalDonation';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {AddResourcesToCard} from '../../../src/server/deferredActions/AddResourcesToCard';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {CardRenderer} from '../../../src/server/cards/render/CardRenderer';
import {CARD_FOR_SPENDABLE_RESOURCE} from '../../../src/common/inputs/Spendable';
import {Vesta} from '../../../src/server/colonies/Vesta';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Resource} from '../../../src/common/Resource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, runAllActions} from '../../TestingUtils';

/**
 * TR34 — MARS ARMY MECHS: the census action with a PAID variant A, on ONE
 * module parameterised by a spec (`censusAction.ts`) — the data censuses
 * (TR15 / TR24) stand on the same module unchanged, and the sister TR35 is
 * the same declaration with other constants. Every rule reading of the card
 * file's header is pinned here; the module's generality is pinned at the end
 * with a fighter spec no card declares yet.
 */
const R = PartyName.REDS;
const M = PartyName.MARS;
const G = PartyName.GREENS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: MarsArmyMechs};

/** A two-seat Redux table with three QUIET real resolutions (Greens · Mars First · Reds) — the Greens rule by the starting rule. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new MarsArmyMechs();
  return {game, p1, p2, parliament, card};
}

/** The same table with the card on p1's table, holding `mechs`, p1 holding `energy`. */
function owned(mechs = 1, energy = 1): Table {
  const t = table();
  t.p1.playedCards.push(t.card);
  t.card.resourceCount = mechs;
  t.p1.energy = energy;
  return t;
}

/** Take the action through the REAL blue-action door (its own event scope), answering the variant when asked. */
function act(t: Table, variant?: 0 | 1): void {
  const door = cast(t.p1.playActionCard(), SelectCard);
  door.cb([t.card]);
  runAllActions(t.game);
  if (variant !== undefined) {
    const or = cast(t.p1.getWaitingFor(), OrOptions);
    t.p1.process({type: 'or', index: variant, response: {type: 'option'}});
    runAllActions(t.game);
    expect(or.options).has.length(2);
  }
}

describe('MarsArmyMechs', () => {
  it('registers with source-backed metadata (the scan: 7 · Mars + Building · blue · the Reds · mechs · no VP)', () => {
    const card = new MarsArmyMechs();
    expect(card.name).eq(CardName.MARS_ARMY_MECHS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(7);
    expect(card.tags).deep.eq([Tag.MARS, Tag.BUILDING]);
    expect(card.metadata.cardNumber).eq('TR34');
    expect(card.resourceType).eq(CardResource.MECH);
    expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.metadata.description).eq('Requires the Reds to be ruling or that you have 2 delegates there. Add 1 mech resource to this card.');
    // The graphic, in the scan's reading order: A («[energy] → [mech]») · OR · B («[mech] → [delegate]»), then the
    // play's own mech under the art — each printed row describing itself.
    type Node = {is?: string, type?: string, amount?: number, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows.map((row) => row[0].is === 'effect' ? 'box' : row[0].type)).deep.eq(['box', 'OR', 'box', CardRenderItemType.RESOURCE]);
    const [a, , b, play] = rows.map((row) => row[0]);
    const cause = (box: Node) => (box.rows?.[0] ?? []) as Array<Node>;
    const result = (box: Node) => (box.rows?.[2] ?? []) as Array<Node | string>;
    expect(cause(a)[0]).deep.include({type: CardRenderItemType.ENERGY, amount: 1});
    expect((result(a)[0] as Node).type).eq(CardRenderItemType.RESOURCE);
    expect(result(a), 'A is TR09\'s row, key and all').deep.include('Action: Pay 1 energy to add a mech resource to this card.');
    expect(cause(b)[0], 'ONE mech icon, no digit — the TR66 shape').deep.include({type: CardRenderItemType.RESOURCE, amount: -1});
    expect(result(b)[0]).deep.include({type: CardRenderItemType.DELEGATES, amount: 1});
    expect(result(b)).deep.include('Action: Spend 1 mech from here to add a delegate to a resolution.');
    expect(play, 'the mech of the play, under the art').deep.include({type: CardRenderItemType.RESOURCE, amount: -1});
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with a NAMED reason — the party, and the delegates on its resolution «0 of 2»', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.p1.cardsInHand.push(t.card);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('two delegates on their resolution: playable; one: «1 of 2»', () => {
      const t = table();
      t.p1.megaCredits = 20;
      t.parliament.placeVote(t.p1, t.parliament.slots[2], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1});
      t.parliament.placeVote(t.p1, t.parliament.slots[2], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the Reds rule: playable with no delegate anywhere', () => {
      const t = table();
      t.p1.megaCredits = 20;
      seatEnacted(t.parliament, quietResolutionOf(R));
      expect(t.parliament.rulingParty()).eq(R);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('checked at the PLAY only: once on the table, the action works whoever rules', () => {
      const t = owned(0, 1);
      expect(t.parliament.rulingParty()).not.eq(R);
      expect(t.card.canAct(t.p1)).is.true;
      act(t);
      expect(t.card.resourceCount).eq(1);
    });
  });

  describe('rule 2 — the play: +1 mech on this card, nothing else', () => {
    it('the card lands with one mech; the stock is untouched', () => {
      const t = table();
      const {p1, card} = t;
      seatEnacted(t.parliament, quietResolutionOf(R));
      p1.megaCredits = 20;
      p1.energy = 2;
      p1.cardsInHand.push(card);
      expect(JSON.stringify(cardPlayPreview(p1, card)), 'the play preview promises the mech').includes('"icon":"mech"');
      p1.playCard(card);
      runAllActions(t.game);
      expect(card.resourceCount).eq(1);
      expect(p1.energy).eq(2);
      expect(p1.tableau.get(CardName.MARS_ARMY_MECHS)).eq(card);
    });
  });

  describe('rules 3–4 — ONE action, two variants, their availability', () => {
    it('both live: an OrOptions in the printed order (A, then B), marked as the card\'s own choice', () => {
      const t = owned(1, 1);
      const or = cast(t.card.action(t.p1), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([MARS_ARMY_MECHS_CENSUS.addTitle, MARS_ARMY_MECHS_CENSUS.voteTitle]);
      expect(or.options.map((o) => o.title)).deep.eq([
        'Pay 1 energy to add a mech resource to this card',
        'Spend 1 mech from here to add a delegate to a resolution',
      ]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.MARS_ARMY_MECHS});
      const preview = actionPreview(t.p1, t.card);
      expect(preview.branches.map((b) => b.index), 'two live options → OrOptions indices in order').deep.eq([0, 1]);
    });

    it('A alone (no mech): no prompt — the action IS «1 energy → 1 mech»', () => {
      const t = owned(0, 1);
      expect(t.card.action(t.p1), 'one live option is the whole action').is.undefined;
      expect([t.p1.energy, t.card.resourceCount]).deep.eq([0, 1]);
    });

    it('B alone (no energy, a mech): no prompt — the grant is queued, nothing spent before its answer', () => {
      const t = owned(1, 0);
      expect(t.card.action(t.p1)).is.undefined;
      runAllActions(t.game);
      const select = cast(t.p1.getWaitingFor(), SelectParty);
      expect(select.votePrompt).deep.include({source: 'grant', cost: 0, count: 1, printed: 1});
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: CardName.MARS_ARMY_MECHS}, mode: 'reward'});
      expect(t.card.resourceCount, 'the price is paid in the answer').eq(1);
    });

    it('A at 0 energy: shown disabled with the automatic energy reason, never hidden', () => {
      const t = owned(1, 0);
      const a = actionPreview(t.p1, t.card).branches[0];
      expect(a.available).is.false;
      expect(a.unavailableReason).eq('Not enough energy');
    });

    it('B is refused by ONE reason, in order: the mech on the card («0 of 1»), then the voting area, then the reserve', () => {
      const t = owned(0, 1);
      const reasonOf = () => actionPreview(t.p1, t.card).branches[1];
      expect(reasonOf().available).is.false;
      expect(reasonOf().unavailableReason).eq('${0} of 1 mech on this card');
      expect(reasonOf().unavailableReasonParams).deep.eq(['0']);
      t.card.resourceCount = 1;
      while (t.parliament.reserve(t.p1) > 0) {
        t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      }
      const area = [...t.parliament.slots];
      t.parliament.slots = [];
      expect(reasonOf().unavailableReason).eq(POLITICAL_DONATION_NO_RESOLUTION_REASON);
      t.parliament.slots = area;
      expect(reasonOf().unavailableReason, 'a cube in the lobby does not lift it').eq(POLITICAL_DONATION_NO_DELEGATE_REASON);
      expect(t.parliament.lobby.has(t.p1.id)).is.true;
    });

    it('a refused variant is SHOWN: two branches always, A then B', () => {
      const t = owned(0, 0);
      const preview = actionPreview(t.p1, t.card);
      expect(preview.branches.map((b) => b.title)).deep.eq([MARS_ARMY_MECHS_CENSUS.addTitle, MARS_ARMY_MECHS_CENSUS.voteTitle]);
      expect(preview.branches.map((b) => b.available)).deep.eq([false, false]);
    });

    describe('both dead — `canAct` is false and the reason is the ONE blocker the player can act on (the TR66 rule)', () => {
      const cases: Array<[energy: number, mechs: number, area: boolean, canAct: boolean]> = [
        [1, 0, true, true],
        [0, 1, true, true],
        [1, 1, false, true],
        [0, 0, true, false],
        [0, 1, false, false],
      ];
      for (const [energy, mechs, area, expected] of cases) {
        it(`energy ${energy}, mechs ${mechs}, voting area ${area ? 'full' : 'empty'} → ${expected}`, () => {
          const t = owned(mechs, energy);
          if (!area) {
            t.parliament.slots = [];
          }
          expect(t.card.canAct(t.p1)).eq(expected);
        });
      }

      it('no mech and no energy → the energy (the vote was never on the table)', () => {
        const t = owned(0, 0);
        expect(actionUnavailableReasons(t.p1, t.card)[0]).deep.include({type: 'resource', message: 'Not enough energy', resource: 'energy'});
        expect(t.card.action(t.p1), 'nothing to do').is.undefined;
      });

      it('a mech but no energy and nothing up for a vote → what closed the vote, not the energy', () => {
        const t = owned(1, 0);
        t.parliament.slots = [];
        expect(actionUnavailableReasons(t.p1, t.card)[0]).deep.include({type: 'party', message: POLITICAL_DONATION_NO_RESOLUTION_REASON});
      });
    });
  });

  describe('rule 8 — A: the energy leaves, then the mech arrives, under the card\'s source', () => {
    it('energy 1 → 0, mechs +1, nothing else touched; the two deltas are on the event stream in that order', () => {
      const t = owned(1, 1);
      const {p1, card, game} = t;
      p1.megaCredits = 7;
      p1.steel = 2;
      p1.titanium = 3;
      p1.plants = 4;
      p1.heat = 5;
      act(t, 0);
      expect(p1.energy).eq(0);
      expect(card.resourceCount).eq(2);
      expect([p1.megaCredits, p1.steel, p1.titanium, p1.plants, p1.heat]).deep.eq([7, 2, 3, 4, 5]);
      const events = game.events.events;
      const energyAt = events.findIndex((e) => e.impact.stock?.energy === -1);
      const mechAt = events.findIndex((e) => (e.impact.cardResources ?? []).some((cr) =>
        cr.target === CardName.MARS_ARMY_MECHS && cr.cardResource === CardResource.MECH && cr.amount === 1));
      expect(energyAt, 'the price is recorded').is.gte(0);
      expect(mechAt, 'the gain is recorded').is.gte(0);
      expect(energyAt, 'the price before the gain').is.lt(mechAt);
      expect(p1.actionsThisGeneration.has(CardName.MARS_ARMY_MECHS)).is.true;
    });
  });

  describe('rule 5 — B: the mech leaves and the cube lands in ONE answer (CHECK → PAY → PLACE)', () => {
    it('the ordinary path: mech 1 → 0, the cube on the chosen slot, the reserve one short, the lobby intact', () => {
      const t = owned(1, 1);
      const {game, p1, parliament, card} = t;
      const reserve = parliament.reserve(p1);
      act(t, 1);
      expect(card.resourceCount, 'nothing spent before the answer').eq(1);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(card.resourceCount).eq(0);
      expect(parliament.votesOf(p1, parliament.slots[1])).eq(1);
      expect(parliament.reserve(p1)).eq(reserve - 1);
      expect(parliament.lobby.has(p1.id), 'the lobby\'s cube is not the card\'s to spend').is.true;
      expect(p1.totalDelegatesPlaced).eq(1);
      expect(p1.energy, 'A\'s price is not B\'s').eq(1);
      parliament.assertLedger(game);
    });

    it('the journal: the price\'s OWN line — «spent 1 [mech] from Mars Army Mechs for a delegate», then the delegate', () => {
      const t = owned(1, 1);
      const {game, p1} = t;
      act(t, 1);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      const lines = game.gameLog.map((m) => m.message);
      const price = lines.indexOf('${0} spent ${1} ${2} from ${3} for a delegate');
      const placed = lines.indexOf('${0} added ${1} delegate(s) from the reserve to ${2}');
      expect(price, 'the price line is written').is.gte(0);
      expect(lines, 'never the generic attack line').not.includes('${0} removed ${1} resource(s) from ${2}\'s ${3}');
      expect(game.gameLog[price].data.map((d) => d.value)).deep.eq([p1.color, '1', CardResource.MECH, CardName.MARS_ARMY_MECHS]);
      expect(price, 'the mech leaves before the cube lands').is.lt(placed);
    });

    it('a mech gone between the ask and the answer: no cube, no charge', () => {
      const t = owned(1, 1);
      const {game, p1, parliament, card} = t;
      act(t, 1);
      card.resourceCount = 0;
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(parliament.votesOf(p1)).eq(0);
      expect(card.resourceCount).eq(0);
      expect(parliament.lobby.has(p1.id)).is.true;
    });

    it('a reserve emptied between the ask and the answer charges NOTHING', () => {
      const t = owned(1, 1);
      const {game, p1, parliament, card} = t;
      act(t, 1);
      while (parliament.reserve(p1) > 0) {
        parliament.placeVote(p1, parliament.slots[0], 'reserve');
      }
      const before = parliament.votesOf(p1, parliament.slots[1]);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(parliament.votesOf(p1, parliament.slots[1])).eq(before);
      expect(card.resourceCount, 'the mech was never charged').eq(1);
    });
  });

  describe('rule 6 — the delegate is an ORDINARY delegate', () => {
    it('a second one on the Reds\' resolution opens their effect AND their requirement', () => {
      const t = owned(1, 1);
      const {p1, parliament} = t;
      parliament.placeVote(p1, parliament.slots[2], 'reserve');
      act(t, 1);
      p1.process({type: 'party', partyName: R});
      expect(parliament.access(p1, R)).deep.include({byDelegates: true, satisfiesRequirement: true});
    });

    it('a chairman quest of «send N delegates» counts it', () => {
      const t = owned(1, 1);
      const {game, p1, parliament} = t;
      parliament.quest = {definition: {goal: {kind: 'delegates'}, count: 1}, source: 'spec', generation: game.generation, progress: new Map()};
      act(t, 1);
      p1.process({type: 'party', partyName: M});
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      expect(parliament.quest.completedBy).eq(p1.id);
    });

    it('TR02\'s «3 delegates on resolutions» sees it', () => {
      const t = owned(1, 1);
      const {p1, parliament} = t;
      const science = new PoliticalScience();
      p1.megaCredits = 20;
      p1.cardsInHand.push(science);
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[1], 'reserve');
      expect(p1.canPlay(science)).is.false;
      act(t, 1);
      p1.process({type: 'party', partyName: G});
      expect(p1.canPlay(science)).is.true;
    });
  });

  describe('rule 7 — the mechs here are NOT money and NOT VP; mechs put here by others are fuel for B', () => {
    it('the payment units stay bound to their own cards: EVA\'s 2 are spendable, these 3 are not', () => {
      const t = owned(3, 0);
      const {p1} = t;
      const eva = new EvaMechs();
      eva.resourceCount = 2;
      p1.playedCards.push(eva);
      expect(CARD_FOR_SPENDABLE_RESOURCE.mechs).eq(CardName.EVA_MECHS);
      expect(p1.getSpendable('mechs')).eq(2);
      p1.playedCards.remove(eva);
      expect(p1.getSpendable('mechs'), 'alone, the card makes no mech spendable').eq(0);
      expect(p1.getSpendable('constructionMechs')).eq(0);
      expect(t.card.getVictoryPoints(p1), 'no VP').eq(0);
    });

    it('TR66\'s trade door reads its own card only: three mechs here open nothing', () => {
      const t = owned(3, 0);
      const convoys = new AutomatedConvoys();
      t.p1.playedCards.push(convoys);
      expect(new TradeWithAutomatedConvoys(t.p1).canUse()).is.false;
      expect(new TradeWithAutomatedConvoys(t.p1).disabledReason()).eq('No mechs on this card');
    });

    it('a mech holder for every generic «mech to any card» — and a Vesta trade that picks it makes B live', () => {
      const t = owned(0, 0);
      const {game, p1, card} = t;
      expect(p1.getResourceCards(CardResource.MECH).map((c) => c.name)).includes(CardName.MARS_ARMY_MECHS);
      expect(new AddResourcesToCard(p1, CardResource.MECH, {count: 1}).getCards().map((c) => c.name)).includes(CardName.MARS_ARMY_MECHS);
      const vesta = new Vesta();
      game.colonies = [vesta];
      const eva = new EvaMechs();
      p1.playedCards.push(eva);
      vesta.trackPosition = 6; // the 7th cell: 3 units
      expect(censusVoteReason(p1, card, MARS_ARMY_MECHS_CENSUS)?.message).eq('${0} of 1 mech on this card');
      vesta.trade(p1);
      runAllActions(game);
      const pick = cast(p1.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.EVA_MECHS, CardName.MARS_ARMY_MECHS]);
      pick.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(3);
      expect(censusVoteReason(p1, card, MARS_ARMY_MECHS_CENSUS), 'B is live on Vesta\'s mechs').is.undefined;
    });
  });

  describe('the preview == the execution', () => {
    it('A: a 1-energy cost chip and a +1 mech gain chip «on this card»; B: the mech leaving, the delegate leaving the reserve, the DOOR', () => {
      const t = owned(1, 1);
      const {p1, card, game} = t;
      const preview = actionPreview(p1, card);
      expect(preview.kind).eq('bespoke');
      const [a, b] = preview.branches;
      expect(a.effects).has.length(2);
      expect(a.effects[0]).deep.include({direction: 'cost', icon: 'energy', amount: 1, current: 1, resulting: 0});
      expect(a.effects[1]).deep.include({direction: 'gain', icon: 'mech', amount: 1, current: 1, resulting: 2, note: 'on this card'});
      expect(b.effects[0]).deep.include({direction: 'cost', icon: 'mech', amount: 1, current: 1, resulting: 0, note: 'on this card'});
      expect(b.effects[1]).deep.include({direction: 'cost', icon: 'delegate', amount: 1, note: 'from the reserve'});
      const door = b.steps.find((s) => s.kind === 'delegateGrant');
      if (door === undefined || door.kind !== 'delegateGrant') {
        throw new Error('no delegateGrant door on B');
      }
      expect(door.staged.sourceCard).eq(CardName.MARS_ARMY_MECHS);
      expect(door.staged.prompt).deep.eq(censusGrant(p1, card, MARS_ARMY_MECHS_CENSUS).previewSelectParty());
      // …field for field the live grant's model.
      const or = cast(card.action(p1), OrOptions);
      cast(or.options[1], SelectOption).cb(undefined);
      runAllActions(game);
      const live = p1.getWaitingFor()!.toModel(p1);
      expect(live.type).eq('party');
      expect({...live, choiceContext: undefined}).deep.eq({...door.staged.prompt, choiceContext: undefined});
    });

    it('is read-only: the game serializes identically before and after', () => {
      const t = owned(1, 1);
      const before = JSON.stringify(t.game.serialize());
      actionPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  it('rule 9 — once per generation: the used action is not offered again', () => {
    const t = owned(1, 1);
    const {p1, game} = t;
    p1.actionsThisGeneration.add(CardName.MARS_ARMY_MECHS);
    expect(p1.getPlayableActionCards().map((c) => c.name)).not.includes(CardName.MARS_ARMY_MECHS);
    game.phase = Phase.ACTION;
    p1.actionsThisGeneration.clear();
    expect(p1.getPlayableActionCards().map((c) => c.name)).includes(CardName.MARS_ARMY_MECHS);
  });

  it('rule 10 — save / load: the mechs and the used flag survive, and the card still acts', () => {
    const t = owned(2, 1);
    t.p1.actionsThisGeneration.add(CardName.MARS_ARMY_MECHS);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const again = reloaded.getPlayerById(t.p1.id);
    const card = again.tableau.get(CardName.MARS_ARMY_MECHS) as MarsArmyMechs;
    expect(card.resourceCount).eq(2);
    expect(again.actionsThisGeneration.has(CardName.MARS_ARMY_MECHS)).is.true;
    expect(card.canAct(again)).is.true;
  });

  it('rule 11 — a MarsBot table: the human\'s B places an ordinary delegate; the ledger holds', () => {
    const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([G, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    const card = new MarsArmyMechs();
    card.resourceCount = 1;
    human.playedCards.push(card);
    human.energy = 0;
    expect(card.action(human)).is.undefined;
    runAllActions(game);
    human.process({type: 'party', partyName: M});
    runAllActions(game);
    expect(card.resourceCount).eq(0);
    expect(parliament.votesOf(human, parliament.slots[1])).eq(1);
    parliament.assertLedger(game);
  });
});

describe('censusAction — ONE module, the spec is the whole difference', () => {
  it('the data censuses stand on the same functions with the data spec: TR15 is unchanged, A free and always open', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const census = new MartianCensus();
    p1.playedCards.push(census);
    p1.energy = 0;
    expect(DATA_CENSUS).deep.include({resource: CardResource.DATA, votePrice: 3});
    expect(DATA_CENSUS.add.price, 'A is free').is.undefined;
    expect(censusAddReason(p1, DATA_CENSUS)).is.undefined;
    expect(censusCanAct(p1, census, DATA_CENSUS)).is.true;
    expect(census.canAct(p1)).is.true;
    expect(censusUnavailableReason(p1, census, DATA_CENSUS)).is.undefined;
    expect(censusVoteReason(p1, census, DATA_CENSUS)).deep.include({message: '${0} of 3 data on this card', params: ['0']});
    expect(censusActionPreview(p1, census, DATA_CENSUS).branches[0].effects).has.length(1);
  });

  it('TR35\'s declaration — {FIGHTER, 1 titanium, 1} — needs no code: the rows, the reasons, A\'s price and B\'s grant follow the spec', () => {
    const [game, p1] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([G, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    const SHIPS: CensusSpec = {
      resource: CardResource.FIGHTER,
      add: {amount: 1, price: {resource: Resource.TITANIUM, amount: 1}},
      votePrice: 1,
      addTitle: 'Pay 1 titanium to add a fighter resource to this card',
      voteTitle: 'Spend 1 fighter from here to add a delegate to a resolution',
      shortReason: '${0} of 1 fighter on this card',
      rows: {add: 'Pay 1 titanium to add a fighter resource to this card.', vote: 'Spend 1 fighter from here to add a delegate to a resolution.'},
    };
    const ships = fakeCard({name: 'Mars Army Ships' as CardName, resourceType: CardResource.FIGHTER});
    ships.resourceCount = 0;
    p1.playedCards.push(ships);
    // The face: «[titanium] → [fighter] / OR / [fighter] → [delegate]».
    type Node = {is?: string, type?: string, amount?: number, rows?: Array<Array<Node | string>>};
    const render = CardRenderer.builder((b) => censusActionRows(b, SHIPS)) as unknown as {rows: Array<Array<Node>>};
    const cause = (box: Node) => (box.rows?.[0] ?? []) as Array<Node>;
    expect(render.rows.map((row) => row[0].is === 'effect' ? 'box' : row[0].type)).deep.eq(['box', 'OR', 'box']);
    expect(cause(render.rows[0][0])[0]).deep.include({type: CardRenderItemType.TITANIUM, amount: 1});
    expect(cause(render.rows[2][0])[0]).deep.include({type: CardRenderItemType.RESOURCE, amount: -1});
    // The reasons, by the spec: titanium for A, «0 of 1 fighter» for B; both dead → the titanium.
    p1.titanium = 0;
    expect(censusAddReason(p1, SHIPS)).deep.include({message: 'Not enough titanium', resource: Resource.TITANIUM});
    expect(censusVoteReason(p1, ships, SHIPS)).deep.include({message: '${0} of 1 fighter on this card', params: ['0']});
    expect(censusCanAct(p1, ships, SHIPS)).is.false;
    expect(censusUnavailableReason(p1, ships, SHIPS)?.message).eq('Not enough titanium');
    // A: the titanium leaves, the fighter arrives.
    p1.titanium = 1;
    expect(censusAction(p1, ships, SHIPS), 'one live variant is the whole action').is.undefined;
    expect([p1.titanium, ships.resourceCount]).deep.eq([0, 1]);
    const preview = censusActionPreview(p1, ships, SHIPS);
    expect(preview.branches[0].effects[0]).deep.include({direction: 'cost', icon: 'titanium', amount: 1});
    expect(preview.branches[1].effects[0]).deep.include({direction: 'cost', icon: 'fighter', amount: 1, current: 1, resulting: 0});
    expect(preview.branches[1].steps[0]?.kind).eq('delegateGrant');
    // B: the fighter is the grant's price — paid in the answer, with the cube.
    expect(censusAction(p1, ships, SHIPS)).is.undefined;
    runAllActions(game);
    cast(p1.getWaitingFor(), SelectParty);
    expect(ships.resourceCount, 'nothing spent before the answer').eq(1);
    p1.process({type: 'party', partyName: M});
    runAllActions(game);
    expect(ships.resourceCount).eq(0);
    expect(parliament.votesOf(p1, parliament.slots[1])).eq(1);
    expect(game.gameLog.map((m) => m.message)).includes('${0} spent ${1} ${2} from ${3} for a delegate');
  });
});
