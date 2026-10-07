import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {applyRally, rallyPlan, skippedNeutralVote} from '../../src/server/parliament/RallyNeutralDelegates';
import {skippedPopularSupport} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {
  NEUTRAL_DELEGATE_ICON, NEUTRAL_VOTE_LABEL, PARLIAMENT_MAX_POPULAR_SUPPORT, PARLIAMENT_NEUTRAL_DELEGATES, POPULAR_SUPPORT_LABEL, ReduxParty,
  SUPPORT_LIMIT_REASON, supportRoomOf,
} from '../../src/common/parliament/ParliamentTypes';
import {NeutralRallyModel} from '../../src/common/models/ActionPreviewModel';
import {quietResolutionOf, seatEnacted, seatResolution} from './parliamentArrange';

/*
 * THE SHARED STEP «ADD 1 NEUTRAL DELEGATE TO EACH <PARTY> RESOLUTION UP FOR
 * VOTING, AND TO EACH OF THEIR POPULAR SUPPORT AREAS» (Turmoil Redux TR31
 * Nationalist Movement): ONE PLAN, TWO READINGS. The pure plan is read before
 * the press and applied by the table's own writers — on every table below the
 * plan equals the deltas the application made, word for word, named zeros and
 * named skips included; the ledger invariant holds after each.
 */
const R = PartyName.REDS;
const M = PartyName.MARS;
const G = PartyName.GREENS;
const U = PartyName.UNITY;
const PARTIES: ReadonlyArray<ReduxParty> = [R, M];
const CARD = CardName.NATIONALIST_MOVEMENT;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

/** A two-seat Redux table: the Reds' quiet card in slot 0, Mars First's in slot 1, the Greens' in slot 2. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([R, M, G] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  return {game, p1, p2, parliament};
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

/** Plan, apply, and check that the application did EXACTLY what the plan said. */
function rally(t: Table): {plan: NeutralRallyModel, record: ReturnType<typeof applyRally>} {
  const {game, p1, parliament} = t;
  const before = {
    votes: Object.fromEntries(PARTIES.map((party) => [party, neutralVotes(parliament, party)])),
    support: Object.fromEntries(PARTIES.map((party) => [party, parliament.popularSupportOf(party)])),
    supply: parliament.neutralSupply(),
  };
  const plan = rallyPlan(parliament, PARTIES);
  const record = applyRally(p1, parliament, plan, {kind: 'card', card: CARD});
  parliament.assertLedger(game);
  // The plan's votes against the table's: each placed vote is one more neutral cube on that party's card.
  for (const party of PARTIES) {
    const placed = plan.votes.filter((v) => v.party === party && v.placed).length;
    expect(neutralVotes(parliament, party), `${party}: neutral votes`).eq(before.votes[party] + placed);
    const area = plan.support.find((s) => s.party === party)!;
    expect(area.current, `${party}: the area as it stood`).eq(before.support[party]);
    expect(parliament.popularSupportOf(party), `${party}: the area after`).eq(area.resulting);
  }
  expect(plan.supply.before).eq(before.supply);
  expect(parliament.neutralSupply(), 'the supply after').eq(plan.supply.after);
  expect(PARLIAMENT_NEUTRAL_DELEGATES - parliament.neutralSupply(), 'in use after').eq(plan.inUse.after);
  expect(plan.megacredits).eq(plan.inUse.after);
  // The record mirrors the plan.
  expect(record.votes.map((v) => v.party)).deep.eq(plan.votes.filter((v) => v.placed).map((v) => v.party));
  expect(record.votesCut.map((v) => v.party)).deep.eq(plan.votes.filter((v) => !v.placed).map((v) => v.party));
  expect(record.missing).deep.eq(plan.missing);
  expect(record.support.map((s) => [s.party, s.gained, s.limit])).deep.eq(plan.support.map((s) => [s.party, s.gained, s.limit]));
  expect(record.inUse).deep.eq(plan.inUse);
  expect(record.megacredits).eq(plan.megacredits);
  expect(parliament.lastRally).eq(record);
  return {plan, record};
}

describe('RallyNeutralDelegates — one plan, two readings', () => {
  describe('supportRoomOf — the one arithmetic, over bare numbers', () => {
    it('equals Parliament.popularSupportRoom on the whole grid (area × supply × n)', () => {
      for (let current = 0; current <= PARLIAMENT_MAX_POPULAR_SUPPORT; current++) {
        for (let supply = 0; supply <= 4; supply++) {
          for (let n = 0; n <= 2; n++) {
            const {parliament} = table();
            parliament.popularSupport.set(R, current); // the area's cubes are out of the supply already (it is derived)
            drainSupply(parliament, supply);
            expect(parliament.neutralSupply(), `supply ${supply}`).eq(supply);
            expect(supportRoomOf(current, supply, n), `current ${current}, supply ${supply}, n ${n}`).deep.eq(parliament.popularSupportRoom(R, n));
          }
        }
      }
    });
  });

  describe('the PLAN is pure', () => {
    it('reading it changes nothing: the same save, no event, no log line, the same winner', () => {
      const t = table();
      t.parliament.placeVote(t.p1, t.parliament.slots[2], 'lobby');
      const save = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      const log = t.game.gameLog.length;
      const winner = t.parliament.winner()?.instance;
      rallyPlan(t.parliament, PARTIES);
      expect(JSON.stringify(t.game.serialize())).eq(save);
      expect(t.game.events.events.length).eq(events);
      expect(t.game.gameLog.length).eq(log);
      expect(t.parliament.winner()?.instance).eq(winner);
      expect(t.parliament.lastRally).is.undefined;
    });
  });

  describe('the tables — the plan equals the application, word for word', () => {
    it('two resolutions, two empty areas, a full supply: 2 votes, 2 support, in use 0 → 4, 4 M€', () => {
      const t = table();
      const {plan} = rally(t);
      expect(plan.votes.map((v) => [v.party, v.placed, v.votesBefore, v.votesAfter])).deep.eq([[R, true, 0, 1], [M, true, 0, 1]]);
      expect(plan.missing).deep.eq([]);
      expect(plan.support.map((s) => [s.party, s.current, s.gained, s.resulting, s.limit])).deep.eq([[R, 0, 1, 1, undefined], [M, 0, 1, 1, undefined]]);
      expect(plan.inUse).deep.eq({before: 0, after: 4});
      expect(plan.megacredits).eq(4);
    });

    it('ONE resolution (Mars First\'s is not in the area): the Reds vote, Mars First is a NAMED ZERO, both areas pay', () => {
      const t = table();
      seatResolution(t.parliament, 1, quietResolutionOf(U));
      const {plan, record} = rally(t);
      expect(plan.votes.map((v) => v.party)).deep.eq([R]);
      expect(plan.missing).deep.eq([M]);
      expect(record.votesCut, 'a missing resolution is not a cut').deep.eq([]);
      expect(plan.support.map((s) => [s.party, s.gained])).deep.eq([[R, 1], [M, 1]]);
      expect(plan.inUse.after).eq(3);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped'), 'nothing was lost — no skip record').deep.eq([]);
    });

    it('NO resolution of either party: two named zeros, the areas alone pay, 2 M€', () => {
      const t = table();
      seatResolution(t.parliament, 0, quietResolutionOf(U));
      seatResolution(t.parliament, 1, quietResolutionOf(PartyName.INDUSTRIALISTS));
      const {plan} = rally(t);
      expect(plan.votes).deep.eq([]);
      expect(plan.missing).deep.eq([R, M]);
      expect(plan.inUse.after).eq(2);
      expect(plan.megacredits).eq(2);
    });

    it('the Reds RULE by an enacted card: their resolution is not up for a vote — a named zero; Mars First\'s votes; both areas pay', () => {
      const t = table();
      seatEnacted(t.parliament, quietResolutionOf(R));
      expect(t.parliament.rulingParty()).eq(R);
      expect(t.parliament.slotOf(R)).is.undefined;
      const {plan} = rally(t);
      expect(plan.votes.map((v) => v.party)).deep.eq([M]);
      expect(plan.missing).deep.eq([R]);
      expect(plan.support.map((s) => [s.party, s.gained])).deep.eq([[R, 1], [M, 1]]);
      expect(t.parliament.popularSupportOf(R), 'the ruler\'s area takes a stock like any other').eq(1);
    });

    it('a FULL area: the Reds\' area reads +0 · the area is full (a named skip), the vote still lands', () => {
      const t = table();
      t.parliament.popularSupport.set(R, PARLIAMENT_MAX_POPULAR_SUPPORT);
      const {plan} = rally(t);
      expect(plan.support[0]).deep.eq({party: R, current: 3, gained: 0, resulting: 3, printed: 1, limit: 'area'});
      expect(plan.votes.filter((v) => v.placed)).has.lengthOf(2);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped');
      expect(skipped).has.lengthOf(1);
      const lost = skippedPopularSupport(plan.support[0]);
      expect(skipped[0].impact.skipped).deep.include({label: POPULAR_SUPPORT_LABEL, reason: SUPPORT_LIMIT_REASON.area});
      expect(lost.reason).eq(SUPPORT_LIMIT_REASON.area);
      expect(plan.inUse.after).eq(3 + 2 + 1);
    });

    describe('the SUPPLY, judged in the printed order — resolution, resolution, area, area', () => {
      it('supply 3: both votes, the Reds\' area, Mars First\'s area reads +0 · no neutral delegates left', () => {
        const t = table();
        drainSupply(t.parliament, 3);
        const {plan} = rally(t);
        expect(plan.votes.map((v) => v.placed)).deep.eq([true, true]);
        expect(plan.support.map((s) => [s.party, s.gained, s.limit])).deep.eq([[R, 1, undefined], [M, 0, 'supply']]);
        expect(plan.supply).deep.eq({before: 3, after: 0});
        expect(plan.inUse.after).eq(PARLIAMENT_NEUTRAL_DELEGATES);
        expect(plan.megacredits).eq(PARLIAMENT_NEUTRAL_DELEGATES);
      });

      it('supply 2: both votes, both areas named zeros by the supply', () => {
        const t = table();
        drainSupply(t.parliament, 2);
        const {plan} = rally(t);
        expect(plan.votes.map((v) => v.placed)).deep.eq([true, true]);
        expect(plan.support.map((s) => [s.gained, s.limit])).deep.eq([[0, 'supply'], [0, 'supply']]);
        expect(plan.megacredits).eq(PARLIAMENT_NEUTRAL_DELEGATES);
      });

      it('supply 1: the Reds\' vote lands, Mars First\'s vote is CUT by the supply — a named skip of its own — and both areas read the supply', () => {
        const t = table();
        drainSupply(t.parliament, 1);
        const {plan, record} = rally(t);
        expect(plan.votes.map((v) => [v.party, v.placed, v.limit])).deep.eq([[R, true, undefined], [M, false, 'supply']]);
        expect(record.votesCut.map((v) => v.party)).deep.eq([M]);
        const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped');
        expect(skipped).has.lengthOf(3);
        expect(skipped[0].impact.skipped).deep.include({label: NEUTRAL_VOTE_LABEL, reason: SUPPORT_LIMIT_REASON.supply});
        expect(skippedNeutralVote().skipped.effect).deep.eq({direction: 'gain', icon: NEUTRAL_DELEGATE_ICON, amount: 1});
        expect(plan.megacredits).eq(PARLIAMENT_NEUTRAL_DELEGATES);
      });

      it('supply 0: nothing moves, every step is a named skip, 14 M€ (every neutral delegate is in use)', () => {
        const t = table();
        drainSupply(t.parliament, 0);
        const {plan} = rally(t);
        expect(plan.votes.map((v) => v.placed)).deep.eq([false, false]);
        expect(plan.support.map((s) => s.gained)).deep.eq([0, 0]);
        expect(plan.inUse).deep.eq({before: 14, after: 14});
        expect(t.game.events.events.filter((e) => e.type === 'effect-skipped')).has.lengthOf(4);
      });
    });

    describe('the WINNER, read on a copy — cube by cube', () => {
      it('the card becomes the winning one by MORE votes: 1 (a player\'s) + 1 neutral beats an empty card', () => {
        const t = table();
        t.parliament.placeVote(t.p1, t.parliament.slots[2], 'lobby'); // the Greens' card: 1 vote, the winner before
        expect(t.parliament.winner()?.instance).eq(t.parliament.slots[2].instance);
        t.parliament.placeVote(t.p2, t.parliament.slots[0], 'lobby'); // the Reds' card: 1 vote, tied → slot 0 wins
        expect(t.parliament.winner()?.instance).eq(t.parliament.slots[0].instance);
        const {plan, record} = rally(t);
        expect(plan.votes[0]).deep.include({party: R, winningBefore: true, winningAfter: true, votesBefore: 1, votesAfter: 2});
        expect(plan.votes[0].tieNote, 'won by more votes now, not by the slot').is.undefined;
        expect(plan.votes[1]).deep.include({party: M, winningBefore: false, winningAfter: false, votesBefore: 0, votesAfter: 1});
        expect(record.winnerBefore).eq(t.parliament.slots[0].instance);
        expect(record.votes.map((v) => v.winnerAfter)).deep.eq([t.parliament.slots[0].instance, t.parliament.slots[0].instance]);
      });

      it('a TIE goes to the slot closer to ENACTED: the Reds\' card (slot 0) reaches the Greens\' count and becomes the winning one with `slot-priority`', () => {
        const t = table();
        t.parliament.placeVote(t.p2, t.parliament.slots[2], 'lobby');
        t.parliament.placeVote(t.p2, t.parliament.slots[2], 'reserve'); // the Greens' card: 2 votes
        t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby'); // the Reds' card: 1
        expect(t.parliament.winner()?.instance).eq(t.parliament.slots[2].instance);
        const {plan, record} = rally(t);
        expect(plan.votes[0]).deep.include({party: R, winningBefore: false, winningAfter: true, tieNote: 'slot-priority', votesAfter: 2});
        expect(record.votes[0]).deep.include({winnerAfter: t.parliament.slots[0].instance, tieNote: 'slot-priority'});
        expect(t.parliament.winner()).deep.include({instance: t.parliament.slots[0].instance, tieBreak: 'slot-priority'});
      });

      it('the k-th verdict stands on the k−1 before it: Mars First\'s cube can only tie a card the Reds\' cube just lifted', () => {
        const t = table();
        t.parliament.placeVote(t.p2, t.parliament.slots[2], 'lobby'); // the Greens: 1
        t.parliament.placeVote(t.p1, t.parliament.slots[1], 'lobby'); // Mars First: 1 — slot 1 wins the tie before anything
        expect(t.parliament.winner()?.instance).eq(t.parliament.slots[1].instance);
        const {plan} = rally(t);
        // The Reds' cube: 0 → 1, three cards at 1 — slot 0 wins the tie now.
        expect(plan.votes[0]).deep.include({party: R, winningBefore: false, winningAfter: true, tieNote: 'slot-priority'});
        // Mars First's cube: 1 → 2 — more than anybody; it takes the win back, by votes.
        expect(plan.votes[1]).deep.include({party: M, winningBefore: false, winningAfter: true, votesAfter: 2});
        expect(plan.votes[1].tieNote).is.undefined;
      });

      it('the LEADER never moves: a player\'s single cube keeps the lead over a neutral one; a party\'s access is unchanged', () => {
        const t = table();
        t.parliament.placeVote(t.p2, t.parliament.slots[0], 'lobby');
        const before = t.parliament.access(t.p2, R);
        rally(t);
        const slot = t.parliament.slots[0];
        expect(t.parliament.leaderOf(slot)).deep.eq({owner: t.p2.id, votes: 1});
        expect(t.parliament.access(t.p2, R)).deep.eq(before);
        expect(t.parliament.access(t.p1, R).hasEffect).is.false;
      });
    });
  });

  describe('what the application WRITES', () => {
    it('a journal line and a typed `neutral-delegates-placed` fact per vote (the dark figure), the support through TR03\'s one payout, the record once', () => {
      const t = table();
      const at = t.game.gameLog.length;
      const {record} = rally(t);
      const lines = t.game.gameLog.slice(at).map((entry) => entry.message);
      expect(lines.filter((m) => m === '${0} adds 1 neutral delegate to ${1}')).has.lengthOf(2);
      expect(lines.filter((m) => m === '${0} gain ${1} neutral delegate(s) in Popular Support (${2}/${3})')).has.lengthOf(2);
      const placed = t.game.events.events.filter((e) => e.type === 'neutral-delegates-placed');
      expect(placed.map((e) => e.impact.delegates)).deep.eq([
        {count: 1, resolution: quietResolutionOf(R), neutral: true},
        {count: 1, resolution: quietResolutionOf(M), neutral: true},
      ]);
      expect(placed.every((e) => e.player === t.p1.color && e.visibility === 'journal')).is.true;
      const support = t.game.events.events.filter((e) => e.type === 'popular-support-gained');
      expect(support.map((e) => e.impact.popularSupport)).deep.eq([{party: R, gained: 1, total: 1}, {party: M, gained: 1, total: 1}]);
      expect(record.seq).to.be.greaterThan(0);
      expect(record.player).eq(t.p1.id);
      expect(record.card).eq(CARD);
      expect(record.generation).eq(t.game.generation);
    });

    it('the record\'s `counted` is the FULL list the recount marks: every neutral vote by slot in the table\'s order, every area with a stock', () => {
      const t = table();
      t.parliament.popularSupport.set(U, 2);
      t.parliament.slots[2].votes.push({owner: 'NEUTRAL', seq: ++t.parliament.voteSeq});
      const {record} = rally(t);
      const p = t.parliament;
      expect(record.counted.votes).deep.eq([
        {instance: p.slots[0].instance, seqs: [record.votes[0].seq]},
        {instance: p.slots[1].instance, seqs: [record.votes[1].seq]},
        {instance: p.slots[2].instance, seqs: [p.slots[2].votes[0].seq]},
      ]);
      expect(record.counted.support).has.deep.members([{party: M, count: 1}, {party: R, count: 1}, {party: U, count: 2}]);
      expect(record.counted.support).has.lengthOf(3);
      const total = record.counted.votes.reduce((n, e) => n + e.seqs.length, 0) + record.counted.support.reduce((n, e) => n + e.count, 0);
      expect(total, 'the list IS the number').eq(record.inUse.after);
      expect(record.inUse).deep.eq({before: 3, after: 7});
    });

    it('two rallies in a row: the serial GROWS (the client plays each once)', () => {
      const t = table();
      const first = rally(t).record.seq;
      const second = rally(t).record.seq;
      expect(second).to.be.greaterThan(first);
    });

    it('the record reaches the model as `lastRally` with the seat as a colour — and is NOT serialized (a presentation ring)', () => {
      const t = table();
      const {record} = rally(t);
      const model = getParliamentModel(t.game, t.p1)!;
      expect(model.lastRally).deep.eq({...record, player: t.p1.color});
      expect(JSON.stringify(t.parliament.serialize())).not.includes('lastRally');
      const reloaded = Parliament.deserialize(t.parliament.serialize(), {expansions: t.game.gameOptions.expansions, rng: t.game.rng});
      expect(reloaded.lastRally).is.undefined;
      expect(reloaded.neutralSupply(), 'the table itself is the ledger').eq(t.parliament.neutralSupply());
    });
  });
});
