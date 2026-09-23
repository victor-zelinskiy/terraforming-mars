import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  GENEROUS_FUNDING, GENEROUS_FUNDING_CODE, GENEROUS_FUNDING_ID, GENEROUS_FUNDING_MEGACREDITS, GENEROUS_FUNDING_PER_UNIT, GENEROUS_FUNDING_QUEST_STEPS,
} from '../../src/server/parliament/resolutions/greens/GenerousFunding';
import {COLONIZATION_FUNDING_PRODUCTION} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {GAS_EXPORT_MEGACREDITS} from '../../src/server/parliament/resolutions/reds/GasExport';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {
  cardCountVerdict, countCardsToward, countMetricToward, resolutionCountKind, spaceCountVerdict, TERRAFORM_RATING_SETS_OVER, TERRAFORM_RATING_SETS_STEP,
  thresholdSets,
} from '../../src/common/parliament/resolutionCounts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {ParliamentPhase} from '../../src/server/parliament/ParliamentPhase';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * GENEROUS FUNDING (Turmoil Redux, RX13) — the FOURTH card of the «counter +
 * influence» family, and the first whose counter reads ONE PLAYER METRIC by
 * THRESHOLD and STEP: 2 × (S + I) for every participant, S the player's
 * complete sets of 5 TR over 15 as the engine's rating stands
 * (`⌊max(0, TR − 15) / 5⌋`), I the Redux influence after the winner's Agenda
 * step. No cap, no winner-only part.
 *
 * What these specs pin: the table TR → sets and the formula's examples
 * (influence pays on its own, the remainder pays nothing); the value is the
 * ENGINE's rating and the division is the family's ONE function — the card
 * restates nothing, the stand's reading is the same function; the breakdown
 * that explains the number is frozen in the record and agrees with the count;
 * a zero is a NAMED skip; a TR step of the Agenda taken in the phase counts
 * before the effect; a reload pays nothing twice; the chairman quest sees the
 * player's OWN raises and nothing else; MarsBot is never counted or paid; the
 * model carries the breakdown to the client.
 */
const FUNDING = resolutionInstanceId(GENEROUS_FUNDING_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Generous Funding in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, FUNDING);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

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

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === player.id && o.step === 'megacredits');
}

/** The breakdown the model / the record carries for a rating of `tr` — spelled out, so a spec reads like the rule. */
function breakdownOf(tr: number) {
  const sets = thresholdSets(tr, 15, 5);
  return {metric: 'terraformRating', value: tr, over: 15, step: 5, sets, toNext: 15 + (sets + 1) * 5 - tr};
}

describe('GenerousFunding', () => {
  describe('the catalog entry', () => {
    it('is RX13 of the Greens, dealt as ONE card in every game (no expansion needed), with the +3 TR quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(GENEROUS_FUNDING_ID)).eq(GENEROUS_FUNDING);
      expect(GENEROUS_FUNDING_CODE).eq('RX13');
      expect(GENEROUS_FUNDING_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX13')).eq(GENEROUS_FUNDING);
      expect(GENEROUS_FUNDING.party).eq(PartyName.GREENS);
      expect(GENEROUS_FUNDING.compatibility, 'a base card: a terraform rating needs no expansion').is.undefined;
      expect(GENEROUS_FUNDING.quest).deep.eq({goal: {kind: 'tr'}, count: 3});
      expect(GENEROUS_FUNDING_QUEST_STEPS).eq(3);
      expect(GENEROUS_FUNDING.scaled).deep.eq([GENEROUS_FUNDING_MEGACREDITS]);
      expect(GENEROUS_FUNDING.winnerSteps, 'no winner-only part').is.undefined;
      expect(GENEROUS_FUNDING.winnerReward, 'no winner tile either').is.undefined;
      expect(GENEROUS_FUNDING.worldSteps, 'no world part').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === FUNDING)).has.length(1);
    });

    it('declares the family\'s shape: a STOCK of M€ at ONE rate for both terms, a THRESHOLD count, and NO cap', () => {
      expect(GENEROUS_FUNDING_MEGACREDITS.unit).deep.eq({kind: 'stock', resource: Resource.MEGACREDITS});
      expect(GENEROUS_FUNDING_MEGACREDITS.unit).deep.eq(GAS_EXPORT_MEGACREDITS.unit);
      expect(GENEROUS_FUNDING_MEGACREDITS.perInfluence).eq(2);
      expect(GENEROUS_FUNDING_MEGACREDITS.count).deep.eq({id: 'terraformRatingSets', per: 2});
      expect(GENEROUS_FUNDING_MEGACREDITS.cap, 'the card prints no maximum — none is declared').is.undefined;
      expect(GENEROUS_FUNDING_MEGACREDITS.recipient).eq(COLONIZATION_FUNDING_PRODUCTION.recipient);
      expect(GENEROUS_FUNDING_PER_UNIT).eq(2);
      expect(resolutionCountKind('terraformRatingSets')).deep.eq({kind: 'threshold', metric: 'terraformRating', over: 15, step: 5});
      expect(TERRAFORM_RATING_SETS_OVER).eq(15);
      expect(TERRAFORM_RATING_SETS_STEP).eq(5);
      expect(familyOf(GENEROUS_FUNDING), 'the stand opens the metric-count family from the declaration alone').eq('counted-metric');
    });

    it('the face prints «2 [M€] / [influence] + [TR 5]» and «over 15»; the quest graphic is «+3 TR»', () => {
      const [row, footnote] = GENEROUS_FUNDING.renderData.rows;
      const items = row.filter(isICardRenderItem);
      expect(items.map((item) => item.type)).deep.eq([CardRenderItemType.MEGACREDITS, CardRenderItemType.INFLUENCE, CardRenderItemType.TR]);
      expect(items[0].amount).eq(2);
      expect(items[2].amount, 'the TR badge carries the SET\'s size').eq(TERRAFORM_RATING_SETS_STEP);
      const texts = footnote.filter(isICardRenderItem).filter((item) => item.type === CardRenderItemType.TEXT);
      expect(texts.map((text) => text.text)).deep.eq(['over 15']);
      expect(Number(texts[0].text?.split(' ')[1]), 'the printed threshold IS the rule\'s constant').eq(TERRAFORM_RATING_SETS_OVER);
      const [quest] = questRenderData(GENEROUS_FUNDING.quest).rows;
      const questItems = quest.filter(isICardRenderItem);
      expect(questItems.map((item) => item.type)).deep.eq([CardRenderItemType.TR]);
      expect(questItems[0].amount).eq(3);
    });
  });

  describe('the count — complete sets of 5 TR over 15, by the family\'s ONE function', () => {
    it('the table TR → sets: 14 → 0, 15 → 0, 19 → 0, 20 → 1, 24 → 1, 25 → 2, 30 → 3 — the remainder pays nothing', () => {
      const table: Array<[number, number]> = [[14, 0], [15, 0], [19, 0], [20, 1], [24, 1], [25, 2], [30, 3], [0, 0], [100, 17]];
      for (const [tr, sets] of table) {
        expect(thresholdSets(tr, 15, 5), `TR ${tr}`).eq(sets);
        expect(countMetricToward('terraformRatingSets', tr).count, `TR ${tr} through the count`).eq(sets);
      }
    });

    it('the formula: 2 × (sets + influence) — every example of the brief; influence pays on its own; no cap ever bites', () => {
      const cases: Array<[number, number, number]> = [
        [15, 0, 0], [15, 3, 6], [19, 3, 6], [20, 0, 2], [20, 1, 4], [24, 3, 8], [25, 3, 10], [30, 5, 16], [45, 5, 22],
      ];
      for (const [tr, influence, expected] of cases) {
        const sets = thresholdSets(tr, 15, 5);
        expect(scaledAmount(GENEROUS_FUNDING_MEGACREDITS, influence, sets), `TR ${tr} I=${influence}`).eq(expected);
        expect(uncappedAmount(GENEROUS_FUNDING_MEGACREDITS, influence, sets), 'no cap: the sum IS the amount').eq(expected);
      }
    });

    it('reads THE ENGINE\'s rating (never its parts) and explains it by a BREAKDOWN, not a list — value, threshold, step, sets, to the next set', () => {
      const [, p1] = reduxGame();
      p1.terraformRating = 24;
      const count = resolutionCount(p1, 'terraformRatingSets');
      expect(count).deep.eq({id: 'terraformRatingSets', count: 1, cards: [], metric: breakdownOf(24)});
      expect(count.metric).deep.eq({metric: 'terraformRating', value: 24, over: 15, step: 5, sets: 1, toNext: 1});
      expect(count.spaces, 'no cells on a metric count').is.undefined;
      expect(count.units, 'no per-card column').is.undefined;
      // The breakdown always agrees with the number, over the whole table.
      for (const tr of [0, 14, 15, 16, 19, 20, 24, 25, 29, 30, 41]) {
        p1.terraformRating = tr;
        const c = resolutionCount(p1, 'terraformRatingSets');
        expect(c.metric?.sets, `TR ${tr}`).eq(c.count);
        expect(c.metric?.value).eq(tr);
        expect(c.metric!.toNext, 'always at least one more point away from the next set').is.greaterThanOrEqual(1);
        expect(c.metric!.toNext).is.lessThanOrEqual(c.metric!.step + Math.max(0, 15 - tr));
        expect(thresholdSets(tr + c.metric!.toNext, 15, 5), 'that many points more IS the next set').eq(c.count + 1);
      }
      // A rating raised by cards is the same rating: the engine's number, wherever it came from.
      p1.terraformRating = 20;
      p1.terraformRatingFromCards = 5;
      expect(resolutionCount(p1, 'terraformRatingSets').count).eq(1);
    });

    it('the shared predicates: the STAND\'s metric reading is the same function; a card and a cell never count toward it', () => {
      expect(countMetricToward('terraformRatingSets', 30)).deep.eq({id: 'terraformRatingSets', count: 3, cards: [], metric: breakdownOf(30)});
      expect(countMetricToward('terraformRatingSets', 14)).deep.eq({id: 'terraformRatingSets', count: 0, cards: [], metric: breakdownOf(14)});
      expect(countMetricToward('terraformRatingSets', 14).metric?.toNext, '14 → 20 is six points').eq(6);
      // …and a non-threshold id through the metric reader counts nothing, honestly.
      expect(countMetricToward('spaceCities', 30)).deep.eq({id: 'spaceCities', count: 0, cards: []});
      const lake = new ArtificialLake();
      expect(cardCountVerdict('terraformRatingSets', lake, {eventTagsInPlay: false})).deep.eq({counts: false, reason: 'Counted by your terraform rating, not among cards'});
      expect(countCardsToward('terraformRatingSets', [lake], {eventTagsInPlay: false})).deep.eq({id: 'terraformRatingSets', count: 0, cards: []});
      expect(spaceCountVerdict('terraformRatingSets', {id: '01', spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}}))
        .deep.eq({counts: false, reason: 'Counted by your terraform rating, not on the board'});
    });
  });

  describe('the enactment', () => {
    it('pays EVERY participant 2 × (S + I) in CASH — voters or not — through the standard supply change, and freezes the breakdown', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner, one delegate: no party effect) — Agenda 4 → step 5 in the phase = influence 3 (an influence step: the rating stands); TR 24.
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 24;
      // p2 never voted — influence 2, TR 19: influence pays on its own.
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p2.terraformRating = 19;
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.enacted).eq(FUNDING);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      // The generation's production phase pays the rating in M€ before the sitting — the record's own
      // `before` / `after` frame the card's payout, and the supply ends where the record says.
      const one = outcomeOf(parliament, p1)!;
      const two = outcomeOf(parliament, p2)!;
      expect(one).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 8, count: 1, influence: 3});
      expect(one.after! - one.before!, '(1 set + I 3) × 2').eq(8);
      expect(p1.megaCredits).eq(one.after);
      expect(one.counted, 'no card is counted').deep.eq([]);
      expect(one.countedSpaces, 'no cell either').is.undefined;
      expect(one.countedMetric, 'the BREAKDOWN is').deep.eq(breakdownOf(24));
      expect(one.uncapped, 'no cap declared — no sum beside the amount').is.undefined;
      expect(two).deep.include({kind: 'stock', amount: 4, count: 0, influence: 2});
      expect(two.after! - two.before!, '(0 sets + I 2) × 2').eq(4);
      expect(p2.megaCredits).eq(two.after);
      expect(two.countedMetric).deep.eq(breakdownOf(19));
      // CASH, not production: the card's ONLY mutation is the supply change.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === GENEROUS_FUNDING_ID);
      expect(mine.filter((e) => e.type === 'resource-changed'), 'one supply change per seat').has.length(2);
      expect(mine.filter((e) => e.type === 'production-changed'), 'and not one step of production').has.length(0);
      expect(p1.production.megacredits).eq(0);
    });

    it('TR 15 and influence 3 is +6; TR 25 and influence 3 is +10; TR 30 and influence 5 is +16 — no maximum', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4); // → influence 3 after the winner's step
      p1.terraformRating = 15;
      parliament.agenda.set(p2.id, agendaForInfluence(5));
      p2.terraformRating = 30;
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'stock', amount: 6, count: 0, influence: 3});
      expect(outcomeOf(parliament, p1)?.countedMetric).deep.eq(breakdownOf(15));
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'stock', amount: 16, count: 3, influence: 5});
      expect(outcomeOf(parliament, p2)!.after! - outcomeOf(parliament, p2)!.before!).eq(16);
      expect(p2.megaCredits).eq(outcomeOf(parliament, p2)!.after);
      expect(scaledAmount(GENEROUS_FUNDING_MEGACREDITS, 3, thresholdSets(25, 15, 5))).eq(10);
    });

    it('a total of zero is NAMED — a skipped outcome carrying the breakdown, a journal line — and changes nothing', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 20;
      // p2: influence 0 and TR 19 — the remainder above 15 pays nothing.
      p2.terraformRating = 19;
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'skipped', amount: 0, count: 0, influence: 0, reason: 'No TR sets and no influence'});
      expect(outcomeOf(parliament, p2)?.countedMetric).deep.eq(breakdownOf(19));
      expect(game.events.events.filter((e) => e.type === 'resource-changed' && e.player === p2.color && e.source?.kind === 'resolution'),
        'not one M€ moved for p2 under the resolution').has.length(0);
      expect(game.gameLog.filter((entry) => entry.message.startsWith('${0} has no complete set of 5 TR over 15')), 'p2\'s zero is named').has.length(1);
      // …while p1's one set and influence 3 pay 8.
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'stock', amount: 8, count: 1, influence: 3});
    });

    it('the threshold is the CARD\'s 15, not the starting rating: a rating of 14 (below any start) is zero sets and named as such', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 14;
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'stock', amount: 6, count: 0, influence: 3});
      expect(outcomeOf(parliament, p1)?.countedMetric).deep.eq({metric: 'terraformRating', value: 14, over: 15, step: 5, sets: 0, toNext: 6});
    });

    it('a TR step of the Agenda taken in the phase raises the rating BEFORE the effect reads it: the winner at step 1 with TR 24 is paid for 25', () => {
      const [game, p1, , parliament] = stage();
      // Agenda 1 → step 2 is a TR step (influence stays 1): TR 24 → 25 → TWO sets.
      parliament.agenda.set(p1.id, 1);
      p1.terraformRating = 24;
      endGeneration(game);
      runAllActions(game);
      expect(p1.terraformRating).eq(25);
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'stock', amount: 6, count: 2, influence: 1});
      expect(outcomeOf(parliament, p1)?.countedMetric).deep.eq(breakdownOf(25));
      expect(parliament.lastPhase?.agenda).deep.include({player: p1.id, from: 1, to: 2, bonus: 'tr'});
    });

    it('a neutral winner cancels nothing: every participant is still paid, and nobody gets a winner-only part', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, FUNDING);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.terraformRating = 20;
      p2.terraformRating = 15;
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(FUNDING);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 2, count: 1, influence: 0});
      expect(outcomeOf(parliament, p2)).deep.include({amount: 2, count: 0, influence: 1});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part !== 'winner'), 'no winner part at all').is.true;
    });

    it('the journal carries ONE line per player with the whole calculation and the resolution as its source', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 24;
      p2.terraformRating = 19;
      endGeneration(game);
      runAllActions(game);
      const lines = game.gameLog.filter((entry) => entry.message.startsWith('${0} gained ${1} M€ from ${2}: ${3} set(s) of 5 TR over 15'));
      expect(lines).has.length(1);
      const data = lines[0].data;
      expect(data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(GENEROUS_FUNDING_ID);
      const record = outcomeOf(parliament, p1)!;
      expect(data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['8', '1', '24', '3', String(record.before), String(record.after)]);
      const gains = game.events.events.filter((e) => e.type === 'resource-changed' && e.player === p1.color &&
        e.source?.kind === 'resolution' && e.source.id === GENEROUS_FUNDING_ID);
      expect(gains).has.length(1);
      expect(gains[0].impact?.stock?.megacredits).eq(8);
    });
  });

  describe('once per enactment — the count is frozen in the record', () => {
    it('a later rating, a later influence and a change of government never recompute what was paid', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 24;
      endGeneration(game);
      runAllActions(game);
      const paid = p1.megaCredits;
      const outcome = outcomeOf(parliament, p1);
      expect(outcome).deep.include({amount: 8, count: 1, influence: 3});
      expect(outcome?.countedMetric).deep.eq(breakdownOf(24));
      // Ten more rating and more influence afterwards: nothing moves.
      p1.terraformRating = 34;
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.megaCredits).eq(paid);
      expect(outcomeOf(parliament, p1)).deep.eq(outcome);
      expect(resolutionCount(p1, 'terraformRatingSets').count, 'the live count moved — the record did not').eq(3);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.megaCredits).eq(paid);
    });

    it('a reload after the enactment pays nothing again; the recorded breakdown survives the save', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 25;
      endGeneration(game);
      runAllActions(game);
      const paid = p1.megaCredits;
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(one.megaCredits).eq(paid);
      settleParliamentGates(live);
      expect(live.parliament!.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'megacredits')).deep.eq(
        parliament.lastPhase?.outcomes?.filter((o) => o.player === p1.id && o.step === 'megacredits'));
      settleParliamentGates(live);
      expect(live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id)?.countedMetric).deep.eq(breakdownOf(25));
    });

    it('an enactment interrupted between two players resumes with the second only — the first is never paid twice (reload AND an in-memory re-entry)', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 20;
      p2.terraformRating = 20;
      const realAdd = p2.stock.add.bind(p2.stock);
      let failures = 0;
      p2.stock.add = (resource, amount, options) => {
        if (resource === Resource.MEGACREDITS && failures === 0) {
          failures++;
          throw new Error('interrupted');
        }
        realAdd(resource, amount, options);
      };
      expect(() => endGeneration(game)).to.throw('interrupted');
      expect(parliament.phase?.step).eq('effects');
      // The production phase paid each rating (20) in M€ first; the card's own payout comes on top.
      const income = 20;
      expect(p1.megaCredits, 'p1 was paid before the interruption: (1 + I 3) × 2').eq(20 + income + 8);
      const live = reload(game);
      runAllActions(live);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(one.megaCredits).eq(20 + income + 8);
      expect(two.megaCredits, 'p2: (1 + I 0) × 2').eq(20 + income + 2);
      settleParliamentGates(live);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id && o.step === 'megacredits')).has.length(1);
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'megacredits')).has.length(1);
      p2.stock.add = realAdd;
      ParliamentPhase.resume(game, parliament, (final: boolean) => (game as Game).continueAfterParliamentPhase(final));
      runAllActions(game);
      expect(p1.megaCredits, 'the re-entry skips the applied key').eq(20 + income + 8);
      expect(p2.megaCredits).eq(20 + income + 2);
    });
  });

  describe('the chairman quest — raise your TR 3 steps', () => {
    function enactFunding(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(GENEROUS_FUNDING_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tr'}, count: 3});
      return [game, p1, p2, parliament];
    }

    /** A rating raised by the player's OWN action (the engine's standard raise under an action scope). */
    function raiseAsAction(player: TestPlayer, steps: number): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.ASTEROID, owner: player.color}, {category: 'card-play'});
      try {
        player.increaseTerraformRating(steps);
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    it('the enactment and the Agenda step move no progress; the player\'s OWN raises complete it — +2 then +1; a high rating alone is nothing', () => {
      const [game, p1, p2, parliament] = enactFunding();
      expect(parliament.questProgressOf(p1), 'the phase\'s Agenda TR step is not the player\'s action').eq(0);
      p2.terraformRating = 40;
      expect(parliament.questProgressOf(p2), 'having a rating is not raising it').eq(0);
      raiseAsAction(p1, 2);
      expect(parliament.questProgressOf(p1)).eq(2);
      expect(parliament.quest?.completedBy).is.undefined;
      const agendaBefore = parliament.agendaOf(p1);
      raiseAsAction(p1, 1);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      // Once per generation: nobody else completes it.
      raiseAsAction(p2, 3);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never counted, never paid, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, FUNDING);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.terraformRating = 20;
      const cash = human.megaCredits;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player)).deep.eq([human.id]);
      const record = parliament.lastPhase?.outcomes?.[0];
      expect(record).deep.include({kind: 'stock', amount: 4, count: 1, influence: 1});
      expect(human.megaCredits, '(1 set + I 1) × 2 on top of the production phase\'s income').eq(cash + 20 + 4);
      expect(parliament.lastPhase?.outcomes?.[0]?.countedMetric?.value, 'the human\'s own rating, nobody else\'s').eq(20);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s count (number and BREAKDOWN) rides the model; the outcome reaches the client with the breakdown', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.terraformRating = 24;
      p2.terraformRating = 15;
      const model = getParliamentModel(game, p2);
      const counts = model?.players.find((p) => p.color === p1.color)?.counts;
      expect(counts?.find((c) => c.id === 'terraformRatingSets')).deep.eq({id: 'terraformRatingSets', count: 1, cards: [], metric: breakdownOf(24)});
      expect(counts?.map((c) => c.id)).includes('terraformRatingSets');
      expect(model?.players.find((p) => p.color === p2.color)?.counts?.find((c) => c.id === 'terraformRatingSets')).deep.eq(
        {id: 'terraformRatingSets', count: 0, cards: [], metric: breakdownOf(15)});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const mine = last?.outcomes?.find((o) => o.player === p1.color);
      expect(mine).deep.include({kind: 'stock', amount: 8, count: 1, influence: 3});
      expect(mine?.countedMetric).deep.eq(breakdownOf(24));
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(2);
    });
  });
});
