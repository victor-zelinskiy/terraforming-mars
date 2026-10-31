import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {CardReactionRecord} from '../../src/common/models/CardReactionModel';
import {
  CALM_REACTION_TEMPO, REACTION_CHAIN_CEILING_MANY_MS, REACTION_CHAIN_CEILING_MS, REACTION_HURRY_PACE, REACTION_MANY_GROUPS, REACTION_MANY_PACE,
  REACTION_RIVAL_SCALE, REACTION_STAGE_MAX_SLOTS, REACTION_STAGE_SHARE, REACTOR_ASPECT, chainCeilingFor, freshCardReactions, groupCardReactions,
  planReactionChain, reactionAnswerGroups, reactionGroupOf, reactionRisers, reactionImpactSpec, reactionRowsOf, reactionStageHeight, reactionStageSlots, reactionTempo, reactionTokensOf,
  reducedReactionTempo,
} from '../../src/client/console/cardReaction/cardReactionModel';
import {intakeAssemblyTimings, reducedIntakeAssemblyTimings} from '../../src/client/console/cardIntake/intakeAssemblyPlan';

/**
 * «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the pure half: the server's records
 * become groups in the order they fired; a group's impacts split by where the
 * scene can show them; the chain's tempo is CALM for one or two groups and
 * QUICK from three, a plan with a ceiling over a row of slots; the ONE stage is
 * the centre of the central opening (iteration 3, the owner's 2026-10-27).
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

    it('ONE PLAY, ONE RISE (TR81): two records of one card under one root are ONE group — the first record, every impact in order', () => {
      const data = (amount: number) => ({kind: 'card-resource', resource: 'Data' as never, amount, target: CardName.LOTUS_INNOVATIONS, to: BLUE} as const);
      const lotus = (seq: number, amount: number, actionId: number | undefined) =>
        record(seq, {card: CardName.LOTUS_INNOVATIONS, channel: 'tr-increase', root: actionId === undefined ? {} : {actionId}, impacts: [data(amount)]});
      // Nitrogen-Rich Asteroid: the degree (one rating call), then the printed +2 TR (another) — one press, one root.
      const groups = groupCardReactions([lotus(11, 2, 7), record(10, {root: {actionId: 7}}), lotus(9, 1, 7)], BLUE);
      expect(groups.map((g) => g.card)).deep.eq([CardName.LOTUS_INNOVATIONS, CardName.HARTLAN_HEATING]);
      expect(groups[0].record.seq, 'the group stands where its FIRST record fired').eq(9);
      expect(groups[0].cards.map((s) => s.amount)).deep.eq([1, 2]);
      // Another root is another press; a record with no root never merges (nothing says it is the same press).
      expect(groupCardReactions([lotus(1, 1, 7), lotus(2, 1, 8)], BLUE)).to.have.lengthOf(2);
      expect(groupCardReactions([lotus(1, 1, undefined), lotus(2, 1, undefined)], BLUE)).to.have.lengthOf(2);
      // …and the ring's own records are never mutated by the merge.
      const ring = [lotus(1, 1, 7), lotus(2, 2, 7)];
      groupCardReactions(ring, BLUE);
      expect(ring.map((r) => r.impacts.length)).deep.eq([1, 1]);
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

    it('a card resource laid on a card is counted too (TR81: «+2 [data]» is two tokens off the printed data); a loss stays one', () => {
      const two = reactionTokensOf({channel: 'card-resource', resource: 'data', amount: 2, targetCard: CardName.LOTUS_INNOVATIONS});
      expect(two.map((t) => [t.amount, t.targetCard])).deep.eq([[1, CardName.LOTUS_INNOVATIONS], [1, CardName.LOTUS_INNOVATIONS]]);
      expect(reactionTokensOf({channel: 'card-resource', resource: 'data', amount: 9})).to.have.lengthOf(6);
      expect(reactionTokensOf({channel: 'card-resource', resource: 'microbe', amount: 2, direction: 'loss'})).to.have.lengthOf(1);
    });
  });

  describe('the tempo — two classes (the owner, 2026-10-27): calm for one or two reactors, the assembly scene\'s numbers from three', () => {
    it('QUICK (≥ 3 groups): rise / hold / recede / overlap equal the assembly trigger\'s surface / hold / recede / overlap', () => {
      const t = reactionTempo(REACTION_MANY_GROUPS);
      const a = intakeAssemblyTimings();
      expect([t.riseMs, t.holdMs, t.recedeMs, t.overlapMs]).deep.eq([a.surfaceMs, a.holdMs, a.recedeMs, a.overlapMs]);
      expect(t.settleMs, 'a quick chain does not settle').eq(0);
      const r = reducedReactionTempo();
      const ra = reducedIntakeAssemblyTimings();
      expect([r.riseMs, r.holdMs, r.recedeMs, r.overlapMs]).deep.eq([ra.surfaceMs, ra.holdMs, ra.recedeMs, ra.overlapMs]);
      expect(r.staggerMs).eq(0);
    });

    it('CALM (1–2 groups): a longer lift, a READ beat, a settle after the last landing — ≈ 2.2 s a card; the default is calm', () => {
      const calm = reactionTempo(1);
      expect(calm).deep.eq({...CALM_REACTION_TEMPO});
      expect(reactionTempo(2)).deep.eq(calm);
      expect(reactionTempo()).deep.eq(calm);
      const quick = reactionTempo(3);
      expect(calm.riseMs).to.be.greaterThan(quick.riseMs);
      expect(calm.holdMs).to.be.greaterThan(quick.holdMs * 2);
      expect(calm.settleMs).to.be.greaterThan(0);
      expect(calm.recedeMs).to.be.greaterThan(quick.recedeMs);
      // One reactor with six tokens: rise + read + the wave + settle + recede — between 2 and 2.6 s.
      const one = calm.riseMs + calm.holdMs + 150 + 470 + calm.staggerMs * 5 + calm.settleMs + calm.recedeMs;
      expect(one).to.be.within(2000, 2600);
    });

    it('a hurry is a pace, never a cut — above 2, under 3', () => {
      expect(REACTION_HURRY_PACE).to.be.within(2, 3);
    });
  });

  describe('planReactionChain — groups in order, overlapping, under a ceiling', () => {
    const t = reactionTempo(REACTION_MANY_GROUPS);
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

    it('the stage offers a ROW of slots (iteration 3): three slots take three groups side by side, the fourth waits for the first', () => {
      const plan = planReactionChain([{tokens: 1}, {tokens: 1}, {tokens: 1}, {tokens: 1}], t, flight, {slots: 3});
      expect(plan.seats).eq(3);
      expect(plan.steps.map((s) => s.seat)).deep.eq([0, 1, 2, 0]);
      expect(plan.steps[3].riseAtMs).to.be.at.least(plan.steps[0].recededAtMs);
      expect(planReactionChain([{tokens: 1}, {tokens: 1}], t, flight, {slots: 3}).seats, 'never more slots than groups').eq(2);
      expect(planReactionChain([{tokens: 1}, {tokens: 1}, {tokens: 1}], t, flight, {slots: 1}).seats, 'a one-slot stage plays in turn').eq(1);
    });

    it('a calm plan (two groups): the settle is part of the slot\'s occupancy', () => {
      const calm = reactionTempo(2);
      const plan = planReactionChain([{tokens: 1}, {tokens: 1}], calm, flight);
      expect(plan.pace).eq(1);
      const [a] = plan.steps;
      expect(a.recededAtMs).eq(a.landedAtMs + calm.settleMs + calm.recedeMs);
      expect(plan.summarized).deep.eq([]);
    });

    it('a group whose rise would start past the ceiling is summarized — the counters tick, the name is kept', () => {
      const plan = planReactionChain(Array.from({length: 8}, () => ({tokens: 6})), t, flight, 1800);
      expect(plan.summarized.length).to.be.greaterThan(0);
      expect(plan.steps.length + plan.summarized.length).eq(8);
      expect(plan.steps.every((s) => s.riseAtMs < 1800)).is.true;
      expect(plan.summarized).deep.eq(plan.summarized.slice().sort((a, b) => a - b));
    });

    it('FOUR groups widen the ceiling to 2.4 s (the owner, PL-1059): the fourth — the forecast-promised Hartlan after the city\'s three — RISES; three groups keep 1.8 s', () => {
      expect(chainCeilingFor(3)).eq(REACTION_CHAIN_CEILING_MS);
      expect(chainCeilingFor(4)).eq(REACTION_CHAIN_CEILING_MANY_MS);
      const four = planReactionChain([{tokens: 4}, {tokens: 2}, {tokens: 1}, {tokens: 7}], t, flight);
      expect(four.summarized, 'nothing summarized — every rise starts under 2.4 s').deep.eq([]);
      expect(four.steps).to.have.lengthOf(4);
      expect(four.steps[3].riseAtMs).to.be.greaterThan(REACTION_CHAIN_CEILING_MS);
      expect(four.steps[3].riseAtMs).to.be.lessThan(REACTION_CHAIN_CEILING_MANY_MS);
      const three = planReactionChain([{tokens: 4}, {tokens: 2}, {tokens: 7}], t, flight);
      expect(three.steps.every((s) => s.riseAtMs < REACTION_CHAIN_CEILING_MS)).is.true;
    });

    it('no groups: an empty plan', () => {
      const plan = planReactionChain([], t, flight);
      expect(plan.steps).deep.eq([]);
      expect(plan.totalMs).eq(0);
    });
  });

  describe('reactionStageSlots — THE ONE STAGE: the rail\'s edge (the owner, 2026-10-27, iteration 5)', () => {
    const tv = {left: 360, top: 120, width: 3000, height: 1900}; // a 4K opening between the hull members
    const fhd = {left: 180, top: 60, width: 1500, height: 950};
    const deck = {left: 120, top: 44, width: 1000, height: 640};
    const pad = Math.max(8, tv.width * 0.012);

    it('one reactor stands at the opening\'s LEFT EDGE (the rail\'s), a protagonist\'s share of its height, card-shaped; the vertical centre is the opening\'s with no line given', () => {
      const [slot] = reactionStageSlots(tv, 1, {uiScale: 2});
      expect(slot.height).eq(Math.round(tv.height * REACTION_STAGE_SHARE));
      expect(slot.width).eq(Math.round(slot.height / REACTOR_ASPECT));
      expect(slot.left).to.be.closeTo(tv.left + pad, 1);
      expect(slot.top + slot.height / 2).to.be.closeTo(tv.top + tv.height / 2, 1);
      expect(reactionStageSlots(tv, 1, {uiScale: 2})).to.have.lengthOf(1);
    });

    it('the ANCHOR the director measures: the row starts at the free canvas\'s edge (past a hero column) and stands on the rail\'s line — clamped inside the opening', () => {
      const [slot] = reactionStageSlots(tv, 1, {uiScale: 2, anchor: {left: 900, centreY: 700}});
      expect(slot.left).eq(900);
      expect(slot.top + slot.height / 2).to.be.closeTo(700, 1);
      // A line too close to the top: the slot stays inside the opening.
      const [high] = reactionStageSlots(tv, 1, {uiScale: 2, anchor: {centreY: 0}});
      expect(high.top).to.be.at.least(tv.top);
      // An edge past the opening's right: the slot stays inside too.
      const [far] = reactionStageSlots(tv, 1, {uiScale: 2, anchor: {left: 10_000}});
      expect(far.left + far.width).to.be.at.most(tv.left + tv.width);
      // An edge LEFT of the opening never pulls the stage over the rail.
      const [over] = reactionStageSlots(tv, 1, {uiScale: 2, anchor: {left: 0}});
      expect(over.left).to.be.closeTo(tv.left + pad, 1);
    });

    it('the height is a share of the opening on every profile, capped at the natural frame × the UI scale', () => {
      expect(reactionStageHeight(fhd, {uiScale: 1})).eq(Math.round(fhd.height * REACTION_STAGE_SHARE));
      expect(reactionStageHeight(deck, {uiScale: 0.72})).eq(Math.round(deck.height * REACTION_STAGE_SHARE));
      // A very tall opening at a small UI scale: the natural frame caps it (a card never prints larger than its art).
      expect(reactionStageHeight({left: 0, top: 0, width: 4000, height: 4000}, {uiScale: 1})).eq(460);
      // A rival stands a step smaller.
      expect(reactionStageHeight(fhd, {uiScale: 1, scale: REACTION_RIVAL_SCALE})).eq(Math.round(fhd.height * REACTION_STAGE_SHARE * REACTION_RIVAL_SCALE));
    });

    it('several reactors are ONE ROW growing RIGHTWARDS from the edge, left to right, never overlapping, never more than the cap; the fit counts from the edge', () => {
      const three = reactionStageSlots(tv, 3, {uiScale: 2});
      expect(three).to.have.lengthOf(3);
      expect(three.every((s) => s.height === three[0].height && s.width === three[0].width)).is.true;
      expect(three[0].left).to.be.closeTo(tv.left + pad, 1);
      expect(three[1].left).to.be.greaterThan(three[0].left + three[0].width);
      expect(three[2].left).to.be.greaterThan(three[1].left + three[1].width);
      // An edge far to the right (a wide hero column) leaves room for fewer slots — the row never leaves the opening.
      const cramped = reactionStageSlots(tv, 3, {uiScale: 2, anchor: {left: tv.left + tv.width * 0.8}});
      expect(cramped.length).to.be.lessThan(3);
      expect(cramped[cramped.length - 1].left + cramped[cramped.length - 1].width).to.be.at.most(tv.left + tv.width);
      expect(reactionStageSlots(tv, 7, {uiScale: 2})).to.have.lengthOf(REACTION_STAGE_MAX_SLOTS);
      expect(reactionStageSlots(tv, 2, {uiScale: 2, maxSlots: 2})).to.have.lengthOf(2);
      expect(reactionStageSlots(tv, 5, {uiScale: 2, maxSlots: 2}), 'a handheld\'s cap').to.have.lengthOf(2);
    });

    it('a narrow opening holds fewer slots — the row never leaves the opening', () => {
      const narrow = {left: 0, top: 0, width: 600, height: 900};
      const slots = reactionStageSlots(narrow, 3, {uiScale: 1});
      expect(slots.length).to.be.lessThan(3);
      for (const s of slots) {
        expect(s.left).to.be.at.least(narrow.left);
        expect(s.left + s.width).to.be.at.most(narrow.left + narrow.width);
      }
    });
  });
  // ── P82 · «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА» — § risers: ONE question «who rises now, and how» ──
  describe('reactionAnswerGroups / reactionRisers — who rises in THIS answer, and how', () => {
    const c = (seq: number, block: number, rows: Array<string>, over: {claimed?: boolean, reserved?: string} = {}) =>
      ({seq, block, rows, claimed: over.claimed ?? false, reserved: over.reserved});

    it('H1 · two groups on ONE row from TWO answers: a host asking with its block takes its own; with neither block nor rows, the newest answer only', () => {
      const stale = c(4, 1, ['stock:megacredits']);
      const fresh = c(5, 2, ['stock:megacredits']);
      expect(reactionAnswerGroups([stale, fresh], {block: 2}).map((g) => g.seq)).deep.eq([5]);
      expect(reactionAnswerGroups([stale, fresh], {}).map((g) => g.seq), 'never every group on record').deep.eq([5]);
      expect(reactionAnswerGroups([stale, fresh], {block: 1}).map((g) => g.seq), 'the earlier host still gets ITS own').deep.eq([4]);
    });

    it('a row ask stays a row ask; a claimed group is nobody\'s; a RESERVED group is only its host\'s (H4 — a host that tells it itself)', () => {
      const groups = [c(1, 3, ['stock:heat']), c(2, 3, ['stock:megacredits'], {claimed: true}), c(3, 3, ['stock:heat'], {reserved: 'stage'})];
      expect(reactionAnswerGroups(groups, {rows: ['stock:heat']}).map((g) => g.seq)).deep.eq([1]);
      expect(reactionAnswerGroups(groups, {rows: ['stock:megacredits']})).deep.eq([]);
      expect(reactionAnswerGroups(groups, {reserved: 'stage'}).map((g) => g.seq)).deep.eq([3]);
    });

    it('an empty answer raises nothing', () => {
      expect(reactionAnswerGroups([], {block: 1})).deep.eq([]);
      expect(reactionRisers([], 3)).deep.eq([]);
    });

    it('H6/H7 · a group standing on screen lifts IN ITS PLACE and takes no slot; the others take their OWN slots in order; past the last slot a group rises nowhere — never two faces in one box', () => {
      expect(reactionRisers([{placed: true}, {placed: false}, {placed: false}], 3)).deep.eq([{via: 'place'}, {via: 'stage', slot: 0}, {via: 'stage', slot: 1}]);
      expect(reactionRisers([{placed: false}, {placed: false}, {placed: false}, {placed: false}], 3).map((r) => r.via === 'stage' ? r.slot : r.via))
        .deep.eq([0, 1, 2, 'none']);
      expect(reactionRisers([{placed: false}, {placed: false}, {placed: false}], 2).map((r) => r.via === 'stage' ? r.slot : r.via), 'the handheld\'s two')
        .deep.eq([0, 1, 'none']);
    });
  });
});
