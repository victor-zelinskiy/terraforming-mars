import {expect} from 'chai';
import {MARS_ARMY_SHIPS_CENSUS, MarsArmyShips} from '../../../src/server/cards/turmoilRedux/MarsArmyShips';
import {censusGrant, censusVoteReason} from '../../../src/server/cards/turmoilRedux/censusAction';
import {SpaceshipRecycling} from '../../../src/server/cards/turmoilRedux/SpaceshipRecycling';
import {EarthArmyContract} from '../../../src/server/cards/turmoilRedux/EarthArmyContract';
import {FormulaZero} from '../../../src/server/cards/turmoilRedux/FormulaZero';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {PoliticalScience} from '../../../src/server/cards/turmoilRedux/PoliticalScience';
import {SecurityFleet} from '../../../src/server/cards/base/SecurityFleet';
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
import {RemoveResourcesFromCard} from '../../../src/server/deferredActions/RemoveResourcesFromCard';
import {ICard} from '../../../src/server/cards/ICard';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {CARD_FOR_SPENDABLE_RESOURCE} from '../../../src/common/inputs/Spendable';
import {Payment} from '../../../src/common/inputs/Payment';
import {newProjectCard} from '../../../src/server/createCard';
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
import {runAllActions} from '../../TestingUtils';

/**
 * TR35 — MARS ARMY SHIPS: TR34's census with fighters and titanium — ONE
 * declaration of the shared module (`censusAction.ts`), nothing of the action
 * in the card file. Every rule reading of the card file's header is pinned
 * here on the REAL card (the module's generality stays pinned on a fake card
 * in `MarsArmyMechs.spec`), plus what the fighter brings: other fighter
 * holders of five meanings (Security Fleet / TR08 score theirs, TR28 turns its
 * own into TR, TR29 spends ANY of the player's), Vesta's fighters as fuel, and
 * the Space tag's payment lane.
 */
const R = PartyName.REDS;
const M = PartyName.MARS;
const G = PartyName.GREENS;
const SHIPS = CardName.MARS_ARMY_SHIPS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: MarsArmyShips};

/** A two-seat Redux table with three QUIET real resolutions (Greens · Mars First · Reds) — the Greens rule by the starting rule. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new MarsArmyShips();
  return {game, p1, p2, parliament, card};
}

/** The same table with the card on p1's table, holding `fighters`, p1 holding `titanium`. */
function owned(fighters = 1, titanium = 1): Table {
  const t = table();
  t.p1.playedCards.push(t.card);
  t.card.resourceCount = fighters;
  t.p1.titanium = titanium;
  return t;
}

/** Put a card with `count` resources into a seat's tableau. */
function holder<T extends ICard>(player: TestPlayer, card: T, count: number): T {
  card.resourceCount = count;
  player.playedCards.push(card);
  return card;
}

/** Take the action through the REAL blue-action door (its own event scope), answering the variant when asked. */
function act(t: Table, variant?: 0 | 1, card: ICard = t.card): void {
  const door = cast(t.p1.playActionCard(), SelectCard);
  door.cb([card]);
  runAllActions(t.game);
  if (variant !== undefined) {
    const or = cast(t.p1.getWaitingFor(), OrOptions);
    t.p1.process({type: 'or', index: variant, response: {type: 'option'}});
    runAllActions(t.game);
    expect(or.options).has.length(2);
  }
}

describe('MarsArmyShips', () => {
  it('registers with source-backed metadata (the scan: 6 · Mars + Space · blue · the Reds · fighters · no VP)', () => {
    const card = new MarsArmyShips();
    expect(card.name).eq(SHIPS);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(6);
    expect(card.tags).deep.eq([Tag.MARS, Tag.SPACE]);
    expect(card.metadata.cardNumber).eq('TR35');
    expect(card.resourceType).eq(CardResource.FIGHTER);
    expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
    expect(card.requirements).has.length(1);
    expect(card.victoryPoints, 'no VP badge').is.undefined;
    expect(card.resourceRole, 'the fighters here buy delegates — the satellite\'s split, the target step\'s value line').deep.eq({kind: 'delegate'});
    expect(card.metadata.description).eq('Requires the Reds to be ruling or that you have 2 delegates there. Add 1 fighter resource to this card.');
    // The graphic, in the scan's reading order: A («[titanium] → [fighter]») · OR · B («[fighter] → [delegate]»), then
    // the play's own fighter under the art — each printed row describing itself.
    type Node = {is?: string, type?: string, amount?: number, rows?: Array<Array<Node | string>>};
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
    expect(rows.map((row) => row[0].is === 'effect' ? 'box' : row[0].type)).deep.eq(['box', 'OR', 'box', CardRenderItemType.RESOURCE]);
    const [a, , b, play] = rows.map((row) => row[0]);
    const cause = (box: Node) => (box.rows?.[0] ?? []) as Array<Node>;
    const result = (box: Node) => (box.rows?.[2] ?? []) as Array<Node | string>;
    expect(cause(a)[0]).deep.include({type: CardRenderItemType.TITANIUM, amount: 1});
    expect((result(a)[0] as Node).type).eq(CardRenderItemType.RESOURCE);
    expect(result(a), 'A\'s own key — never Security Fleet\'s «Spend 1 titanium…»').deep.include('Action: Pay 1 titanium to add a fighter resource to this card.');
    expect(cause(b)[0], 'ONE fighter icon, no digit — the TR66 shape').deep.include({type: CardRenderItemType.RESOURCE, amount: -1});
    expect(result(b)[0]).deep.include({type: CardRenderItemType.DELEGATES, amount: 1});
    expect(result(b)).deep.include('Action: Spend 1 fighter from here to add a delegate to a resolution.');
    expect(play, 'the fighter of the play, under the art').deep.include({type: CardRenderItemType.RESOURCE, amount: -1});
  });

  it('the declaration IS the one `MarsArmyMechs.spec` pinned on a fake card — the constants moved, nothing rewritten', () => {
    expect(MARS_ARMY_SHIPS_CENSUS).deep.eq({
      resource: CardResource.FIGHTER,
      add: {amount: 1, price: {resource: Resource.TITANIUM, amount: 1}},
      votePrice: 1,
      addTitle: 'Pay 1 titanium to add a fighter resource to this card',
      voteTitle: 'Spend 1 fighter from here to add a delegate to a resolution',
      shortReason: '${0} of 1 fighter on this card',
      rows: {add: 'Pay 1 titanium to add a fighter resource to this card.', vote: 'Spend 1 fighter from here to add a delegate to a resolution.'},
    });
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

  describe('rule 2 — the play: +1 fighter on this card, nothing else', () => {
    it('the card lands with one fighter; the stock is untouched', () => {
      const t = table();
      const {p1, card} = t;
      seatEnacted(t.parliament, quietResolutionOf(R));
      p1.megaCredits = 20;
      p1.titanium = 2;
      p1.cardsInHand.push(card);
      expect(JSON.stringify(cardPlayPreview(p1, card)), 'the play preview promises the fighter').includes('"icon":"fighter"');
      p1.playCard(card);
      runAllActions(t.game);
      expect(card.resourceCount).eq(1);
      expect(p1.titanium).eq(2);
      expect(p1.tableau.get(SHIPS)).eq(card);
    });
  });

  describe('rules 3–4 — ONE action, two variants, their availability', () => {
    it('both live: an OrOptions in the printed order (A, then B), marked as the card\'s own choice', () => {
      const t = owned(1, 1);
      const or = cast(t.card.action(t.p1), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([
        'Pay 1 titanium to add a fighter resource to this card',
        'Spend 1 fighter from here to add a delegate to a resolution',
      ]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: SHIPS});
      const preview = actionPreview(t.p1, t.card);
      expect(preview.branches.map((b) => b.index), 'two live options → OrOptions indices in order').deep.eq([0, 1]);
    });

    it('A alone (no fighter): no prompt — the action IS «1 titanium → 1 fighter»', () => {
      const t = owned(0, 1);
      expect(t.card.action(t.p1), 'one live option is the whole action').is.undefined;
      expect([t.p1.titanium, t.card.resourceCount]).deep.eq([0, 1]);
    });

    it('B alone (no titanium, a fighter): no prompt — the grant is queued, nothing spent before its answer', () => {
      const t = owned(1, 0);
      expect(t.card.action(t.p1)).is.undefined;
      runAllActions(t.game);
      const select = cast(t.p1.getWaitingFor(), SelectParty);
      expect(select.votePrompt).deep.include({source: 'grant', cost: 0, count: 1, printed: 1});
      expect(select.choiceContext).deep.eq({source: {kind: 'card', card: SHIPS}, mode: 'reward'});
      expect(t.card.resourceCount, 'the price is paid in the answer').eq(1);
    });

    it('A at 0 titanium: shown disabled with the automatic titanium reason, never hidden — and M€ never stands in for it', () => {
      const t = owned(1, 0);
      t.p1.megaCredits = 50;
      const a = actionPreview(t.p1, t.card).branches[0];
      expect(a.available).is.false;
      expect(a.unavailableReason).eq('Not enough titanium');
    });

    it('B is refused by ONE reason, in order: the fighter on the card («0 of 1»), then the voting area, then the reserve', () => {
      const t = owned(0, 1);
      const reasonOf = () => actionPreview(t.p1, t.card).branches[1];
      expect(reasonOf().available).is.false;
      expect(reasonOf().unavailableReason).eq('${0} of 1 fighter on this card');
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
      expect(preview.branches.map((b) => b.title)).deep.eq([MARS_ARMY_SHIPS_CENSUS.addTitle, MARS_ARMY_SHIPS_CENSUS.voteTitle]);
      expect(preview.branches.map((b) => b.available)).deep.eq([false, false]);
    });

    describe('both dead — `canAct` is false and the reason is the ONE blocker the player can act on (the TR66 rule)', () => {
      const cases: Array<[titanium: number, fighters: number, area: boolean, canAct: boolean]> = [
        [1, 0, true, true],
        [0, 1, true, true],
        [1, 1, false, true],
        [0, 0, true, false],
        [0, 1, false, false],
      ];
      for (const [titanium, fighters, area, expected] of cases) {
        it(`titanium ${titanium}, fighters ${fighters}, voting area ${area ? 'full' : 'empty'} → ${expected}`, () => {
          const t = owned(fighters, titanium);
          if (!area) {
            t.parliament.slots = [];
          }
          expect(t.card.canAct(t.p1)).eq(expected);
        });
      }

      it('no fighter and no titanium → the titanium (the vote was never on the table)', () => {
        const t = owned(0, 0);
        expect(actionUnavailableReasons(t.p1, t.card)[0]).deep.include({type: 'resource', message: 'Not enough titanium', resource: 'titanium'});
        expect(t.card.action(t.p1), 'nothing to do').is.undefined;
      });

      it('a fighter but no titanium and nothing up for a vote → what closed the vote, not the titanium', () => {
        const t = owned(1, 0);
        t.parliament.slots = [];
        expect(actionUnavailableReasons(t.p1, t.card)[0]).deep.include({type: 'party', message: POLITICAL_DONATION_NO_RESOLUTION_REASON});
      });
    });
  });

  describe('rule 8 — A: the titanium leaves, then the fighter arrives, under the card\'s source', () => {
    it('titanium 1 → 0, fighters +1, nothing else touched; the two deltas are on the event stream in that order', () => {
      const t = owned(1, 1);
      const {p1, card, game} = t;
      p1.megaCredits = 7;
      p1.steel = 2;
      p1.energy = 3;
      p1.plants = 4;
      p1.heat = 5;
      act(t, 0);
      expect(p1.titanium).eq(0);
      expect(card.resourceCount).eq(2);
      expect([p1.megaCredits, p1.steel, p1.energy, p1.plants, p1.heat]).deep.eq([7, 2, 3, 4, 5]);
      const events = game.events.events;
      const titaniumAt = events.findIndex((e) => e.impact.stock?.titanium === -1);
      const fighterAt = events.findIndex((e) => (e.impact.cardResources ?? []).some((cr) =>
        cr.target === SHIPS && cr.cardResource === CardResource.FIGHTER && cr.amount === 1));
      expect(titaniumAt, 'the price is recorded').is.gte(0);
      expect(fighterAt, 'the gain is recorded').is.gte(0);
      expect(titaniumAt, 'the price before the gain').is.lt(fighterAt);
      expect(p1.actionsThisGeneration.has(SHIPS)).is.true;
    });
  });

  describe('rule 5 — B: the fighter leaves and the cube lands in ONE answer (CHECK → PAY → PLACE)', () => {
    it('the ordinary path: fighter 1 → 0, the cube on the chosen slot, the reserve one short, the lobby intact', () => {
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
      expect(p1.titanium, 'A\'s price is not B\'s').eq(1);
      parliament.assertLedger(game);
    });

    it('the journal: the price\'s OWN line — «spent 1 [fighter] from Mars Army Ships for a delegate», then the delegate', () => {
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
      expect(game.gameLog[price].data.map((d) => d.value)).deep.eq([p1.color, '1', CardResource.FIGHTER, SHIPS]);
      expect(price, 'the fighter leaves before the cube lands').is.lt(placed);
    });

    it('a fighter gone between the ask and the answer: no cube, no charge', () => {
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
      expect(card.resourceCount, 'the fighter was never charged').eq(1);
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

  describe('rule 7 — the fighters here are DELEGATES: not VP, not TR; TR29 may spend them, Vesta may fuel them', () => {
    it('no VP here, and the VP holders score only their OWN fighters (Security Fleet, TR08)', () => {
      const t = owned(3, 0);
      const {p1, card} = t;
      const fleet = holder(p1, new SecurityFleet(), 2);
      const formula = holder(p1, new FormulaZero(), 1);
      expect(card.getVictoryPoints(p1), 'no VP').eq(0);
      expect(fleet.getVictoryPoints(p1), 'Security Fleet: its own two').eq(2);
      expect(formula.getVictoryPoints(p1), 'Formula Zero: its own one').eq(1);
    });

    it('TR28\'s action reads only its OWN fighters: three here give it no TR and lose nothing', () => {
      const t = owned(3, 0);
      const {p1, card} = t;
      const contract = holder(p1, new EarthArmyContract(), 0);
      const tr = p1.terraformRating;
      act(t, undefined, contract);
      expect(contract.resourceCount, 'its own fighter arrives on itself').eq(1);
      expect(card.resourceCount, 'the delegates\' fuel is untouched').eq(3);
      expect(p1.terraformRating).eq(tr);
    });

    it('TR29 may legally spend a fighter FROM HERE («any of your cards») — and B loses its fuel, named «0 of 1»', () => {
      const t = owned(1, 0);
      const {game, p1, card} = t;
      const recycling = holder(p1, new SpaceshipRecycling(), 0);
      expect(RemoveResourcesFromCard.getAvailableTargetCards(p1, CardResource.FIGHTER, 'self').map((c) => c.name),
        'the source step offers this card').deep.eq([SHIPS]);
      const door = cast(p1.playActionCard(), SelectCard);
      door.cb([recycling]);
      runAllActions(game);
      const source = cast(p1.getWaitingFor(), SelectCard<ICard>);
      expect(source.cards.map((c) => c.name)).deep.eq([SHIPS]);
      p1.process({type: 'card', cards: [SHIPS]});
      runAllActions(game);
      // No mech holder on the table: TR29's B has no target, so its A is the whole outcome (no OrOptions asked).
      expect(card.resourceCount).eq(0);
      expect(p1.titanium, 'TR29\'s A paid out').eq(2);
      expect(censusVoteReason(p1, card, MARS_ARMY_SHIPS_CENSUS)).deep.include({message: '${0} of 1 fighter on this card', params: ['0']});
      expect(card.canAct(p1), 'and TR29\'s titanium opens A again').is.true;
    });

    it('a fighter holder for every generic «fighter to any card» — and a Vesta trade that picks it makes B live', () => {
      const t = owned(0, 0);
      const {game, p1, card} = t;
      expect(p1.getResourceCards(CardResource.FIGHTER).map((c) => c.name)).includes(SHIPS);
      expect(new AddResourcesToCard(p1, CardResource.FIGHTER, {count: 1}).getCards().map((c) => c.name)).includes(SHIPS);
      const vesta = new Vesta();
      game.colonies = [vesta];
      holder(p1, new SecurityFleet(), 0);
      vesta.trackPosition = 6; // the 7th cell: 3 units
      expect(censusVoteReason(p1, card, MARS_ARMY_SHIPS_CENSUS)?.message).eq('${0} of 1 fighter on this card');
      vesta.trade(p1);
      runAllActions(game);
      const pick = cast(p1.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.SECURITY_FLEET, SHIPS]);
      pick.cb([card]);
      runAllActions(game);
      expect(card.resourceCount).eq(3);
      expect(censusVoteReason(p1, card, MARS_ARMY_SHIPS_CENSUS), 'B is live on Vesta\'s fighters').is.undefined;
    });
  });

  describe('rule 12 — the Space tag', () => {
    it('the play is payable with EVA Mechs\' mechs and with titanium; Construction Mechs\' lane stays shut', () => {
      const t = table();
      const {p1, card} = t;
      const options = p1.paymentOptionsForCard(card);
      expect(CARD_FOR_SPENDABLE_RESOURCE.mechs).eq(CardName.EVA_MECHS);
      expect(options.mechs, 'EVA Mechs: «when playing a Space tag»').is.true;
      expect(options.titanium).is.true;
      expect(options.constructionMechs, 'no Building, no City').is.false;
      expect(options.steel).is.false;
    });

    it('a play paid with EVA\'s mechs: 6 M€ = one mech (5) + 1 M€', () => {
      const t = table();
      const {game, p1, card} = t;
      seatEnacted(t.parliament, quietResolutionOf(R));
      const eva = holder(p1, new EvaMechs(), 2);
      p1.megaCredits = 1;
      p1.titanium = 0;
      p1.cardsInHand.push(card);
      expect(p1.canPlay(card)).is.true;
      p1.checkPaymentAndPlayCard(card, Payment.of({megacredits: 1, mechs: 1}));
      runAllActions(game);
      expect(eva.resourceCount).eq(1);
      expect(p1.megaCredits).eq(0);
      expect(card.resourceCount).eq(1);
    });

    it('TR05 Vector Computations\' «draw a Space card» finds it under a card without one', () => {
      const t = table();
      const {game, p1} = t;
      holder(p1, new VectorComputations(), 4);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      // `draw()` pops: the LAST is on top — a Mars-only card above this one, spares at the bottom.
      game.projectDeck.drawPile.push(...[CardName.ALGAE, CardName.ALGAE, SHIPS, CardName.MARS_ARMY_MECHS].map((n) => newProjectCard(n)!));
      act(t, undefined, p1.tableau.get(CardName.VECTOR_COMPUTATIONS)!);
      expect(p1.cardsInHand.map((c) => c.name)).deep.eq([SHIPS]);
      expect(game.projectDeck.discardPile.map((c) => c.name), 'TR34 has no Space tag').deep.eq([CardName.MARS_ARMY_MECHS]);
    });
  });

  describe('the preview == the execution', () => {
    it('A: a 1-titanium cost chip and a +1 fighter gain chip «on this card»; B: the fighter leaving, the delegate leaving the reserve, the DOOR', () => {
      const t = owned(1, 1);
      const {p1, card, game} = t;
      const preview = actionPreview(p1, card);
      expect(preview.kind).eq('bespoke');
      const [a, b] = preview.branches;
      expect(a.effects).has.length(2);
      expect(a.effects[0]).deep.include({direction: 'cost', icon: 'titanium', amount: 1, current: 1, resulting: 0});
      expect(a.effects[1]).deep.include({direction: 'gain', icon: 'fighter', amount: 1, current: 1, resulting: 2, note: 'on this card'});
      expect(b.effects[0]).deep.include({direction: 'cost', icon: 'fighter', amount: 1, current: 1, resulting: 0, note: 'on this card'});
      expect(b.effects[1]).deep.include({direction: 'cost', icon: 'delegate', amount: 1, note: 'from the reserve'});
      const door = b.steps.find((s) => s.kind === 'delegateGrant');
      if (door === undefined || door.kind !== 'delegateGrant') {
        throw new Error('no delegateGrant door on B');
      }
      expect(door.staged.sourceCard).eq(SHIPS);
      expect(door.staged.prompt).deep.eq(censusGrant(p1, card, MARS_ARMY_SHIPS_CENSUS).previewSelectParty());
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
    p1.actionsThisGeneration.add(SHIPS);
    expect(p1.getPlayableActionCards().map((c) => c.name)).not.includes(SHIPS);
    game.phase = Phase.ACTION;
    p1.actionsThisGeneration.clear();
    expect(p1.getPlayableActionCards().map((c) => c.name)).includes(SHIPS);
  });

  it('rule 10 — save / load: the fighters and the used flag survive, and the card still acts', () => {
    const t = owned(2, 1);
    t.p1.actionsThisGeneration.add(SHIPS);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const again = reloaded.getPlayerById(t.p1.id);
    const card = again.tableau.get(SHIPS) as MarsArmyShips;
    expect(card.resourceCount).eq(2);
    expect(again.actionsThisGeneration.has(SHIPS)).is.true;
    expect(card.canAct(again)).is.true;
  });

  it('rule 11 — a MarsBot table: the human\'s B places an ordinary delegate; the ledger holds', () => {
    const [game, human] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    ([G, M, R] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
    const card = new MarsArmyShips();
    card.resourceCount = 1;
    human.playedCards.push(card);
    human.titanium = 0;
    expect(card.action(human)).is.undefined;
    runAllActions(game);
    human.process({type: 'party', partyName: M});
    runAllActions(game);
    expect(card.resourceCount).eq(0);
    expect(parliament.votesOf(human, parliament.slots[1])).eq(1);
    parliament.assertLedger(game);
  });
});
