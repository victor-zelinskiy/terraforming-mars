import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  TAX_BREAKS, TAX_BREAKS_CAP, TAX_BREAKS_CODE, TAX_BREAKS_ID, TAX_BREAKS_NO_KINDS_REASON, TAX_BREAKS_PRODUCTION, TAX_BREAKS_QUEST_MECHS,
} from '../../src/server/parliament/resolutions/industrialists/TaxBreaks';
import {CENTRAL_POWER_GRID_PRODUCTION} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {SPONSORED_PROJECTS} from '../../src/server/parliament/resolutions/scientists/SponsoredProjects';
import {MANUFACTURING_RUN_ID} from '../../src/server/parliament/resolutions/industrialists/ManufacturingRun';
import {resolutionActionSource} from '../../src/server/parliament/resolutions/ResolutionAction';
import {productionCountStep} from '../../src/server/parliament/resolutions/ResolutionProductionCount';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {declaredCountIds, holdersCount, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {AltSecondaryTag} from '../../src/common/cards/render/AltSecondaryTag';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount, uncappedAmount} from '../../src/common/parliament/influenceScaling';
import {countHoldersToward, holderKindsOf, holdersMeasured, resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {EventSource} from '../../src/common/events/EventSource';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {ICard} from '../../src/server/cards/ICard';
import {Fish} from '../../src/server/cards/base/Fish';
import {Birds} from '../../src/server/cards/base/Birds';
import {Pets} from '../../src/server/cards/base/Pets';
import {Mine} from '../../src/server/cards/base/Mine';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {Arklight} from '../../src/server/cards/colonies/Arklight';
import {Supercomputer} from '../../src/server/cards/turmoilRedux/Supercomputer';
import {ConstructionMechs} from '../../src/server/cards/turmoilRedux/ConstructionMechs';

/**
 * TAX BREAKS (Turmoil Redux, RX41) — «Each player increases their M€
 * production 1 step for each different type of card resource they have +
 * Influence. (Max. 5)» — an ASSEMBLY: Central Power Grid's payout over
 * Sponsored Projects' reading of the seat's cards, MEASURED BY KIND.
 *
 * What these specs pin (the prompt's §2, point by point): K is the number of
 * DIFFERENT kinds among the cards the engine says hold a resource
 * (`getCardsWithResources` — Collector's and the resource-type requirement's
 * own measure): two animal cards are one kind, a holder at 0 is no kind
 * (decision Р2), a corporation counts, another seat's cards never; the SAME
 * cards as RX40's count and a different number (the divergence); min(5, K + I)
 * for every participant, the cap on the increase (10 → 15); the payout through
 * the family's counted production step, its record freezing the kinds and their
 * cards; the named zero; once per enactment; MarsBot never paid and its quest
 * honestly unreachable; the quest moved by the seat's own mechs only.
 */
const LAW = resolutionInstanceId(TAX_BREAKS_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Tax Breaks in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, LAW);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  return [game, p1, p2, parliament];
}

function enact(game: IGame): void {
  endGenerationThroughParliament(game);
  runAllActions(game);
  settleParliamentGates(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

/** `card` holding `n` of its own resource. */
function holding<T extends ICard>(card: T, n: number): T {
  card.resourceCount = n;
  return card;
}

function outcomeOf(parliament: Parliament, player: IPlayer) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === player.id && o.step === 'production' && o.kind !== 'reaction');
}

/** The prompt's table: Fish 2, Birds 1 (one kind — animals), Dirigibles 1 (floaters), Supercomputer 3 (data) → 3 kinds on 4 cards. */
function threeKinds(): Array<ICard> {
  return [holding(new Fish(), 2), holding(new Birds(), 1), holding(new Dirigibles(), 1), holding(new Supercomputer(), 3)];
}

/** The ENGINE's own measure (Collector's non-standard term, `ResourceTypeRequirement`) — what the law must agree with. */
function engineKinds(player: IPlayer): number {
  return new Set(player.getCardsWithResources().map((card) => card.resourceType)).size;
}

describe('TaxBreaks', () => {
  describe('the catalog entry and the declaration', () => {
    it('is RX41 of the Industrialists — one copy, no expansion needed, one production part and the two-mech quest, nothing else', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(TAX_BREAKS_ID)).eq(TAX_BREAKS);
      expect(TAX_BREAKS_CODE).eq('RX41').and.matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX41')).eq(TAX_BREAKS);
      expect(TAX_BREAKS.party).eq(PartyName.INDUSTRIALISTS);
      expect(TAX_BREAKS.compatibility, 'a base card — no expansion is needed').is.undefined;
      expect(TAX_BREAKS.levy).is.undefined;
      expect(TAX_BREAKS.winnerSteps, 'no winner-only part').is.undefined;
      expect(TAX_BREAKS.winnerReward).is.undefined;
      expect(TAX_BREAKS.passive).is.undefined;
      expect(TAX_BREAKS.action).is.undefined;
      expect(TAX_BREAKS.scaled).deep.eq([TAX_BREAKS_PRODUCTION]);
      expect(TAX_BREAKS.text.name).eq('Tax Breaks');
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === LAW), 'one physical copy').has.length(1);
    });

    it('THE PAYOUT IS RX04\'s, TERM FOR TERM — only the count id differs; the cap bounds the WHOLE sum', () => {
      const {count, ...rest} = TAX_BREAKS_PRODUCTION;
      const {count: gridCount, ...gridRest} = CENTRAL_POWER_GRID_PRODUCTION;
      expect(rest, 'unit, rate, cap and recipient are one declaration').deep.eq(gridRest);
      expect(count).deep.eq({id: 'cardResourceTypes', per: 1});
      expect(gridCount).deep.eq({id: 'powerTags', per: 1});
      expect(TAX_BREAKS_CAP).eq(5);
      const cases: Array<[number, number, number]> = [[0, 0, 0], [3, 0, 3], [0, 2, 2], [3, 2, 5], [4, 3, 5], [5, 0, 5], [2, 5, 5]];
      for (const [k, i, expected] of cases) {
        expect(scaledAmount(TAX_BREAKS_PRODUCTION, i, k), `K=${k} I=${i}`).eq(expected);
      }
      expect(uncappedAmount(TAX_BREAKS_PRODUCTION, 3, 4), 'the sum before the cap').eq(7);
    });

    it('the count is the HOLDERS kind measured by TYPE — RX40\'s count is the same kind measured by card; the family is the counted-holders one', () => {
      expect(resolutionCountKind('cardResourceTypes')).deep.eq({kind: 'holders', measure: 'types'});
      expect(resolutionCountKind('cardsWithResources')).deep.eq({kind: 'holders', measure: 'cards'});
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('cardResourceTypes').and.includes('cardsWithResources');
      expect(familyOf(TAX_BREAKS)).eq('counted-holders');
      expect(familyOf(SPONSORED_PROJECTS), 'RX40 keeps its own family').eq('each-card');
    });

    it('the shared step refuses a declaration it cannot pay — the step and its declaration are one thing', () => {
      expect(() => productionCountStep(TAX_BREAKS_ID, {...TAX_BREAKS_PRODUCTION, count: undefined}, {none: '', reason: '', gained: '', capped: ''})).throws(/count term/);
      expect(() => productionCountStep(TAX_BREAKS_ID, {...TAX_BREAKS_PRODUCTION, unit: {kind: 'stock', resource: Resource.MEGACREDITS}}, {none: '', reason: '', gained: '', capped: ''}))
        .throws(/PRODUCTION unit/);
    });

    it('the face prints «1 [M€ production] / [a card holding a «?»] + [influence]» and «max 5» — the holder glyph of RX40 with the WILD kind, never its three cubes alone', () => {
      const items = JSON.stringify(TAX_BREAKS.renderData);
      expect(items).includes(`"type":"${CardRenderItemType.RESOURCE_CARD}"`);
      expect(items, 'the «?» kind rides the holder as its secondary mark').includes(`"secondaryTag":"${AltSecondaryTag.WILD_RESOURCE}"`);
      expect(items).includes(`"type":"${CardRenderItemType.INFLUENCE}"`);
      expect(items).includes('"text":"max 5"');
      // RX40's holder carries NO kind mark: the two laws read apart at a glance.
      expect(JSON.stringify(SPONSORED_PROJECTS.renderData)).not.includes(`"secondaryTag":"${AltSecondaryTag.WILD_RESOURCE}"`);
    });

    it('the quest is 2 mechs on the seat\'s cards', () => {
      expect(TAX_BREAKS.quest).deep.eq({goal: {kind: 'cardResource', resource: CardResource.MECH}, count: TAX_BREAKS_QUEST_MECHS});
      expect(TAX_BREAKS_QUEST_MECHS).eq(2);
      expect(TAX_BREAKS.text.quest).eq('Add 2 mech resources to your cards');
    });
  });

  describe('the count (K) — the DIFFERENT kinds on the cards the engine says hold a resource', () => {
    it('3 kinds on 4 cards: Fish 2 and Birds 1 are ONE kind; the cards and the grouping ride the model', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(...threeKinds());
      const counted = resolutionCount(p1, 'cardResourceTypes');
      expect(counted.count).eq(3);
      expect(counted.count, 'the engine\'s own measure').eq(engineKinds(p1));
      expect(counted.cards).deep.eq(p1.getCardsWithResources().map((c) => c.name));
      expect(counted.byCard?.map((e) => [e.card, e.resource, e.count])).deep.eq([
        [CardName.FISH, CardResource.ANIMAL, 2],
        [CardName.BIRDS, CardResource.ANIMAL, 1],
        [CardName.DIRIGIBLES, CardResource.FLOATER, 1],
        [CardName.SUPERCOMPUTER, CardResource.DATA, 3],
      ]);
      expect(counted.byCard?.every((e) => e.vp === undefined), 'a count by kind is no list of destinations — no «one more» points').is.true;
      expect(holderKindsOf(counted.byCard ?? [])).deep.eq([
        {resource: CardResource.ANIMAL, cards: [{card: CardName.FISH, count: 2}, {card: CardName.BIRDS, count: 1}]},
        {resource: CardResource.FLOATER, cards: [{card: CardName.DIRIGIBLES, count: 1}]},
        {resource: CardResource.DATA, cards: [{card: CardName.SUPERCOMPUTER, count: 3}]},
      ]);
      expect(holdersCount(p1, 'cardResourceTypes')).deep.eq(counted);
    });

    it('THE DIVERGENCE: over ONE table RX40 counts 4 cards and RX41 counts 3 kinds — the same cards, a different measure', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(...threeKinds());
      const cards = resolutionCount(p1, 'cardsWithResources');
      const kinds = resolutionCount(p1, 'cardResourceTypes');
      expect(cards.count).eq(4);
      expect(kinds.count).eq(3);
      expect(kinds.cards, 'the same list').deep.eq(cards.cards);
      expect(holdersMeasured('cards', cards.byCard ?? [])).eq(4);
      expect(holdersMeasured('types', cards.byCard ?? [])).eq(3);
    });

    it('a holder at 0 holds no kind (decision Р2); a card that holds nothing never does; a corporation with resources does', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(holding(new Pets(), 0), new Mine());
      expect(resolutionCount(p1, 'cardResourceTypes').count, 'Pets at 0 — «a type they have» is a type with a resource on it').eq(0);
      p1.playedCards.push(holding(new Arklight(), 2));
      const counted = resolutionCount(p1, 'cardResourceTypes');
      expect(counted.count, 'Arklight\'s animals are a kind of the seat').eq(1);
      expect(counted.cards).deep.eq([CardName.ARKLIGHT]);
      p1.playedCards.get(CardName.PETS)!.resourceCount = 3;
      expect(resolutionCount(p1, 'cardResourceTypes').count, 'Pets joins the animals — still one kind').eq(1);
      p1.playedCards.push(holding(new Tardigrades(), 1));
      expect(resolutionCount(p1, 'cardResourceTypes').count, 'microbes — a second kind').eq(2);
      expect(resolutionCount(p1, 'cardResourceTypes').count).eq(engineKinds(p1));
    });

    it('only the seat\'s OWN cards: another seat\'s kinds never count', () => {
      const [, p1, p2] = reduxGame();
      p1.playedCards.push(holding(new Fish(), 1));
      p2.playedCards.push(holding(new Dirigibles(), 3), holding(new Supercomputer(), 2));
      expect(resolutionCount(p1, 'cardResourceTypes').count).eq(1);
      expect(resolutionCount(p2, 'cardResourceTypes').count).eq(2);
    });

    it('the stand\'s restatement agrees with the engine over a corpus — card by card and kind by kind', () => {
      const [, p1] = reduxGame();
      const corpus: Array<ICard> = [holding(new Fish(), 0), holding(new Birds(), 1), new Mine(), holding(new Arklight(), 3), holding(new Pets(), 7), holding(new Dirigibles(), 0), holding(new Supercomputer(), 1)];
      p1.playedCards.push(...corpus);
      const stand = countHoldersToward('cardResourceTypes', corpus.map((c) => ({name: c.name, resourceType: c.resourceType, resourceCount: c.resourceCount})));
      const engine = resolutionCount(p1, 'cardResourceTypes');
      expect(stand.cards).deep.eq(engine.cards);
      expect(stand.count).eq(engine.count).and.eq(engineKinds(p1)).and.eq(2);
      expect(countHoldersToward('cardsWithResources', corpus.map((c) => ({name: c.name, resourceType: c.resourceType, resourceCount: c.resourceCount}))).count,
        'RX40\'s measure over the same corpus').eq(4);
    });
  });

  describe('the enactment — min(5, K + I) of M€ production for every participant', () => {
    it('the prompt\'s seat: 3 kinds + influence 2 = +5 (no cap bit); the rival with nothing is NAMED and skipped', () => {
      const [game, p1, p2, parliament] = stage();
      p1.playedCards.push(...threeKinds(), holding(new Pets(), 0));
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's own step lands on influence 2
      p1.production.override({megacredits: 1});
      enact(game);
      expect(parliament.enacted).eq(LAW);
      const paid = outcomeOf(parliament, p1)!;
      expect(paid).deep.include({kind: 'production', effect: 'production', production: Resource.MEGACREDITS, amount: 5, count: 3, influence: 2, uncapped: 5, before: 1, after: 6});
      expect(paid.counted, 'Pets at 0 is no holder').deep.eq([CardName.FISH, CardName.BIRDS, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER]);
      expect(paid.countedByCard?.map((e) => e.resource)).deep.eq([CardResource.ANIMAL, CardResource.ANIMAL, CardResource.FLOATER, CardResource.DATA]);
      expect(p1.production.megacredits).eq(6);
      const zero = outcomeOf(parliament, p2)!;
      expect(zero).deep.include({kind: 'skipped', amount: 0, count: 0, influence: 0, reason: TAX_BREAKS_NO_KINDS_REASON});
      expect(zero.reason).eq('No resources on your cards and no influence');
      expect(zero.before, 'nothing moved, so there are no edges to state').is.undefined;
      expect(p2.production.megacredits).eq(0);
      expect(parliament.lastPhase?.outcomes?.filter((o) => o.player === p2.id && o.kind !== 'reaction'), 'exactly one record for the one step').has.length(1);
    });

    it('THE CAP bounds the INCREASE: 4 kinds + influence 3 pays +5 (uncapped 7), and production 10 becomes 15', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...threeKinds(), holding(new Tardigrades(), 2));
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      p1.production.override({megacredits: 10});
      enact(game);
      expect(outcomeOf(parliament, p1)).deep.include({amount: 5, count: 4, influence: 3, uncapped: 7, before: 10, after: 15});
      expect(p1.production.megacredits).eq(15);
    });

    it('the count alone and the influence alone each pay; a neutral winner cancels nothing', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, LAW);
      parliament.addNeutralVote(parliament.slots[0]);
      p1.playedCards.push(...threeKinds());
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      enact(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(outcomeOf(parliament, p1)).deep.include({amount: 3, count: 3, influence: 0});
      expect(outcomeOf(parliament, p2)).deep.include({amount: 2, count: 0, influence: 2});
      expect(parliament.lastPhase?.outcomes?.every((o) => o.part !== 'winner'), 'no winner part at all').is.true;
    });

    it('the journal carries ONE line per seat with the whole calculation; the recorder sees ONE production change under the law', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(...threeKinds(), holding(new Tardigrades(), 2));
      parliament.agenda.set(p1.id, agendaForInfluence(3) - 1);
      p1.production.override({megacredits: 2});
      enact(game);
      const capped = game.gameLog.filter((entry) => entry.message.startsWith('${0} gained ${1} ${2} production from ${3}: ${4} resource type(s) + ${5} influence = ${6}, limited'));
      expect(capped).has.length(1);
      const data = capped[0].data;
      expect(data.find((d) => d.type === LogMessageDataType.RESOLUTION)?.value).eq(TAX_BREAKS_ID);
      expect(data.filter((d) => d.type === LogMessageDataType.RAW_STRING).map((d) => d.value)).deep.eq(['5', '4', '3', '7', '2', '7']);
      expect(game.gameLog.filter((entry) => entry.message.startsWith('${0} has no resource on their cards and no influence')), 'the rival\'s zero is named').has.length(1);
      const deltas = game.events.events.filter((e) =>
        e.type === 'production-changed' && e.player === p1.color && e.source?.kind === 'resolution' && e.source.id === TAX_BREAKS_ID);
      expect(deltas).has.length(1);
      expect(deltas[0].impact?.production?.megacredits).eq(5);
      expect(parliament.enacted).eq(LAW);
    });
  });

  describe('once per enactment', () => {
    it('a later resource of a new kind never recomputes what was paid, and a reload pays nothing again', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(holding(new Fish(), 1));
      enact(game);
      const paid = p1.production.megacredits;
      expect(outcomeOf(parliament, p1)).deep.include({amount: 2, count: 1, influence: 1});
      p1.playedCards.push(holding(new Dirigibles(), 2), holding(new Supercomputer(), 1));
      expect(p1.production.megacredits, 'two new kinds afterwards change nothing').eq(paid);
      const live = reload(game);
      settleParliamentGates(live);
      const seat = live.getPlayerById(p1.id);
      expect(seat.production.megacredits).eq(paid);
      expect(live.parliament!.lastPhase?.outcomes?.find((o) => o.player === p1.id && o.step === 'production'))
        .deep.include({amount: 2, count: 1});
    });
  });

  describe('the chairman quest — 2 mechs on the seat\'s cards', () => {
    function under(player: IPlayer, source: EventSource, category: 'card-action' | 'parliament', f: () => void): void {
      const events = player.game.events;
      events.beginAction(player, source, {category});
      try {
        f();
      } finally {
        events.endScope();
      }
    }

    it('the seat\'s own mechs count; a mech a LAW\'s action adds (Manufacturing Run) is the law\'s, never the seat\'s (Q5)', () => {
      const [game, p1, , parliament] = stage();
      const mechs = new ConstructionMechs();
      p1.playedCards.push(mechs);
      enact(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(TAX_BREAKS_ID);
      expect(parliament.quest?.definition).deep.eq(TAX_BREAKS.quest);
      expect(parliament.questProgressOf(p1), 'the enactment is the political phase\'s').eq(0);
      under(p1, resolutionActionSource(MANUFACTURING_RUN_ID, p1), 'parliament', () => p1.addResourceTo(mechs, {qty: 1, log: false}));
      expect(mechs.resourceCount).eq(1);
      expect(parliament.questProgressOf(p1), 'a law\'s action adds nothing to the quest').eq(0);
      under(p1, {kind: 'card', card: CardName.CONSTRUCTION_MECHS, owner: p1.color}, 'card-action', () => p1.addResourceTo(mechs, {qty: 1, log: false}));
      expect(parliament.questProgressOf(p1), 'the seat\'s own action').eq(1);
      under(p1, {kind: 'card', card: CardName.CONSTRUCTION_MECHS, owner: p1.color}, 'card-action', () => p1.addResourceTo(mechs, {qty: 1, log: false}));
      expect(parliament.quest?.completedBy).eq(p1.id);
    });
  });

  describe('MarsBot — nothing, and its quest is honestly unreachable', () => {
    it('is never counted, never paid, and the phase does not stall (mode none)', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, LAW);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.playedCards.push(holding(new Fish(), 1), holding(new Dirigibles(), 1));
      bot.playedCards.push(holding(new Fish(), 2), holding(new Supercomputer(), 1));
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.outcomes?.filter((o) => o.kind !== 'reaction').map((o) => o.player)).deep.eq([human.id]);
      expect(outcomeOf(parliament, human), '2 kinds + the winner\'s influence 1').deep.include({kind: 'production', amount: 3, count: 2, influence: 1});
      expect(game.events.events.filter((e) => e.player === bot.color && e.source?.kind === 'resolution'), 'nothing reached the bot under the law').is.empty;
      const model = getParliamentModel(game, human);
      expect(model?.quest?.source).eq(TAX_BREAKS_ID);
      expect(model?.players.find((p) => p.color === bot.color)?.counts, 'no count for a seat outside the parliament').is.undefined;
    });

    it('a bot IN the quest (mode politics) cannot reach 2 mechs — the model says so, never a silent 0/2', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      game.playerIsFinishedWithResearchPhase(human);
      const parliament = game.parliament!;
      parliament.quest = {definition: TAX_BREAKS.quest, source: TAX_BREAKS_ID, generation: game.generation, progress: new Map()};
      // No colony tile prints a mech, and the bot's floater pool is floaters: no storage area of the bot holds one.
      expect(getParliamentModel(game, human)?.quest?.botReachable).is.false;
      // …while a kind its storage DOES hold is reachable on the same table (the verdict is the table's, not the law's).
      parliament.quest = {definition: {goal: {kind: 'cardResource', resource: CardResource.FLOATER}, count: 2}, source: 'starter', generation: game.generation, progress: new Map()};
      expect(getParliamentModel(game, human)?.quest?.botReachable).is.true;
    });
  });

  describe('the model', () => {
    it('every seat carries its count — the kinds\' number, the cards with their kinds — and the outcome reaches the client', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(...threeKinds());
      p2.playedCards.push(holding(new Birds(), 1), holding(new Pets(), 0));
      const model = getParliamentModel(game, p2)!;
      const countOf = (color: typeof p1.color) => model.players.find((p) => p.color === color)?.counts?.find((c) => c.id === 'cardResourceTypes');
      expect(countOf(p1.color)?.count).eq(3);
      expect(countOf(p1.color)?.byCard?.map((e) => e.card)).deep.eq([CardName.FISH, CardName.BIRDS, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER]);
      expect(countOf(p2.color)).deep.eq({id: 'cardResourceTypes', count: 1, cards: [CardName.BIRDS], byCard: [{card: CardName.BIRDS, resource: CardResource.ANIMAL, count: 1}]});
      enact(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const paid = last?.outcomes?.find((o) => o.player === p1.color && o.step === 'production');
      expect(paid).deep.include({kind: 'production', production: Resource.MEGACREDITS, amount: 4, count: 3, influence: 1});
      expect(paid?.countedByCard?.map((e) => e.card)).deep.eq([CardName.FISH, CardName.BIRDS, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER]);
    });
  });
});
