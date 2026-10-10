import {expect} from 'chai';
import {GREEN_ALLEGIANCE_OVER, GREEN_ALLEGIANCE_STEP, GreenAllegiance, greenAllegianceSteps} from '../../../src/server/cards/turmoilRedux/GreenAllegiance';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Teractor} from '../../../src/server/cards/corporation/Teractor';
import {PointLuna} from '../../../src/server/cards/prelude/PointLuna';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {AGENDA_SETS_NOTE, AGENDA_TRACK_ICON, INFLUENCE_ICON} from '../../../src/server/cards/actionPreviews';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {PARLIAMENT_AGENDA_STEPS} from '../../../src/common/parliament/ParliamentTypes';
import {countMetricToward, thresholdBreakdown, thresholdSets} from '../../../src/common/parliament/resolutionCounts';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {AgendaWalkModel} from '../../../src/common/models/ActionPreviewModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {questGateOf, quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';
import {cardsToModel} from '../../../src/server/models/ModelUtils';
import {RedLawyers} from '../../../src/server/cards/turmoilRedux/RedLawyers';

/**
 * TR42 — GREEN ALLEGIANCE: the walk of TR04 / TR37 with its length COUNTED —
 * «1 step for every complete set of 5 TR over 20», the threshold count of RX13
 * Generous Funding over another threshold. The walk itself is the ONE walk
 * (tests/parliament/AgendaWalk.spec.ts); the division is the family's one
 * function (tests/parliament/GenerousFunding.spec.ts pins RX13's table). Every
 * rule reading of the card file's header is pinned here on the real card, and
 * the preview's promise — the steps AND why they are this many — is held to
 * the play's result.
 */
const G = PartyName.GREENS;
const COST = 2;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: GreenAllegiance};

/**
 * A two-seat Redux table in the action phase, generation 1: the Greens rule
 * by the STARTING RULE (the plate is open), p1's marker on `position`, their
 * rating at `tr`, the card in hand, 20 M€.
 */
function table(tr: number, position = 1): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parliament.agenda.set(p1.id, position);
  p1.setTerraformRating(tr);
  const card = new GreenAllegiance();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

/** The Reds rule by an enacted card — the Greens' plate is open only by delegates. */
function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

/** `n` of `player`'s own cubes on the Greens' quiet resolution in slot 0. */
function greensCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(G);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(G));
    slot = t.parliament.slotOf(G)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

const ADVANCE = '${0} advances on the Agenda track to step ${1}';
const TR_LINE = '${0} gained ${1} ${2} from the Agenda track';
const END_LINE = '${0} is already at the end of the Agenda track';
const SETS_LINE = '${0} has ${1} complete set(s) of 5 TR over 20 (TR ${2}) — ${3} Agenda step(s)';
const ZERO_LINE = '${0} has no complete set of 5 TR over 20 (TR ${1}) — the Agenda marker stays';
const LINES: ReadonlyArray<string> = [SETS_LINE, ZERO_LINE, ADVANCE, TR_LINE, END_LINE];

/** The card's and the walk's own journal lines, in order. */
function linesOf(game: IGame, from: number): Array<string> {
  return game.gameLog.slice(from).map((entry) => entry.message).filter((message) => LINES.includes(message));
}

function play(t: Table, megacredits = COST): void {
  t.p1.playCard(t.card, Payment.of({megacredits}));
  runAllActions(t.game);
}

function walkOf(t: Table): AgendaWalkModel {
  const preview = cardPlayPreview(t.p1, t.card);
  const step = preview.branches[0].steps.find((s) => s.kind === 'agendaWalk');
  expect(step, 'the walk is a step of the preview').is.not.undefined;
  return (step as {kind: 'agendaWalk', walk: AgendaWalkModel}).walk;
}

describe('GreenAllegiance', () => {
  describe('the card as printed', () => {
    it('is a green card for 2, an Earth tag, no VP, the Greens\' plate, TR42 — and prints «[★] / [TR 5]» over «OVER 20»', () => {
      const card = new GreenAllegiance();
      expect(card.name).eq(CardName.GREEN_ALLEGIANCE);
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.EARTH]);
      expect(card.victoryPoints).is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem — a requirement, not a tag').eq(G);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR42');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.GREEN_ALLEGIANCE];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect(card.metadata.description).eq('Requires the Greens to be ruling or that you have 2 delegates there. Advance your Agenda marker 1 step for every set of 5 TR that you have over 20. (And collect bonuses from each step.)');
      expect([GREEN_ALLEGIANCE_OVER, GREEN_ALLEGIANCE_STEP]).deep.eq([20, 5]);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(2);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount]), 'one Agenda step per TR badge carrying the set\'s size')
        .deep.eq([[CardRenderItemType.AGENDA_STEP, 1], [CardRenderItemType.TR, GREEN_ALLEGIANCE_STEP]]);
      expect(items[1].showDigit, 'ONE badge with its digit, never five badges («5 TR per step» would be the opposite rule)').eq(true);
      const caption = rows[1].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(caption.map((item) => [item.type, item.text]), 'the literal key is the printed threshold')
        .deep.eq([[CardRenderItemType.TEXT, `over ${GREEN_ALLEGIANCE_OVER}`]]);
    });
  });

  describe('rule 1 — the requirement: the Greens rule, or 2 of your delegates on their resolution', () => {
    it('the starting rule opens it; under the Reds: «0 of 2», «1 of 2», then two cubes open it', () => {
      const open = table(33);
      expect(open.p1.canPlay(open.card), 'generation 1 — the Greens rule by the starting rule').is.true;
      const t = redsRule(table(33));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0, requirement: true, requirementKey: 'req:party',
      });
      greensCubes(t, t.p1, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, current: 1});
      greensCubes(t, t.p1, 1);
      expect(t.p1.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s: one delegate still reads «1 of 2»', () => {
      const t = redsRule(table(33));
      t.p1.playedCards.push(new CouncilSeat());
      greensCubes(t, t.p1, 1);
      expect(t.parliament.hasPartyEffect(t.p1, G), 'the Greens\' EFFECT is the player\'s by the Seat').is.true;
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: G, current: 1, params: [G, '2']});
    });
  });

  describe('rule 2 — N = the complete sets of 5 TR over 20, by the family\'s ONE division, with RX13\'s breakdown', () => {
    it('the table: 14 → 0, 20 → 0, 24 → 0, 25 → 1, 29 → 1, 30 → 2, 35 → 3, 45 → 5, 60 → 8', () => {
      const expected: Array<[number, number]> = [[14, 0], [20, 0], [24, 0], [25, 1], [29, 1], [30, 2], [35, 3], [45, 5], [60, 8]];
      for (const [tr, sets] of expected) {
        const t = table(tr);
        expect(greenAllegianceSteps(t.p1).sets, `TR ${tr}`).eq(sets);
        expect(sets, 'the very division RX13 counts with').eq(thresholdSets(tr, GREEN_ALLEGIANCE_OVER, GREEN_ALLEGIANCE_STEP));
      }
    });

    it('the breakdown is the family\'s model — value · over · step · sets · toNext (≥ 1), the one writer RX13 reads too', () => {
      expect(greenAllegianceSteps(table(33).p1)).deep.eq({metric: 'terraformRating', value: 33, over: 20, step: 5, sets: 2, toNext: 2});
      expect(greenAllegianceSteps(table(24).p1).toNext, 'one short of the first set').eq(1);
      expect(greenAllegianceSteps(table(25).p1).toNext, 'exactly one set: a whole set to the next').eq(5);
      expect(greenAllegianceSteps(table(23).p1)).deep.include({sets: 0, toNext: 2});
      expect(greenAllegianceSteps(table(14).p1).toNext, 'the solo start').eq(11);
      for (const tr of [14, 19, 24, 25, 30]) {
        expect(countMetricToward('terraformRatingSets', tr).metric, `RX13 at TR ${tr} — the same writer, over 15`)
          .deep.eq(thresholdBreakdown('terraformRating', tr, 15, 5));
      }
    });
  });

  describe('rules 3–4 — the play IS the walk, its N read ONCE, before the first step', () => {
    it('TR 33 from 1: two steps — ② TR (the Greens answer it), ③ influence 2; the breakdown line BEFORE the walk\'s lines; one record', () => {
      const t = table(33);
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(3);
      expect(t.parliament.influence(t.p1)).eq(2);
      expect(t.p1.terraformRating).eq(34);
      expect(t.p1.megaCredits, '20 − 2 for the card + 2 from the Greens for the walked TR').eq(20);
      expect(t.parliament.lastAdvance).deep.include({player: t.p1.id, from: 1, to: 3, reason: 'card', card: CardName.GREEN_ALLEGIANCE});
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 2, bonus: 'tr'}, {to: 3}]);
      expect(linesOf(t.game, at), 'why → step 2 · its TR → step 3').deep.eq([SETS_LINE, ADVANCE, TR_LINE, ADVANCE]);
      const why = t.game.gameLog.find((entry) => entry.message === SETS_LINE)!;
      expect(why.data.slice(1).map((d) => d.value), 'sets · TR · steps').deep.eq(['2', '33', '2']);
    });

    it('rule 3 — the walk\'s own TR adds no set: TR 29 from 1 → ② TR → 30, and NO second step', () => {
      const t = table(29);
      play(t);
      expect(t.p1.terraformRating, 'the rating crossed 30 on the walk').eq(30);
      expect(t.parliament.agendaOf(t.p1), 'N was 1, read before the walk').eq(2);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 2, bonus: 'tr'}]);
    });

    it('the longest walk of the set — TR 45 from 0: five steps, ① influence 1 · ② TR · ③ influence 2 · ④ TR · ⑤ influence 3; two Greens answers; ONE event', () => {
      const t = table(45, 0);
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(5);
      expect(t.parliament.influence(t.p1)).eq(3);
      expect(t.p1.terraformRating).eq(47);
      expect(t.p1.megaCredits, '20 − 2 + 2 × 2 from the Greens').eq(22);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 1}, {to: 2, bonus: 'tr'}, {to: 3}, {to: 4, bonus: 'tr'}, {to: 5}]);
      expect(t.parliament.lastAdvance?.seq, 'the serial moved ONCE').eq(1);
      expect(t.game.events.events.filter((e) => e.type === 'agenda-advanced')).has.lengthOf(1);
    });

    it('rule 4 — the end of the track cuts honestly: TR 35 (three sets) from 10 → ⑪ TR, ⑫ influence 5, the line ONCE', () => {
      const t = table(35, PARLIAMENT_AGENDA_STEPS - 2);
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(12);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 11, bonus: 'tr'}, {to: 12}]);
      expect(linesOf(t.game, at)).deep.eq([SETS_LINE, ADVANCE, TR_LINE, ADVANCE, END_LINE]);
    });
  });

  describe('rule 5 — ZERO sets is a legal play, and the zero is NAMED (the owner\'s decision 3)', () => {
    it('TR 23: playable; the cost paid, in the tableau, its Earth tag counted; no record, no event, no skip — ONE line with the breakdown', () => {
      const t = table(23);
      expect(t.p1.canPlay(t.card), 'the count adds no check of its own').is.true;
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(1);
      expect(t.parliament.lastAdvance).is.undefined;
      expect(t.game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
      expect(t.game.events.events.filter((e) => e.type === 'effect-skipped'), 'a computed zero named before the press is not a loss').deep.eq([]);
      expect(linesOf(t.game, at)).deep.eq([ZERO_LINE]);
      const zero = t.game.gameLog.find((entry) => entry.message === ZERO_LINE)!;
      expect(zero.data[1].value, 'the rating the zero was read from').eq('23');
      expect(t.p1.megaCredits).eq(18);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.GREEN_ALLEGIANCE);
      expect(t.p1.tags.count(Tag.EARTH)).eq(1);
    });
  });

  describe('rule 6 — a walked TR is an ordinary TR of the action phase', () => {
    it('a chairman quest of «gain 1 TR» is closed by the walk, and its gate stands AFTER the walk', () => {
      const t = table(33);
      t.parliament.quest = {definition: {goal: {kind: 'tr'}, count: 1}, source: 'starter', generation: t.game.generation, progress: new Map()};
      play(t);
      expect(t.parliament.quest?.completedBy).eq(t.p1.id);
      expect(t.parliament.agendaOf(t.p1), 'the walk finished before the gate rose').eq(3);
      expect(questGateOf(t.p1)).is.not.undefined;
      expect(t.parliament.lastAdvance?.reason).eq('card');
    });
  });

  describe('rule 7 — the Earth tag', () => {
    it('Teractor\'s −3 brings the cost to 0: playable with no M€ at all, the walk unchanged', () => {
      const t = table(33);
      t.p1.playCorporationCard(new Teractor());
      t.p1.megaCredits = 0;
      expect(t.p1.getCardCost(t.card)).eq(0);
      expect(t.p1.canPlay(t.card)).is.true;
      play(t, 0);
      expect(t.parliament.agendaOf(t.p1)).eq(3);
      expect(t.p1.megaCredits, 'only the Greens\' 2 for the walked TR').eq(2);
    });

    it('Point Luna draws for the Earth tag', () => {
      const t = table(23);
      t.p1.playCorporationCard(new PointLuna());
      const hand = t.p1.cardsInHand.length;
      play(t);
      expect(t.p1.cardsInHand.length, 'the played card left, Point Luna\'s card came').eq(hand);
    });
  });

  describe('rule 8 — the preview: the walk AND why it is this long, held to the play', () => {
    it('TR 33 from 1: the track chip 1 → 3 noted «2 sets of 5 TR over 20», then the TR and influence chips; the walk carries the breakdown', () => {
      const t = table(33);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects.map((e) => e.icon)).deep.eq([AGENDA_TRACK_ICON, 'tr', INFLUENCE_ICON]);
      expect(branch.effects[0]).deep.include({direction: 'gain', amount: 2, current: 1, resulting: 3, note: AGENDA_SETS_NOTE});
      expect(branch.effects[0].noteParams).deep.eq(['2', '5', '20']);
      expect(branch.effects[2]).deep.include({icon: INFLUENCE_ICON, amount: 1, current: 1, resulting: 2});
      expect(walkOf(t)).deep.eq({
        from: 1, to: 3, printed: 2, walked: 2,
        steps: [{to: 2, kind: 'tr'}, {to: 3, kind: 'influence', level: 2}],
        influence: {current: 1, resulting: 2},
        basis: {metric: 'terraformRating', value: 33, over: 20, step: 5, sets: 2, toNext: 2},
      });
    });

    it('ZERO: no walk chip at all (nothing to promise — PL-118), the breakdown still rides the walk', () => {
      const t = table(23);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects.filter((e) => e.icon === AGENDA_TRACK_ICON)).deep.eq([]);
      expect(walkOf(t)).deep.include({from: 1, to: 1, printed: 0, walked: 0, steps: []});
      expect(walkOf(t).basis).deep.include({value: 23, sets: 0, toNext: 2});
    });

    it('a CUT keeps both: the chip notes the cut, the breakdown rides the walk — TR 35 from 10 «2 of 3 · end of the track»', () => {
      const t = table(35, 10);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects[0]).deep.include({icon: AGENDA_TRACK_ICON, amount: 2, current: 10, resulting: 12, note: 'end of the track'});
      expect(branch.effects[0].noteParams, 'one note per chip — the cut wins').is.undefined;
      expect(walkOf(t)).deep.include({printed: 3, walked: 2});
      expect(walkOf(t).basis?.sets).eq(3);
    });

    it('the OWN hand card carries the same walk (`CardModel.agendaWalk` — the hand plate and the inspector read it); no opt-in, none', () => {
      const t = table(33);
      const [own] = cardsToModel(t.p1, [t.card], {showCalculatedCost: true, unplayableReasons: true});
      expect(own.agendaWalk, 'the preview\'s walk, word for word').deep.eq(walkOf(t));
      const [plain] = cardsToModel(t.p1, [t.card], {showCalculatedCost: true});
      expect(plain.agendaWalk, 'only the own hand opts in').is.undefined;
      const zero = table(23);
      expect(cardsToModel(zero.p1, [zero.card], {unplayableReasons: true})[0].agendaWalk).deep.include({printed: 0, walked: 0});
      const lawyers = table(33, 11);
      const printed = cardsToModel(lawyers.p1, [new RedLawyers()], {unplayableReasons: true})[0].agendaWalk;
      expect(printed, 'a printed walk: the track\'s cut is its news').deep.include({from: 11, to: 12, printed: 2, walked: 1});
      expect(printed, '…and it carries no basis').not.to.have.property('basis');
      const [game, p1] = testGame(2);
      expect(game.parliament).is.undefined;
      expect(cardsToModel(p1, [new GreenAllegiance()], {unplayableReasons: true})[0].agendaWalk, 'outside the Parliament: nothing').is.undefined;
    });

    it('PARITY: the preview\'s walk is the play\'s result, and the preview mutates nothing', () => {
      const t = table(45, 0);
      const before = JSON.stringify(t.game.serialize());
      const walk = walkOf(t);
      expect(JSON.stringify(t.game.serialize()), 'purity').eq(before);
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(walk.to);
      expect(t.parliament.influence(t.p1)).eq(walk.influence.resulting);
      expect(t.parliament.lastAdvance?.steps?.map((s) => s.to)).deep.eq(walk.steps.map((s) => s.to));
    });
  });

  describe('rules 10, 12 — the record, the journal and the rival', () => {
    it('ONE agenda-advanced event sourced by the CARD; a rival\'s notification carries the walk as the actor\'s pill', () => {
      const t = table(33);
      play(t);
      const advanced = t.game.events.events.filter((e) => e.type === 'agenda-advanced');
      expect(advanced).has.lengthOf(1);
      expect(advanced[0].source).deep.include({kind: 'card', card: CardName.GREEN_ALLEGIANCE});
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.GREEN_ALLEGIANCE)!.id;
      const impact = recomputeRootImpact(t.game.events.events, root, t.p1.color, t.p2.color);
      const actor = impact.pillGroups.find((group) => group.scope === 'actor');
      expect(actor?.chips.map((chip) => `${chip.icon} ${chip.text}`)).to.include.members(['agenda +2']);
    });

    it('save / load adds nothing: the walk\'s record survives whole', () => {
      const t = table(33);
      play(t);
      const restored = Game.deserialize(structuredClone(t.game.serialize()));
      const again = restored.getPlayerById(t.p1.id);
      expect(restored.parliament!.agendaOf(again)).eq(3);
      expect(restored.parliament!.lastAdvance).deep.include({from: 1, to: 3, reason: 'card', card: CardName.GREEN_ALLEGIANCE});
      expect([...again.tableau].map((c) => c.name)).includes(CardName.GREEN_ALLEGIANCE);
    });
  });

  describe('outside the Mars Parliament', () => {
    it('never dealt (the manifest is the gate); a play without a parliament walks nothing and does not throw', () => {
      const [game, p1] = testGame(2);
      expect(game.parliament).is.undefined;
      const card = new GreenAllegiance();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      expect(() => card.play(p1)).to.not.throw();
      expect(game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
    });
  });
});
