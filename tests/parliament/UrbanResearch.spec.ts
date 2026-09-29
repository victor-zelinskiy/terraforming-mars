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
  URBAN_RESEARCH, URBAN_RESEARCH_CODE, URBAN_RESEARCH_DRAW, URBAN_RESEARCH_ID, URBAN_RESEARCH_MEGACREDITS,
  URBAN_RESEARCH_NO_INFLUENCE_REASON, URBAN_RESEARCH_NO_TAGS_REASON,
} from '../../src/server/parliament/resolutions/marsFirst/UrbanResearch';
import {SCIENTISTS_BUDGET, SCIENTISTS_BUDGET_DRAW, SCIENTISTS_BUDGET_MEGACREDITS} from '../../src/server/parliament/resolutions/scientists/ScientistsBudget';
import {MIGRATION_FUNDING_MEGACREDITS} from '../../src/server/parliament/resolutions/marsFirst/MigrationFunding';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, passToParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {declaredCountIds, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {SpaceId} from '../../src/common/Types';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '../../src/common/cards/render/Types';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {RESOLUTION_TAG_COUNTING_MODE, resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Capital} from '../../src/server/cards/base/Capital';
import {DomedCrater} from '../../src/server/cards/base/DomedCrater';
import {Mine} from '../../src/server/cards/base/Mine';
import {NobelPrize} from '../../src/server/cards/prelude2/NobelPrize';
import {EarlySettlement} from '../../src/server/cards/prelude/EarlySettlement';
import {LunaEcumenopolis} from '../../src/server/cards/moon/LunaEcumenopolis';
import {Odyssey} from '../../src/server/cards/pathfinders/Odyssey';
import {addCity, fakeCard, runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';

/**
 * URBAN RESEARCH (Turmoil Redux, RX31) — a card assembled out of parts that
 * already shipped: a COUNTED term over the tableau (RX04 / RX18 / RX27) and the
 * shared external-draw intake (RX05 / RX16 / RX27). The one new thing is the
 * COMBINATION: the amount of a DRAW is a count.
 *
 * What these specs pin: the count is the CITY TAGS of the tableau and NEVER the
 * cities of the board (five cities on Mars and no city tag draw nothing — the
 * cheapest way to break this card is to reach for `marsCities`); a card
 * printing two city tags is 2, a wild tag is none, a played event's tags are
 * face down; the two halves are independent and each names its OWN zero; the
 * printed order is the executed order (draw, then the money, per seat); the
 * cards come through the intake, so a reload inside the take draws nothing
 * twice, a short deck delivers what it has and an empty one is named; MarsBot
 * is never dealt to or paid; and RX27 pays exactly what it did before.
 */
const RESEARCH_LAW = resolutionInstanceId(URBAN_RESEARCH_ID, 0);
const BUDGET = resolutionInstanceId(SCIENTISTS_BUDGET.id, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat the law in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, RESEARCH_LAW);
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

describe('UrbanResearch', () => {
  describe('the catalog entry', () => {
    it('is RX31 of Mars First, dealt as ONE card in every game (no expansion needed), with the 1-city-tag quest', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(URBAN_RESEARCH_ID)).eq(URBAN_RESEARCH);
      expect(URBAN_RESEARCH_CODE).eq('RX31');
      expect(URBAN_RESEARCH_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX31')).eq(URBAN_RESEARCH);
      expect(URBAN_RESEARCH.party).eq(PartyName.MARS);
      expect(URBAN_RESEARCH.module).eq('turmoilRedux');
      expect(URBAN_RESEARCH.compatibility, 'a base card').is.undefined;
      expect(URBAN_RESEARCH.quest).deep.eq({goal: {kind: 'tag', tag: Tag.CITY}, count: 1});
      expect(URBAN_RESEARCH.winnerSteps, 'no winner-only part').is.undefined;
      expect(URBAN_RESEARCH.winnerReward, 'no winner tile either').is.undefined;
      expect(URBAN_RESEARCH.worldSteps, 'no world part').is.undefined;
      expect(URBAN_RESEARCH.tileGrant, 'nothing is granted by threshold').is.undefined;
      expect(URBAN_RESEARCH.levy, 'nothing is paid for it').is.undefined;
      expect(URBAN_RESEARCH.passive, 'no passive').is.undefined;
      expect(URBAN_RESEARCH.action, 'no action').is.undefined;
      const dealt = REDUX_RESOLUTION_CATALOG.dealtInstances(() => true);
      expect(dealt.filter((instance) => instance === RESEARCH_LAW)).has.length(1);
    });

    it('is ASSEMBLED: a COUNTED draw (the new combination) and an ordinary payout by influence — two steps, no cap', () => {
      // THE DRAW: the unit Scientists Budget declared, sized by a COUNT for the first time.
      expect(URBAN_RESEARCH_DRAW).deep.eq({id: 'draw', unit: {kind: 'cards'}, perInfluence: 0, count: {id: 'cityTags', per: 1}, recipient: 'each'});
      expect(URBAN_RESEARCH_DRAW.unit).deep.eq(SCIENTISTS_BUDGET_DRAW.unit);
      expect(SCIENTISTS_BUDGET_DRAW.count, 'RX27 draws a FLAT 2 — the combination is this card\'s own').is.undefined;
      expect(URBAN_RESEARCH_DRAW.base, 'no flat part: no city tag means no card').is.undefined;
      expect(URBAN_RESEARCH_DRAW.level, 'not a level: the hand is never read').is.undefined;
      expect(URBAN_RESEARCH_DRAW.sequel, 'and it divides no earlier total').is.undefined;
      expect(URBAN_RESEARCH_DRAW.cap, 'the card prints no maximum').is.undefined;
      // THE MONEY: influence alone, at the rate Migration Funding prints for its own count.
      expect(URBAN_RESEARCH_MEGACREDITS).deep.eq({id: 'megacredits', unit: {kind: 'stock', resource: Resource.MEGACREDITS}, perInfluence: 2, recipient: 'each'});
      expect(URBAN_RESEARCH_MEGACREDITS.unit).deep.eq(SCIENTISTS_BUDGET_MEGACREDITS.unit);
      expect(URBAN_RESEARCH_MEGACREDITS.perInfluence).eq(MIGRATION_FUNDING_MEGACREDITS.perInfluence);
      expect(URBAN_RESEARCH_MEGACREDITS.count, 'no count on this half').is.undefined;
      expect(URBAN_RESEARCH.scaled).deep.eq([URBAN_RESEARCH_DRAW, URBAN_RESEARCH_MEGACREDITS]);
      // THE PRINTED ORDER: the cards, then the money.
      expect(URBAN_RESEARCH.immediateSteps?.map((step) => step.key)).deep.eq(['draw', 'megacredits']);
      expect(URBAN_RESEARCH.immediateStepsFor, 'no per-player step plan').is.undefined;
      expect(familyOf(URBAN_RESEARCH), 'the stand opens the tag-count family from the declaration alone').eq('counted-tags');
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('cityTags');
    });

    it('THE COUNT IS OVER TAGS: `cityTags` is the twin of the science tags, never one of the three city counts over the BOARD', () => {
      expect(resolutionCountKind('cityTags')).deep.eq({kind: 'tags', tags: [Tag.CITY]});
      expect(resolutionCountKind('cityTags')).deep.eq({...resolutionCountKind('scienceTags'), tags: [Tag.CITY]});
      // The three the catalog already holds, and what each of them counts — none of them is a tag.
      expect(resolutionCountKind('spaceCities')).deep.eq({kind: 'board', tiles: 'spaceCity', measure: 'cells'});
      expect(resolutionCountKind('marsCities')).deep.eq({kind: 'board', tiles: 'marsCity', measure: 'cells'});
      expect(resolutionCountKind('marsCityTiers')).deep.eq({kind: 'board', tiles: 'marsCity', measure: 'tiers'});
    });

    it('the face prints «2 [M€] / [influence]» beside «[card] / [city tag]», as the scan does; the quest graphic is ONE city tag', () => {
      const [row] = URBAN_RESEARCH.renderData.rows;
      const items = row.filter(isICardRenderItem);
      expect(items.map((item) => item.type)).deep.eq(
        [CardRenderItemType.MEGACREDITS, CardRenderItemType.INFLUENCE, CardRenderItemType.CARDS, CardRenderItemType.TAG]);
      expect(items[0].amount, 'the rate of the money').eq(2);
      expect(items[2].amount, 'one card per counted tag').eq(1);
      expect(items[3].tag, 'the counted object is the printed CITY medallion — never a city tile').eq(Tag.CITY);
      const [quest] = questRenderData(URBAN_RESEARCH.quest).rows;
      expect(quest.filter(isICardRenderItem).map((item) => [item.type, item.tag, item.amount])).deep.eq([[CardRenderItemType.TAG, Tag.CITY, 1]]);
    });

    it('the formula: one card per city tag whatever the influence; 2 M€ per influence whatever the tags', () => {
      const cases: Array<[number, number, number]> = [[0, 0, 0], [0, 5, 0], [1, 0, 1], [3, 0, 3], [3, 5, 3]];
      for (const [count, influence, expected] of cases) {
        expect(scaledAmount(URBAN_RESEARCH_DRAW, influence, count), `count ${count} I=${influence}`).eq(expected);
        expect(uncappedAmount(URBAN_RESEARCH_DRAW, influence, count)).eq(expected);
      }
      for (const [influence, expected] of [[0, 0], [1, 2], [3, 6], [5, 10]]) {
        expect(scaledAmount(URBAN_RESEARCH_MEGACREDITS, influence), `I=${influence}`).eq(expected);
      }
    });
  });

  describe('⚠ A CITY TAG IS A TAG — the board is not counted, at all', () => {
    it('FIVE cities on Mars and not one city tag: ZERO cards (the count the card must NOT have reached for reads 5)', () => {
      const [game, p1] = reduxGame();
      for (const space of ['35', '36', '42', '43', '48'] as Array<SpaceId>) {
        addCity(p1, space);
      }
      expect(game.board.getCitiesOnMars(p1)).has.length(5);
      expect(resolutionCount(p1, 'marsCities').count, 'the board count the trap would have taken').eq(5);
      expect(resolutionCount(p1, 'marsCityTiers').count).eq(5);
      const counted = resolutionCount(p1, 'cityTags');
      expect(counted.count, 'not one of those tiles prints a tag').eq(0);
      expect(counted.cards, 'and none of them is a card').deep.eq([]);
      expect(scaledAmount(URBAN_RESEARCH_DRAW, 5, counted.count), 'no card is drawn, at any influence').eq(0);
    });

    it('…and the other way round: a city TAG in the tableau with nothing on the board still draws', () => {
      const [game, p1] = reduxGame();
      p1.playedCards.push(new Capital());
      expect(game.board.getCitiesOnMars(p1), 'the board is untouched').is.empty;
      expect(resolutionCount(p1, 'cityTags').count).eq(1);
      expect(resolutionCount(p1, 'marsCities').count).eq(0);
    });
  });

  describe('the count — the canonical tag count, card by card', () => {
    it('ONE card can print TWO city tags, and every face-up source counts: a project, a prelude, a corporation', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new LunaEcumenopolis(), new Capital(), new EarlySettlement());
      const counted = resolutionCount(p1, 'cityTags');
      expect(counted.count, '2 + 1 + 1').eq(4);
      expect(counted.count, 'the canonical counter agrees').eq(p1.tags.count(Tag.CITY, RESOLUTION_TAG_COUNTING_MODE));
      expect(counted.cards).deep.eq([CardName.LUNA_ECUMENOPOLIS, CardName.CAPITAL, CardName.EARLY_SETTLEMENT]);
      expect(counted.units, 'what each of them contributed').deep.eq([2, 1, 1]);
      // A corporation is just another card in the tableau for this count.
      p1.playedCards.push(fakeCard({name: 'City Holdings' as CardName, type: CardType.CORPORATION, tags: [Tag.CITY, Tag.BUILDING]}));
      expect(resolutionCount(p1, 'cityTags').count).eq(5);
    });

    it('a WILD tag is not a city tag at an enactment, and a card without the tag is not counted', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(new NobelPrize(), new Mine(), new Capital());
      // The player's own ACTION context does substitute the wild tag — that is what an enactment must not borrow.
      expect(p1.tags.count(Tag.CITY, 'default'), 'printed 1 + wild 1').eq(2);
      expect(RESOLUTION_TAG_COUNTING_MODE).eq('raw');
      expect(p1.tags.count(Tag.CITY, RESOLUTION_TAG_COUNTING_MODE)).eq(1);
      const counted = resolutionCount(p1, 'cityTags');
      expect(counted.count).eq(1);
      expect(counted.cards).deep.eq([CardName.CAPITAL]);
    });

    it('a played EVENT\'s city tag is face down — unless Odyssey keeps it up; the hand and a rival\'s tableau never count', () => {
      const [, p1, p2] = reduxGame();
      p1.cardsInHand.push(new Capital());
      p2.playedCards.push(new DomedCrater());
      const cityEvent = fakeCard({name: 'Ground Breaking' as CardName, type: CardType.EVENT, tags: [Tag.CITY, Tag.EVENT]});
      p1.playedCards.push(cityEvent);
      expect(resolutionCount(p1, 'cityTags').count, 'hand, rival tableau, face-down event').eq(0);
      expect(resolutionCount(p2, 'cityTags').cards).deep.eq([CardName.DOMED_CRATER]);
      p1.playedCards.push(new Odyssey());
      expect(p1.tags.eventTagsInPlay()).is.true;
      expect(resolutionCount(p1, 'cityTags').cards).deep.eq(['Ground Breaking']);
    });
  });

  describe('the enactment — the printed order, for every participant', () => {
    it('draw → money, in that order, for EVERY participant: the cards leave the deck first and the M€ land after the take', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 4 → step 5 in the phase = influence 3; Capital + Domed Crater = 2 city tags → 2 cards, 6 M€.
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Capital(), new DomedCrater());
      // p2 never voted — influence 1, no city tag: the money comes, the cards do not.
      parliament.agenda.set(p2.id, agendaForInfluence(1));
      const deckBefore = game.projectDeck.drawPile.length;
      endGeneration(game);
      runAllActions(game);
      expect(parliament.enacted).eq(RESEARCH_LAW);
      expect(parliament.rulingParty()).eq(PartyName.MARS);
      // THE ORDER, by the record list: the draw is recorded before the money.
      expect(recordsOf(parliament, p1).map((o) => o.step)).deep.eq(['draw']);
      const draw1 = outcomeOf(parliament, p1, 'draw')!;
      expect(draw1).deep.include({kind: 'cards', effect: 'draw', amount: 2, drawn: 2, count: 2, influence: 3});
      expect(draw1.counted, 'the cards that made the count').deep.eq([CardName.CAPITAL, CardName.DOMED_CRATER]);
      expect(draw1.countedUnits).deep.eq([1, 1]);
      expect(game.projectDeck.drawPile.length, 'they left the deck at the enactment').eq(deckBefore - 2);
      expect(p1.cardsInHand, 'not in the hand until taken').is.empty;
      const ask = takePrompt(p1);
      expect(ask?.cards).has.length(2);
      expect(ask?.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: URBAN_RESEARCH_ID, effect: 'draw'});
      expect(ask?.choiceContext?.source).deep.eq({kind: 'resolution', resolution: URBAN_RESEARCH_ID});
      expect(outcomeOf(parliament, p1, 'megacredits'), 'the money waits behind this seat\'s own take').is.undefined;
      expect(p2.getWaitingFor(), 'p2 waits its turn').is.undefined;
      const cash1 = p1.megaCredits;
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(2);
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      expect(paid1).deep.include({kind: 'stock', effect: 'megacredits', stock: Resource.MEGACREDITS, amount: 6, influence: 3, before: cash1, after: cash1 + 6});
      expect(paid1.count, 'the money counts nothing').is.undefined;
      expect(p1.megaCredits).eq(paid1.after);
      takeEverything(game);
      // …and p2: no city tag, so a named skip of the draw — and its own 2 M€ all the same.
      expect(recordsOf(parliament, p2).map((o) => o.step)).deep.eq(['draw', 'megacredits']);
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({kind: 'skipped', amount: 0, drawn: 0, count: 0, influence: 1, reason: URBAN_RESEARCH_NO_TAGS_REASON});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({kind: 'stock', amount: 2, influence: 1});
      expect(p2.cardsInHand, 'nothing was substituted for the cards it did not get').is.empty;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      // The events say the same order under the resolution's source: the draw, then the money.
      const mine = game.events.events.filter((e) => e.source?.kind === 'resolution' && e.source.id === URBAN_RESEARCH_ID && e.player === p1.color &&
        e.type !== 'action');
      expect(mine.map((e) => e.type)).deep.eq(['cards-drawn', 'resource-changed']);
      expect(mine[1].impact?.stock?.megacredits).eq(6);
    });

    it('TWO INDEPENDENT ZEROES, each naming itself: no city tag skips only the draw, influence 0 skips only the money', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 wins the vote (it placed the delegate), so its marker takes ONE Agenda step before the effect:
      // step 3 → 4 = influence 2. No city tag — no cards, named, and 4 M€ all the same.
      parliament.agenda.set(p1.id, 3);
      p1.playedCards.push(new Mine());
      // p2 never voted — influence 0, and three city tags (one card prints two): three cards, and the money is a
      // named skip. The winner's own step is what puts influence 0 out of its reach, so the zero is the loser's.
      parliament.agenda.set(p2.id, agendaForInfluence(0));
      p2.playedCards.push(new LunaEcumenopolis(), new Capital());
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include(
        {kind: 'skipped', amount: 0, drawn: 0, count: 0, influence: 2, reason: URBAN_RESEARCH_NO_TAGS_REASON});
      // The production phase pays this generation's income BEFORE the sitting, so the money is read around the
      // record's own before/after — never against a supply noted while the generation was still running.
      const paid1 = outcomeOf(parliament, p1, 'megacredits')!;
      expect(paid1).deep.include({kind: 'stock', amount: 4, influence: 2});
      expect(paid1.after).eq(paid1.before! + 4);
      expect(p1.megaCredits).eq(paid1.after);
      expect(p1.cardsInHand, 'nothing was substituted for the cards it did not get').is.empty;
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({kind: 'cards', amount: 3, drawn: 3, count: 3, influence: 0});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include(
        {kind: 'skipped', amount: 0, influence: 0, stock: Resource.MEGACREDITS, reason: URBAN_RESEARCH_NO_INFLUENCE_REASON});
      expect(p2.cardsInHand, 'influence 0 buys no cards and takes none away').has.length(3);
      // Each zero is named in the journal in its OWN words — never one «nothing came of it».
      expect(game.gameLog.filter((e) => e.message.startsWith('${0} has no city tags — no cards')), 'p1\'s zero').has.length(1);
      expect(game.gameLog.filter((e) => e.message.startsWith('${0} has no influence — no M€')), 'p2\'s zero').has.length(1);
    });

    it('a SHORT deck delivers what is left and names it; an EMPTY deck is a named skip — and neither touches the money', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Capital(), new DomedCrater());
      const only = game.projectDeck.drawPile.slice(-1);
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      game.projectDeck.drawPile.push(...only);
      endGeneration(game);
      runAllActions(game);
      expect(takePrompt(p1)?.cards, 'one of the two owed').has.length(1);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 1, count: 2});
      expect(game.gameLog.some((e) => e.message.includes('were left in the deck for'))).is.true;
      takeEverything(game);
      expect(outcomeOf(parliament, p1, 'megacredits'), 'the money is untouched by what the deck could not give').deep.include({kind: 'stock', amount: 6});

      const [game2, q1, , parl2] = stage();
      parl2.agenda.set(q1.id, 4);
      q1.playedCards.push(new Capital());
      game2.projectDeck.drawPile.length = 0;
      game2.projectDeck.discardPile.length = 0;
      endGeneration(game2);
      runAllActions(game2);
      expect(takePrompt(q1), 'nothing to take').is.undefined;
      expect(q1.cardsInHand).is.empty;
      expect(outcomeOf(parl2, q1, 'draw')).deep.include({kind: 'skipped', amount: 1, drawn: 0, count: 1, reason: 'The project deck is empty'});
      expect(outcomeOf(parl2, q1, 'megacredits')).deep.include({kind: 'stock', amount: 6});
    });

    it('a neutral winner cancels nothing: every participant draws by its own tags and is paid by its own influence', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, RESEARCH_LAW);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.playedCards.push(new Capital());
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      expect((parliament.lastPhase ?? parliament.phase?.summary)?.winner.player).eq('NEUTRAL');
      expect(parliament.enacted).eq(RESEARCH_LAW);
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'cards', amount: 1, drawn: 1, count: 1, influence: 0});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'skipped', amount: 0, influence: 0});
      expect(outcomeOf(parliament, p2, 'draw')).deep.include({kind: 'skipped', amount: 0, count: 0, influence: 2});
      expect(outcomeOf(parliament, p2, 'megacredits')).deep.include({kind: 'stock', amount: 4, influence: 2});
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part === 'effect'), 'no winner part, no world part').is.true;
    });

    it('the journal carries the two lines per seat with the resolution as their source: the draw with its count, the money with its rate', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Capital(), new DomedCrater());
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      const drawLine = game.gameLog.find((entry) => entry.message === '${0} draws ${1} card(s) from ${2}: 1 per city tag, ${3} city tag(s)' &&
        entry.data[0].value === p1.color)!;
      expect(drawLine.data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(URBAN_RESEARCH_ID);
      expect(drawLine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['2', '2']);
      const cash = outcomeOf(parliament, p1, 'megacredits')!;
      const payLine = game.gameLog.find((entry) => entry.message === '${0} gained ${1} M€ from ${2}: 2 per point of influence, influence ${3} (${4} → ${5})' &&
        entry.data[0].value === p1.color)!;
      expect(payLine.data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value))
        .deep.eq(['6', '3', String(cash.before), String(cash.after)]);
    });
  });

  describe('once per enactment — nothing is drawn or paid twice', () => {
    it('a reload INSIDE the take draws nothing again: the cards sit in the intake, the prompt is re-derived, the money still comes after', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Capital(), new DomedCrater());
      endGeneration(game);
      runAllActions(game);
      const offered = takePrompt(p1)!.cards.map((c) => c.name);
      const deckAfter = game.projectDeck.drawPile.length;
      const cash = p1.megaCredits;

      const live = reload(game);
      const one = live.getPlayerById(p1.id);
      expect(live.projectDeck.drawPile.length, 'nothing was drawn a second time').eq(deckAfter);
      expect(one.megaCredits, 'and the money has not been paid yet — the draw stands before it').eq(cash);
      const again = takePrompt(one);
      expect(again?.cards.map((c) => c.name), 'the same two cards').deep.eq(offered);
      expect(again?.externalDrawPrompt?.cause).deep.eq({kind: 'resolution', resolution: URBAN_RESEARCH_ID, effect: 'draw'});
      takeAll(one);
      runAllActions(live);
      expect(one.cardsInHand.map((c) => c.name)).deep.members(offered);
      expect(one.pendingCardIntakes).is.empty;
      takeEverything(live);
      settleParliamentGates(live);
      const records = (live.parliament!.lastPhase ?? live.parliament!.phase?.summary)?.outcomes?.filter((o) => o.player === p1.id) ?? [];
      expect(records.map((o) => o.step)).deep.eq(['draw', 'megacredits']);
      expect(records.filter((o) => o.step === 'draw')).has.length(1);
      expect(one.megaCredits, 'paid exactly once, after the take').eq(cash + 6);
      expect(parliament.enacted).eq(RESEARCH_LAW);
    });

    it('a later tableau and a later influence never recompute what was drawn or paid', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new Capital());
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      const cash = p1.megaCredits;
      const records = recordsOf(parliament, p1);
      p1.playedCards.push(new DomedCrater(), new LunaEcumenopolis());
      parliament.agenda.set(p1.id, 12);
      getParliamentModel(game, p1);
      expect(p1.megaCredits).eq(cash);
      expect(p1.cardsInHand).has.length(1);
      expect(recordsOf(parliament, p1)).deep.eq(records);
      expect(resolutionCount(p1, 'cityTags').count, 'the live count moved — the record did not').eq(4);
    });
  });

  describe('the chairman quest — play 1 city tag', () => {
    it('taking the dealt cards moves no progress; the player\'s OWN city tag completes it', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(new Capital());
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      settleParliamentGates(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(URBAN_RESEARCH_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'tag', tag: Tag.CITY}, count: 1});
      expect(parliament.questProgressOf(p1), 'taking the dealt card is not playing a tag').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      p1.playCard(new DomedCrater());
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      p2.playCard(new Capital());
      runAllActions(game);
      expect(parliament.chairman, 'once per generation').eq(p1.id);
    });
  });

  describe('the stand — the scenarios a tag-counted law opens', () => {
    /*
     * The tag-counted family's scenarios carry a TABLEAU, and a tableau is only
     * legible under the count it was laid out for (RX27's rule): every scenario
     * of the family names its count, and this law's own are laid out for city
     * tags — power cards and science cards would read zero on every row.
     */
    const STAND = path.join(__dirname, '..', '..', 'src', 'client', 'components', 'console', 'parliament', 'ConsoleResolutionsPlayground.vue');

    it('every scenario of the tag-counted family names its count, and this law opens its own', () => {
      const source = fs.readFileSync(STAND, 'utf8');
      const scenarios = source.split('\n').filter((line) => line.includes("family: 'counted-tags'"));
      expect(scenarios.length, 'the family has scenarios at all').is.greaterThan(0);
      const unnamed = scenarios.filter((line) => !line.includes("counts: '")).map((line) => line.trim().slice(0, 60));
      expect(unnamed, 'a tag scenario without its count shows one law another law\'s tableau').deep.eq([]);
      expect(scenarios.filter((line) => line.includes("counts: 'cityTags'")).length,
        'the two halves\' own zeroes, the two-tag card, the prelude, the wild tag and the empty deck').is.greaterThan(5);
    });
  });

  describe('MarsBot, the model, and RX27 standing where it stood', () => {
    it('MarsBot (mode none) is never dealt to and never paid, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, RESEARCH_LAW);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(new Capital());
      const cash = human.megaCredits;
      const income = human.terraformRating + human.production.megacredits;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);   // the assembly gate, then the effects run
      takeEverything(game);          // …and the one human seat takes its card
      settleParliamentGates(game);   // the adjourn gate
      expect(parliament.phase).is.undefined;
      expect(game.generation).eq(2);
      const outcomes = parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.map((o) => o.player)).deep.eq([human.id, human.id]);
      expect(outcomes.map((o) => o.step)).deep.eq(['draw', 'megacredits']);
      expect(outcomes[0]).deep.include({kind: 'cards', amount: 1, drawn: 1, count: 1});
      expect(outcomes[1]).deep.include({kind: 'stock', amount: 2, influence: 1});
      expect(human.megaCredits, 'the income of the production phase plus 2 × influence 1').eq(cash + income + 2);
      expect(human.cardsInHand).has.length(1);
      expect(game.events.events.filter((e) => e.player === bot.color && e.source?.kind === 'resolution'),
        'nothing reached the bot under the resolution').is.empty;
      expect(bot.pendingCardIntakes, 'and no intake was opened for it').is.empty;
      const model = getParliamentModel(game, human);
      expect(model?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('every seat\'s city-tag count rides the model, and the records reach the client with the count and its cards', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      p1.playedCards.push(new LunaEcumenopolis(), new Capital());
      p2.playedCards.push(new Mine());
      const model = getParliamentModel(game, p2);
      expect(model?.players.find((p) => p.color === p1.color)?.counts?.find((c) => c.id === 'cityTags')).deep.eq(
        {id: 'cityTags', count: 3, cards: [CardName.LUNA_ECUMENOPOLIS, CardName.CAPITAL], units: [2, 1]});
      expect(model?.players.find((p) => p.color === p2.color)?.counts?.find((c) => c.id === 'cityTags')).deep.eq(
        {id: 'cityTags', count: 0, cards: [], units: []});
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const drawn = last?.outcomes?.find((o) => o.player === p1.color && o.step === 'draw');
      expect(drawn).deep.include({kind: 'cards', amount: 3, drawn: 3, count: 3});
      expect(drawn?.counted).deep.eq([CardName.LUNA_ECUMENOPOLIS, CardName.CAPITAL]);
      expect(drawn?.countedUnits).deep.eq([2, 1]);
      expect(last?.outcomes?.find((o) => o.player === p1.color && o.step === 'megacredits')).deep.include({kind: 'stock', amount: 6, influence: 3});
    });

    it('RX27 DID NOT MOVE: the Scientists Budget levies, counts and draws exactly what it did before', () => {
      const [game, p1, , parliament] = reduxGame();
      seatResolution(parliament, 0, BUDGET);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.megaCredits = 20;
      p1.terraformRating = 0;
      parliament.agenda.set(p1.id, 4); // influence 3 at the effect
      p1.playedCards.push(new Capital()); // a CITY tag — none of the budget's business
      endGeneration(game);
      runAllActions(game);
      expect(parliament.enacted).eq(BUDGET);
      expect(outcomeOf(parliament, p1, 'levy')).deep.include({kind: 'stock', amount: -10, owed: 10, before: 20, after: 10});
      expect(outcomeOf(parliament, p1, 'megacredits')).deep.include({kind: 'stock', amount: 3, count: 0, influence: 3, before: 10, after: 13});
      expect(outcomeOf(parliament, p1, 'draw')).deep.include({kind: 'cards', amount: 2, drawn: 2});
      takeEverything(game);
      expect(p1.cardsInHand, 'the flat 2, not one per city tag').has.length(2);
    });

    it('the generation passes on to the next sitting after this law — the deck is not disturbed', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, 4);
      endGeneration(game);
      runAllActions(game);
      takeEverything(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.slots).has.length(3);
      expect(parliament.slots.some((slot) => slot.instance === RESEARCH_LAW), 'the enacted card left the area').is.false;
      passToParliament(game);
      expect(parliament.phase, 'a second sitting convenes').is.not.undefined;
    });
  });
});
