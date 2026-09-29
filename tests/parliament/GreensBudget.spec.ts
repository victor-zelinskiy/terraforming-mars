import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {ICard} from '../../src/server/cards/ICard';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  GREENS_BUDGET, GREENS_BUDGET_ANIMALS, GREENS_BUDGET_ANIMALS_AMOUNT, GREENS_BUDGET_CODE, GREENS_BUDGET_ID, GREENS_BUDGET_LEVY, GREENS_BUDGET_LEVY_AMOUNT,
  GREENS_BUDGET_MEGACREDITS, GREENS_BUDGET_MICROBES, GREENS_BUDGET_MICROBES_AMOUNT, GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON,
  GREENS_BUDGET_NO_MICROBE_HOLDER_REASON, GREENS_BUDGET_NO_TAGS_REASON,
} from '../../src/server/parliament/resolutions/greens/GreensBudget';
import {INDUSTRIALIST_BUDGET, INDUSTRIALIST_BUDGET_LEVY} from '../../src/server/parliament/resolutions/industrialists/IndustrialistBudget';
import {SCIENTISTS_BUDGET, SCIENTISTS_BUDGET_MEGACREDITS} from '../../src/server/parliament/resolutions/scientists/ScientistsBudget';
import {UNITY_BUDGET, UNITY_BUDGET_MEGACREDITS} from '../../src/server/parliament/resolutions/unity/UnityBudget';
import {AQUIFER_CONTEST_ANIMALS} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerGate, answerQuestGate, endGenerationThroughParliament, gatePromptOf, seatResolution, settleParliamentGates} from './parliamentArrange';
import {declaredCountIds, declaredStockReads, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardResource} from '../../src/common/CardResource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {cardCountVerdict, resolutionCountKind, RESOLUTION_TAG_COUNTING_MODE} from '../../src/common/parliament/resolutionCounts';
import {LEVY_STEP_KEY, levyDeclared, levyNetEffectOf, levyNothingReasonKey, levyPaid, levyShortReasonKey} from '../../src/common/parliament/resolutionLevy';
import {rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {Fish} from '../../src/server/cards/base/Fish';
import {Pets} from '../../src/server/cards/base/Pets';
import {Birds} from '../../src/server/cards/base/Birds';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {Trees} from '../../src/server/cards/base/Trees';
import {Grass} from '../../src/server/cards/base/Grass';
import {EcologicalZone} from '../../src/server/cards/base/EcologicalZone';
import {Virus} from '../../src/server/cards/base/Virus';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';

/**
 * GREENS BUDGET (Turmoil Redux, RX34) — the FIFTH card of the BUDGET family,
 * ASSEMBLED whole: the shared levy of 10 M€ (RX15), a count over THREE tags
 * (plant + microbe + animal, the form RX29 declared) + influence, and TWO flat
 * payouts onto ONE own card each (2 animals, then 3 microbes — Aquifer
 * Contest's picker, RX01, twice). The first law that asks ONE seat two
 * questions in a row.
 *
 * What these specs pin: the printed order is the executed order (levy →
 * payout → animals → microbes, the records' before/after chain proves the
 * money's half and the prompts' order the portions'); the LEVY is the
 * family's, unchanged (10 M€ leaves the rest; 4 M€ pays 4 of 10 and says so;
 * 0 M€ is a named skip — all three are still paid and asked); the payout is
 * PRINTED plant + microbe + animal tags + influence with a per-tag breakdown,
 * no cap, a card printing two of them worth 2, a wild tag none, a played
 * event's tag face down; «to any card» is ONE card per portion, picked apart,
 * never a layout; the portions are FLAT (influence 0 and 5 alike: 2 and 3);
 * FOUR different zeros each name themselves with their size; the second
 * question follows the first's ANSWER, a reload between them re-asks the
 * second and never the first, the next seat waits for both; a neutral winner
 * cancels nothing; MarsBot is never levied, paid or asked; and RX15 / RX27 /
 * RX29 declare exactly what they declared before.
 */
const BUDGET = resolutionInstanceId(GREENS_BUDGET_ID, 0);

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

function resourcesOn(player: IPlayer, name: CardName): number {
  return player.tableau.get(name)?.resourceCount ?? 0;
}

/** The standing pick of `player` — its kind, amount and candidates (the shared picker's own prompt). */
function pickOf(player: IPlayer): {resource: string | undefined, amount: number | undefined, cards: Array<CardName>, prompt: SelectCard<ICard>} {
  const prompt = cast(player.getWaitingFor(), SelectCard) as SelectCard<ICard>;
  return {resource: prompt.resourceGainPrompt?.cardResource, amount: prompt.resourceGainPrompt?.amount, cards: prompt.cards.map((c) => c.name), prompt};
}

describe('GreensBudget', () => {
  describe('the catalog entry', () => {
    it('is RX34 of the Greens, dealt as ONE card, with the 2-plant-tag quest and no winner, world, passive or action part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(GREENS_BUDGET_ID)).eq(GREENS_BUDGET);
      expect(GREENS_BUDGET_CODE).eq('RX34');
      expect(GREENS_BUDGET_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX34')).eq(GREENS_BUDGET);
      expect(GREENS_BUDGET.party).eq(PartyName.GREENS);
      expect(GREENS_BUDGET.module).eq('turmoilRedux');
      expect(GREENS_BUDGET.compatibility, 'a base card — no expansion is needed').is.undefined;
      expect(GREENS_BUDGET.quest).deep.eq({goal: {kind: 'tag', tag: Tag.PLANT}, count: 2});
      expect(GREENS_BUDGET.winnerSteps, 'no winner-only part').is.undefined;
      expect(GREENS_BUDGET.winnerReward, 'no winner tile either').is.undefined;
      expect(GREENS_BUDGET.worldSteps, 'the world is untouched').is.undefined;
      expect(GREENS_BUDGET.worldMoves).is.undefined;
      expect(GREENS_BUDGET.trackAdvance).is.undefined;
      expect(GREENS_BUDGET.passive, 'no passive').is.undefined;
      expect(GREENS_BUDGET.action, 'no action').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === BUDGET)).has.length(1);
    });

    it('is ASSEMBLED: the family\'s levy at 10, a count over THREE tags, and two FLAT portions onto ONE card each — never a spread', () => {
      // THE LEVY: the family's member with this card's sum — the same shape RX15 / RX27 / RX29 declared.
      expect(GREENS_BUDGET.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
      expect(GREENS_BUDGET_LEVY_AMOUNT).eq(10);
      expect(levyDeclared(GREENS_BUDGET.levy)).is.true;
      expect(GREENS_BUDGET.levy!.recipient).eq(INDUSTRIALIST_BUDGET_LEVY.recipient);
      // THE COUNT: one term over three tags — Unity Budget's three-tag form, over the biological medallions.
      expect(GREENS_BUDGET_MEGACREDITS.count).deep.eq({id: 'plantMicrobeAnimalTags', per: 1});
      expect(resolutionCountKind('plantMicrobeAnimalTags')).deep.eq({kind: 'tags', tags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]});
      expect(GREENS_BUDGET_MEGACREDITS.unit).deep.eq(UNITY_BUDGET_MEGACREDITS.unit);
      expect(GREENS_BUDGET_MEGACREDITS.perInfluence).eq(1);
      expect(GREENS_BUDGET_MEGACREDITS.cap, 'the card prints no maximum — none is declared').is.undefined;
      // THE PORTIONS: Aquifer Contest's unit (one kind, ONE card — no `spread`), flat like Scientists Budget's draw.
      expect(GREENS_BUDGET_ANIMALS).deep.eq({id: 'animals', unit: {kind: 'cardResource', resources: [CardResource.ANIMAL]}, base: 2, perInfluence: 0, recipient: 'each'});
      expect(GREENS_BUDGET_MICROBES).deep.eq({id: 'microbes', unit: {kind: 'cardResource', resources: [CardResource.MICROBE]}, base: 3, perInfluence: 0, recipient: 'each'});
      expect(GREENS_BUDGET_ANIMALS.unit).deep.eq(AQUIFER_CONTEST_ANIMALS.unit);
      expect(GREENS_BUDGET_ANIMALS.unit.kind === 'cardResource' && GREENS_BUDGET_ANIMALS.unit.spread, '«to any card» is ONE card — Cloud Development\'s layout is not declared').is.undefined;
      expect(GREENS_BUDGET_MICROBES.unit.kind === 'cardResource' && GREENS_BUDGET_MICROBES.unit.spread).is.undefined;
      expect(GREENS_BUDGET_ANIMALS_AMOUNT).eq(2);
      expect(GREENS_BUDGET_MICROBES_AMOUNT).eq(3);
      expect(GREENS_BUDGET.scaled).deep.eq([GREENS_BUDGET_MEGACREDITS, GREENS_BUDGET_ANIMALS, GREENS_BUDGET_MICROBES]);
      // THE NET stands on the M€ payout alone — a portion onto a card is never the levy's other half.
      expect(levyNetEffectOf(GREENS_BUDGET_LEVY, GREENS_BUDGET.scaled)).eq(GREENS_BUDGET_MEGACREDITS);
      // THE PRINTED ORDER: the levy step FIRST, the payout, the animals, the microbes — per seat.
      expect(GREENS_BUDGET.immediateSteps?.map((step) => step.key)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'animals', 'microbes']);
      expect(GREENS_BUDGET.immediateStepsFor, 'no per-player step plan').is.undefined;
      expect(familyOf(GREENS_BUDGET), 'the stand opens the tag-count family from the declaration alone').eq('counted-tags');
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('plantMicrobeAnimalTags');
      expect(declaredStockReads(REDUX_RESOLUTION_CATALOG)).includes(Resource.MEGACREDITS);
      expect(RESOLUTION_TAG_COUNTING_MODE, 'the family counts PRINTED tags').eq('raw');
    });

    it('the face prints «−10 [M€] · 2 [animal] · 3 [microbe]» over «1 [M€] / [animal] + [plant] + [microbe] + [influence]»; the quest graphic is two plant tags', () => {
      const [top, rate] = GREENS_BUDGET.renderData.rows;
      const topItems = top.filter(isICardRenderItem);
      expect(topItems.map((item) => item.type)).deep.eq([CardRenderItemType.MEGACREDITS, CardRenderItemType.RESOURCE, CardRenderItemType.RESOURCE]);
      expect(topItems[0].amount, 'the negative is printed INSIDE the tile, as on the card').eq(-10);
      expect(topItems[0].amountInside).is.true;
      // The portions are the resource SQUARES (a payout onto a card), with their printed counts.
      expect(topItems.slice(1).map((item) => [item.resource, item.amount])).deep.eq([[CardResource.ANIMAL, 2], [CardResource.MICROBE, 3]]);
      const rateItems = rate.filter(isICardRenderItem);
      expect(rateItems.map((item) => item.type)).deep.eq([
        CardRenderItemType.MEGACREDITS, CardRenderItemType.TAG, CardRenderItemType.TAG, CardRenderItemType.TAG, CardRenderItemType.INFLUENCE,
      ]);
      expect(rateItems[0].amount, 'the rate').eq(1);
      expect(rateItems.slice(1, 4).map((item) => item.tag), 'the counted objects are the three printed medallions, in the scan\'s order').deep.eq([Tag.ANIMAL, Tag.PLANT, Tag.MICROBE]);
      const [quest] = questRenderData(GREENS_BUDGET.quest).rows;
      expect(quest.filter(isICardRenderItem).map((item) => [item.type, item.tag, item.amount])).deep.eq([[CardRenderItemType.TAG, Tag.PLANT, 2]]);
    });

    it('the formula: plant + microbe + animal tags + influence, no cap; the portions are 2 and 3 at EVERY influence', () => {
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 3, 3], [2, 0, 2], [3, 3, 6], [7, 5, 12]];
      for (const [count, influence, expected] of cases) {
        expect(scaledAmount(GREENS_BUDGET_MEGACREDITS, influence, count), `count ${count} I=${influence}`).eq(expected);
        expect(uncappedAmount(GREENS_BUDGET_MEGACREDITS, influence, count)).eq(expected);
      }
      for (const influence of [0, 1, 3, 5, 12]) {
        expect(scaledAmount(GREENS_BUDGET_ANIMALS, influence), `animals at I=${influence}`).eq(2);
        expect(scaledAmount(GREENS_BUDGET_MICROBES, influence), `microbes at I=${influence}`).eq(3);
      }
    });

    it('the shared count asks ONE question of a card — does it PRINT one of the three, face up; storage and wild tags are not it', () => {
      const up = {eventTagsInPlay: false};
      expect(cardCountVerdict('plantMicrobeAnimalTags', new EcologicalZone(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('plantMicrobeAnimalTags', new Trees(), up)).deep.eq({counts: true});
      expect(cardCountVerdict('plantMicrobeAnimalTags', new NobelPrize(), up)).deep.eq({counts: false, reason: 'No plant, microbe or animal tag'});
      expect(cardCountVerdict('plantMicrobeAnimalTags', new ArtificialLake(), up)).deep.eq({counts: false, reason: 'No plant, microbe or animal tag'});
      expect(cardCountVerdict('plantMicrobeAnimalTags', new Virus(), up), 'a played event lies face down').deep.eq({counts: false, reason: 'A played event is face down'});
      expect(cardCountVerdict('plantMicrobeAnimalTags', new Virus(), {eventTagsInPlay: true}), '…unless the game turns events up').deep.eq({counts: true});
    });
  });

  describe('the enactment — the printed order, for every participant, in turn', () => {
    it('levy → payout → animals → microbes for EVERY participant (voters or not): the records\' chain and the prompts\' order prove it', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3; Fish (animal) + Tardigrades (microbe) + Trees (plant) = 3 → +6.
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Fish(), new Tardigrades(), new Trees());
      // p2 never voted — influence 1, no card: influence pays on its own; no holder of either kind.
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      const income1 = incomeOf(p1);
      const income2 = incomeOf(p2);
      endGeneration(game);
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(parliament.enacted).eq(BUDGET);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      // THE MONEY IS SETTLED BEFORE THE FIRST QUESTION: the levy and the payout are recorded, the animals ask.
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits']);
      const levy1 = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      expect(levy1).deep.eq({
        player: p1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'stock', stock: Resource.MEGACREDITS,
        amount: -10, owed: 10, before: 20 + income1, after: 10 + income1});
      expect(paid1).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 6, count: 3, influence: 3, before: levy1.after, after: levy1.after! + 6});
      expect(paid1.counted, 'the cards that made the count, in play order').deep.eq([CardName.FISH, CardName.TARDIGRADES, CardName.TREES]);
      expect(paid1.countedUnits).deep.eq([1, 1, 1]);
      expect(paid1.countedByTag, 'the per-tag breakdown rides the record, in the printed rule\'s order').deep.eq(
        [{tag: Tag.PLANT, count: 1}, {tag: Tag.MICROBE, count: 1}, {tag: Tag.ANIMAL, count: 1}]);
      expect(paid1.uncapped, 'no cap declared — no sum beside the amount').is.undefined;
      expect(p1.megaCredits).eq(paid1.after);
      // THE FIRST QUESTION: 2 animals onto ONE card — the single holder is still SHOWN (never applied behind the board).
      const animals = pickOf(p1);
      expect(animals.resource).eq('animal');
      expect(animals.amount).eq(2);
      expect(animals.cards).deep.eq([CardName.FISH]);
      expect(animals.prompt.choiceContext?.source).deep.eq({kind: 'resolution', resolution: GREENS_BUDGET_ID});
      expect(animals.prompt.choiceContext?.mode).eq('reward');
      expect(p2.getWaitingFor(), 'the next seat waits for the whole of p1\'s part').is.undefined;
      p1.process({type: 'card', cards: [CardName.FISH]});
      expect(resourcesOn(p1, CardName.FISH)).eq(2);
      // THE SECOND QUESTION follows the first's ANSWER: 3 microbes onto ONE card, picked apart.
      const microbes = pickOf(p1);
      expect(microbes.resource).eq('microbe');
      expect(microbes.amount).eq(3);
      expect(microbes.cards).deep.eq([CardName.TARDIGRADES]);
      expect(microbes.prompt.choiceContext?.source).deep.eq({kind: 'resolution', resolution: GREENS_BUDGET_ID});
      expect(p2.getWaitingFor(), 'still waiting — two questions to one seat').is.undefined;
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect(resourcesOn(p1, CardName.TARDIGRADES)).eq(3);
      expect(resourcesOn(p1, CardName.FISH), 'the animals stayed where they landed').eq(2);
      // …then p2: its own levy, its own influence, and both portions NAMED and forfeited — no holder, no question:
      // the whole effects step is over and the ADJOURN gate is what both seats hold now.
      expect(p2.getWaitingFor(), 'no holder — no question').is.not.instanceOf(SelectCard);
      expect(gatePromptOf(p2, 'adjourn'), 'the sitting moved on to its second gate').is.not.undefined;
      const levy2 = outcomeOf(parliament, p2, LEVY_STEP_KEY)!;
      const paid2 = outcomeOf(parliament, p2, 'megacredits')!;
      expect(levy2).deep.include({kind: 'stock', amount: -10, owed: 10, before: 20 + income2, after: 10 + income2});
      expect(paid2).deep.include({kind: 'stock', amount: 1, count: 0, influence: 1, before: levy2.after, after: levy2.after! + 1});
      expect(paid2.counted).deep.eq([]);
      expect(outcomeOf(parliament, p2, 'animals')).deep.eq({
        player: p2.id, step: 'animals', part: 'effect', kind: 'skipped', effect: 'animals', resource: CardResource.ANIMAL, amount: 2, influence: 1, reason: GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON});
      expect(outcomeOf(parliament, p2, 'microbes')).deep.eq({
        player: p2.id, step: 'microbes', part: 'effect', kind: 'skipped', effect: 'microbes', resource: CardResource.MICROBE, amount: 3, influence: 1, reason: GREENS_BUDGET_NO_MICROBE_HOLDER_REASON});
      // THE ORDER, whole: every record of p1 before any of p2, each seat in the printed order.
      expect(allRecords(parliament).map((o) => `${o.player}:${o.step}`)).deep.eq([
        `${p1.id}:${LEVY_STEP_KEY}`, `${p1.id}:megacredits`, `${p1.id}:animals`, `${p1.id}:microbes`,
        `${p2.id}:${LEVY_STEP_KEY}`, `${p2.id}:megacredits`, `${p2.id}:animals`, `${p2.id}:microbes`,
      ]);
      expect(outcomeOf(parliament, p1, 'animals')).deep.eq({
        player: p1.id, step: 'animals', part: 'effect', kind: 'cardResource', effect: 'animals', resource: CardResource.ANIMAL, amount: 2, card: CardName.FISH, influence: 3});
      expect(outcomeOf(parliament, p1, 'microbes')).deep.eq({
        player: p1.id, step: 'microbes', part: 'effect', kind: 'cardResource', effect: 'microbes', resource: CardResource.MICROBE, amount: 3, card: CardName.TARDIGRADES, influence: 3});
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      // The events say the same order under the resolution's source: −10, +6, then the two portions.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === GREENS_BUDGET_ID && e.player === p1.color &&
        e.type !== 'action');
      expect(mine.slice(0, 2).map((e) => e.impact?.stock?.megacredits)).deep.eq([-10, 6]);
      // The reward address reads the levy as a LOSS, each portion as a payout onto its card — nothing is a skip.
      const delivery = rewardAddressOf({...levy1, player: p1.color}, p1.color);
      expect(delivery.direction).eq('loss');
      expect(delivery.skipped).is.undefined;
      const landed = rewardAddressOf({...outcomeOf(parliament, p1, 'microbes')!, player: p1.color}, p1.color);
      expect(landed.skipped).is.undefined;
      expect(landed.address.surface).eq('tableau-card');
      // …and p2's forfeited portions are skips that NAME their size.
      const forfeited = rewardAddressOf({...outcomeOf(parliament, p2, 'animals')!, player: p2.color}, p2.color);
      expect(forfeited.skipped).eq(GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON);
      expect(forfeited.payload.amount).eq(2);
    });

    it('the levy is the family\'s, bounded by the seat: 12 M€ leaves 2; 4 M€ pays 4 of 10 and says so; 0 M€ is a named skip — all three are still paid and asked', () => {
      const levy = GREENS_BUDGET_LEVY;
      expect([levyPaid(levy, 12), levyPaid(levy, 4), levyPaid(levy, 0)]).deep.eq([10, 4, 0]);
      // 12 M€ AT THE SITTING: no rating, no production, so the production phase adds nothing.
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Fish());
      p1.megaCredits = 12;
      p1.terraformRating = 0;
      endGeneration(game);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10, before: 12, after: 2});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 4, count: 1, influence: 3, before: 2, after: 6});
      expect(p1.megaCredits, '12 − 10 + 4').eq(6);
      expect(pickOf(p1).amount, 'the levy asks no solvency — the animals are still asked').eq(2);

      // 4 M€: the take is what the seat holds, the shortfall is on the PAYING record, and the payout still comes.
      const [game2, q1, , parl2] = stage();
      parl2.agenda.set(q1.id, 4);
      q1.playedCards.push(new Tardigrades());
      q1.megaCredits = 4;
      q1.terraformRating = 0;
      endGeneration(game2);
      expect(outcomeOf(parl2, q1, LEVY_STEP_KEY)).deep.include(
        {kind: 'stock', amount: -4, owed: 10, before: 4, after: 0, reason: levyShortReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl2, q1, 'megacredits')).deep.include({kind: 'stock', amount: 4, count: 1, influence: 3, before: 0, after: 4});
      expect(q1.megaCredits, 'never below zero on the way').eq(4);
      expect(game2.gameLog.filter((e) => e.message.startsWith('${0} pays only ${1} of the ${2} ${3} owed')), 'the shortfall is named').has.length(1);
      expect(game2.gameLog.filter((e) => e.message.includes('Adjusting')), 'the take carried its source — no illegal-state line').deep.eq([]);
      // …no animal holder (named, forfeited), then the microbes are asked all the same.
      expect(outcomeOf(parl2, q1, 'animals')).deep.include({kind: 'skipped', amount: 2, reason: GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON});
      expect(pickOf(q1)).deep.include({resource: 'microbe', amount: 3, cards: [CardName.TARDIGRADES]});

      // 0 M€: a named skip carrying the owed sum — and the card still pays.
      const [game3, r1, , parl3] = stage();
      parl3.agenda.set(r1.id, 4);
      r1.megaCredits = 0;
      r1.terraformRating = 0;
      endGeneration(game3);
      expect(outcomeOf(parl3, r1, LEVY_STEP_KEY)).deep.eq(
        {player: r1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 10, reason: levyNothingReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl3, r1, 'megacredits')).deep.include({kind: 'stock', amount: 3, influence: 3, before: 0, after: 3});
      expect(game3.events.events.filter((e) => e.type === 'resource-changed' && e.player === r1.color && e.source?.kind === 'resolution' &&
        (e.impact?.stock?.megacredits ?? 0) < 0), 'not one M€ left the seat').has.length(0);
    });

    it('the count is THREE tags added up: a card printing two of them counts twice, a wild tag is none, a played event\'s tag is face down, and the breakdown names each tag', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      // Ecological Zone (animal + plant = 2) + Tardigrades (microbe) + GHG Producing Bacteria (science + microbe → 1) + Trees (plant) = 5;
      // Nobel Prize (wild) counts nothing; Virus (an EVENT with a microbe tag) lies face down.
      p1.playedCards.push(new EcologicalZone(), new Tardigrades(), new GHGProducingBacteria(), new Trees(), new NobelPrize(), new Virus());
      // p2: influence 0, and a wild tag that is NONE of the three at an enactment.
      p2.playedCards.push(new NobelPrize());
      const live = resolutionCount(p1, 'plantMicrobeAnimalTags');
      expect(live.count).eq(5);
      expect(live.cards).deep.eq([CardName.ECOLOGICAL_ZONE, CardName.TARDIGRADES, CardName.GHG_PRODUCING_BACTERIA, CardName.TREES]);
      expect(live.units).deep.eq([2, 1, 1, 1]);
      expect(live.byTag).deep.eq([{tag: Tag.PLANT, count: 2}, {tag: Tag.MICROBE, count: 2}, {tag: Tag.ANIMAL, count: 1}]);
      expect(p1.tags.count(Tag.MICROBE, 'raw'), 'the canonical counter agrees, tag by tag').eq(2);
      expect(p1.tags.count(Tag.PLANT, 'raw')).eq(2);
      expect(p1.tags.count(Tag.ANIMAL, 'raw')).eq(1);
      endGeneration(game);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 8, count: 5, influence: 3});
      expect(outcomeOf(parliament, p1, 'megacredits')?.countedByTag).deep.eq([{tag: Tag.PLANT, count: 2}, {tag: Tag.MICROBE, count: 2}, {tag: Tag.ANIMAL, count: 1}]);
      // p1's animals go on Ecological Zone (the one animal holder), its microbes on one of the two microbe holders.
      p1.process({type: 'card', cards: [CardName.ECOLOGICAL_ZONE]});
      expect(pickOf(p1).cards).has.members([CardName.TARDIGRADES, CardName.GHG_PRODUCING_BACTERIA]);
      p1.process({type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]});
      runAllActions(game);
      // p2's zero is NAMED — the levy is still taken, and both portions are forfeited BY NAME, not folded into the zero.
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include(
        {kind: 'skipped', amount: 0, count: 0, influence: 0, reason: GREENS_BUDGET_NO_TAGS_REASON});
      expect(outcomeOf(parliament, p2, 'animals')).deep.include({kind: 'skipped', amount: 2, reason: GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON});
      expect(outcomeOf(parliament, p2, 'microbes')).deep.include({kind: 'skipped', amount: 3, reason: GREENS_BUDGET_NO_MICROBE_HOLDER_REASON});
      expect(game.gameLog.filter((e) => e.message.startsWith('${0} has no plant, microbe or animal tags and no influence')), 'p2\'s zero is named').has.length(1);
      const reasons = recordsOf(parliament, p2).map((o) => o.reason);
      expect(new Set(reasons).size, 'four records, three DIFFERENT reasons and one paying levy — never one shared «nothing»').eq(4);
    });

    it('«to any card» is ONE card per portion, picked APART: the animals land on the chosen animal holder, the microbes on the chosen microbe holder, nothing on the rest', () => {
      const [game, p1] = stage();
      p1.playedCards.push(new Fish(), new Pets(), new Tardigrades(), new GHGProducingBacteria());
      endGeneration(game);
      const animals = pickOf(p1);
      expect(animals.cards, 'the ANIMAL holders only — a microbe holder is not a candidate for animals').has.members([CardName.FISH, CardName.PETS]);
      expect(animals.cards).does.not.include(CardName.TARDIGRADES);
      // The VP reading follows each card's OWN rule: Fish 1 per animal, Pets 1 per 2.
      expect(animals.prompt.resourceGainPrompt?.vpBox?.[CardName.FISH]).deep.include({from: 0, to: 2});
      expect(animals.prompt.resourceGainPrompt?.vpBox?.[CardName.PETS]).deep.include({from: 0, to: 1});
      p1.process({type: 'card', cards: [CardName.PETS]});
      const microbes = pickOf(p1);
      expect(microbes.cards, 'the MICROBE holders only').has.members([CardName.TARDIGRADES, CardName.GHG_PRODUCING_BACTERIA]);
      expect(microbes.cards).does.not.include(CardName.FISH);
      p1.process({type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]});
      runAllActions(game);
      expect([resourcesOn(p1, CardName.FISH), resourcesOn(p1, CardName.PETS), resourcesOn(p1, CardName.TARDIGRADES), resourcesOn(p1, CardName.GHG_PRODUCING_BACTERIA)],
        'the whole of each portion on ONE card — never split, never banked').deep.eq([0, 2, 0, 3]);
    });

    it('a card with zero resources is a target; a single candidate is still SHOWN and confirmed (never applied behind the board)', () => {
      const [game, p1] = stage();
      p1.playedCards.push(new Birds(), new Tardigrades());
      endGeneration(game);
      expect(pickOf(p1).cards).deep.eq([CardName.BIRDS]);
      expect(resourcesOn(p1, CardName.BIRDS), 'nothing landed before the answer').eq(0);
      p1.process({type: 'card', cards: [CardName.BIRDS]});
      expect(resourcesOn(p1, CardName.BIRDS)).eq(2);
      expect(pickOf(p1).cards).deep.eq([CardName.TARDIGRADES]);
      expect(resourcesOn(p1, CardName.TARDIGRADES)).eq(0);
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      expect(resourcesOn(p1, CardName.TARDIGRADES)).eq(3);
    });

    it('no holder of ONE kind: that portion is NAMED and forfeited with its size, the other is still asked — each zero its own', () => {
      // No animal holder: the animals are forfeited («2 animals»), the microbes land.
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(new Tardigrades(), new Trees());
      endGeneration(game);
      expect(outcomeOf(parliament, p1, 'animals')).deep.include({kind: 'skipped', effect: 'animals', resource: CardResource.ANIMAL, amount: 2, reason: GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON});
      expect(game.gameLog.some((e) => e.message === '${0} has no card that can hold animals — ${1} animal(s) from ${2} are forfeited'), 'the journal names the loss and its size').is.true;
      expect(pickOf(p1)).deep.include({resource: 'microbe', amount: 3});
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect(resourcesOn(p1, CardName.TARDIGRADES)).eq(3);
      expect(resourcesOn(p1, CardName.TREES), 'a plant TAG is not storage').eq(0);
      // No microbe holder: the animals land, the microbes are forfeited («3 microbes»).
      const [game2, q1, , parl2] = stage();
      q1.playedCards.push(new Fish());
      endGeneration(game2);
      q1.process({type: 'card', cards: [CardName.FISH]});
      runAllActions(game2);
      expect(resourcesOn(q1, CardName.FISH)).eq(2);
      expect(outcomeOf(parl2, q1, 'microbes')).deep.include({kind: 'skipped', effect: 'microbes', resource: CardResource.MICROBE, amount: 3, reason: GREENS_BUDGET_NO_MICROBE_HOLDER_REASON});
      const line = game2.gameLog.find((e) => e.message === '${0} has no card that can hold microbes — ${1} microbe(s) from ${2} are forfeited');
      expect(line, 'the journal names the loss and its size').is.not.undefined;
      expect(line?.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['3']);
      expect(line?.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(GREENS_BUDGET_ID);
      // The address reads each as a skip with its own words and its own size — never one reason for two portions.
      expect(rewardAddressOf({...outcomeOf(parl2, q1, 'microbes')!, player: q1.color}, q1.color)).deep.include({skipped: GREENS_BUDGET_NO_MICROBE_HOLDER_REASON});
      expect(rewardAddressOf({...outcomeOf(parliament, p1, 'animals')!, player: p1.color}, p1.color)).deep.include({skipped: GREENS_BUDGET_NO_ANIMAL_HOLDER_REASON});
    });

    it('influence never touches the portions: a seat at influence 0 and a seat at influence 5 are both owed 2 animals and 3 microbes', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, BUDGET);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.megaCredits = 20;
      p2.megaCredits = 20;
      parliament.agenda.set(p1.id, agendaForInfluence(0));
      parliament.agenda.set(p2.id, agendaForInfluence(5));
      p1.playedCards.push(new Fish(), new Tardigrades());
      p2.playedCards.push(new Fish(), new Tardigrades());
      endGeneration(game);
      expect(parliament.influence(p1)).eq(0);
      expect(pickOf(p1)).deep.include({resource: 'animal', amount: 2});
      p1.process({type: 'card', cards: [CardName.FISH]});
      expect(pickOf(p1)).deep.include({resource: 'microbe', amount: 3});
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect(parliament.influence(p2)).eq(5);
      expect(pickOf(p2)).deep.include({resource: 'animal', amount: 2});
      p2.process({type: 'card', cards: [CardName.FISH]});
      expect(pickOf(p2)).deep.include({resource: 'microbe', amount: 3});
      p2.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      for (const p of [p1, p2]) {
        expect(outcomeOf(parliament, p, 'animals')).deep.include({kind: 'cardResource', amount: 2});
        expect(outcomeOf(parliament, p, 'microbes')).deep.include({kind: 'cardResource', amount: 3});
        expect(resourcesOn(p, CardName.FISH)).eq(2);
        expect(resourcesOn(p, CardName.TARDIGRADES)).eq(3);
      }
      // …while the money DID follow the influence: 0 tags-less M€ for p1 beyond its two tags, 2 + 5 for p2.
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({amount: 2, count: 2, influence: 0});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({amount: 7, count: 2, influence: 5});
      settleParliamentGates(game);
      expect((parliament.lastPhase ?? parliament.phase?.summary)?.winner.player, 'a neutral winner cancels nothing').eq('NEUTRAL');
      expect(allRecords(parliament).map((o) => o.part)).deep.eq(Array(8).fill('effect'));
    });
  });

  describe('two questions to one seat — new to the catalog', () => {
    it('the second prompt comes only AFTER the first is answered; the next seat is not visited until both are closed', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(new Fish(), new Tardigrades());
      p2.playedCards.push(new Fish(), new Tardigrades());
      endGeneration(game);
      expect(pickOf(p1).resource).eq('animal');
      expect(p2.getWaitingFor()).is.undefined;
      p1.process({type: 'card', cards: [CardName.FISH]});
      expect(pickOf(p1).resource, 'the second question stands for the SAME seat').eq('microbe');
      expect(p2.getWaitingFor(), 'p2 still waits').is.undefined;
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect(p1.getWaitingFor(), 'p1 is done').is.undefined;
      expect(pickOf(p2).resource, 'now p2 is asked — animals first').eq('animal');
      p2.process({type: 'card', cards: [CardName.FISH]});
      expect(pickOf(p2).resource).eq('microbe');
      p2.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(game.parliament!.phase).is.undefined;
    });

    it('a reload BETWEEN the two picks re-asks the SECOND and never the first; a reload INSIDE each pick rebuilds the same question with the same amount; nothing lands twice', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 2); // → step 3 after the phase = influence 2
      p1.playedCards.push(new Fish(), new Birds(), new Tardigrades(), new GHGProducingBacteria());
      endGeneration(game);
      expect(pickOf(p1)).deep.include({resource: 'animal', amount: 2});
      // INSIDE the first pick: the same question, the same amount, fixed with the phase.
      let live = reload(game);
      let one = live.getPlayerById(p1.id) as TestPlayer;
      expect(pickOf(one)).deep.include({resource: 'animal', amount: 2});
      expect(pickOf(one).prompt.choiceContext?.source).deep.eq({kind: 'resolution', resolution: GREENS_BUDGET_ID});
      expect(live.parliament!.phase?.effectState?.[p1.id]?.animalsOwed, 'the amount is fixed with the phase').eq(2);
      expect(live.parliament!.phase?.effects?.pending, 'the model says WHICH question stands').deep.eq({player: p1.id, key: 'animals'});
      one.process({type: 'card', cards: [CardName.BIRDS]});
      expect(one.tableau.get(CardName.BIRDS)?.resourceCount).eq(2);
      // A REPEATED answer to the processed question is refused and pays nothing more.
      expect(() => one.process({type: 'card', cards: [CardName.FISH]})).to.throw();
      expect(one.tableau.get(CardName.FISH)?.resourceCount ?? 0).eq(0);
      expect(one.tableau.get(CardName.BIRDS)?.resourceCount).eq(2);
      // BETWEEN the two picks: the microbes stand, the animals never return, Birds keeps exactly 2.
      expect(pickOf(one).resource).eq('microbe');
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      expect(pickOf(one), 'the SECOND question is rebuilt').deep.include({resource: 'microbe', amount: 3});
      expect(pickOf(one).cards).has.members([CardName.TARDIGRADES, CardName.GHG_PRODUCING_BACTERIA]);
      expect(live.parliament!.phase?.effects?.pending).deep.eq({player: p1.id, key: 'microbes'});
      expect(live.parliament!.phase?.effectState?.[p1.id]?.microbesOwed).eq(3);
      expect(one.tableau.get(CardName.BIRDS)?.resourceCount, 'the animals landed ONCE').eq(2);
      expect(one.tableau.get(CardName.FISH)?.resourceCount ?? 0).eq(0);
      // Even if the influence moved meanwhile, the question keeps the amount it was built with (flat anyway — and fixed).
      live.parliament!.agenda.set(p1.id, 8);
      live = reload(live);
      one = live.getPlayerById(p1.id) as TestPlayer;
      expect(pickOf(one)).deep.include({resource: 'microbe', amount: 3});
      one.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(live);
      expect(one.tableau.get(CardName.TARDIGRADES)?.resourceCount).eq(3);
      expect(one.tableau.get(CardName.GHG_PRODUCING_BACTERIA)?.resourceCount ?? 0).eq(0);
      expect(() => one.process({type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]})).to.throw();
      expect(one.getWaitingFor(), 'nothing more is asked of p1 — the adjourn gate stands').is.not.instanceOf(SelectCard);
      expect(gatePromptOf(one, 'adjourn')).is.not.undefined;
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
      settleParliamentGates(live);
      expect(live.generation).eq(2);
      // Every key applied once: the outcomes are one per step.
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === p1.id).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'animals', 'microbes']);
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'animals')).deep.include({kind: 'cardResource', amount: 2, card: CardName.BIRDS});
      expect(outcomes.find((o) => o.player === p1.id && o.step === 'microbes')).deep.include({kind: 'cardResource', amount: 3, card: CardName.TARDIGRADES});
    });

    it('a reload BETWEEN two players\' parts asks the second player its two questions once, never the first again', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(new Fish(), new Tardigrades());
      p2.playedCards.push(new Fish(), new Tardigrades());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      const live = reload(game);
      const one = live.getPlayerById(p1.id) as TestPlayer;
      const two = live.getPlayerById(p2.id) as TestPlayer;
      expect(one.getWaitingFor(), 'p1 owes nothing more').is.undefined;
      expect([resourcesOn(one, CardName.FISH), resourcesOn(one, CardName.TARDIGRADES)]).deep.eq([2, 3]);
      expect(pickOf(two).resource).eq('animal');
      two.process({type: 'card', cards: [CardName.FISH]});
      expect(pickOf(two).resource).eq('microbe');
      two.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(live);
      expect([resourcesOn(two, CardName.FISH), resourcesOn(two, CardName.TARDIGRADES)]).deep.eq([2, 3]);
      expect([resourcesOn(one, CardName.FISH), resourcesOn(one, CardName.TARDIGRADES)], 'p1 was never paid again').deep.eq([2, 3]);
      settleParliamentGates(live);
      expect(live.parliament!.phase).is.undefined;
    });

    it('a later, legal enactment of the same card pays again (idempotency is per enactment, never forever)', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(new Fish(), new Tardigrades());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect([resourcesOn(p1, CardName.FISH), resourcesOn(p1, CardName.TARDIGRADES)]).deep.eq([2, 3]);
      // Generation 2: the card leaves ENACTED for the discard, then returns to the vote and wins again.
      game.phase = Phase.ACTION;
      seatResolution(parliament, 0, BUDGET);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.megaCredits = 20;
      endGeneration(game);
      expect(pickOf(p1)).deep.include({resource: 'animal', amount: 2});
      p1.process({type: 'card', cards: [CardName.FISH]});
      expect(pickOf(p1)).deep.include({resource: 'microbe', amount: 3});
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect([resourcesOn(p1, CardName.FISH), resourcesOn(p1, CardName.TARDIGRADES)]).deep.eq([4, 6]);
    });
  });

  describe('the journal, the model and the client\'s readings', () => {
    it('the journal carries the levy, the payout with its three-tag sum, and each portion\'s landing — the resolution as their source', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new EcologicalZone(), new Tardigrades());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.ECOLOGICAL_ZONE]});
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      const levy = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const levyLine = game.gameLog.find((entry) => entry.message === '${0} pays ${1} ${2} to ${3} (${4} → ${5})' && entry.data[0].value === p1.color)!;
      expect(levyLine.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(GREENS_BUDGET_ID);
      expect(levyLine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['10', String(levy.before), String(levy.after)]);
      const payLine = game.gameLog.find((entry) => entry.message.startsWith('${0} gained ${1} M€ from ${2}: ${3} plant, microbe and animal tag(s)') &&
        entry.data[0].value === p1.color)!;
      // Ecological Zone (2) + Tardigrades (1) = 3, + influence 3 = 6.
      expect(payLine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value))
        .deep.eq(['6', '3', '3', String(levy.after), String(levy.after! + 6)]);
      const added = game.gameLog.filter((entry) => entry.message === '${0} added ${1} ${2} to ${3} from ${4}' && entry.data[0].value === p1.color);
      expect(added.map((entry) => entry.data.find((d) => d.type === LogMessageDataType.CARD)?.value)).deep.eq([CardName.ECOLOGICAL_ZONE, CardName.TARDIGRADES]);
      expect(added.every((entry) => entry.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value === GREENS_BUDGET_ID)).is.true;
      expect(game.gameLog.some((entry) => entry.message === 'Resolution ${0} is enacted')).is.true;
    });

    it('every seat\'s three-tag count and the SUPPLY the levy reads ride the model; every other seat reads WHICH question is asked; the records reach the client', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new EcologicalZone(), new Tardigrades());
      p1.megaCredits = 34;
      p2.megaCredits = 4;
      const model = getParliamentModel(game, p2);
      const one = model?.players.find((p) => p.color === p1.color);
      expect(one?.counts?.find((c) => c.id === 'plantMicrobeAnimalTags')).deep.eq({
        id: 'plantMicrobeAnimalTags', count: 3, cards: [CardName.ECOLOGICAL_ZONE, CardName.TARDIGRADES], units: [2, 1],
        byTag: [{tag: Tag.PLANT, count: 1}, {tag: Tag.MICROBE, count: 1}, {tag: Tag.ANIMAL, count: 1}],
      });
      expect(one?.stock).to.include({[Resource.MEGACREDITS]: 34});
      const two = model?.players.find((p) => p.color === p2.color);
      expect(two?.counts?.find((c) => c.id === 'plantMicrobeAnimalTags')).deep.eq({
        id: 'plantMicrobeAnimalTags', count: 0, cards: [], units: [], byTag: [{tag: Tag.PLANT, count: 0}, {tag: Tag.MICROBE, count: 0}, {tag: Tag.ANIMAL, count: 0}],
      });
      expect(two?.stock, 'the seat the panel will warn about').to.include({[Resource.MEGACREDITS]: 4});
      endGeneration(game);
      // p1 picks the animals' card: p2's model says so (the step key and the input kind — never a title).
      let phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.step).eq('effects');
      expect(phase?.pending).deep.eq({player: p1.color, key: 'animals', input: 'card'});
      p1.process({type: 'card', cards: [CardName.ECOLOGICAL_ZONE]});
      phase = getParliamentModel(game, p2)?.phase;
      expect(phase?.pending, 'then the microbes\' card — the second question of the same seat').deep.eq({player: p1.color, key: 'microbes', input: 'card'});
      expect(phase?.outcomes?.map((o) => `${o.step}:${o.kind}`)).deep.eq([`${LEVY_STEP_KEY}:stock`, 'megacredits:stock', 'animals:cardResource']);
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10});
      const paid = last?.outcomes?.find((o) => o.player === p1.color && o.step === 'megacredits');
      expect(paid).deep.include({kind: 'stock', amount: 6, count: 3, influence: 3});
      expect(paid?.countedUnits).deep.eq([2, 1]);
      expect(paid?.countedByTag).deep.eq([{tag: Tag.PLANT, count: 1}, {tag: Tag.MICROBE, count: 1}, {tag: Tag.ANIMAL, count: 1}]);
      expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === 'animals')).deep.include({kind: 'cardResource', resource: 'Animal', amount: 2, card: CardName.ECOLOGICAL_ZONE});
      expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === 'microbes')).deep.include({kind: 'cardResource', resource: 'Microbe', amount: 3, card: CardName.TARDIGRADES});
      // (p2's 4 M€ were the VOTE's picture; the production phase paid its income before the sitting, so the levy took the whole 10.)
      expect(last?.outcomes?.filter((o) => o.player === p2.color).map((o) => `${o.step}:${o.kind}:${o.amount}`)).deep.eq(
        [`${LEVY_STEP_KEY}:stock:-10`, 'megacredits:skipped:0', 'animals:skipped:2', 'microbes:skipped:3']);
    });

    it('a later tableau, a later influence and a change of government never recompute what was taken or paid', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Fish());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      runAllActions(game);
      const cash = p1.megaCredits;
      const records = allRecords(parliament).map((o) => structuredClone(o));
      p1.playedCards.push(new EcologicalZone(), new Tardigrades());
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.megaCredits).eq(cash);
      expect(allRecords(parliament)).deep.eq(records);
      expect(resolutionCount(p1, 'plantMicrobeAnimalTags').count, 'the live count moved — the record did not').eq(4);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({count: 1, influence: 3, amount: 4});
    });
  });

  describe('the chairman quest — play 2 plant tags', () => {
    it('the enactment moves no progress (its animals and microbes are no tags); the player\'s OWN two plant tags complete it', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new Fish(), new Tardigrades());
      endGeneration(game);
      p1.process({type: 'card', cards: [CardName.FISH]});
      p1.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(GREENS_BUDGET_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.PLANT}, count: 2});
      expect(parliament.questProgressOf(p1), 'the enactment plays no tag').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      p1.playCard(new Trees());
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      expect(parliament.quest?.completedBy).is.undefined;
      p1.playCard(new Grass());
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      runAllActions(game);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      // Once per generation: nobody else completes it.
      p2.playCard(new Trees());
      p2.playCard(new Grass());
      runAllActions(game);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('the stand — the scenarios a tag-counted law opens', () => {
    const STAND = path.join(__dirname, '..', '..', 'src', 'client', 'components', 'console', 'parliament', 'ConsoleResolutionsPlayground.vue');

    it('every scenario of the tag-counted family names the count its tableau is laid out for; this card opens its own edges', () => {
      const source = fs.readFileSync(STAND, 'utf8');
      const scenarios = source.split('\n').filter((line) => line.includes("family: 'counted-tags'"));
      const unnamed = scenarios.filter((line) => !line.includes("counts: '")).map((line) => line.trim().slice(0, 60));
      expect(unnamed, 'a tag scenario without its count shows one law another law\'s tableau').deep.eq([]);
      expect(scenarios.filter((line) => line.includes("counts: 'plantMicrobeAnimalTags'")).length,
        'this card opens its own: no live tags, two tags on one card, no animal holder, no microbe holder, the levy\'s edges, influence 0 / 3').is.greaterThan(5);
    });
  });

  describe('MarsBot and the older budgets standing where they stood', () => {
    it('MarsBot (mode none) is never levied, never paid, never asked — and the phase does not stall on a question it cannot answer', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BUDGET);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new Fish(), new Tardigrades());
      bot.playedCards.push(new Fish(), new Tardigrades());
      const cash = human.megaCredits;
      const income = incomeOf(human);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      // The sitting's barrier is ONE human: the bot holds no gate, the human's answer opens the effects.
      expect(bot.getWaitingFor()).is.undefined;
      answerGate(human, 'assembly');
      expect(pickOf(human)).deep.include({resource: 'animal', amount: 2});
      human.process({type: 'card', cards: [CardName.FISH]});
      expect(bot.getWaitingFor()).is.undefined;
      expect(pickOf(human)).deep.include({resource: 'microbe', amount: 3});
      human.process({type: 'card', cards: [CardName.TARDIGRADES]});
      runAllActions(game);
      expect(bot.getWaitingFor()).is.undefined;
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.map((o) => o.player)).deep.eq([human.id, human.id, human.id, human.id]);
      expect(outcomes.map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'animals', 'microbes']);
      expect(outcomes[0]).deep.include({kind: 'stock', amount: -10, owed: 10});
      expect(outcomes[1]).deep.include({kind: 'stock', amount: 3, count: 2, influence: 1});
      expect(human.megaCredits, '−10 and (2 + I 1) on top of the production phase\'s income').eq(cash + income - 10 + 3);
      expect([resourcesOn(human, CardName.FISH), resourcesOn(human, CardName.TARDIGRADES)]).deep.eq([2, 3]);
      expect([resourcesOn(bot, CardName.FISH), resourcesOn(bot, CardName.TARDIGRADES)], 'nothing reached the bot').deep.eq([0, 0]);
      expect(game.events.events.filter((e) => e.player === bot.color && e.source?.kind === 'resolution'),
        'nothing reached the bot under the resolution').is.empty;
      const model = getParliamentModel(game, human);
      expect(model?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('RX15, RX27 and RX29 DID NOT MOVE: the three older budgets declare exactly what they declared before', () => {
      expect(INDUSTRIALIST_BUDGET.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
      expect(INDUSTRIALIST_BUDGET.immediateSteps?.map((step) => step.key)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'production']);
      expect(SCIENTISTS_BUDGET.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
      expect(SCIENTISTS_BUDGET_MEGACREDITS.count).deep.eq({id: 'scienceTags', per: 1});
      expect(SCIENTISTS_BUDGET.immediateSteps?.map((step) => step.key)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'draw']);
      expect(UNITY_BUDGET.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 12, recipient: 'each'});
      expect(UNITY_BUDGET_MEGACREDITS.count).deep.eq({id: 'earthVenusJovianTags', per: 1});
      expect(resolutionCountKind('earthVenusJovianTags')).deep.eq({kind: 'tags', tags: [Tag.EARTH, Tag.VENUS, Tag.JOVIAN]});
      expect(resolutionCountKind('scienceTags')).deep.eq({kind: 'tags', tags: [Tag.SCIENCE]});
      // …and the three-tag count of this card is its OWN id — never Unity Budget's widened, never one id per tag.
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG).filter((id) => ['plantMicrobeAnimalTags', 'earthVenusJovianTags', 'scienceTags'].includes(id))).has.length(3);
    });
  });
});
