import {expect} from 'chai';
import {NATIONALIST_MOVEMENT_PARTIES, NATIONALIST_MOVEMENT_PRINT, NationalistMovement} from '../../../src/server/cards/turmoilRedux/NationalistMovement';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {rallyPlan} from '../../../src/server/parliament/RallyNeutralDelegates';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {NEUTRAL_SUPPORT_NOTE, NEUTRAL_VOTES_NOTE} from '../../../src/server/cards/actionPreviews';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {NeutralRallyModel} from '../../../src/common/models/ActionPreviewModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {
  NEUTRAL_DELEGATE_ICON, NEUTRAL_VOTE_LABEL, PARLIAMENT_MAX_POPULAR_SUPPORT, PARLIAMENT_NEUTRAL_DELEGATES, POPULAR_SUPPORT_LABEL, ReduxParty,
  SUPPORT_LIMIT_REASON,
} from '../../../src/common/parliament/ParliamentTypes';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {diffRootNotifications, recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR31 — NATIONALIST MOVEMENT: the set's first card that places a NEUTRAL
 * vote — one call of the shared step `RallyNeutralDelegates` (its own tables
 * are pinned by tests/parliament/RallyNeutralDelegates.spec.ts). Every rule
 * reading of the card file's header is pinned here, and the preview's promise
 * is held to the play's result on every table.
 */
const R = PartyName.REDS;
const M = PartyName.MARS;
const G = PartyName.GREENS;
const U = PartyName.UNITY;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: NationalistMovement};

/** A two-seat Redux table, blue's action phase: the Reds' quiet card in slot 0, Mars First's in slot 1, the Greens' in slot 2; the card in hand, 20 M€. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([R, M, G] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  const card = new NationalistMovement();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

/** The requirement's second road: two of blue's delegates on the Reds' card (slot 0). */
function withAccess(t: Table): Table {
  t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
  t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
  expect(t.p1.canPlay(t.card)).is.true;
  return t;
}

/** Leave exactly `n` neutral delegates in the common supply (the rest stand as neutral votes on the Greens' card). */
function drainSupply(parliament: Parliament, n: number): void {
  while (parliament.neutralSupply() > n) {
    parliament.slots[2].votes.push({owner: 'NEUTRAL', seq: ++parliament.voteSeq});
  }
}

function neutralVotes(parliament: Parliament, party: ReduxParty): number {
  const slot = parliament.slotOf(party);
  return slot === undefined ? 0 : parliament.neutralVotes(slot);
}

function planOf(t: Table): NeutralRallyModel {
  const preview = cardPlayPreview(t.p1, t.card);
  const step = preview.branches[0].steps.find((s) => s.kind === 'neutralRally');
  expect(step, 'the rally is a SHOW step of the preview').is.not.undefined;
  return (step as {kind: 'neutralRally', rally: NeutralRallyModel}).rally;
}

function play(t: Table): void {
  t.p1.playCard(t.card, Payment.of({megacredits: 2}));
  runAllActions(t.game);
}

const VOTE_LINE = '${0} adds 1 neutral delegate to ${1}';
const SUPPORT_LINE = '${0} gain ${1} neutral delegate(s) in Popular Support (${2}/${3})';
const MONEY_LINE = '${0} gains ${1} M€ — ${2} neutral delegate(s) in use';

describe('NationalistMovement', () => {
  it('registers with source-backed metadata (the scan: 2 · Mars · green · the Reds\' plate · no VP · TR31) and prints «[neutral]* · 1 M€ / [neutral]»', () => {
    const card = new NationalistMovement();
    expect(card.type).eq(CardType.AUTOMATED);
    expect(card.cost).eq(2);
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.victoryPoints).is.undefined;
    expect(card.metadata.cardNumber).eq('TR31');
    expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
    expect(card.requirements).has.length(1);
    expect(NATIONALIST_MOVEMENT_PARTIES).deep.eq([R, M]);
    expect(NATIONALIST_MOVEMENT_PRINT).deep.eq({perResolution: 1, perArea: 1});
    const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
    expect(rows).has.lengthOf(1);
    const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
    expect(items.map((item) => [item.type, item.amount])).deep.eq([
      [CardRenderItemType.NEUTRAL_DELEGATE, 1], [CardRenderItemType.MEGACREDITS, 1], [CardRenderItemType.NEUTRAL_DELEGATE, 1],
    ]);
    expect(rows[0].some((node) => typeof node === 'object' && node !== null && 'type' in node && (node as {type: string}).type === '*'), 'the asterisk').is.true;
    expect(rows[0].some((node) => typeof node === 'object' && node !== null && 'type' in node && (node as {type: string}).type === '/'), 'the slash').is.true;
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with a NAMED reason — the Reds, «0 of 2»', () => {
      const t = table();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: «1 of 2»; two: playable', () => {
      const t = table();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1});
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('the Reds rule: playable with no delegate anywhere', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(R));
      expect(t.parliament.rulingParty()).eq(R);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('a party effect GRANTED by a card is not a road (FAQ p.19)', () => {
      const t = table();
      t.parliament.grantPartyEffect(t.p1, R, 'Septem Tribus');
      expect(t.parliament.access(t.p1, R).hasEffect).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('outside Turmoil Redux the card is never dealt — and `canPlay` answers false without throwing', () => {
      const [game, p1] = testGame(2);
      game.phase = Phase.ACTION;
      const card = new NationalistMovement();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      expect(game.parliament).is.undefined;
      expect(p1.canPlay(card)).is.false;
    });
  });

  describe('the play — rules 2 to 7, by the «2 delegates» road on a quiet government', () => {
    it('two resolutions, two areas, a full supply: 2 neutral votes, 2 support, in use 2 → 6 (blue\'s own cubes are not neutral), +6 M€; the card is on the table', () => {
      const t = withAccess(table());
      const money = t.p1.megaCredits;
      play(t);
      expect(t.p1.playedCards.get(CardName.NATIONALIST_MOVEMENT)).is.not.undefined;
      expect(neutralVotes(t.parliament, R)).eq(1);
      expect(neutralVotes(t.parliament, M)).eq(1);
      expect(t.parliament.popularSupportOf(R)).eq(1);
      expect(t.parliament.popularSupportOf(M)).eq(1);
      expect(t.parliament.neutralSupply()).eq(PARLIAMENT_NEUTRAL_DELEGATES - 4);
      expect(t.p1.megaCredits, 'the price, then 4 M€ for the 4 neutral delegates in use').eq(money - 2 + 4);
      expect(t.parliament.slots[0].votes.map((v) => v.owner), 'the neutral cube joins AFTER blue\'s two').deep.eq([t.p1.id, t.p1.id, 'NEUTRAL']);
      t.parliament.assertLedger(t.game);
    });

    it('rule 2 — the Reds RULE by an enacted card: no Reds resolution is up for a vote — a named zero, nothing skipped — Mars First votes, both areas pay', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(R));
      expect(t.p1.canPlay(t.card), 'playable by the ruling road').is.true;
      const plan = planOf(t);
      expect(plan.missing).deep.eq([R]);
      expect(plan.votes.map((v) => v.party)).deep.eq([M]);
      play(t);
      expect(neutralVotes(t.parliament, M)).eq(1);
      expect(t.parliament.popularSupportOf(R)).eq(1);
      expect(t.parliament.popularSupportOf(M)).eq(1);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).deep.eq([]);
      expect(t.parliament.lastRally?.missing).deep.eq([R]);
    });

    it('rule 3 — the neutral cube is a VOTE: the Reds\' card becomes the winning one on the tie (slot 0 is closer to ENACTED); the leader never moves', () => {
      const t = withAccess(table());
      t.parliament.placeVote(t.p2, t.parliament.slots[2], 'lobby');
      t.parliament.placeVote(t.p2, t.parliament.slots[2], 'reserve');
      t.parliament.placeVote(t.p2, t.parliament.slots[2], 'reserve'); // the Greens: 3 — the winner before
      expect(t.parliament.winner()?.instance).eq(t.parliament.slots[2].instance);
      const plan = planOf(t);
      expect(plan.votes[0]).deep.include({party: R, votesBefore: 2, votesAfter: 3, winningBefore: false, winningAfter: true, tieNote: 'slot-priority'});
      play(t);
      expect(t.parliament.winner()).deep.include({instance: t.parliament.slots[0].instance, tieBreak: 'slot-priority', player: t.p1.id});
      expect(t.parliament.leaderOf(t.parliament.slots[0])).deep.eq({owner: t.p1.id, votes: 2});
      expect(t.parliament.lastRally?.votes[0]).deep.include({winnerAfter: t.parliament.slots[0].instance, tieNote: 'slot-priority'});
    });

    it('rule 3 — the winner does NOT change when the cube is not enough: the Greens keep it at 4 against 3', () => {
      const t = withAccess(table());
      for (const source of ['lobby', 'reserve', 'reserve', 'reserve'] as const) {
        t.parliament.placeVote(t.p2, t.parliament.slots[2], source);
      }
      const plan = planOf(t);
      expect(plan.votes[0]).deep.include({party: R, winningBefore: false, winningAfter: false, votesAfter: 3});
      play(t);
      expect(t.parliament.winner()?.instance).eq(t.parliament.slots[2].instance);
      expect(t.parliament.lastRally?.winnerBefore).eq(t.parliament.slots[2].instance);
      expect(t.parliament.lastRally?.votes.map((v) => v.winnerAfter)).deep.eq([t.parliament.slots[2].instance, t.parliament.slots[2].instance]);
    });

    it('rule 3 — a card that already wins STAYS the winner, and the party\'s access is what it was', () => {
      const t = withAccess(table());
      expect(t.parliament.winner()?.instance).eq(t.parliament.slots[0].instance);
      const red = t.parliament.access(t.p2, R);
      const plan = planOf(t);
      expect(plan.votes[0]).deep.include({winningBefore: true, winningAfter: true});
      play(t);
      expect(t.parliament.access(t.p2, R)).deep.eq(red);
      expect(t.parliament.access(t.p1, R).byDelegates, 'blue\'s own two still open the effect; the neutral cube adds nothing').is.true;
    });

    it('rule 4 — a FULL area is a named zero («the area is full»), the vote still lands', () => {
      const t = withAccess(table());
      t.parliament.popularSupport.set(M, PARLIAMENT_MAX_POPULAR_SUPPORT);
      const plan = planOf(t);
      expect(plan.support[1]).deep.eq({party: M, current: 3, gained: 0, resulting: 3, printed: 1, limit: 'area'});
      play(t);
      expect(t.parliament.popularSupportOf(M)).eq(3);
      expect(neutralVotes(t.parliament, M)).eq(1);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped');
      expect(skipped).has.lengthOf(1);
      expect(skipped[0].impact.skipped).deep.include({label: POPULAR_SUPPORT_LABEL, reason: SUPPORT_LIMIT_REASON.area});
    });

    for (const supply of [3, 2, 1, 0]) {
      it(`rule 5 — the supply (${supply}) is judged in the printed order, and the M€ never exceed 14`, () => {
        const t = withAccess(table());
        drainSupply(t.parliament, supply);
        const plan = planOf(t);
        const expectedVotes = [supply >= 1, supply >= 2];
        const expectedSupport = [supply >= 3 ? 1 : 0, supply >= 4 ? 1 : 0];
        expect(plan.votes.map((v) => v.placed)).deep.eq(expectedVotes);
        expect(plan.support.map((s) => s.gained)).deep.eq(expectedSupport);
        expect(plan.megacredits).eq(PARLIAMENT_NEUTRAL_DELEGATES);
        const money = t.p1.megaCredits;
        play(t);
        expect(t.p1.megaCredits).eq(money - 2 + PARLIAMENT_NEUTRAL_DELEGATES);
        expect(t.parliament.neutralSupply()).eq(0);
        expect(neutralVotes(t.parliament, R)).eq(expectedVotes[0] ? 1 : 0);
        expect(neutralVotes(t.parliament, M)).eq(expectedVotes[1] ? 1 : 0);
        const skips = t.game.events.events.filter((e) => e.type === 'effect-skipped');
        expect(skips.map((e) => e.impact.skipped?.label)).deep.eq([
          ...(expectedVotes[0] ? [] : [NEUTRAL_VOTE_LABEL]), ...(expectedVotes[1] ? [] : [NEUTRAL_VOTE_LABEL]),
          ...(expectedSupport[0] === 1 ? [] : [POPULAR_SUPPORT_LABEL]), ...(expectedSupport[1] === 1 ? [] : [POPULAR_SUPPORT_LABEL]),
        ]);
        expect(skips.every((e) => e.impact.skipped?.reason === SUPPORT_LIMIT_REASON.supply)).is.true;
        t.parliament.assertLedger(t.game);
      });
    }

    it('rule 6 — the M€ are the neutral delegates IN USE after the placement: every slot\'s neutral votes (any party) and every area', () => {
      const t = withAccess(table());
      t.parliament.popularSupport.set(U, 2);
      t.parliament.popularSupport.set(G, 1);
      t.parliament.slots[2].votes.push({owner: 'NEUTRAL', seq: ++t.parliament.voteSeq});
      t.parliament.slots[2].votes.push({owner: 'NEUTRAL', seq: ++t.parliament.voteSeq});
      expect(t.parliament.neutralSupply()).eq(14 - 5);
      const money = t.p1.megaCredits;
      play(t);
      expect(t.parliament.neutralSupply()).eq(14 - 9);
      expect(t.p1.megaCredits).eq(money - 2 + 9);
      expect(PARLIAMENT_NEUTRAL_DELEGATES - t.parliament.neutralSupply()).eq(9);
    });

    it('rule 7 — everything in ONE answer: no prompt stands after the play', () => {
      const t = withAccess(table());
      play(t);
      expect(t.p1.getWaitingFor()).is.undefined;
    });
  });

  describe('rule 8 — the card\'s delegates are NEUTRAL', () => {
    it('a chairman quest of «send N delegates» does not move; no Agenda marker moves; the vote opens nobody\'s effect', () => {
      const t = withAccess(table());
      t.parliament.quest = {definition: {goal: {kind: 'delegates'}, count: 1}, source: 'spec', generation: t.game.generation, progress: new Map()};
      const placed = t.p1.totalDelegatesPlaced;
      const agenda = [t.parliament.agendaOf(t.p1), t.parliament.agendaOf(t.p2)];
      play(t);
      expect(t.parliament.questProgressOf(t.p1)).eq(0);
      expect(t.parliament.quest.completedBy).is.undefined;
      expect(t.p1.totalDelegatesPlaced).eq(placed);
      expect([t.parliament.agendaOf(t.p1), t.parliament.agendaOf(t.p2)]).deep.eq(agenda);
      expect(t.parliament.access(t.p2, M).hasEffect).is.false;
      expect(t.parliament.lastAdvance).is.undefined;
    });

    it('on a MarsBot table the bot\'s cubes are the bot\'s, never neutral: they are not counted', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([R, M, G] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      expect(bot.isMarsBot).is.true;
      parliament.placeVote(bot, parliament.slots[2], 'lobby');
      const card = new NationalistMovement();
      human.cardsInHand.push(card);
      human.megaCredits = 20;
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      parliament.placeVote(human, parliament.slots[0], 'reserve');
      expect(human.canPlay(card)).is.true;
      const plan = rallyPlan(parliament, NATIONALIST_MOVEMENT_PARTIES, NATIONALIST_MOVEMENT_PRINT);
      expect(plan.inUse).deep.eq({before: 0, after: 4});
      human.playCard(card, Payment.of({megacredits: 2}));
      runAllActions(game);
      expect(human.megaCredits).eq(20 - 2 + 4);
      expect(parliament.slots[2].votes.map((v) => v.owner)).deep.eq([bot.id]);
      parliament.assertLedger(game);
    });
  });

  describe('the preview == the play, on every table', () => {
    const tables: Array<{name: string, arrange: (t: Table) => void}> = [
      {name: 'two resolutions, empty areas', arrange: () => undefined},
      {name: 'the Reds rule by a card', arrange: (t) => seatEnacted(t.parliament, quietResolutionOf(R))},
      {name: 'Mars First not in the area', arrange: (t) => seatResolution(t.parliament, 1, quietResolutionOf(U))},
      {name: 'the Reds\' area full', arrange: (t) => t.parliament.popularSupport.set(R, 3)},
      {name: 'supply 3', arrange: (t) => drainSupply(t.parliament, 3)},
      {name: 'supply 1', arrange: (t) => drainSupply(t.parliament, 1)},
      {name: 'a tie decided by the slot', arrange: (t) => {
        t.parliament.placeVote(t.p2, t.parliament.slots[2], 'lobby');
        t.parliament.placeVote(t.p2, t.parliament.slots[2], 'reserve');
        t.parliament.placeVote(t.p2, t.parliament.slots[2], 'reserve');
      }},
    ];
    for (const {name, arrange} of tables) {
      it(`${name}: the plan read before the press is the fact, line by line`, () => {
        const t = table();
        arrange(t);
        if (!t.p1.canPlay(t.card)) {
          withAccess(t);
        }
        const plan = planOf(t);
        const preview = cardPlayPreview(t.p1, t.card);
        const chips = preview.branches[0].effects;
        const placed = plan.votes.filter((v) => v.placed).length;
        const supported = plan.support.reduce((n, s) => n + s.gained, 0);
        expect(chips.filter((c) => c.icon === NEUTRAL_DELEGATE_ICON && c.note === NEUTRAL_VOTES_NOTE).map((c) => c.amount)).deep.eq(placed > 0 ? [placed] : []);
        expect(chips.filter((c) => c.icon === NEUTRAL_DELEGATE_ICON && c.note === NEUTRAL_SUPPORT_NOTE).map((c) => c.amount)).deep.eq(supported > 0 ? [supported] : []);
        expect(chips.find((c) => c.icon === 'megacredits')).deep.include({direction: 'gain', amount: plan.megacredits});
        const money = t.p1.megaCredits;
        play(t);
        const record = t.parliament.lastRally!;
        expect(record.votes.map((v) => [v.party, v.votes])).deep.eq(plan.votes.filter((v) => v.placed).map((v) => [v.party, v.votesAfter]));
        expect(record.votes.map((v) => v.winnerAfter === v.instance)).deep.eq(plan.votes.filter((v) => v.placed).map((v) => v.winningAfter));
        expect(record.votesCut.map((v) => v.party)).deep.eq(plan.votes.filter((v) => !v.placed).map((v) => v.party));
        expect(record.missing).deep.eq(plan.missing);
        expect(record.support.map((s) => [s.party, s.current, s.gained, s.resulting, s.limit])).deep.eq(plan.support.map((s) => [s.party, s.current, s.gained, s.resulting, s.limit]));
        expect(record.inUse).deep.eq(plan.inUse);
        expect(record.megacredits).eq(plan.megacredits);
        expect(t.p1.megaCredits).eq(money - 2 + plan.megacredits);
        expect(PARLIAMENT_NEUTRAL_DELEGATES - t.parliament.neutralSupply()).eq(plan.inUse.after);
        t.parliament.assertLedger(t.game);
      });
    }

    it('building the preview changes nothing: no event, no journal line, no record, the same save', () => {
      const t = withAccess(table());
      const before = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      const log = t.game.gameLog.length;
      cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect(t.game.events.events.length).eq(events);
      expect(t.game.gameLog.length).eq(log);
      expect(t.parliament.lastRally).is.undefined;
    });
  });

  describe('rule 9 — what the TABLE is told: the journal, the events, the record, a rival\'s notification', () => {
    function rootOf(t: Table): number {
      return t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.NATIONALIST_MOVEMENT)!.id;
    }

    it('the journal lines, in the printed order: the two votes with their resolutions, the two areas (the party as the subject), the M€ with its basis', () => {
      const t = withAccess(table());
      const at = t.game.gameLog.length;
      play(t);
      const lines = t.game.gameLog.slice(at).map((entry) => entry.message).filter((m) => [VOTE_LINE, SUPPORT_LINE, MONEY_LINE].includes(m));
      expect(lines).deep.eq([VOTE_LINE, VOTE_LINE, SUPPORT_LINE, SUPPORT_LINE, MONEY_LINE]);
      const money = t.game.gameLog.slice(at).find((entry) => entry.message === MONEY_LINE)!;
      expect(money.data.map((d) => d.value)).deep.eq([t.p1.color, '4', '4']);
    });

    it('the typed facts join the play\'s chain under the CARD: two `neutral-delegates-placed` (the dark figure), two `popular-support-gained`, the M€ delta', () => {
      const t = withAccess(table());
      play(t);
      const root = rootOf(t);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const votes = chain.filter((e) => e.type === 'neutral-delegates-placed');
      const support = chain.filter((e) => e.type === 'popular-support-gained');
      expect(votes.map((e) => e.impact.delegates)).deep.eq([
        {count: 1, resolution: quietResolutionOf(R), neutral: true}, {count: 1, resolution: quietResolutionOf(M), neutral: true},
      ]);
      expect(support.map((e) => e.impact.popularSupport)).deep.eq([{party: R, gained: 1, total: 1}, {party: M, gained: 1, total: 1}]);
      for (const e of [...votes, ...support]) {
        expect(e.player).eq(t.p1.color);
        expect(e.visibility).eq('journal');
        expect(e.source).deep.include({kind: 'card', card: CardName.NATIONALIST_MOVEMENT});
      }
      expect(chain.indexOf(support[0]), '«and to each of their areas» after the votes').gt(chain.indexOf(votes[1]));
      const gain = chain.find((e) => e.type === 'resource-changed' && e.impact.stock?.megacredits === 4);
      expect(gain, 'the M€ under the card').is.not.undefined;
      expect(chain.indexOf(gain!), '«then»').gt(chain.indexOf(support[1]));
    });

    it('the journal draws the votes as rows of the card with the DARK figure — «[neutral] +1 · <resolution>» twice — then the support rows; the payment reads last', () => {
      const t = withAccess(table());
      play(t);
      const root = rootOf(t);
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, t.p1.color);
      const own = rows.filter((row) => row.source.kind === 'card' && row.source.card === CardName.NATIONALIST_MOVEMENT);
      expect(own.filter((row) => row.political?.kind === 'resolution').map((row) => ({chips: row.chips, political: row.political}))).deep.eq([
        {chips: [{icon: NEUTRAL_DELEGATE_ICON, text: '+1'}], political: {kind: 'resolution', resolution: quietResolutionOf(R)}},
        {chips: [{icon: NEUTRAL_DELEGATE_ICON, text: '+1'}], political: {kind: 'resolution', resolution: quietResolutionOf(M)}},
      ]);
      expect(own.filter((row) => row.political?.kind === 'support').map((row) => row.political)).deep.eq([
        {kind: 'support', party: R, total: 1}, {kind: 'support', party: M, total: 1},
      ]);
      expect(own.some((row) => row.chips.some((chip) => chip.icon === 'megacredits' && chip.text === '+4')), 'the M€ is its own chip under the card').is.true;
      expect(rows[rows.length - 1].bucket).eq('payment');
    });

    it('a rival\'s notification carries the votes, the support and the M€ as the actor\'s pills — never a bare «played a card · −2 M€»', () => {
      const t = withAccess(table());
      play(t);
      const impact = recomputeRootImpact(t.game.events.events, rootOf(t), t.p1.color, t.p2.color);
      const actor = impact.pillGroups.find((group) => group.scope === 'actor');
      expect(actor?.chips.map((chip) => `${chip.icon} ${chip.text}`)).to.include.members([`${NEUTRAL_DELEGATE_ICON} +4`, 'megacredits +2']);
      expect(impact.skipped).deep.eq([]);
    });

    it('a rival\'s notification opens the PARLIAMENT — the object the card is about (PL-025: the family of parliament outcomes)', () => {
      const t = withAccess(table());
      play(t);
      const {models} = diffRootNotifications({
        messages: t.game.gameLog, events: t.game.events.events, seen: new Set<number>(), viewerColor: t.p2.color, generation: t.game.getGeneration(), createdAt: 1000,
      });
      const card = models.find((m) => m.variant === 'play-card');
      expect(card, 'red is told of blue\'s play').is.not.undefined;
      expect(card!.cta).deep.eq({labelKey: 'Open the Parliament', action: 'open-parliament'});
    });

    it('the record is written ONCE per play, with a growing serial, and `counted` IS the table', () => {
      const t = withAccess(table());
      play(t);
      const first = t.parliament.lastRally!;
      expect(first.card).eq(CardName.NATIONALIST_MOVEMENT);
      expect(first.player).eq(t.p1.id);
      const counted = first.counted.votes.reduce((n, e) => n + e.seqs.length, 0) + first.counted.support.reduce((n, e) => n + e.count, 0);
      expect(counted).eq(first.inUse.after);
      expect(first.counted.votes.map((e) => e.instance)).deep.eq([t.parliament.slots[0].instance, t.parliament.slots[1].instance]);
      expect(first.counted.support).has.deep.members([{party: R, count: 1}, {party: M, count: 1}]);
      expect(first.seq).to.be.greaterThan(0);
      // The serial's growth across two rallies is the shared step's own law (RallyNeutralDelegates.spec).
    });
  });

  it('rule 10 — save / load: the card on the table, the neutral votes and the areas survive; the record does not (a presentation ring), and the ledger holds', () => {
    const t = withAccess(table());
    play(t);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    const parliament = live.parliament!;
    expect([...again.tableau].map((c) => c.name)).includes(CardName.NATIONALIST_MOVEMENT);
    expect(neutralVotes(parliament, R)).eq(1);
    expect(neutralVotes(parliament, M)).eq(1);
    expect(parliament.popularSupportOf(R)).eq(1);
    expect(parliament.popularSupportOf(M)).eq(1);
    expect(parliament.neutralSupply()).eq(14 - 4);
    expect(parliament.lastRally).is.undefined;
    parliament.assertLedger(live);
  });
});
