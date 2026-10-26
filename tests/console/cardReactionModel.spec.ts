import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {CardReactionRecord} from '../../src/common/models/CardReactionModel';
import {
  REACTION_CHAIN_CEILING_MS, REACTION_MANY_PACE, freshCardReactions, groupCardReactions, planReactionChain, reactionGroupOf,
  reactionImpactSpec, reactionRowsOf, reactionSeatRect, reactionTempo, reactionTokensOf, reducedReactionTempo,
} from '../../src/client/console/cardReaction/cardReactionModel';
import {intakeAssemblyTimings, reducedIntakeAssemblyTimings} from '../../src/client/console/cardIntake/intakeAssemblyPlan';

/**
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the pure half: the server's records
 * become groups in the order they fired; a group's impacts split by where the
 * scene can show them; the chain's tempo is a plan with a ceiling and two
 * seats; the seat beside the receiver never covers what the player is reading.
 */
const BLUE = 'blue';
const RED = 'red';

function record(seq: number, over: Partial<CardReactionRecord> = {}): CardReactionRecord {
  return {
    seq, root: {}, owner: BLUE, kind: 'corporation', card: CardName.HARTLAN_HEATING, channel: 'card-played',
    impacts: [{kind: 'stock', resource: Resource.HEAT, amount: 6, to: BLUE}, {kind: 'production', resource: Resource.MEGACREDITS, amount: 1, to: BLUE}],
    ...over,
  };
}

describe('cardReactionModel — the record → the group → the chain → the seat', () => {
  describe('freshCardReactions — the ring consumed once by seq', () => {
    it('nothing on the first view of a seat, nothing known, the rest in order', () => {
      const a = record(100);
      const b = record(101);
      expect(freshCardReactions(undefined, [a], false)).deep.eq([]);
      expect(freshCardReactions([a], [a, b], true)).deep.eq([b]);
      expect(freshCardReactions([], [b, a], true).map((r) => r.seq)).deep.eq([100, 101]);
      expect(freshCardReactions([a, b], [a, b], true)).deep.eq([]);
    });

    it('a record with no impact (a hook that only logged) is no reaction', () => {
      expect(freshCardReactions([], [record(5, {impacts: []})], true)).deep.eq([]);
    });
  });

  describe('the group — where each impact can be shown', () => {
    it('Hartlan: 6 heat on the stock row, 1 M€ production on its plate — both the viewer\'s rail', () => {
      const group = reactionGroupOf(record(1), BLUE);
      expect(group.own).is.true;
      expect(group.card).eq(CardName.HARTLAN_HEATING);
      expect(group.rail).deep.eq([
        {channel: 'stock', resource: 'heat', amount: 6},
        {channel: 'production', resource: 'megacredits', amount: 1},
      ]);
      expect(group.cards).deep.eq([]);
      expect(group.elsewhere).deep.eq([]);
      expect(reactionRowsOf(group)).deep.eq(['stock:heat', 'production:megacredits']);
    });

    it('a rival\'s record is not the viewer\'s own, and a gain addressed to the rival is elsewhere', () => {
      const group = reactionGroupOf(record(1, {owner: RED, impacts: [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2, to: RED}]}), BLUE);
      expect(group.own).is.false;
      expect(group.rail).deep.eq([]);
      expect(group.elsewhere).to.have.lengthOf(1);
    });

    it('a draw and a scale step are other scenes\' — named elsewhere; a card resource onto an own card is the holder\'s', () => {
      const group = reactionGroupOf(record(1, {impacts: [
        {kind: 'draw', amount: 1, to: BLUE},
        {kind: 'global', parameter: 'temperature' as never, amount: 1, to: BLUE},
        {kind: 'card-resource', resource: 'Microbe' as never, amount: 1, target: CardName.DECOMPOSERS, to: BLUE},
        {kind: 'tr', amount: 1, to: BLUE},
      ]}), BLUE);
      expect(group.elsewhere.map((i) => i.kind)).deep.eq(['draw', 'global']);
      expect(group.cards).deep.eq([{channel: 'card-resource', resource: 'microbe', amount: 1, targetCard: CardName.DECOMPOSERS}]);
      expect(group.rail).deep.eq([{channel: 'stock', resource: 'rating', amount: 1}]);
    });

    it('a loss keeps its direction (a reaction that took something)', () => {
      expect(reactionImpactSpec({kind: 'stock', resource: Resource.PLANTS, amount: -2, to: BLUE})).deep.eq({channel: 'stock', resource: 'plants', amount: 2, direction: 'loss'});
    });

    it('groups keep the order the effects fired in', () => {
      const groups = groupCardReactions([record(3, {card: CardName.THARSIS_REPUBLIC}), record(2)], BLUE);
      expect(groups.map((g) => g.card)).deep.eq([CardName.HARTLAN_HEATING, CardName.THARSIS_REPUBLIC]);
    });
  });

  describe('the tokens — a wave, never a burst', () => {
    it('6 heat is six tokens of one; 10 M€ is six tokens summing to ten; a production step and a rating are one', () => {
      expect(reactionTokensOf({channel: 'stock', resource: 'heat', amount: 6}).map((t) => t.amount)).deep.eq([1, 1, 1, 1, 1, 1]);
      const ten = reactionTokensOf({channel: 'stock', resource: 'megacredits', amount: 10});
      expect(ten).to.have.lengthOf(6);
      expect(ten.reduce((s, t) => s + t.amount, 0)).eq(10);
      expect(reactionTokensOf({channel: 'production', resource: 'megacredits', amount: 3})).to.have.lengthOf(1);
      expect(reactionTokensOf({channel: 'stock', resource: 'rating', amount: 2})).to.have.lengthOf(1);
    });
  });

  describe('the tempo — the assembly scene\'s numbers, byte for byte (ONE rise primitive)', () => {
    it('rise / hold / recede / overlap equal the assembly trigger\'s surface / hold / recede / overlap', () => {
      const t = reactionTempo();
      const a = intakeAssemblyTimings();
      expect([t.riseMs, t.holdMs, t.recedeMs, t.overlapMs]).deep.eq([a.surfaceMs, a.holdMs, a.recedeMs, a.overlapMs]);
      const r = reducedReactionTempo();
      const ra = reducedIntakeAssemblyTimings();
      expect([r.riseMs, r.holdMs, r.recedeMs, r.overlapMs]).deep.eq([ra.surfaceMs, ra.holdMs, ra.recedeMs, ra.overlapMs]);
      expect(r.staggerMs).eq(0);
    });
  });

  describe('planReactionChain — groups in order, overlapping, under a ceiling', () => {
    const t = reactionTempo();
    const flight = {popMs: 150, arcMs: 470};

    it('one group: rise → hold → birth → the last landing → recede; the wall is under the ceiling', () => {
      const plan = planReactionChain([{tokens: 7}], t, flight);
      expect(plan.steps).to.have.lengthOf(1);
      expect(plan.pace).eq(1);
      expect(plan.seats).eq(1);
      const [s] = plan.steps;
      expect(s.riseAtMs).eq(0);
      expect(s.birthAtMs).eq(t.riseMs + t.holdMs);
      expect(s.landedAtMs).eq(s.birthAtMs + flight.popMs + flight.arcMs + t.staggerMs * 6);
      expect(s.recededAtMs).eq(s.landedAtMs + t.recedeMs);
      expect(plan.totalMs).to.be.lessThan(REACTION_CHAIN_CEILING_MS);
    });

    it('two groups: the second rises overlapMs before the first\'s last landing, on the SECOND seat (two faces never share a box)', () => {
      const plan = planReactionChain([{tokens: 1}, {tokens: 1}], t, flight);
      expect(plan.steps[1].riseAtMs).eq(plan.steps[0].landedAtMs - t.overlapMs);
      expect(plan.seats).eq(2);
      expect(plan.pace, 'two groups do not quicken').eq(1);
      expect(plan.steps.map((s) => s.seat)).deep.eq([0, 1]);
    });

    it('a third group waits for its seat (the first\'s) to be free — never two faces in one box', () => {
      const plan = planReactionChain([{tokens: 1}, {tokens: 1}, {tokens: 1}], t, flight);
      expect(plan.steps[2].riseAtMs).to.be.at.least(plan.steps[0].recededAtMs);
    });

    it('MANY groups (≥ 3): the chain quickens and alternates two seats', () => {
      const plan = planReactionChain([{tokens: 1}, {tokens: 1}, {tokens: 1}], t, flight);
      expect(plan.pace).eq(REACTION_MANY_PACE);
      expect(plan.seats).eq(2);
      expect(plan.steps.map((s) => s.seat)).deep.eq([0, 1, 0]);
      expect(plan.steps[0].birthAtMs).eq(Math.round((t.riseMs + t.holdMs) / REACTION_MANY_PACE));
    });

    it('a group whose rise would start past the ceiling is summarized — the counters tick, the name is kept', () => {
      const plan = planReactionChain(Array.from({length: 8}, () => ({tokens: 6})), t, flight, 1800);
      expect(plan.summarized.length).to.be.greaterThan(0);
      expect(plan.steps.length + plan.summarized.length).eq(8);
      expect(plan.steps.every((s) => s.riseAtMs < 1800)).is.true;
      expect(plan.summarized).deep.eq(plan.summarized.slice().sort((a, b) => a - b));
    });

    it('no groups: an empty plan', () => {
      const plan = planReactionChain([], t, flight);
      expect(plan.steps).deep.eq([]);
      expect(plan.totalMs).eq(0);
    });
  });

  describe('reactionSeatRect — beside the receiver, never over what is read', () => {
    const stage = {left: 0, top: 0, width: 3840, height: 2160};
    const rail = {left: 0, top: 900, width: 320, height: 60};

    it('stands right of the rail, centred on the receiving row, card-shaped at the asked height', () => {
      const seat = reactionSeatRect(stage, rail, [], 300);
      expect(seat.left).to.be.greaterThan(rail.left + rail.width);
      expect(seat.height).eq(300);
      expect(seat.width).to.be.closeTo(300 / (460 / 320), 0.01);
      expect(seat.top + seat.height / 2).to.be.closeTo(rail.top + rail.height / 2, 0.01);
    });

    it('slides past a surface it would cover (the hero, the composer\'s focus) — down first, then up', () => {
      const hero = {left: 300, top: 700, width: 600, height: 500};
      const seat = reactionSeatRect(stage, rail, [hero], 300);
      expect(seat.top).to.be.at.least(hero.top + hero.height);
      const below = {left: 300, top: 700, width: 600, height: 1400};
      const up = reactionSeatRect(stage, rail, [below], 300);
      expect(up.top + up.height).to.be.at.most(below.top);
    });

    it('the second seat stands below the first', () => {
      const first = reactionSeatRect(stage, rail, [], 300, 0);
      const second = reactionSeatRect(stage, rail, [], 300, 1);
      expect(second.top).to.be.greaterThan(first.top + first.height);
      expect(second.left).eq(first.left);
    });

    it('with no clear place the top-right corner takes it, at a reduced size', () => {
      const wall = {left: 0, top: 0, width: 3840, height: 2160};
      const seat = reactionSeatRect(stage, rail, [wall], 300);
      expect(seat.left + seat.width).to.be.at.most(stage.width);
      expect(seat.top).to.be.at.most(stage.top + 100);
      expect(seat.height).to.be.at.most(300);
    });
  });
});
