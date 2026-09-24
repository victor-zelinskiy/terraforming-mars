import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  INDUSTRIALIST_BUDGET, INDUSTRIALIST_BUDGET_CODE, INDUSTRIALIST_BUDGET_ID, INDUSTRIALIST_BUDGET_LEVY, INDUSTRIALIST_BUDGET_LEVY_AMOUNT,
  INDUSTRIALIST_BUDGET_MEGACREDITS, INDUSTRIALIST_BUDGET_PRODUCTION, INDUSTRIALIST_BUDGET_PRODUCTION_STEPS,
} from '../../src/server/parliament/resolutions/industrialists/IndustrialistBudget';
import {CENTRAL_POWER_GRID_PRODUCTION} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {GENEROUS_FUNDING_MEGACREDITS} from '../../src/server/parliament/resolutions/greens/GenerousFunding';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, passToParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {declaredCountIds, declaredLevyResources, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem, isICardRenderProductionBox} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {
  cardCountVerdict, countCardsToward, countMetricToward, countProductionToward, INDUSTRIAL_PRODUCTION_RESOURCES, resolutionCountKind, spaceCountVerdict,
} from '../../src/common/parliament/resolutionCounts';
import {
  LEVY_STEP_KEY, levyDeclared, levyEstimate, levyNetEffectOf, levyPaid, levyRecorded, levyShort, levyNothingReasonKey, levyShortReasonKey,
} from '../../src/common/parliament/resolutionLevy';
import {rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {ParliamentPhase} from '../../src/server/parliament/ParliamentPhase';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {Mine} from '../../src/server/cards/base/Mine';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * INDUSTRIALIST BUDGET (Turmoil Redux, RX15) — the first card of the BUDGET
 * family: every participant LOSES 10 M€ (the family's shared LEVY — the first
 * negative amount a resolution moves), then gains 1 M€ per step of steel +
 * titanium + energy production (the fifth count kind: PRODUCTION steps over a
 * list, explained resource by resource) + 1 per influence, then +4 M€
 * production flat. No cap, no winner part, no world part.
 *
 * What these specs pin: the printed order is the executed order (the records'
 * before/after chain proves it — never the final numbers alone); the levy is
 * bounded by the seat (4 M€ pays 4 of 10 and says so; 0 M€ pays nothing,
 * named — and both are still paid the rest); the count is the ENGINE's
 * production track, added up, never the supply and never cards, with the
 * breakdown frozen in the record; the flat part is the same for everybody;
 * a zero payout is a named skip while the levy is still taken; a reload pays
 * and takes nothing twice; MarsBot is never levied, paid or counted; the
 * model carries the count, the breakdown and the supply the levy reads.
 *
 * THE ORDER OF THE GENERATION (the owner's question, pinned as three
 * statements against `Game.ts`): `gotoProductionPhase` (l. 1088, every seat's
 * `runProductionPhase`) → `postProductionPhase` (l. 1103) → the colonies →
 * `ParliamentPhase.start` (l. 1160). So (1) the levy is taken from a supply
 * that ALREADY holds this generation's income; (2) the +4 M€ production first
 * PAYS in the next generation; (3) the count does not depend on the moment —
 * the production phase moves stocks (energy → heat), never production.
 */
const BUDGET = resolutionInstanceId(INDUSTRIALIST_BUDGET_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the budget in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, BUDGET);
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

/** The seat's PRODUCTION track, set through the engine (the count reads the track, never a field). */
function produce(player: TestPlayer, steel: number, titanium: number, energy: number): void {
  player.production.add(Resource.STEEL, steel);
  player.production.add(Resource.TITANIUM, titanium);
  player.production.add(Resource.ENERGY, energy);
}

function recordsOf(parliament: Parliament, player: TestPlayer) {
  return (parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === player.id);
}

function outcomeOf(parliament: Parliament, player: TestPlayer, step: string) {
  return recordsOf(parliament, player).find((o) => o.step === step);
}

/** The breakdown the record carries for a track of steel / titanium / energy. */
function breakdownOf(steel: number, titanium: number, energy: number) {
  return [{resource: Resource.STEEL, count: steel}, {resource: Resource.TITANIUM, count: titanium}, {resource: Resource.ENERGY, count: energy}];
}

/** The generation's income at the production phase — what the levy is taken FROM (TR + M€ production). */
function incomeOf(player: TestPlayer): number {
  return player.terraformRating + player.production.megacredits;
}

describe('IndustrialistBudget', () => {
  describe('the catalog entry', () => {
    it('is RX15 of the Industrialists, dealt as ONE card in every game (no expansion needed), with the +1 steel production quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(INDUSTRIALIST_BUDGET_ID)).eq(INDUSTRIALIST_BUDGET);
      expect(INDUSTRIALIST_BUDGET_CODE).eq('RX15');
      expect(INDUSTRIALIST_BUDGET_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX15')).eq(INDUSTRIALIST_BUDGET);
      expect(INDUSTRIALIST_BUDGET.party).eq(PartyName.INDUSTRIALISTS);
      expect(INDUSTRIALIST_BUDGET.compatibility, 'a base card').is.undefined;
      expect(INDUSTRIALIST_BUDGET.quest).deep.eq({goal: {kind: 'production', resource: Resource.STEEL}, count: 1});
      expect(INDUSTRIALIST_BUDGET.winnerSteps, 'no winner-only part').is.undefined;
      expect(INDUSTRIALIST_BUDGET.winnerReward, 'no winner tile either').is.undefined;
      expect(INDUSTRIALIST_BUDGET.worldSteps, 'no world part').is.undefined;
      expect(INDUSTRIALIST_BUDGET.passive, 'no passive').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === BUDGET)).has.length(1);
    });

    it('declares the BUDGET family\'s shape: a LEVY of 10 M€ to everybody, a payout by PRODUCTION STEPS + influence (no cap), a FLAT +4 M€ production', () => {
      expect(INDUSTRIALIST_BUDGET.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
      expect(INDUSTRIALIST_BUDGET_LEVY_AMOUNT).eq(10);
      expect(levyDeclared(INDUSTRIALIST_BUDGET.levy)).is.true;
      expect(INDUSTRIALIST_BUDGET.scaled).deep.eq([INDUSTRIALIST_BUDGET_MEGACREDITS, INDUSTRIALIST_BUDGET_PRODUCTION]);
      expect(INDUSTRIALIST_BUDGET_MEGACREDITS.unit).deep.eq(GENEROUS_FUNDING_MEGACREDITS.unit);
      expect(INDUSTRIALIST_BUDGET_MEGACREDITS.perInfluence).eq(1);
      expect(INDUSTRIALIST_BUDGET_MEGACREDITS.count).deep.eq({id: 'steelTitaniumEnergyProduction', per: 1});
      expect(INDUSTRIALIST_BUDGET_MEGACREDITS.cap, 'the card prints no maximum — none is declared').is.undefined;
      expect(INDUSTRIALIST_BUDGET_PRODUCTION.unit).deep.eq(CENTRAL_POWER_GRID_PRODUCTION.unit);
      expect(INDUSTRIALIST_BUDGET_PRODUCTION).deep.include({base: 4, perInfluence: 0, recipient: 'each'});
      expect(INDUSTRIALIST_BUDGET_PRODUCTION.count, 'the flat part counts nothing').is.undefined;
      expect(INDUSTRIALIST_BUDGET_PRODUCTION_STEPS).eq(4);
      expect(resolutionCountKind('steelTitaniumEnergyProduction')).deep.eq({kind: 'production', resources: [Resource.STEEL, Resource.TITANIUM, Resource.ENERGY]});
      expect(INDUSTRIAL_PRODUCTION_RESOURCES).deep.eq([Resource.STEEL, Resource.TITANIUM, Resource.ENERGY]);
      // The net the panel prints stands on the M€ payout — the part in the levy's own currency, never the production.
      expect(levyNetEffectOf(INDUSTRIALIST_BUDGET_LEVY, INDUSTRIALIST_BUDGET.scaled)).eq(INDUSTRIALIST_BUDGET_MEGACREDITS);
      // THE PRINTED ORDER: the levy step FIRST, the payout, the flat part.
      expect(INDUSTRIALIST_BUDGET.immediateSteps?.map((step) => step.key)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'production']);
      expect(familyOf(INDUSTRIALIST_BUDGET), 'the stand opens the production-count family from the declaration alone').eq('counted-production');
      // The catalog's models: the count id and the levied supply are declared by this card.
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('steelTitaniumEnergyProduction');
      expect(declaredLevyResources(REDUX_RESOLUTION_CATALOG)).deep.eq([Resource.MEGACREDITS]);
    });

    it('the face prints «−10 [M€] · [4 M€ production]» and «1 [M€] / [steel + titanium + energy production] + [influence]»; the quest graphic is «+1 steel production»', () => {
      const [head, rate] = INDUSTRIALIST_BUDGET.renderData.rows;
      const headItems = head.filter(isICardRenderItem);
      expect(headItems.map((item) => item.type)).deep.eq([CardRenderItemType.MEGACREDITS]);
      expect(headItems[0].amount, 'the negative is printed INSIDE the tile, as on the card').eq(-10);
      expect(headItems[0].amountInside).is.true;
      const flat = head.find(isICardRenderProductionBox);
      expect(flat, 'the flat part is a production box').is.not.undefined;
      const flatItems = flat!.rows[0].filter(isICardRenderItem);
      expect(flatItems.map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.MEGACREDITS, 4]]);
      const rateItems = rate.filter(isICardRenderItem);
      expect(rateItems.map((item) => item.type)).deep.eq([CardRenderItemType.MEGACREDITS, CardRenderItemType.INFLUENCE]);
      expect(rateItems[0].amount).eq(1);
      const box = rate.find(isICardRenderProductionBox);
      expect(box, 'the counted object is the production box').is.not.undefined;
      const inBox = box!.rows[0].filter(isICardRenderItem);
      expect(inBox.map((item) => item.type)).deep.eq([CardRenderItemType.STEEL, CardRenderItemType.TITANIUM, CardRenderItemType.ENERGY]);
      const [quest] = questRenderData(INDUSTRIALIST_BUDGET.quest).rows;
      const questBox = quest.find(isICardRenderProductionBox);
      expect(questBox!.rows[0].filter(isICardRenderItem).map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.STEEL, 1]]);
    });
  });

  describe('the levy — the family\'s ONE arithmetic', () => {
    it('takes the whole sum from a seat that holds it, what the seat holds from a short one, nothing from an empty one — never below zero', () => {
      const levy = INDUSTRIALIST_BUDGET_LEVY;
      expect(levyPaid(levy, 34)).eq(10);
      expect(levyPaid(levy, 10)).eq(10);
      expect(levyPaid(levy, 4)).eq(4);
      expect(levyPaid(levy, 0)).eq(0);
      expect(levyShort(levy, 34)).is.false;
      expect(levyShort(levy, 10)).is.false;
      expect(levyShort(levy, 9)).is.true;
      expect(levyShort(levy, 0)).is.true;
      expect(levyNothingReasonKey(Resource.MEGACREDITS)).eq('No M€ to pay the levy');
      expect(levyShortReasonKey(Resource.MEGACREDITS)).eq('Not enough M€: the rest of the levy is not taken');
    });

    it('the estimate nets the payout in the same currency: 34 M€ held, +7 paid → −10 → +7 = −3; a short seat names it; a recorded levy reads what was taken', () => {
      const levy = INDUSTRIALIST_BUDGET_LEVY;
      expect(levyEstimate(levy, 34, {effectId: 'megacredits', amount: 7})).deep.eq(
        {resource: Resource.MEGACREDITS, context: 'estimate', owed: 10, paid: 10, short: false, held: 34, payout: {effectId: 'megacredits', amount: 7}, net: -3});
      expect(levyEstimate(levy, 4, {effectId: 'megacredits', amount: 7})).deep.include({paid: 4, short: true, net: 3, note: 'Not enough M€: the rest of the levy is not taken'});
      expect(levyEstimate(levy, 0)).deep.include({paid: 0, short: true, note: 'No M€ to pay the levy'});
      expect(levyEstimate(levy, 0).net, 'no payout known — no net').is.undefined;
      expect(levyRecorded(levy, {kind: 'stock', amount: -10, owed: 10}, 'applied', {effectId: 'megacredits', amount: 9})).deep.eq(
        {resource: Resource.MEGACREDITS, context: 'applied', owed: 10, paid: 10, short: false, payout: {effectId: 'megacredits', amount: 9}, net: -1});
      expect(levyRecorded(levy, {kind: 'stock', amount: -4, owed: 10, reason: 'Not enough M€: the rest of the levy is not taken'}, 'resolving')).deep.include(
        {paid: 4, owed: 10, short: true, note: 'Not enough M€: the rest of the levy is not taken'});
      expect(levyRecorded(levy, {kind: 'skipped', amount: 0, owed: 10, reason: 'No M€ to pay the levy'}, 'applied')).deep.include({paid: 0, owed: 10, short: true});
      // An older record without `owed` reads the declaration's sum.
      expect(levyRecorded(levy, {kind: 'stock', amount: -10}, 'applied').owed).eq(10);
    });
  });

  describe('the count — production steps of steel + titanium + energy, by the family\'s ONE reader', () => {
    it('reads THE ENGINE\'s production track (never the supply, never cards) and explains it resource by resource, zeros included', () => {
      const [, p1] = reduxGame();
      produce(p1, 2, 1, 3);
      p1.steel = 40;
      p1.energy = 9;
      const count = resolutionCount(p1, 'steelTitaniumEnergyProduction');
      expect(count).deep.eq({id: 'steelTitaniumEnergyProduction', count: 6, cards: [], byResource: breakdownOf(2, 1, 3)});
      expect(count.spaces, 'no cells').is.undefined;
      expect(count.units, 'no per-card column').is.undefined;
      expect(count.metric, 'no threshold breakdown').is.undefined;
      // The breakdown always agrees with the number.
      expect(count.byResource!.reduce((sum, entry) => sum + entry.count, 0)).eq(count.count);
      // Zero steps are listed, not dropped: the reading prints every term of the face.
      const [, p] = reduxGame();
      produce(p, 0, 0, 2);
      expect(resolutionCount(p, 'steelTitaniumEnergyProduction')).deep.eq({id: 'steelTitaniumEnergyProduction', count: 2, cards: [], byResource: breakdownOf(0, 0, 2)});
      // A card that raised the production is not what is counted — the steps are (Mine: +1 steel production, no tag of its own).
      const [, q] = reduxGame();
      q.playedCards.push(new Mine());
      expect(resolutionCount(q, 'steelTitaniumEnergyProduction').count, 'a card in play raises nothing by itself').eq(0);
    });

    it('the shared predicates: the STAND\'s reading is the same function; a card and a cell never count; the engine keeps these three productions at 0 or above', () => {
      expect(countProductionToward('steelTitaniumEnergyProduction', {[Resource.STEEL]: 2, [Resource.TITANIUM]: 1, [Resource.ENERGY]: 3}))
        .deep.eq({id: 'steelTitaniumEnergyProduction', count: 6, cards: [], byResource: breakdownOf(2, 1, 3)});
      expect(countProductionToward('steelTitaniumEnergyProduction', {[Resource.STEEL]: 4, [Resource.PLANTS]: 9, [Resource.MEGACREDITS]: 7}), 'only the listed resources')
        .deep.eq({id: 'steelTitaniumEnergyProduction', count: 4, cards: [], byResource: breakdownOf(4, 0, 0)});
      expect(countProductionToward('steelTitaniumEnergyProduction', {})).deep.eq({id: 'steelTitaniumEnergyProduction', count: 0, cards: [], byResource: breakdownOf(0, 0, 0)});
      // …and a non-production id through the production reader counts nothing, honestly.
      expect(countProductionToward('powerTags', {[Resource.ENERGY]: 3})).deep.eq({id: 'powerTags', count: 0, cards: []});
      expect(countMetricToward('steelTitaniumEnergyProduction', 30)).deep.eq({id: 'steelTitaniumEnergyProduction', count: 0, cards: []});
      const mine = new Mine();
      expect(cardCountVerdict('steelTitaniumEnergyProduction', mine, {eventTagsInPlay: false})).deep.eq({counts: false, reason: 'Counted by your production, not among cards'});
      expect(countCardsToward('steelTitaniumEnergyProduction', [mine], {eventTagsInPlay: false})).deep.eq({id: 'steelTitaniumEnergyProduction', count: 0, cards: []});
      expect(spaceCountVerdict('steelTitaniumEnergyProduction', {id: '01', spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}}))
        .deep.eq({counts: false, reason: 'Counted by your production, not on the board'});
      // NO FLOOR OF THE COUNT'S OWN — the engine's: a decrease below zero of steel, titanium or energy production stops at zero.
      const [, p1] = reduxGame();
      produce(p1, 1, 0, 2);
      p1.production.add(Resource.STEEL, -3);
      p1.production.add(Resource.TITANIUM, -2);
      p1.production.add(Resource.ENERGY, -5);
      expect([p1.production.steel, p1.production.titanium, p1.production.energy]).deep.eq([0, 0, 0]);
      expect(resolutionCount(p1, 'steelTitaniumEnergyProduction').count).eq(0);
    });

    it('the formula: count + influence, no cap; the flat part is 4 whatever the influence', () => {
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 3, 3], [6, 0, 6], [6, 3, 9], [12, 5, 17]];
      for (const [count, influence, expected] of cases) {
        expect(scaledAmount(INDUSTRIALIST_BUDGET_MEGACREDITS, influence, count), `count ${count} I=${influence}`).eq(expected);
        expect(uncappedAmount(INDUSTRIALIST_BUDGET_MEGACREDITS, influence, count)).eq(expected);
      }
      for (const influence of [0, 1, 3, 5]) {
        expect(scaledAmount(INDUSTRIALIST_BUDGET_PRODUCTION, influence), `flat at I=${influence}`).eq(4);
      }
    });
  });

  describe('the enactment — the printed order, for every participant', () => {
    it('levy → payout → production, in that order, for EVERY participant (voters or not): the records\' before/after chain proves it', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3; steel 2, titanium 1, energy 3 = 6 → +9.
      parliament.agenda.set(p1.id, 4);
      produce(p1, 2, 1, 3);
      // p2 never voted — influence 1, no production: influence pays on its own.
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      const income1 = incomeOf(p1);
      const income2 = incomeOf(p2);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.enacted).eq(BUDGET);
      expect(parliament.rulingParty()).eq(PartyName.INDUSTRIALISTS);
      // THE ORDER, by the record list and by the chain of supplies.
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'production']);
      expect(recordsOf(parliament, p2).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'production']);
      const levy1 = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      const prod1 = outcomeOf(parliament, p1, 'production')!;
      expect(levy1).deep.eq({player: p1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'stock', stock: Resource.MEGACREDITS, amount: -10, owed: 10, before: 20 + income1, after: 10 + income1});
      expect(paid1).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 9, count: 6, influence: 3, before: levy1.after, after: levy1.after! + 9});
      expect(paid1.counted, 'no card is counted').deep.eq([]);
      expect(paid1.countedByResource, 'the BREAKDOWN is frozen in the record').deep.eq(breakdownOf(2, 1, 3));
      expect(paid1.uncapped, 'no cap declared — no sum beside the amount').is.undefined;
      expect(prod1).deep.eq({player: p1.id, step: 'production', part: 'effect', kind: 'production', effect: 'production', production: Resource.MEGACREDITS, influence: 3, amount: 4, before: 0, after: 4});
      expect(p1.megaCredits).eq(paid1.after);
      expect(p1.production.megacredits).eq(4);
      const levy2 = outcomeOf(parliament, p2, LEVY_STEP_KEY)!;
      const paid2 = outcomeOf(parliament, p2, 'megacredits')!;
      expect(levy2).deep.include({kind: 'stock', amount: -10, owed: 10, before: 20 + income2, after: 10 + income2});
      expect(paid2).deep.include({kind: 'stock', amount: 1, count: 0, influence: 1, before: levy2.after, after: levy2.after! + 1});
      expect(paid2.countedByResource).deep.eq(breakdownOf(0, 0, 0));
      expect(outcomeOf(parliament, p2, 'production')).deep.include({kind: 'production', amount: 4, before: 0, after: 4});
      expect(p2.megaCredits).eq(paid2.after);
      // The events say the same order under the resolution's source: −10, +9, then the production step.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === INDUSTRIALIST_BUDGET_ID && e.player === p1.color &&
        e.type !== 'action');
      expect(mine.map((e) => e.type)).deep.eq(['resource-changed', 'resource-changed', 'production-changed']);
      expect(mine[0].impact?.stock?.megacredits).eq(-10);
      expect(mine[1].impact?.stock?.megacredits).eq(9);
      expect(mine[2].impact?.production?.megacredits).eq(4);
      // The reward address reads the levy as a LOSS, never as a skip.
      const delivery = rewardAddressOf({...levy1, player: p1.color}, p1.color);
      expect(delivery.direction).eq('loss');
      expect(delivery.skipped).is.undefined;
    });

    it('a SHORT seat pays what it holds and says so: 4 M€ → 4 of 10 taken, the reason on the paying record — and the payout and the production still come', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 1, 0, 1);
      // Nothing in the supply and a rating of 4: the production phase pays 4, and that is all the seat holds at the sitting.
      p1.megaCredits = 0;
      p1.terraformRating = 4;
      endGeneration(game);
      runAllActions(game);
      const levy = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      expect(levy).deep.include({kind: 'stock', stock: Resource.MEGACREDITS, amount: -4, owed: 10, before: 4, after: 0, reason: 'Not enough M€: the rest of the levy is not taken'});
      const paid = outcomeOf(parliament, p1, 'megacredits')!;
      expect(paid).deep.include({kind: 'stock', amount: 5, count: 2, influence: 3, before: 0, after: 5});
      expect(outcomeOf(parliament, p1, 'production')).deep.include({kind: 'production', amount: 4});
      expect(p1.megaCredits, 'never below zero on the way').eq(5);
      expect(game.gameLog.filter((entry) => entry.message.startsWith('${0} pays only ${1} of the ${2} ${3} owed')), 'the shortfall is named').has.length(1);
      // Neither an illegal-state line nor a skip: the take carried its source and was bounded by the supply.
      expect(game.gameLog.filter((entry) => entry.message.includes('Adjusting'))).deep.eq([]);
      expect(rewardAddressOf({...levy, player: p1.color}, p1.color).skipped).is.undefined;
    });

    it('a seat with 0 M€ pays nothing — a NAMED skip carrying the owed sum — and is still paid the rest; the card asks no solvency', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 0, 2, 0);
      p1.megaCredits = 0;
      p1.terraformRating = 0;
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.eq(
        {player: p1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 10, reason: 'No M€ to pay the levy'});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 5, count: 2, influence: 3, before: 0, after: 5});
      expect(outcomeOf(parliament, p1, 'production')).deep.include({kind: 'production', amount: 4});
      expect(p1.megaCredits).eq(5);
      expect(game.events.events.filter((e) => e.type === 'resource-changed' && e.player === p1.color && e.source?.kind === 'resolution' && (e.impact?.stock?.megacredits ?? 0) < 0),
        'not one M€ left the seat under the resolution').has.length(0);
      expect(game.gameLog.filter((entry) => entry.message.startsWith('${0} has no ${1} — ${2} takes nothing')), 'the empty supply is named').has.length(1);
    });

    it('a payout of zero (no production, no influence) is NAMED with its breakdown; the levy is still taken and the production still comes', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 1, 1, 1);
      // p2: influence 0, no production at all.
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include(
        {kind: 'skipped', amount: 0, count: 0, influence: 0, reason: 'No steel, titanium or energy production and no influence'});
      expect(outcomeOf(parliament, p2, 'megacredits')?.countedByResource).deep.eq(breakdownOf(0, 0, 0));
      expect(outcomeOf(parliament, p2, 'production')).deep.include({kind: 'production', amount: 4, before: 0, after: 4});
      expect(game.gameLog.filter((entry) => entry.message.startsWith('${0} has no steel, titanium or energy production')), 'p2\'s zero is named').has.length(1);
      // …while p1's three steps and influence 3 pay 6.
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 6, count: 3, influence: 3});
    });

    it('a neutral winner cancels nothing: every participant is levied, paid and raised', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, BUDGET);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.megaCredits = 20;
      p2.megaCredits = 20;
      produce(p1, 3, 0, 0);
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(BUDGET);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({amount: -10, owed: 10});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({amount: 3, count: 3, influence: 0});
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({amount: -10, owed: 10});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({amount: 2, count: 0, influence: 2});
      expect(p1.production.megacredits).eq(4);
      expect(p2.production.megacredits).eq(4);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part === 'effect'), 'no winner part, no world part').is.true;
    });

    it('the journal carries the three lines per player with the resolution as their source: the levy with both sums, the payout with its inputs, the production', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 2, 1, 3);
      endGeneration(game);
      runAllActions(game);
      const levyLines = game.gameLog.filter((entry) => entry.message === '${0} pays ${1} ${2} to ${3} (${4} → ${5})');
      expect(levyLines, 'one levy line per seat').has.length(2);
      const levy = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const mine = levyLines.find((entry) => entry.data[0].value === p1.color)!;
      expect(mine.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(INDUSTRIALIST_BUDGET_ID);
      expect(mine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['10', String(levy.before), String(levy.after)]);
      const payLines = game.gameLog.filter((entry) => entry.message.startsWith('${0} gained ${1} M€ from ${2}: ${3} step(s) of steel, titanium and energy production'));
      expect(payLines.find((entry) => entry.data[0].value === p1.color)!.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value))
        .deep.eq(['9', '6', '3', String(levy.after), String(levy.after! + 9)]);
      expect(game.gameLog.filter((entry) => entry.message === '${0} gained ${1} ${2} production from ${3} (${4} → ${5})'), 'one production line per seat').has.length(2);
    });
  });

  describe('the order of the generation — the sitting runs AFTER the production phase', () => {
    it('(1) the levy is taken from a supply that ALREADY holds this generation\'s income: 0 M€ and TR 20 before the phase → the record reads 20 → 10', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.megaCredits = 0;
      p1.terraformRating = 20;
      expect(p1.production.megacredits).eq(0);
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({amount: -10, before: 20, after: 10});
    });

    it('(2) the +4 M€ production first PAYS in the NEXT generation: this generation\'s production phase has already run when the sitting raises it', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.megaCredits = 0;
      p1.terraformRating = 20;
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      // This generation: income 20 (no M€ production yet), −10, +3 (influence 3, no track) — and not one M€ of the +4.
      expect(p1.production.megacredits).eq(4);
      expect(p1.megaCredits).eq(20 - 10 + 3);
      // The next production phase pays TR + the 4 steps the law raised.
      const before = p1.megaCredits;
      p1.runProductionPhase();
      runAllActions(game);
      expect(p1.megaCredits - before).eq(p1.terraformRating + 4);
    });

    it('(3) the count does NOT depend on the moment: the production phase moves stocks (energy → heat), never production — the count before the phase is the count recorded', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 1, 0, 2);
      p1.energy = 5;
      p1.heat = 0;
      const beforePhase = resolutionCount(p1, 'steelTitaniumEnergyProduction');
      expect(beforePhase.count).eq(3);
      endGeneration(game);
      runAllActions(game);
      // The 5 energy in stock became heat; the 2 energy now in stock is the phase's own production income.
      expect(p1.heat, 'the stock moved').eq(5);
      expect(p1.energy).eq(2);
      expect([p1.production.steel, p1.production.titanium, p1.production.energy], 'the track did not').deep.eq([1, 0, 2]);
      const recorded = outcomeOf(parliament, p1, 'megacredits')!;
      expect(recorded.count).eq(beforePhase.count);
      expect(recorded.countedByResource).deep.eq(beforePhase.byResource);
    });
  });

  describe('once per enactment — nothing is taken or paid twice', () => {
    it('a later production, a later influence and a change of government never recompute what was taken or paid', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 2, 1, 3);
      endGeneration(game);
      runAllActions(game);
      const cash = p1.megaCredits;
      const records = recordsOf(parliament, p1);
      produce(p1, 5, 5, 5);
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.megaCredits).eq(cash);
      expect(recordsOf(parliament, p1)).deep.eq(records);
      expect(resolutionCount(p1, 'steelTitaniumEnergyProduction').count, 'the live count moved — the record did not').eq(21);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.megaCredits).eq(cash);
      expect(p1.production.megacredits).eq(4);
    });

    it('a reload after the enactment takes and pays nothing again; the records survive the save with their breakdown and owed sum', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 2, 1, 3);
      endGeneration(game);
      runAllActions(game);
      const cash = p1.megaCredits;
      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(one.megaCredits).eq(cash);
      settleParliamentGates(live);
      expect(live.parliament!.lastPhase?.outcomes?.filter((o) => o.player === p1.id)).deep.eq(parliament.lastPhase?.outcomes?.filter((o) => o.player === p1.id));
      settleParliamentGates(live);
      expect(live.getPlayerById(p1.id).megaCredits).eq(cash);
      expect(live.getPlayerById(p1.id).production.megacredits).eq(4);
      const levy = live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id && o.step === LEVY_STEP_KEY);
      expect(levy).deep.include({amount: -10, owed: 10});
      expect(live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id && o.step === 'megacredits')?.countedByResource).deep.eq(breakdownOf(2, 1, 3));
    });

    it('an enactment interrupted between a seat\'s levy and its payout resumes with the payout only — the levy is never taken twice (reload AND an in-memory re-entry)', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 1, 1, 1);
      produce(p2, 1, 0, 0);
      const income = 20;
      const realAdd = p2.stock.add.bind(p2.stock);
      let failures = 0;
      p2.stock.add = (resource, amount, options) => {
        // The levy (negative) passes; the PAYOUT (positive) is what breaks — once.
        if (resource === Resource.MEGACREDITS && amount > 0 && failures === 0) {
          failures++;
          throw new Error('interrupted');
        }
        realAdd(resource, amount, options);
      };
      expect(() => endGeneration(game)).to.throw('interrupted');
      expect(parliament.phase?.step).eq('effects');
      expect(p1.megaCredits, 'p1 went through: 20 + income − 10 + (3 + I 3)').eq(20 + income - 10 + 6);
      expect(p2.megaCredits, 'p2\'s levy was taken before the interruption').eq(20 + income - 10);
      const live = reload(game);
      runAllActions(live);
      const one = live.getPlayerById(p1.id);
      const two = live.getPlayerById(p2.id);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      expect(one.megaCredits).eq(20 + income - 10 + 6);
      expect(two.megaCredits, 'p2: the levy ONCE, then (1 + I 0)').eq(20 + income - 10 + 1);
      expect(one.production.megacredits).eq(4);
      expect(two.production.megacredits).eq(4);
      settleParliamentGates(live);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p2.id && o.step === LEVY_STEP_KEY)).has.length(1);
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'megacredits')).has.length(1);
      expect(outcomes.filter((o) => o.player === p2.id && o.step === 'production')).has.length(1);
      p2.stock.add = realAdd;
      ParliamentPhase.resume(game, parliament, (final: boolean) => (game as Game).continueAfterParliamentPhase(final));
      runAllActions(game);
      expect(p1.megaCredits, 'the re-entry skips every applied key').eq(20 + income - 10 + 6);
      expect(p2.megaCredits).eq(20 + income - 10 + 1);
      expect(p2.production.megacredits).eq(4);
    });
  });

  describe('the chairman quest — raise your steel production 1 step', () => {
    function enactBudget(): [IGame, TestPlayer, TestPlayer, Parliament] {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(INDUSTRIALIST_BUDGET_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'production', resource: Resource.STEEL}, count: 1});
      return [game, p1, p2, parliament];
    }

    /** A production raised by the player's OWN action (the engine's standard raise under an action scope). */
    function raiseAsAction(player: TestPlayer, resource: Resource, steps: number): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.MINE, owner: player.color}, {category: 'card-play'});
      try {
        player.production.add(resource, steps, {log: false});
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    it('the enactment\'s own M€ production moves no progress; the player\'s OWN steel step completes it — titanium does not', () => {
      const [game, p1, p2, parliament] = enactBudget();
      expect(parliament.questProgressOf(p1), 'the law\'s +4 M€ production is not steel and not the player\'s action').eq(0);
      raiseAsAction(p1, Resource.TITANIUM, 2);
      expect(parliament.questProgressOf(p1), 'titanium is not steel').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      raiseAsAction(p1, Resource.STEEL, 1);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      // Once per generation: nobody else completes it.
      raiseAsAction(p2, Resource.STEEL, 1);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never levied, never paid, never counted, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BUDGET);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.production.add(Resource.STEEL, 2);
      const cash = human.megaCredits;
      const income = incomeOf(human);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player)).deep.eq([human.id, human.id, human.id]);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'production']);
      expect(parliament.lastPhase?.outcomes?.[0]).deep.include({kind: 'stock', amount: -10, owed: 10});
      expect(parliament.lastPhase?.outcomes?.[1]).deep.include({kind: 'stock', amount: 3, count: 2, influence: 1});
      expect(human.megaCredits, '−10 and (2 + I 1) on top of the production phase\'s income').eq(cash + income - 10 + 3);
      expect(human.production.megacredits).eq(4);
      expect(bot.megaCredits, 'the bot\'s supply is untouched').eq(bot.megaCredits);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.stock, 'no levied supply for it either').is.undefined;
    });

    it('every seat\'s count (number and BREAKDOWN) and the SUPPLY the levy reads ride the model; the records reach the client with `owed` and the breakdown', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      produce(p1, 2, 1, 3);
      p1.megaCredits = 34;
      p2.megaCredits = 4;
      const model = getParliamentModel(game, p2);
      const one = model?.players.find((p) => p.color === p1.color);
      expect(one?.counts?.find((c) => c.id === 'steelTitaniumEnergyProduction')).deep.eq({id: 'steelTitaniumEnergyProduction', count: 6, cards: [], byResource: breakdownOf(2, 1, 3)});
      expect(one?.stock).deep.eq({[Resource.MEGACREDITS]: 34});
      const two = model?.players.find((p) => p.color === p2.color);
      expect(two?.counts?.find((c) => c.id === 'steelTitaniumEnergyProduction')).deep.eq({id: 'steelTitaniumEnergyProduction', count: 0, cards: [], byResource: breakdownOf(0, 0, 0)});
      expect(two?.stock).deep.eq({[Resource.MEGACREDITS]: 4});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const levy = last?.outcomes?.find((o) => o.player === p1.color && o.step === LEVY_STEP_KEY);
      expect(levy).deep.include({kind: 'stock', amount: -10, owed: 10});
      const paid = last?.outcomes?.find((o) => o.player === p1.color && o.step === 'megacredits');
      expect(paid).deep.include({kind: 'stock', amount: 9, count: 6, influence: 3});
      expect(paid?.countedByResource).deep.eq(breakdownOf(2, 1, 3));
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes).has.length(6);
    });
  });

  describe('the family\'s other members stand', () => {
    it('the earlier count kinds read as before beside the new one (cards, tags, board, threshold)', () => {
      expect(resolutionCountKind('buildingCardsWithNonNegativeVp')).deep.eq({kind: 'cards'});
      expect(resolutionCountKind('powerTags')).deep.eq({kind: 'tags', tags: ['power' as never]});
      expect(resolutionCountKind('spaceCities')).deep.eq({kind: 'board', tiles: 'spaceCity'});
      expect(resolutionCountKind('terraformRatingSets').kind).eq('threshold');
      const [, p1] = reduxGame();
      p1.terraformRating = 24;
      expect(resolutionCount(p1, 'terraformRatingSets').count).eq(1);
      expect(resolutionCount(p1, 'powerTags').count).eq(0);
      expect(resolutionCount(p1, 'spaceCities').count).eq(0);
    });

    it('the generation passes on to the next sitting after a budget — the deck is not disturbed', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.slots).has.length(3);
      expect(parliament.slots.some((slot) => slot.instance === BUDGET), 'the enacted card left the area').is.false;
      passToParliament(game);
      expect(parliament.phase, 'a second sitting convenes').is.not.undefined;
    });
  });
});
