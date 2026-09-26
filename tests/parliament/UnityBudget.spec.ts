import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  UNITY_BUDGET, UNITY_BUDGET_CODE, UNITY_BUDGET_ID, UNITY_BUDGET_LEVY, UNITY_BUDGET_LEVY_AMOUNT, UNITY_BUDGET_MEGACREDITS,
  UNITY_BUDGET_NO_TAGS_REASON, UNITY_BUDGET_TRACK_STEPS, UNITY_BUDGET_TRACKS,
} from '../../src/server/parliament/resolutions/unity/UnityBudget';
import {
  INDUSTRIALIST_BUDGET, INDUSTRIALIST_BUDGET_LEVY, INDUSTRIALIST_BUDGET_MEGACREDITS,
} from '../../src/server/parliament/resolutions/industrialists/IndustrialistBudget';
import {SCIENTISTS_BUDGET, SCIENTISTS_BUDGET_LEVY, SCIENTISTS_BUDGET_MEGACREDITS} from '../../src/server/parliament/resolutions/scientists/ScientistsBudget';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, passToParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {declaredCountIds, declaredStockReads, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {LEVY_STEP_KEY, levyDeclared, levyNetEffectOf, levyNothingReasonKey, levyPaid, levyShortReasonKey} from '../../src/common/parliament/resolutionLevy';
import {
  COLONY_TRACK_STEP_KEY, colonyTrackAdvanceDeclared, colonyTrackMoveSteps, colonyTrackRoom, NO_COLONY_TRACK_REASON,
} from '../../src/common/parliament/colonyTrackAdvance';
import {REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {MAX_COLONY_TRACK_POSITION} from '../../src/common/constants';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {Colony} from '../../src/server/colonies/Colony';
import {Luna} from '../../src/server/colonies/Luna';
import {Callisto} from '../../src/server/colonies/Callisto';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Miranda} from '../../src/server/colonies/Miranda';
import {LunaGovernor} from '../../src/server/cards/colonies/LunaGovernor';
import {VenusGovernor} from '../../src/server/cards/venusNext/VenusGovernor';
import {JovianLanterns} from '../../src/server/cards/colonies/JovianLanterns';
import {EarthOffice} from '../../src/server/cards/base/EarthOffice';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * UNITY BUDGET (Turmoil Redux, RX29) — the FOURTH card of the BUDGET family
 * and the FIRST resolution that moves the COLONY TABLE: the shared levy of
 * 12 M€ (RX15), a count over THREE tags (Earth + Venus + Jovian, the multi-tag
 * form of RX06) + influence, and «advance each colony track 2 steps» — a WORLD
 * step declared as data (`trackAdvance`) and paid by the family's ONE shared
 * executor.
 *
 * What these specs pin: the printed order is the executed order (the
 * records' before/after chain proves it); the LEVY is the family's, unchanged
 * (12 M€ leaves 0; 4 M€ pays 4 of 12 and says so; 0 M€ is a named skip — all
 * three are still paid); the payout is PRINTED Earth + Venus + Jovian tags +
 * influence with a per-tag breakdown, no cap, a card printing two of them
 * worth 2; EVERY colony tile in play advances exactly 2 — ONCE per enactment
 * on a three-seat table, the tiles with nobody's cube on them and the bot's
 * alike; a track at its end is NAMED, a track one short of it makes one
 * honest step; an inactive tile has no live track; a neutral winner cancels
 * nothing; a reload inside the enactment moves nothing twice; MarsBot is never
 * levied or paid; and RX15 / RX27 pay exactly what they did before.
 */
const BUDGET = resolutionInstanceId(UNITY_BUDGET_ID, 0);
const INDUSTRIAL = resolutionInstanceId(INDUSTRIALIST_BUDGET.id, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** THE TABLE: the tiles in this order, each with the given seats' cubes and its marker's position (activated unless said otherwise). */
function arrangeColonies(game: IGame, table: Array<[Colony, Array<IPlayer>, number, {inactive?: boolean}?]>): void {
  game.colonies = table.map(([colony, owners, track, opts]) => {
    colony.isActive = opts?.inactive !== true;
    colony.colonies = owners.map((p) => p.id);
    colony.trackPosition = track;
    return colony;
  });
}

function colonyOf(game: IGame, name: ColonyName): Colony {
  const colony = game.colonies.find((c) => c.name === name);
  if (colony === undefined) {
    throw new Error(`${name} is not on the table`);
  }
  return colony as Colony;
}

/**
 * THE GENERATION MOVES THE TABLE FIRST: `Colony.endGeneration` advances every ACTIVE track one step
 * before the sitting convenes (`Game.endGenerationForColonies` → the production phase → the parliament),
 * so a track arranged at N stands at N + 1 when the law reads it — the record's `before` is the
 * generation's own position, never the arranged one. Every expectation below adds it.
 */
const GENERATION_STEP = 1;

/** Seat the budget in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation; a plain three-tile table (Luna 1, Callisto 2, Ceres 3). */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, BUDGET);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  arrangeColonies(game, [[new Luna(), [p1], 1], [new Callisto(), [], 2], [new Ceres(), [p2], 3]]);
  return [game, p1, p2, parliament];
}

/** The plain table's records: the generation's step first, then the law's two. */
const STAGE_TRACKS = [
  {colony: ColonyName.LUNA, before: 1 + GENERATION_STEP, after: 3 + GENERATION_STEP},
  {colony: ColonyName.CALLISTO, before: 2 + GENERATION_STEP, after: 4 + GENERATION_STEP},
  {colony: ColonyName.CERES, before: 3 + GENERATION_STEP, after: 5 + GENERATION_STEP},
];
const STAGE_AFTER = STAGE_TRACKS.map((t) => t.after);

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

/** The generation's income at the production phase — what the levy is taken FROM (TR + M€ production). */
function incomeOf(player: TestPlayer): number {
  return player.terraformRating + player.production.megacredits;
}

function allRecords(parliament: Parliament): Array<SerializedEnactOutcome> {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return summary?.outcomes ?? [];
}

function recordsOf(parliament: Parliament, player: TestPlayer) {
  return allRecords(parliament).filter((o) => o.player === player.id);
}

function outcomeOf(parliament: Parliament, player: TestPlayer, step: string) {
  return recordsOf(parliament, player).find((o) => o.step === step);
}

/** THE WORLD's record — the one that names no seat. */
function tracksRecord(parliament: Parliament) {
  return allRecords(parliament).find((o) => o.player === undefined && o.step === COLONY_TRACK_STEP_KEY);
}

describe('UnityBudget', () => {
  describe('the catalog entry', () => {
    it('is RX29 of Unity, dealt as ONE card in every game (colonies are mandatory in Redux), with the 2-Earth-tag quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(UNITY_BUDGET_ID)).eq(UNITY_BUDGET);
      expect(UNITY_BUDGET_CODE).eq('RX29');
      expect(UNITY_BUDGET_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX29')).eq(UNITY_BUDGET);
      expect(UNITY_BUDGET.party).eq(PartyName.UNITY);
      expect(UNITY_BUDGET.module).eq('turmoilRedux');
      expect(UNITY_BUDGET.compatibility, 'colonies are mandatory in Redux — no compatibility marker').is.undefined;
      expect(UNITY_BUDGET.quest).deep.eq({goal: {kind: 'tag', tag: Tag.EARTH}, count: 2});
      expect(UNITY_BUDGET.winnerSteps, 'no winner-only part').is.undefined;
      expect(UNITY_BUDGET.winnerReward, 'no winner tile either').is.undefined;
      expect(UNITY_BUDGET.worldMoves, 'the planet is untouched').is.undefined;
      expect(UNITY_BUDGET.passive, 'no passive').is.undefined;
      expect(UNITY_BUDGET.action, 'no action').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === BUDGET)).has.length(1);
    });

    it('is ASSEMBLED: the family\'s levy at 12, a count over THREE tags, and the colony table as DATA paid by the shared world step', () => {
      // THE LEVY: the family's member with this card's sum — the same shape RX15 / RX27 declared.
      expect(UNITY_BUDGET.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 12, recipient: 'each'});
      expect(UNITY_BUDGET_LEVY_AMOUNT).eq(12);
      expect(levyDeclared(UNITY_BUDGET.levy)).is.true;
      expect(UNITY_BUDGET.levy!.recipient).eq(INDUSTRIALIST_BUDGET_LEVY.recipient);
      // THE COUNT: one term over three tags — Cloud Development's two-tag form, one tag wider.
      expect(UNITY_BUDGET_MEGACREDITS.count).deep.eq({id: 'earthVenusJovianTags', per: 1});
      expect(resolutionCountKind('earthVenusJovianTags')).deep.eq({kind: 'tags', tags: [Tag.EARTH, Tag.VENUS, Tag.JOVIAN]});
      expect(UNITY_BUDGET_MEGACREDITS.unit).deep.eq(INDUSTRIALIST_BUDGET_MEGACREDITS.unit);
      expect(UNITY_BUDGET_MEGACREDITS.perInfluence).eq(1);
      expect(UNITY_BUDGET_MEGACREDITS.cap, 'the card prints no maximum — none is declared').is.undefined;
      expect(UNITY_BUDGET.scaled).deep.eq([UNITY_BUDGET_MEGACREDITS]);
      expect(levyNetEffectOf(UNITY_BUDGET_LEVY, UNITY_BUDGET.scaled)).eq(UNITY_BUDGET_MEGACREDITS);
      // THE COLONY TABLE: data + the family's shared world step under its own key, never a step of the card's own.
      expect(UNITY_BUDGET.trackAdvance).deep.eq({steps: 2});
      expect(UNITY_BUDGET_TRACKS).deep.eq({steps: UNITY_BUDGET_TRACK_STEPS});
      expect(colonyTrackAdvanceDeclared(UNITY_BUDGET.trackAdvance)).is.true;
      expect(UNITY_BUDGET.worldSteps?.map((step) => step.key)).deep.eq([COLONY_TRACK_STEP_KEY]);
      expect(UNITY_BUDGET.text.world, 'the inspector reads the world part as its own block').is.a('string');
      // THE PRINTED ORDER: the levy step FIRST, then the payout — per seat; the table is not a seat's step.
      expect(UNITY_BUDGET.immediateSteps?.map((step) => step.key)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      expect(UNITY_BUDGET.immediateStepsFor, 'no per-player step plan').is.undefined;
      expect(familyOf(UNITY_BUDGET), 'the stand opens the tag-count family from the declaration alone').eq('counted-tags');
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('earthVenusJovianTags');
      expect(declaredStockReads(REDUX_RESOLUTION_CATALOG)).includes(Resource.MEGACREDITS);
      // THE ADDRESS of the new kind: the colonies screen, hosted as the sitting's own step; nothing flies off the card.
      expect(REWARD_ADDRESS.colonyTrack).deep.include({surface: 'colonies', source: 'none', unit: 'none', stage: 'colonies', reading: 'world-tracks'});
    });

    it('the face prints «−12 [M€] · ALL [colony] +2» over «1 [M€] / [Earth] + [Venus] + [Jovian] + [influence]»; the quest graphic is two Earth tags', () => {
      const [top, rate] = UNITY_BUDGET.renderData.rows;
      const topItems = top.filter(isICardRenderItem);
      expect(topItems.map((item) => item.type)).deep.eq(
        [CardRenderItemType.MEGACREDITS, CardRenderItemType.TEXT, CardRenderItemType.COLONIES, CardRenderItemType.TEXT]);
      expect(topItems[0].amount, 'the negative is printed INSIDE the tile, as on the card').eq(-12);
      expect(topItems[0].amountInside).is.true;
      expect([topItems[1].text, topItems[3].text]).deep.eq(['ALL', '+2']);
      const rateItems = rate.filter(isICardRenderItem);
      expect(rateItems.map((item) => item.type)).deep.eq([
        CardRenderItemType.MEGACREDITS, CardRenderItemType.TAG, CardRenderItemType.TAG, CardRenderItemType.TAG, CardRenderItemType.INFLUENCE,
      ]);
      expect(rateItems[0].amount, 'the rate').eq(1);
      expect(rateItems.slice(1, 4).map((item) => item.tag), 'the counted objects are the three printed medallions').deep.eq([Tag.EARTH, Tag.VENUS, Tag.JOVIAN]);
      const [quest] = questRenderData(UNITY_BUDGET.quest).rows;
      expect(quest.filter(isICardRenderItem).map((item) => [item.type, item.tag, item.amount])).deep.eq([[CardRenderItemType.TAG, Tag.EARTH, 2]]);
    });

    it('the formula: Earth + Venus + Jovian tags + influence, no cap; the shared room: two steps, one at the last cell, none at the end', () => {
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 3, 3], [2, 0, 2], [3, 3, 6], [7, 5, 12]];
      for (const [count, influence, expected] of cases) {
        expect(scaledAmount(UNITY_BUDGET_MEGACREDITS, influence, count), `count ${count} I=${influence}`).eq(expected);
        expect(uncappedAmount(UNITY_BUDGET_MEGACREDITS, influence, count)).eq(expected);
      }
      expect(colonyTrackRoom(UNITY_BUDGET_TRACKS, 1)).deep.eq({current: 1, max: MAX_COLONY_TRACK_POSITION, steps: 2, applied: 2, moves: true, atMax: false, resulting: 3});
      expect(colonyTrackRoom(UNITY_BUDGET_TRACKS, MAX_COLONY_TRACK_POSITION - 1)).deep.include({applied: 1, moves: true, atMax: false, resulting: MAX_COLONY_TRACK_POSITION});
      expect(colonyTrackRoom(UNITY_BUDGET_TRACKS, MAX_COLONY_TRACK_POSITION)).deep.include({applied: 0, moves: false, atMax: true, resulting: MAX_COLONY_TRACK_POSITION});
      expect(colonyTrackMoveSteps({colony: ColonyName.LUNA, before: 5, after: 6})).eq(1);
      expect(colonyTrackMoveSteps({colony: ColonyName.LUNA, before: 6, after: 6})).eq(0);
    });
  });

  describe('the enactment — the printed order, for every participant, then the colony table once', () => {
    it('levy → payout for EVERY participant (voters or not), then every track +2: the records\' before/after chain proves it', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3; Luna Governor (2 Earth) + Jovian Lanterns (1) = 3 → +6.
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new LunaGovernor(), new JovianLanterns());
      // p2 never voted — influence 1, no tag: influence pays on its own.
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      const income1 = incomeOf(p1);
      const income2 = incomeOf(p2);
      endGeneration(game);
      runAllActions(game);
      expect(parliament.enacted).eq(BUDGET);
      expect(parliament.rulingParty()).eq(PartyName.UNITY);
      // THE ORDER, by the record list and by the chain of supplies.
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      const levy1 = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      expect(levy1).deep.eq({
        player: p1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'stock', stock: Resource.MEGACREDITS,
        amount: -12, owed: 12, before: 20 + income1, after: 8 + income1});
      expect(paid1).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 6, count: 3, influence: 3, before: levy1.after, after: levy1.after! + 6});
      expect(paid1.counted, 'the cards that made the count').deep.eq([CardName.LUNA_GOVERNOR, CardName.JOVIAN_LANTERNS]);
      expect(paid1.countedUnits, 'Luna Governor prints two Earth tags').deep.eq([2, 1]);
      expect(paid1.countedByTag, 'the per-tag breakdown rides the record').deep.eq([{tag: Tag.EARTH, count: 2}, {tag: Tag.VENUS, count: 0}, {tag: Tag.JOVIAN, count: 1}]);
      expect(paid1.uncapped, 'no cap declared — no sum beside the amount').is.undefined;
      expect(p1.megaCredits).eq(paid1.after);
      // …then p2: its own levy, its own influence.
      const levy2 = outcomeOf(parliament, p2, LEVY_STEP_KEY)!;
      const paid2 = outcomeOf(parliament, p2, 'megacredits')!;
      expect(levy2).deep.include({kind: 'stock', amount: -12, owed: 12, before: 20 + income2, after: 8 + income2});
      expect(paid2).deep.include({kind: 'stock', amount: 1, count: 0, influence: 1, before: levy2.after, after: levy2.after! + 1});
      expect(paid2.counted, 'no card is counted').deep.eq([]);
      // THE TABLE, LAST — after every seat's own part, once, for nobody.
      const all = allRecords(parliament);
      expect(all.map((o) => `${o.player ?? 'world'}:${o.step}`)).deep.eq([
        `${p1.id}:${LEVY_STEP_KEY}`, `${p1.id}:megacredits`, `${p2.id}:${LEVY_STEP_KEY}`, `${p2.id}:megacredits`, `world:${COLONY_TRACK_STEP_KEY}`,
      ]);
      const tracks = tracksRecord(parliament)!;
      expect(tracks).deep.eq({step: COLONY_TRACK_STEP_KEY, part: 'world', kind: 'colonyTrack', amount: 2, tracks: STAGE_TRACKS});
      expect(tracks.player, 'a world record belongs to NO seat').is.undefined;
      expect(game.colonies.map((c) => c.trackPosition), 'the engine\'s own markers moved exactly as recorded').deep.eq(STAGE_AFTER);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      // The events say the same order under the resolution's source: −12, then +6.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === UNITY_BUDGET_ID && e.player === p1.color &&
        e.type !== 'action');
      expect(mine.map((e) => e.type)).deep.eq(['resource-changed', 'resource-changed']);
      expect(mine[0].impact?.stock?.megacredits).eq(-12);
      expect(mine[1].impact?.stock?.megacredits).eq(6);
      // The reward address reads the levy as a LOSS, never as a skip; the table's record is a payout of nobody's.
      const delivery = rewardAddressOf({...levy1, player: p1.color}, p1.color);
      expect(delivery.direction).eq('loss');
      expect(delivery.skipped).is.undefined;
      const table = rewardAddressOf({...tracks, player: undefined}, p2.color);
      expect(table.skipped, 'the whole table moved — nothing is a skip').is.undefined;
      expect(table.mine, 'a world record is every viewer\'s').is.true;
      expect(table.payload.tracks).deep.eq(tracks.tracks);
    });

    it('the levy is the family\'s, bounded by the seat: 12 M€ leaves 0; 4 M€ pays 4 of 12 and says so; 0 M€ is a named skip — all three are still paid', () => {
      const levy = UNITY_BUDGET_LEVY;
      expect([levyPaid(levy, 12), levyPaid(levy, 4), levyPaid(levy, 0)]).deep.eq([12, 4, 0]);
      // 12 M€ AT THE SITTING: no rating, no production, so the production phase adds nothing.
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.megaCredits = 12;
      p1.terraformRating = 0;
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -12, owed: 12, before: 12, after: 0});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 3, count: 0, influence: 3, before: 0, after: 3});
      expect(p1.megaCredits, '12 − 12 + 3').eq(3);

      // 4 M€: the take is what the seat holds, the shortfall is on the PAYING record, and the payout still comes.
      const [game2, q1, , parl2] = stage();
      parl2.agenda.set(q1.id, 4);
      q1.playedCards.push(new LunaGovernor());
      q1.megaCredits = 4;
      q1.terraformRating = 0;
      endGeneration(game2);
      runAllActions(game2);
      expect(outcomeOf(parl2, q1, LEVY_STEP_KEY)).deep.include(
        {kind: 'stock', amount: -4, owed: 12, before: 4, after: 0, reason: levyShortReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl2, q1, 'megacredits')).deep.include({kind: 'stock', amount: 5, count: 2, influence: 3, before: 0, after: 5});
      expect(q1.megaCredits, 'never below zero on the way').eq(5);
      expect(game2.gameLog.filter((e) => e.message.startsWith('${0} pays only ${1} of the ${2} ${3} owed')), 'the shortfall is named').has.length(1);
      expect(game2.gameLog.filter((e) => e.message.includes('Adjusting')), 'the take carried its source — no illegal-state line').deep.eq([]);

      // 0 M€: a named skip carrying the owed sum — and the card still pays.
      const [game3, r1, , parl3] = stage();
      parl3.agenda.set(r1.id, 4);
      r1.megaCredits = 0;
      r1.terraformRating = 0;
      endGeneration(game3);
      runAllActions(game3);
      expect(outcomeOf(parl3, r1, LEVY_STEP_KEY)).deep.eq(
        {player: r1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 12, reason: levyNothingReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl3, r1, 'megacredits')).deep.include({kind: 'stock', amount: 3, influence: 3, before: 0, after: 3});
      expect(game3.events.events.filter((e) => e.type === 'resource-changed' && e.player === r1.color && e.source?.kind === 'resolution' &&
        (e.impact?.stock?.megacredits ?? 0) < 0), 'not one M€ left the seat').has.length(0);
      // …and the tracks moved for all three tables all the same: the levy asks no solvency of the seat, the table asks nothing of it.
      for (const g of [game, game2, game3]) {
        expect(g.colonies.map((c) => c.trackPosition)).deep.eq(STAGE_AFTER);
      }
    });

    it('the count is THREE tags added up: a card printing two of one counts twice, a wild tag is none of them, and the breakdown names each tag', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      // Luna Governor (Earth ×2) + Venus Governor (Venus ×2) + Jovian Lanterns (Jovian) + Earth Office (Earth) = 6; GHG bacteria counts nothing.
      p1.playedCards.push(new LunaGovernor(), new VenusGovernor(), new JovianLanterns(), new EarthOffice(), new GHGProducingBacteria());
      // p2: influence 0, and a wild tag that is NONE of the three at an enactment.
      p2.playedCards.push(new NobelPrize());
      const live = resolutionCount(p1, 'earthVenusJovianTags');
      expect(live.count).eq(6);
      expect(live.cards).deep.eq([CardName.LUNA_GOVERNOR, CardName.VENUS_GOVERNOR, CardName.JOVIAN_LANTERNS, CardName.EARTH_OFFICE]);
      expect(live.units).deep.eq([2, 2, 1, 1]);
      expect(live.byTag).deep.eq([{tag: Tag.EARTH, count: 3}, {tag: Tag.VENUS, count: 2}, {tag: Tag.JOVIAN, count: 1}]);
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 9, count: 6, influence: 3});
      expect(outcomeOf(parliament, p1, 'megacredits')?.countedByTag).deep.eq([{tag: Tag.EARTH, count: 3}, {tag: Tag.VENUS, count: 2}, {tag: Tag.JOVIAN, count: 1}]);
      // p2's zero is NAMED — the levy is still taken.
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -12, owed: 12});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include(
        {kind: 'skipped', amount: 0, count: 0, influence: 0, reason: UNITY_BUDGET_NO_TAGS_REASON});
      expect(game.gameLog.filter((e) => e.message.startsWith('${0} has no Earth, Venus or Jovian tags and no influence')), 'p2\'s zero is named').has.length(1);
    });

    it('a neutral winner cancels nothing: every participant is levied and paid, and the table still advances', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, BUDGET);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.megaCredits = 20;
      p2.megaCredits = 20;
      p1.playedCards.push(new LunaGovernor());
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      arrangeColonies(game, [[new Luna(), [], 1], [new Callisto(), [], 1]]);
      endGeneration(game);
      runAllActions(game);
      expect((parliament.lastPhase ?? parliament.phase?.summary)?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(BUDGET);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({amount: 2, count: 2, influence: 0});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({amount: 2, count: 0, influence: 2});
      expect(tracksRecord(parliament)?.tracks).deep.eq([
        {colony: ColonyName.LUNA, before: 1 + GENERATION_STEP, after: 3 + GENERATION_STEP},
        {colony: ColonyName.CALLISTO, before: 1 + GENERATION_STEP, after: 3 + GENERATION_STEP},
      ]);
      settleParliamentGates(game);
      expect(allRecords(parliament).map((o) => o.part)).deep.eq(['effect', 'effect', 'effect', 'effect', 'world']);
    });

    it('the journal carries the two lines per seat and one line per tile, with the resolution as their source', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new LunaGovernor(), new JovianLanterns());
      endGeneration(game);
      runAllActions(game);
      const levy = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const levyLines = game.gameLog.filter((entry) => entry.message === '${0} pays ${1} ${2} to ${3} (${4} → ${5})');
      expect(levyLines, 'one levy line per seat').has.length(2);
      const mine = levyLines.find((entry) => entry.data[0].value === p1.color)!;
      expect(mine.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(UNITY_BUDGET_ID);
      expect(mine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['12', String(levy.before), String(levy.after)]);
      const payLine = game.gameLog.find((entry) => entry.message.startsWith('${0} gained ${1} M€ from ${2}: ${3} Earth, Venus and Jovian tag(s)') &&
        entry.data[0].value === p1.color)!;
      expect(payLine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value))
        .deep.eq(['6', '3', '3', String(levy.after), String(levy.after! + 6)]);
      // THE TABLE's lines are the LAW's — no player in them, one per tile, the tile named by its own token.
      const trackLines = game.gameLog.filter((entry) => entry.message === '${0} advanced the ${1} colony track ${2} step(s) (${3} → ${4})');
      expect(trackLines).has.length(3);
      expect(trackLines.map((entry) => entry.data[0])).deep.eq(Array(3).fill({type: LogMessageDataType.RESOLUTION, value: UNITY_BUDGET_ID}));
      expect(trackLines.map((entry) => entry.data[1].type)).deep.eq(Array(3).fill(LogMessageDataType.COLONY));
      expect(trackLines.map((entry) => entry.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)))
        .deep.eq(STAGE_TRACKS.map((t) => ['2', String(t.before), String(t.after)]));
      expect(trackLines.some((entry) => entry.data.some((d) => d.type === LogMessageDataType.PLAYER)), 'nobody is named — the law moved the table').is.false;
    });
  });

  describe('the colony table — a WORLD step: every tile in play, exactly 2, ONCE per enactment', () => {
    it('on a THREE-seat table every track advances 2 — never 2 per participant — and the record names no seat', () => {
      const [game, p1, p2, p3] = testGame(3, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      seatResolution(parliament, 0, BUDGET);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      for (const p of [p1, p2, p3]) {
        p.megaCredits = 20;
      }
      arrangeColonies(game, [[new Luna(), [p1], 1], [new Callisto(), [p2, p3], 2], [new Ceres(), [], 1]]);
      endGeneration(game);
      runAllActions(game);
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      expect(recordsOf(parliament, p2).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      expect(recordsOf(parliament, p3).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      expect(game.colonies.map((c) => c.trackPosition), '+1 of the generation, then +2 apiece — never +6').deep.eq([4, 5, 4]);
      const world = allRecords(parliament).filter((o) => o.player === undefined);
      expect(world, 'ONE record for the whole table').has.length(1);
      expect(world[0]).deep.include({step: COLONY_TRACK_STEP_KEY, part: 'world', kind: 'colonyTrack', amount: 2});
      expect(world[0].tracks?.map((t) => t.after - t.before)).deep.eq([2, 2, 2]);
    });

    it('a track at its END does not overflow and is NAMED in the record and the journal; a track one short of it makes ONE honest step', () => {
      const [game, , , parliament] = stage();
      // Luna stands at the END already (the generation's step cannot move it either); Callisto where the
      // generation's step leaves it ONE short of the end; Ceres two short of it after that step.
      colonyOf(game, ColonyName.LUNA).trackPosition = MAX_COLONY_TRACK_POSITION;
      colonyOf(game, ColonyName.CALLISTO).trackPosition = MAX_COLONY_TRACK_POSITION - 1 - GENERATION_STEP;
      colonyOf(game, ColonyName.CERES).trackPosition = MAX_COLONY_TRACK_POSITION - 2 - GENERATION_STEP;
      endGeneration(game);
      runAllActions(game);
      expect(colonyOf(game, ColonyName.LUNA).trackPosition, 'never past the end').eq(MAX_COLONY_TRACK_POSITION);
      expect(colonyOf(game, ColonyName.CALLISTO).trackPosition).eq(MAX_COLONY_TRACK_POSITION);
      expect(colonyOf(game, ColonyName.CERES).trackPosition).eq(MAX_COLONY_TRACK_POSITION);
      const tracks = tracksRecord(parliament)!;
      expect(tracks.kind, 'the table moved as a whole — a tile at its end is named IN the list, never a skip of the record').eq('colonyTrack');
      expect(tracks.tracks).deep.eq([
        {colony: ColonyName.LUNA, before: MAX_COLONY_TRACK_POSITION, after: MAX_COLONY_TRACK_POSITION},
        {colony: ColonyName.CALLISTO, before: MAX_COLONY_TRACK_POSITION - 1, after: MAX_COLONY_TRACK_POSITION},
        {colony: ColonyName.CERES, before: MAX_COLONY_TRACK_POSITION - 2, after: MAX_COLONY_TRACK_POSITION},
      ]);
      expect(tracks.tracks!.map(colonyTrackMoveSteps)).deep.eq([0, 1, 2]);
      const atMax = game.gameLog.filter((entry) => entry.message === 'The ${0} colony track is at its maximum — ${1} does not advance it');
      expect(atMax, 'Luna is named').has.length(1);
      expect(atMax[0].data[0]).deep.include({type: LogMessageDataType.COLONY});
      const moved = game.gameLog.filter((entry) => entry.message === '${0} advanced the ${1} colony track ${2} step(s) (${3} → ${4})');
      expect(moved.map((entry) => entry.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)))
        .deep.eq([['1', String(MAX_COLONY_TRACK_POSITION - 1), String(MAX_COLONY_TRACK_POSITION)], ['2', String(MAX_COLONY_TRACK_POSITION - 2), String(MAX_COLONY_TRACK_POSITION)]]);
      expect(rewardAddressOf({...tracks, player: undefined}, undefined).skipped, 'not a skip').is.undefined;
    });

    it('a tile with nobody\'s cube on it advances like any other; an INACTIVE tile has no live track and is not in the record', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Luna(), [p1], 2], [new Callisto(), [], 2], [new Miranda(), [], 1, {inactive: true}]]);
      endGeneration(game);
      runAllActions(game);
      expect(colonyOf(game, ColonyName.CALLISTO).trackPosition, 'no cube needed — the track is the tile\'s').eq(2 + GENERATION_STEP + 2);
      expect(colonyOf(game, ColonyName.MIRANDA).trackPosition, 'exactly as the end of the generation leaves it — untouched').eq(1);
      expect(tracksRecord(parliament)?.tracks).deep.eq([
        {colony: ColonyName.LUNA, before: 2 + GENERATION_STEP, after: 4 + GENERATION_STEP},
        {colony: ColonyName.CALLISTO, before: 2 + GENERATION_STEP, after: 4 + GENERATION_STEP},
      ]);
    });

    it('no tile in play at all (every tile inactive): the world part is a NAMED skip — the seats are levied and paid all the same', () => {
      const [game, p1, , parliament] = stage();
      arrangeColonies(game, [[new Luna(), [], 1, {inactive: true}], [new Callisto(), [], 1, {inactive: true}]]);
      parliament.agenda.set(p1.id, 4);
      endGeneration(game);
      runAllActions(game);
      expect(tracksRecord(parliament)).deep.eq({step: COLONY_TRACK_STEP_KEY, part: 'world', kind: 'skipped', amount: 2, tracks: [], reason: NO_COLONY_TRACK_REASON});
      expect(rewardAddressOf({...tracksRecord(parliament)!, player: undefined}, undefined).skipped).eq(NO_COLONY_TRACK_REASON);
      expect(game.colonies.map((c) => c.trackPosition)).deep.eq([1, 1]);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 3, influence: 3});
      expect(game.gameLog.some((entry) => entry.message === 'No colony tile is in play — ${0} advances no track')).is.true;
    });
  });

  describe('once per enactment — nothing is taken, paid or moved twice', () => {
    it('a reload INSIDE the enactment moves nothing again: the applied keys stand, one world record', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new LunaGovernor());
      endGenerationThroughParliament(game);
      const cash = p1.megaCredits;
      expect(game.colonies.map((c) => c.trackPosition)).deep.eq(STAGE_AFTER);
      const live = reload(game);
      expect(live.colonies.map((c) => c.trackPosition), 'the moved table survives the save').deep.eq(STAGE_AFTER);
      settleParliamentGates(live);
      // The whole sitting re-driven from the copy: the applied keys stand, nothing repeats.
      expect(live.colonies.map((c) => c.trackPosition)).deep.eq(STAGE_AFTER);
      expect(live.getPlayerById(p1.id).megaCredits, 'nor taken or paid again').eq(cash);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === undefined && o.step === COLONY_TRACK_STEP_KEY)).has.length(1);
      expect(outcomes.filter((o) => o.player === p1.id)).has.length(2);
    });

    it('a later tableau, a later influence, a later trade and a change of government never recompute what was taken, paid or moved', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new LunaGovernor());
      endGeneration(game);
      runAllActions(game);
      const cash = p1.megaCredits;
      const records = allRecords(parliament).map((o) => structuredClone(o));
      p1.playedCards.push(new JovianLanterns(), new VenusGovernor());
      parliament.agenda.set(p1.id, 12);
      colonyOf(game, ColonyName.LUNA).increaseTrack(1);
      getParliamentModel(game, p1);
      expect(p1.megaCredits).eq(cash);
      expect(allRecords(parliament)).deep.eq(records);
      expect(resolutionCount(p1, 'earthVenusJovianTags').count, 'the live count moved — the record did not').eq(5);
      expect(tracksRecord(parliament)?.tracks?.[0], 'the live track moved — the record did not').deep.eq(STAGE_TRACKS[0]);
      expect(p1.megaCredits).eq(cash);
    });
  });

  describe('the chairman quest — play 2 Earth tags', () => {
    it('the enactment moves no progress; the player\'s OWN two Earth tags complete it', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(UNITY_BUDGET_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.EARTH}, count: 2});
      expect(parliament.questProgressOf(p1), 'the enactment plays no tag').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      // ONE card printing TWO Earth tags completes it in one play.
      p1.playCard(new LunaGovernor());
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      // Once per generation: nobody else completes it.
      p2.playCard(new LunaGovernor());
      runAllActions(game);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('MarsBot, the model, and the older budgets standing where they stood', () => {
    it('MarsBot (mode none) is never levied and never paid — and the tile with its cube advances like every other', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BUDGET);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new LunaGovernor());
      arrangeColonies(game, [[new Luna(), [bot], 2], [new Callisto(), [human], 1]]);
      const cash = human.megaCredits;
      const income = incomeOf(human);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.map((o) => o.player)).deep.eq([human.id, human.id, undefined]);
      expect(outcomes.map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', COLONY_TRACK_STEP_KEY]);
      expect(outcomes[0]).deep.include({kind: 'stock', amount: -12, owed: 12});
      expect(outcomes[1]).deep.include({kind: 'stock', amount: 3, count: 2, influence: 1});
      expect(human.megaCredits, '−12 and (2 + I 1) on top of the production phase\'s income').eq(cash + income - 12 + 3);
      // The bot's tile moved with the table — the track is the tile's, not the bot's; nothing reached the bot under the law.
      expect(colonyOf(game, ColonyName.LUNA).trackPosition).eq(2 + GENERATION_STEP + 2);
      expect(colonyOf(game, ColonyName.CALLISTO).trackPosition).eq(1 + GENERATION_STEP + 2);
      expect(game.events.events.filter((e) => e.player === bot.color && e.source?.kind === 'resolution'),
        'nothing reached the bot under the resolution').is.empty;
      const model = getParliamentModel(game, human);
      expect(model?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
      expect(model?.players.find((p) => p.color === bot.color)?.stock, 'no levied supply for it either').is.undefined;
    });

    it('every seat\'s three-tag count (with its per-tag totals) and the SUPPLY the levy reads ride the model; the world record reaches EVERY client with its tracks and no seat', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new LunaGovernor(), new JovianLanterns());
      p1.megaCredits = 34;
      p2.megaCredits = 4;
      const model = getParliamentModel(game, p2);
      const one = model?.players.find((p) => p.color === p1.color);
      expect(one?.counts?.find((c) => c.id === 'earthVenusJovianTags')).deep.eq({
        id: 'earthVenusJovianTags', count: 3, cards: [CardName.LUNA_GOVERNOR, CardName.JOVIAN_LANTERNS], units: [2, 1],
        byTag: [{tag: Tag.EARTH, count: 2}, {tag: Tag.VENUS, count: 0}, {tag: Tag.JOVIAN, count: 1}],
      });
      expect(one?.stock).to.include({[Resource.MEGACREDITS]: 34});
      const two = model?.players.find((p) => p.color === p2.color);
      expect(two?.counts?.find((c) => c.id === 'earthVenusJovianTags')).deep.eq({
        id: 'earthVenusJovianTags', count: 0, cards: [], units: [], byTag: [{tag: Tag.EARTH, count: 0}, {tag: Tag.VENUS, count: 0}, {tag: Tag.JOVIAN, count: 0}],
      });
      expect(two?.stock, 'the seat the panel will warn about').to.include({[Resource.MEGACREDITS]: 4});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      for (const viewer of [p1, p2]) {
        const last = getParliamentModel(game, viewer)?.lastPhase;
        expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -12, owed: 12});
        const paid = last?.outcomes?.find((o) => o.player === p1.color && o.step === 'megacredits');
        expect(paid).deep.include({kind: 'stock', amount: 6, count: 3, influence: 3});
        expect(paid?.countedByTag).deep.eq([{tag: Tag.EARTH, count: 2}, {tag: Tag.VENUS, count: 0}, {tag: Tag.JOVIAN, count: 1}]);
        const world = last?.outcomes?.filter((o) => o.part === 'world') ?? [];
        expect(world.map((o) => `${o.step}:${o.kind}:${o.amount}`), `viewer ${viewer.color}`).deep.eq([`${COLONY_TRACK_STEP_KEY}:colonyTrack:2`]);
        expect(world[0].player, 'a world record names no seat on the wire').is.undefined;
        expect(world[0].tracks).deep.eq(STAGE_TRACKS);
      }
    });

    it('RX15 and RX27 DID NOT MOVE: Industrialist Budget levies, counts and pays exactly what it did before; the three budgets stay one family', () => {
      const [game, p1, , parliament] = reduxGame();
      seatResolution(parliament, 0, INDUSTRIAL);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.megaCredits = 20;
      p1.terraformRating = 0;
      parliament.agenda.set(p1.id, 4); // influence 3 at the effect
      p1.production.add(Resource.STEEL, 2);
      p1.production.add(Resource.TITANIUM, 1);
      p1.production.add(Resource.ENERGY, 3);
      const tracksBefore = game.colonies.map((c) => ({position: c.trackPosition, active: c.isActive}));
      endGeneration(game);
      runAllActions(game);
      expect(parliament.enacted).eq(INDUSTRIAL);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10, before: 20, after: 10});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 9, count: 6, influence: 3, before: 10, after: 19});
      expect(outcomeOf(parliament, p1, 'production')).deep.include({kind: 'production', amount: 4, before: 0, after: 4});
      expect(p1.megaCredits).eq(19);
      expect(game.colonies.map((c) => c.trackPosition), 'the older budget touches no track — the generation\'s own step is all that moved')
        .deep.eq(tracksBefore.map((t) => (t.active ? Math.min(t.position + GENERATION_STEP, MAX_COLONY_TRACK_POSITION) : t.position)));
      expect(allRecords(parliament).some((o) => o.player === undefined), 'and records no world part').is.false;
      // …and the three budgets remain three cards of one family: the same levy shape, different sums and counts.
      expect(INDUSTRIALIST_BUDGET.levy).deep.eq(INDUSTRIALIST_BUDGET_LEVY);
      expect(SCIENTISTS_BUDGET.levy).deep.eq(SCIENTISTS_BUDGET_LEVY);
      expect([INDUSTRIALIST_BUDGET_LEVY.amount, SCIENTISTS_BUDGET_LEVY.amount, UNITY_BUDGET_LEVY.amount]).deep.eq([10, 10, 12]);
      expect(INDUSTRIALIST_BUDGET_MEGACREDITS.count?.id).eq('steelTitaniumEnergyProduction');
      expect(SCIENTISTS_BUDGET_MEGACREDITS.count?.id).eq('scienceTags');
      expect(UNITY_BUDGET_MEGACREDITS.count?.id).eq('earthVenusJovianTags');
      expect(INDUSTRIALIST_BUDGET.trackAdvance ?? SCIENTISTS_BUDGET.trackAdvance, 'only this budget moves the table').is.undefined;
    });

    it('the generation passes on to the next sitting after this budget — the deck is not disturbed', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.slots).has.length(3);
      expect(parliament.slots.some((slot) => slot.instance === BUDGET), 'the enacted card left the area').is.false;
      passToParliament(game);
      expect(parliament.phase, 'a second sitting convenes').is.not.undefined;
    });
  });
});
