import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  SCIENTISTS_BUDGET, SCIENTISTS_BUDGET_CODE, SCIENTISTS_BUDGET_DRAW, SCIENTISTS_BUDGET_DRAW_CARDS, SCIENTISTS_BUDGET_ID,
  SCIENTISTS_BUDGET_LEVY, SCIENTISTS_BUDGET_LEVY_AMOUNT, SCIENTISTS_BUDGET_MEGACREDITS, SCIENTISTS_BUDGET_NO_TAGS_REASON,
} from '../../src/server/parliament/resolutions/scientists/ScientistsBudget';
import {
  INDUSTRIALIST_BUDGET, INDUSTRIALIST_BUDGET_LEVY, INDUSTRIALIST_BUDGET_MEGACREDITS,
} from '../../src/server/parliament/resolutions/industrialists/IndustrialistBudget';
import {MEDICAL_DATABASE_RESOURCES} from '../../src/server/parliament/resolutions/scientists/MedicalDatabase';
import {RD_FUNDING_ID} from '../../src/server/parliament/resolutions/scientists/RdFunding';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, passToParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {declaredCountIds, declaredStockReads, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {RESOLUTION_TAG_COUNTING_MODE, resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {LEVY_STEP_KEY, levyDeclared, levyNetEffectOf, levyNothingReasonKey, levyPaid, levyShortReasonKey} from '../../src/common/parliament/resolutionLevy';
import {rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Research} from '../../src/server/cards/base/Research';
import {GHGProducingBacteria} from '../../src/server/cards/base/GHGProducingBacteria';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * SCIENTISTS BUDGET (Turmoil Redux, RX27) — the SECOND card of the BUDGET
 * family, assembled entirely out of parts that already shipped: the shared
 * LEVY of 10 M€ (RX15), the science-tag count (RX18) and the shared
 * external-draw intake (RX05 / RX16 / RX24). Its own code is three
 * declarations and two ordinary steps.
 *
 * What these specs pin: the printed order is the executed order (the records'
 * before/after chain proves it); the LEVY is the family's, unchanged and
 * untouched (12 M€ leaves 2; 4 M€ pays 4 of 10 and says so; 0 M€ is a named
 * skip — and all three are still paid and still dealt to); the payout is
 * PRINTED science tags + influence, with no cap and no bonus of any law in it;
 * the 2 cards are FLAT (influence buys none, they never join the money) and
 * come through the intake, so a reload inside the take draws nothing twice, a
 * short deck delivers what it has and an empty one is named; MarsBot is never
 * levied, paid or dealt to; and RX15 pays exactly what it did before.
 */
const BUDGET = resolutionInstanceId(SCIENTISTS_BUDGET_ID, 0);
const INDUSTRIAL = resolutionInstanceId(INDUSTRIALIST_BUDGET.id, 0);
const RDF = resolutionInstanceId(RD_FUNDING_ID, 0);

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

function recordsOf(parliament: Parliament, player: TestPlayer) {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return (summary?.outcomes ?? []).filter((o) => o.player === player.id);
}

function outcomeOf(parliament: Parliament, player: TestPlayer, step: string) {
  return recordsOf(parliament, player).find((o) => o.step === step);
}

/** The live mandatory take of `player`, if that is what it is waiting for. */
function takePrompt(player: IPlayer): SelectCard<IProjectCard> | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectCard && (wf as SelectCard<IProjectCard>).externalDrawPrompt !== undefined ?
    wf as SelectCard<IProjectCard> : undefined;
}

/** Answer the whole take in one press (what «B забрать все» sends). */
function takeAll(player: IPlayer): Array<CardName> {
  const ask = takePrompt(player);
  if (ask === undefined) {
    throw new Error(`${player.color} is not being asked to take cards`);
  }
  const names = ask.cards.map((c) => c.name);
  player.process({type: 'card', cards: names});
  return names;
}

/** Every seat takes what it was dealt, in generation order, until nobody owes a take. */
function takeEverything(game: IGame): void {
  for (let round = 0; round < 8; round++) {
    let taken = 0;
    for (const player of game.playersInGenerationOrder) {
      if (takePrompt(player) !== undefined) {
        takeAll(player);
        runAllActions(game);
        taken++;
      }
    }
    if (taken === 0) {
      return;
    }
  }
  throw new Error('the takes did not settle in 8 rounds');
}

describe('ScientistsBudget', () => {
  describe('the catalog entry', () => {
    it('is RX27 of the Scientists, dealt as ONE card in every game (no expansion needed), with the 2-science-tag quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(SCIENTISTS_BUDGET_ID)).eq(SCIENTISTS_BUDGET);
      expect(SCIENTISTS_BUDGET_CODE).eq('RX27');
      expect(SCIENTISTS_BUDGET_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX27')).eq(SCIENTISTS_BUDGET);
      expect(SCIENTISTS_BUDGET.party).eq(PartyName.SCIENTISTS);
      expect(SCIENTISTS_BUDGET.module).eq('turmoilRedux');
      expect(SCIENTISTS_BUDGET.compatibility, 'a base card').is.undefined;
      expect(SCIENTISTS_BUDGET.quest).deep.eq({goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2});
      expect(SCIENTISTS_BUDGET.winnerSteps, 'no winner-only part').is.undefined;
      expect(SCIENTISTS_BUDGET.winnerReward, 'no winner tile either').is.undefined;
      expect(SCIENTISTS_BUDGET.worldSteps, 'no world part').is.undefined;
      expect(SCIENTISTS_BUDGET.worldMoves, 'the planet is untouched').is.undefined;
      expect(SCIENTISTS_BUDGET.passive, 'no passive').is.undefined;
      expect(SCIENTISTS_BUDGET.action, 'no action').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === BUDGET)).has.length(1);
    });

    it('is ASSEMBLED, not written again: the family\'s levy VERBATIM, Medical Database\'s count term, a FLAT draw — and only three steps', () => {
      // THE LEVY: the same shape RX15 declared, with the same sum — nothing of this card's own.
      expect(SCIENTISTS_BUDGET.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
      expect(SCIENTISTS_BUDGET.levy).deep.eq(INDUSTRIALIST_BUDGET_LEVY);
      expect(SCIENTISTS_BUDGET_LEVY_AMOUNT).eq(10);
      expect(levyDeclared(SCIENTISTS_BUDGET.levy)).is.true;
      // THE COUNT: the id Medical Database introduced — no new one was coined for the same tag.
      expect(SCIENTISTS_BUDGET_MEGACREDITS.count).deep.eq({id: 'scienceTags', per: 1});
      expect(SCIENTISTS_BUDGET_MEGACREDITS.count).deep.eq(MEDICAL_DATABASE_RESOURCES.count);
      expect(SCIENTISTS_BUDGET_MEGACREDITS.unit).deep.eq(INDUSTRIALIST_BUDGET_MEGACREDITS.unit);
      expect(SCIENTISTS_BUDGET_MEGACREDITS.perInfluence).eq(1);
      expect(SCIENTISTS_BUDGET_MEGACREDITS.cap, 'the card prints no maximum — none is declared').is.undefined;
      expect(resolutionCountKind('scienceTags')).deep.eq({kind: 'tags', tags: [Tag.SCIENCE]});
      // THE DRAW: flat — a base of 2 and a rate of 0, no level term (this is «draw 2», not «draw up to»).
      expect(SCIENTISTS_BUDGET_DRAW).deep.eq({id: 'draw', unit: {kind: 'cards'}, base: 2, perInfluence: 0, recipient: 'each'});
      expect(SCIENTISTS_BUDGET_DRAW_CARDS).eq(2);
      expect(SCIENTISTS_BUDGET_DRAW.level, 'not a level: the hand is never read').is.undefined;
      expect(SCIENTISTS_BUDGET_DRAW.count, 'and it counts nothing').is.undefined;
      expect(SCIENTISTS_BUDGET.scaled).deep.eq([SCIENTISTS_BUDGET_MEGACREDITS, SCIENTISTS_BUDGET_DRAW]);
      // THE NET stands on the M€ payout alone — a hand of cards is never the other half of a levy.
      expect(levyNetEffectOf(SCIENTISTS_BUDGET_LEVY, SCIENTISTS_BUDGET.scaled)).eq(SCIENTISTS_BUDGET_MEGACREDITS);
      // THE PRINTED ORDER: the levy step FIRST, the payout, the cards.
      expect(SCIENTISTS_BUDGET.immediateSteps?.map((step) => step.key)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'draw']);
      expect(SCIENTISTS_BUDGET.immediateStepsFor, 'no per-player step plan').is.undefined;
      expect(familyOf(SCIENTISTS_BUDGET), 'the stand opens the tag-count family from the declaration alone').eq('counted-tags');
      // The catalog's models: the count id was already declared, and the levied supply rides the seat model.
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('scienceTags');
      expect(declaredStockReads(REDUX_RESOLUTION_CATALOG)).includes(Resource.MEGACREDITS);
    });

    it('the face prints «2 [card]» over «−10 [M€] · 1 [M€] / [science tag] + [influence]»; the quest graphic is two science tags', () => {
      const [cards, rate] = SCIENTISTS_BUDGET.renderData.rows;
      const cardItems = cards.filter(isICardRenderItem);
      expect(cardItems.map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.CARDS, 2]]);
      const rateItems = rate.filter(isICardRenderItem);
      expect(rateItems.map((item) => item.type)).deep.eq(
        [CardRenderItemType.MEGACREDITS, CardRenderItemType.MEGACREDITS, CardRenderItemType.TAG, CardRenderItemType.INFLUENCE]);
      expect(rateItems[0].amount, 'the negative is printed INSIDE the tile, as on the card').eq(-10);
      expect(rateItems[0].amountInside).is.true;
      expect(rateItems[1].amount, 'the rate').eq(1);
      expect(rateItems[2].tag, 'the counted object is the printed science medallion').eq(Tag.SCIENCE);
      const [quest] = questRenderData(SCIENTISTS_BUDGET.quest).rows;
      expect(quest.filter(isICardRenderItem).map((item) => [item.type, item.tag, item.amount])).deep.eq([[CardRenderItemType.TAG, Tag.SCIENCE, 2]]);
    });

    it('the formula: science tags + influence, no cap; the draw is 2 whatever the influence', () => {
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 3, 3], [2, 0, 2], [2, 3, 5], [7, 5, 12]];
      for (const [count, influence, expected] of cases) {
        expect(scaledAmount(SCIENTISTS_BUDGET_MEGACREDITS, influence, count), `count ${count} I=${influence}`).eq(expected);
        expect(uncappedAmount(SCIENTISTS_BUDGET_MEGACREDITS, influence, count)).eq(expected);
      }
      for (const influence of [0, 1, 3, 5]) {
        expect(scaledAmount(SCIENTISTS_BUDGET_DRAW, influence), `flat at I=${influence}`).eq(2);
      }
    });
  });

  describe('the enactment — the printed order, for every participant', () => {
    it('levy → payout → draw, in that order, for EVERY participant (voters or not): the records\' before/after chain proves it', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3; Research (2 tags) + GHG bacteria (1) = 3 → +6.
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Research(), new GHGProducingBacteria());
      // p2 never voted — influence 1, no science tag: influence pays on its own.
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      const income1 = incomeOf(p1);
      const income2 = incomeOf(p2);
      const deckBefore = game.projectDeck.drawPile.length;
      endGeneration(game);
      runAllActions(game);
      expect(parliament.enacted).eq(BUDGET);
      expect(parliament.rulingParty()).eq(PartyName.SCIENTISTS);
      // THE ORDER, by the record list and by the chain of supplies.
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'draw']);
      const levy1 = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      expect(levy1).deep.eq({
        player: p1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'stock', stock: Resource.MEGACREDITS,
        amount: -10, owed: 10, before: 20 + income1, after: 10 + income1});
      expect(paid1).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 6, count: 3, influence: 3, before: levy1.after, after: levy1.after! + 6});
      expect(paid1.counted, 'the cards that made the count').deep.eq([CardName.RESEARCH, CardName.GHG_PRODUCING_BACTERIA]);
      expect(paid1.countedUnits, 'Research prints two').deep.eq([2, 1]);
      expect(paid1.uncapped, 'no cap declared — no sum beside the amount').is.undefined;
      expect(p1.megaCredits).eq(paid1.after);
      // THE DRAW is last, and its cards are WITHHELD until the take.
      const draw1 = outcomeOf(parliament, p1, 'draw')!;
      expect(draw1).deep.include({kind: 'cards', effect: 'draw', amount: 2, drawn: 2, influence: 3});
      expect(game.projectDeck.drawPile.length, 'they left the deck at the enactment').eq(deckBefore - 2);
      expect(p1.cardsInHand, 'not in the hand until taken').is.empty;
      const ask = takePrompt(p1);
      expect(ask?.cards).has.length(2);
      expect(ask?.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: SCIENTISTS_BUDGET_ID, effect: 'draw'});
      expect(ask?.choiceContext?.source).deep.eq({kind: 'resolution', resolution: SCIENTISTS_BUDGET_ID});
      expect(p2.getWaitingFor(), 'p2 waits its turn').is.undefined;
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(2);
      // …then p2: its own levy, its own influence, and the same two cards.
      const levy2 = outcomeOf(parliament, p2, LEVY_STEP_KEY)!;
      const paid2 = outcomeOf(parliament, p2, 'megacredits')!;
      expect(levy2).deep.include({kind: 'stock', amount: -10, owed: 10, before: 20 + income2, after: 10 + income2});
      expect(paid2).deep.include({kind: 'stock', amount: 1, count: 0, influence: 1, before: levy2.after, after: levy2.after! + 1});
      expect(paid2.counted, 'no card is counted').deep.eq([]);
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 2, influence: 1});
      takeAll(p2);
      runAllActions(game);
      expect(p2.cardsInHand).has.length(2);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      // The events say the same order under the resolution's source: −10, then +6.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === SCIENTISTS_BUDGET_ID && e.player === p1.color &&
        e.type !== 'action');
      expect(mine.map((e) => e.type)).deep.eq(['resource-changed', 'resource-changed', 'cards-drawn']);
      expect(mine[0].impact?.stock?.megacredits).eq(-10);
      expect(mine[1].impact?.stock?.megacredits).eq(6);
      // The reward address reads the levy as a LOSS, never as a skip.
      const delivery = rewardAddressOf({...levy1, player: p1.color}, p1.color);
      expect(delivery.direction).eq('loss');
      expect(delivery.skipped).is.undefined;
    });

    it('the levy is the family\'s, bounded by the seat: 12 M€ leaves 2; 4 M€ pays 4 of 10 and says so; 0 M€ is a named skip — all three are still paid and still dealt to', () => {
      const levy = SCIENTISTS_BUDGET_LEVY;
      expect([levyPaid(levy, 12), levyPaid(levy, 4), levyPaid(levy, 0)]).deep.eq([10, 4, 0]);
      // 12 M€ AT THE SITTING: no rating, no production, so the production phase adds nothing.
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.megaCredits = 12;
      p1.terraformRating = 0;
      endGeneration(game);
      runAllActions(game);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10, before: 12, after: 2});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 3, count: 0, influence: 3, before: 2, after: 5});
      expect(p1.megaCredits, '12 − 10 + 3').eq(5);
      expect(takePrompt(p1)?.cards, 'and the two cards all the same').has.length(2);

      // 4 M€: the take is what the seat holds, the shortfall is on the PAYING record, and the payout still comes.
      const [game2, q1, , parl2] = stage();
      parl2.agenda.set(q1.id, 4);
      q1.playedCards.push(new Research());
      q1.megaCredits = 4;
      q1.terraformRating = 0;
      endGeneration(game2);
      runAllActions(game2);
      expect(outcomeOf(parl2, q1, LEVY_STEP_KEY)).deep.include(
        {kind: 'stock', amount: -4, owed: 10, before: 4, after: 0, reason: levyShortReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl2, q1, 'megacredits')).deep.include({kind: 'stock', amount: 5, count: 2, influence: 3, before: 0, after: 5});
      expect(q1.megaCredits, 'never below zero on the way').eq(5);
      expect(takePrompt(q1)?.cards).has.length(2);
      expect(game2.gameLog.filter((e) => e.message.startsWith('${0} pays only ${1} of the ${2} ${3} owed')), 'the shortfall is named').has.length(1);
      expect(game2.gameLog.filter((e) => e.message.includes('Adjusting')), 'the take carried its source — no illegal-state line').deep.eq([]);

      // 0 M€: a named skip carrying the owed sum — and the card still pays and still deals.
      const [game3, r1, , parl3] = stage();
      parl3.agenda.set(r1.id, 4);
      r1.megaCredits = 0;
      r1.terraformRating = 0;
      endGeneration(game3);
      runAllActions(game3);
      expect(outcomeOf(parl3, r1, LEVY_STEP_KEY)).deep.eq(
        {player: r1.id, step: LEVY_STEP_KEY, part: 'effect', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 10, reason: levyNothingReasonKey(Resource.MEGACREDITS)});
      expect(outcomeOf(parl3, r1, 'megacredits')).deep.include({kind: 'stock', amount: 3, influence: 3, before: 0, after: 3});
      expect(takePrompt(r1)?.cards).has.length(2);
      expect(game3.events.events.filter((e) => e.type === 'resource-changed' && e.player === r1.color && e.source?.kind === 'resolution' &&
        (e.impact?.stock?.megacredits ?? 0) < 0), 'not one M€ left the seat').has.length(0);
    });

    it('a payout of zero (no science tags, no influence) is NAMED — the levy is still taken and the two cards still come', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Research());
      // p2: influence 0, and a wild tag that is NOT a science tag at an enactment.
      p2.playedCards.push(new NobelPrize());
      endGeneration(game);
      runAllActions(game);
      // The draw ASKS, so the sitting walks the seats one take at a time — every record is in once they are answered.
      takeEverything(game);
      expect(outcomeOf(parliament, p2, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include(
        {kind: 'skipped', amount: 0, count: 0, influence: 0, reason: SCIENTISTS_BUDGET_NO_TAGS_REASON});
      expect(outcomeOf(parliament, p2, 'draw'), 'the cards do not depend on the payout').deep.include({kind: 'cards', amount: 2, drawn: 2});
      expect(game.gameLog.filter((e) => e.message.startsWith('${0} has no science tags and no influence')), 'p2\'s zero is named').has.length(1);
      // …while p1's two tags and influence 3 pay 5.
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 5, count: 2, influence: 3});
    });

    it('the 2 cards are FLAT: influence 0 and influence 5 are dealt the same two, and they never join the money', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      parliament.agenda.set(p2.id, agendaForInfluence(0));
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 2, influence: 3});
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 2, influence: 0});
      // The money record is its own: the cards are a separate step, never an addend of the payout.
      expect(outcomeOf(parliament, p1, 'megacredits')?.amount).eq(3);
      expect(outcomeOf(parliament, p2, 'megacredits')?.kind, 'influence 0 and no tag: a named skip').eq('skipped');
      expect(outcomeOf(parliament, p1, 'draw')?.stock, 'a draw is not a supply record').is.undefined;
      expect([p1.cardsInHand.length, p2.cardsInHand.length]).deep.eq([2, 2]);
    });

    it('a SHORT deck delivers what is left and names it; an EMPTY deck is a named skip, nothing is substituted', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      const only = game.projectDeck.drawPile.slice(-1);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      game.projectDeck.drawPile.push(...only);
      endGeneration(game);
      runAllActions(game);
      expect(takePrompt(p1)?.cards, 'one of the two owed').has.length(1);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 1});
      expect(game.gameLog.some((e) => e.message.includes('were left in the deck for'))).is.true;
      takeAll(p1);
      runAllActions(game);

      const [game2, q1, , parl2] = stage();
      parl2.agenda.set(q1.id, 4);
      game2.projectDeck.drawPile.length = 0;
      game2.projectDeck.discardPile.length = 0;
      endGeneration(game2);
      runAllActions(game2);
      expect(takePrompt(q1), 'nothing to take').is.undefined;
      expect(q1.cardsInHand).is.empty;
      expect(outcomeOf(parl2, q1, 'draw')).deep.include({kind: 'skipped', amount: 2, drawn: 0, reason: 'The project deck is empty'});
      // The levy and the payout are untouched by an empty deck.
      expect(outcomeOf(parl2, q1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10});
      expect(outcomeOf(parl2, q1, 'megacredits')).deep.include({kind: 'stock', amount: 3});
    });

    it('a neutral winner cancels nothing: every participant is levied, paid and dealt to', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, BUDGET);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.megaCredits = 20;
      p2.megaCredits = 20;
      p1.playedCards.push(new Research());
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      expect((parliament.lastPhase ?? parliament.phase?.summary)?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(BUDGET);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({amount: 2, count: 2, influence: 0});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({amount: 2, count: 0, influence: 2});
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({amount: 2, drawn: 2});
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({amount: 2, drawn: 2});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part === 'effect'), 'no winner part, no world part').is.true;
    });

    it('the journal carries the three lines per seat with the resolution as their source: the levy with both sums, the payout with its inputs, the draw', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Research(), new GHGProducingBacteria());
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      const levy = outcomeOf(parliament, p1, LEVY_STEP_KEY)!;
      const levyLines = game.gameLog.filter((entry) => entry.message === '${0} pays ${1} ${2} to ${3} (${4} → ${5})');
      expect(levyLines, 'one levy line per seat').has.length(2);
      const mine = levyLines.find((entry) => entry.data[0].value === p1.color)!;
      expect(mine.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(SCIENTISTS_BUDGET_ID);
      expect(mine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['10', String(levy.before), String(levy.after)]);
      const payLine = game.gameLog.find((entry) => entry.message.startsWith('${0} gained ${1} M€ from ${2}: ${3} science tag(s)') &&
        entry.data[0].value === p1.color)!;
      expect(payLine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value))
        .deep.eq(['6', '3', '3', String(levy.after), String(levy.after! + 6)]);
      expect(game.gameLog.filter((entry) => entry.message === '${0} draws ${1} card(s) from ${2}: 2 for every player'), 'one draw line per seat').has.length(2);
    });
  });

  describe('THE TAG BONUS OF R&D FUNDING (RX26) IS NOT IN THIS COUNT — and never can be', () => {
    /*
     * R&D Funding grants «additional science tags equal to your influence WHEN
     * TAKING ACTIONS» — a hook inside `includeTagSubstitutions`, which the
     * substitution modes ask and `'raw'` never does. A resolution's payout is
     * not an action, so this budget pays by the PRINTED tags. TWO independent
     * reasons keep it that way, and both are pinned below:
     *   1. the counting MODE: resolution count terms read `'raw'`;
     *   2. the GOVERNMENT: only one resolution is enacted at a time, and the
     *      `enact` step seats THIS budget there BEFORE the effects run — so
     *      whichever law granted the bonus has already left when the payout is
     *      made. (Which is also why the vote panel's raw estimate is not just
     *      «the rule» but literally correct: win the vote and the bonus is gone.)
     * Do not «fix» this by counting the bonus: it would pay for an action
     * nobody took, under a law that no longer stands.
     */
    it('the count reads PRINTED tags under the standing law: the tag zone says 2 + 2, `scienceTags` says 2', () => {
      const [, p1, , parliament] = reduxGame();
      parliament.enacted = RDF;
      p1.playedCards.push(new Research());
      parliament.agenda.set(p1.id, agendaForInfluence(2));
      expect(parliament.enactedDefinition()?.id, 'the law stands').eq(RD_FUNDING_ID);
      expect(ParliamentHandler.tagBonus(p1, Tag.SCIENCE), 'the law grants 1 per influence').eq(2);
      expect(ParliamentHandler.tagBonuses(p1), 'and the tag zone names it').deep.eq([{tag: Tag.SCIENCE, amount: 2, resolution: RD_FUNDING_ID}]);
      // The two modes, side by side: an ACTION sees the addition (and the Scientists' ruling wild tag), an enactment does not.
      expect(p1.tags.count(Tag.SCIENCE, 'default'), 'printed 2 + wild 1 + bonus 2').eq(5);
      expect(RESOLUTION_TAG_COUNTING_MODE).eq('raw');
      expect(p1.tags.count(Tag.SCIENCE, RESOLUTION_TAG_COUNTING_MODE)).eq(2);
      const counted = resolutionCount(p1, 'scienceTags');
      expect(counted.count, 'the budget counts the printed tags').eq(2);
      expect(counted.cards).deep.eq([CardName.RESEARCH]);
      expect(scaledAmount(SCIENTISTS_BUDGET_MEGACREDITS, 2, counted.count), '2 printed + influence 2').eq(4);
    });

    it('…and the enactment pays by them: R&D Funding standing, the budget wins, the record is the printed count', () => {
      const [game, p1, , parliament] = stage();
      seatEnacted(parliament, RDF);
      parliament.agenda.set(p1.id, 4); // influence 3 at the effect
      p1.playedCards.push(new Research());
      expect(ParliamentHandler.tagBonus(p1, Tag.SCIENCE), 'the bonus is live while the vote runs').is.greaterThan(0);
      endGeneration(game);
      runAllActions(game);
      // The budget took the government — the law it replaced is in the discard, its bonus gone.
      expect(parliament.enacted).eq(BUDGET);
      expect(ParliamentHandler.tagBonus(p1, Tag.SCIENCE)).eq(0);
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 5, count: 2, influence: 3});
      expect(outcomeOf(parliament, p1, 'megacredits')?.counted).deep.eq([CardName.RESEARCH]);
    });
  });

  describe('once per enactment — nothing is taken, paid or drawn twice', () => {
    it('a reload INSIDE the take draws nothing again: the cards sit in the intake, the prompt is re-derived, the take lands once', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Research());
      endGeneration(game);
      runAllActions(game);
      const offered = takePrompt(p1)!.cards.map((c) => c.name);
      const deckAfter = game.projectDeck.drawPile.length;
      const cash = p1.megaCredits;

      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(live.projectDeck.drawPile.length, 'nothing was drawn a second time').eq(deckAfter);
      expect(one.megaCredits, 'nor taken or paid again').eq(cash);
      const again = takePrompt(one);
      expect(again?.cards.map((c) => c.name), 'the same two cards').deep.eq(offered);
      expect(again?.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: SCIENTISTS_BUDGET_ID, effect: 'draw'});
      takeAll(one);
      runAllActions(live);
      expect(one.cardsInHand.map((c) => c.name)).deep.members(offered);
      expect(one.pendingCardIntakes).is.empty;
      takeEverything(live);
      settleParliamentGates(live);
      const records = (live.parliament!.lastPhase ?? live.parliament!.phase?.summary)?.outcomes?.filter((o) => o.player === p1.id) ?? [];
      expect(records.map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'draw']);
      expect(records.filter((o) => o.step === 'draw')).has.length(1);
    });

    it('a later tableau, a later influence and a change of government never recompute what was taken or paid', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Research());
      endGeneration(game);
      runAllActions(game);
      takeAll(p1);
      runAllActions(game);
      const cash = p1.megaCredits;
      const records = recordsOf(parliament, p1);
      p1.playedCards.push(new GHGProducingBacteria(), new Tardigrades());
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.megaCredits).eq(cash);
      expect(recordsOf(parliament, p1)).deep.eq(records);
      expect(resolutionCount(p1, 'scienceTags').count, 'the live count moved — the record did not').eq(3);
      seatEnacted(parliament, ARCHITECTURE_AWARD_ID);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      expect(p1.megaCredits).eq(cash);
      expect(p1.cardsInHand).has.length(2);
    });
  });

  describe('the chairman quest — play 2 science tags', () => {
    it('the enactment\'s own draw moves no progress; the player\'s OWN two science tags complete it', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(SCIENTISTS_BUDGET_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2});
      expect(parliament.questProgressOf(p1), 'taking the dealt cards is not playing a tag').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      // ONE card printing TWO science tags completes it in one play.
      p1.playCard(new Research());
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      // Once per generation: nobody else completes it.
      p2.playCard(new Research());
      runAllActions(game);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('the stand — the scenarios a tag-counted law opens', () => {
    /*
     * THE STAND IS DERIVED FROM THE DECLARATION, but a COUNTED family's
     * scenarios carry a TABLEAU, and a tableau is only legible under the count
     * it was laid out for: Central Power Grid's power cards read ZERO on every
     * row under a science law, teaching the rule backwards. So every scenario
     * of the tag-counted family declares WHICH count it belongs to
     * (`counts: '<id>'`, the filter the board-counted family already uses) —
     * the rule, not the two ids, is what this guard keeps.
     */
    const STAND = path.join(__dirname, '..', '..', 'src', 'client', 'components', 'console', 'parliament', 'ConsoleResolutionsPlayground.vue');

    it('every scenario of the tag-counted family names the count its tableau is laid out for', () => {
      const source = fs.readFileSync(STAND, 'utf8');
      const scenarios = source.split('\n').filter((line) => line.includes("family: 'counted-tags'"));
      expect(scenarios.length, 'the family has scenarios at all').is.greaterThan(0);
      const unnamed = scenarios.filter((line) => !line.includes("counts: '")).map((line) => line.trim().slice(0, 60));
      expect(unnamed, 'a tag scenario without its count shows one law another law\'s tableau').deep.eq([]);
      expect(scenarios.filter((line) => line.includes("counts: 'scienceTags'")).length,
        'this card opens its own: the levy\'s edges, the tag count\'s, and the empty deck').is.greaterThan(4);
      expect(source, 'the empty deck is one of them, and it is the DRAW that is named').includes('emptyDeck: true');
    });
  });

  describe('MarsBot, the model, and RX15 standing where it stood', () => {
    it('MarsBot (mode none) is never levied, never paid, never dealt to, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BUDGET);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new Research());
      const cash = human.megaCredits;
      const income = incomeOf(human);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);   // the assembly gate, then the effects run
      takeEverything(game);          // …and the one human seat takes its two cards
      settleParliamentGates(game);   // the adjourn gate
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.map((o) => o.player)).deep.eq([human.id, human.id, human.id]);
      expect(outcomes.map((o) => o.step)).deep.eq([LEVY_STEP_KEY, 'megacredits', 'draw']);
      expect(outcomes[0]).deep.include({kind: 'stock', amount: -10, owed: 10});
      expect(outcomes[1]).deep.include({kind: 'stock', amount: 3, count: 2, influence: 1});
      expect(human.megaCredits, '−10 and (2 + I 1) on top of the production phase\'s income').eq(cash + income - 10 + 3);
      expect(human.cardsInHand).has.length(2);
      // The bot's own production phase moves its supply; THIS card never does — nothing of its own
      // was taken, paid or drawn under the resolution's source (its income is not our business).
      expect(game.events.events.filter((e) => e.player === bot.color && e.source?.kind === 'resolution'),
        'nothing reached the bot under the resolution').is.empty;
      expect(bot.pendingCardIntakes, 'and no intake was opened for it').is.empty;
      const model = getParliamentModel(game, human);
      expect(model?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
      expect(model?.players.find((p) => p.color === bot.color)?.stock, 'no levied supply for it either').is.undefined;
    });

    it('every seat\'s science-tag count and the SUPPLY the levy reads ride the model; the records reach the client with `owed` and the card list', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Research(), new GHGProducingBacteria());
      p1.megaCredits = 34;
      p2.megaCredits = 4;
      const model = getParliamentModel(game, p2);
      const one = model?.players.find((p) => p.color === p1.color);
      expect(one?.counts?.find((c) => c.id === 'scienceTags')).deep.eq(
        {id: 'scienceTags', count: 3, cards: [CardName.RESEARCH, CardName.GHG_PRODUCING_BACTERIA], units: [2, 1]});
      expect(one?.stock).to.include({[Resource.MEGACREDITS]: 34});
      const two = model?.players.find((p) => p.color === p2.color);
      expect(two?.counts?.find((c) => c.id === 'scienceTags')).deep.eq({id: 'scienceTags', count: 0, cards: [], units: []});
      expect(two?.stock, 'the seat the panel will warn about').to.include({[Resource.MEGACREDITS]: 4});
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10});
      const paid = last?.outcomes?.find((o) => o.player === p1.color && o.step === 'megacredits');
      expect(paid).deep.include({kind: 'stock', amount: 6, count: 3, influence: 3});
      expect(paid?.countedUnits).deep.eq([2, 1]);
      expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 2});
    });

    it('RX15 DID NOT MOVE: Industrialist Budget levies, counts and pays exactly what it did before', () => {
      const [game, p1, , parliament] = reduxGame();
      seatResolution(parliament, 0, INDUSTRIAL);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.megaCredits = 20;
      p1.terraformRating = 0;
      parliament.agenda.set(p1.id, 4); // influence 3 at the effect
      p1.production.add(Resource.STEEL, 2);
      p1.production.add(Resource.TITANIUM, 1);
      p1.production.add(Resource.ENERGY, 3);
      endGeneration(game);
      runAllActions(game);
      expect(parliament.enacted).eq(INDUSTRIAL);
      expect(outcomeOf(parliament, p1, LEVY_STEP_KEY)).deep.include({kind: 'stock', amount: -10, owed: 10, before: 20, after: 10});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 9, count: 6, influence: 3, before: 10, after: 19});
      expect(outcomeOf(parliament, p1, 'production')).deep.include({kind: 'production', amount: 4, before: 0, after: 4});
      expect(p1.megaCredits).eq(19);
      // …and the two budgets remain two cards of one family: the same levy, different counts.
      expect(INDUSTRIALIST_BUDGET.levy).deep.eq(SCIENTISTS_BUDGET.levy);
      expect(INDUSTRIALIST_BUDGET_MEGACREDITS.count?.id).eq('steelTitaniumEnergyProduction');
      expect(SCIENTISTS_BUDGET_MEGACREDITS.count?.id).eq('scienceTags');
    });

    it('the generation passes on to the next sitting after this budget — the deck is not disturbed', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
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
