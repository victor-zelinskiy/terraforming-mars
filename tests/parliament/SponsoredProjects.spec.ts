import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  SPONSORED_PROJECTS, SPONSORED_PROJECTS_CODE, SPONSORED_PROJECTS_DRAW, SPONSORED_PROJECTS_ID, SPONSORED_PROJECTS_QUEST_DATA,
  SPONSORED_PROJECTS_RESOURCES,
} from '../../src/server/parliament/resolutions/scientists/SponsoredProjects';
import {EACH_COUNTED_NO_HOLDER_REASON, eachCountedCardStep} from '../../src/server/parliament/resolutions/ResolutionEachCard';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {declaredCountIds, holdersCount, resolutionCount} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {EnactContext, EnactOutcome} from '../../src/server/parliament/resolutions/IResolution';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {declaredCardResourceKinds, paysEachCountedCard, scaledAmount} from '../../src/common/parliament/influenceScaling';
import {countHoldersToward, holderCountVerdict, resolutionCountKind} from '../../src/common/parliament/resolutionCounts';
import {CARD_RESOURCE_EACH_ADDRESS, REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {ParliamentEnactOutcomeModel} from '../../src/common/models/ParliamentModel';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {ICard} from '../../src/server/cards/ICard';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {Fish} from '../../src/server/cards/base/Fish';
import {Birds} from '../../src/server/cards/base/Birds';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {Arklight} from '../../src/server/cards/colonies/Arklight';
import {MeatIndustry} from '../../src/server/cards/promo/MeatIndustry';
import {MartianFiber} from '../../src/server/cards/turmoilRedux/MartianFiber';
import {Supercomputer} from '../../src/server/cards/turmoilRedux/Supercomputer';
import {Mine} from '../../src/server/cards/base/Mine';
import {Pets} from '../../src/server/cards/base/Pets';

/**
 * SPONSORED PROJECTS (Turmoil Redux, RX40) — «Draw cards equal to your
 * Influence. Add 1 resource to each of your cards that already has a
 * resource.» — the first law that pays the seats' CARDS WITHOUT A QUESTION.
 *
 * What these specs pin (the contract's §2, point by point): the printed order
 * is the executed one, seat by seat (the draw, then the resources); the draw
 * is Open IP Trade's — influence through the shared intake, influence 0 and an
 * empty deck NAMED, a reload inside the take drawing nothing twice; «each of
 * your cards that already has a resource» is the ENGINE's
 * `getCardsWithResources` (a corporation included, a holder at 0 not, another
 * seat's cards never) — the count, the payout and the stand's restatement are
 * pinned together; each card takes ONE of ITS OWN kind through
 * `addResourceTo` (the journal names every card under the law, the cards'
 * points move by their own rules, the table's answers answer); no card with a
 * resource is a NAMED zero apart from the draw's; the counted cards are fixed
 * the first time the step runs; the record carries what each card held before
 * and its points' move; the quest never counts the law's own data; MarsBot is
 * never dealt, never paid (decision Р3).
 */
const SPONSORED = resolutionInstanceId(SPONSORED_PROJECTS_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Sponsored Projects in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, SPONSORED);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  return [game, p1, p2, parliament];
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

function outcomesOf(parliament: Parliament, player: IPlayer, step?: string): Array<SerializedEnactOutcome> {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return (summary?.outcomes ?? []).filter((o) => o.player === player.id && (step === undefined || o.step === step) && o.kind !== 'reaction');
}

/** The live mandatory take of `player`, if that is what it is waiting for. */
function takePrompt(player: IPlayer): SelectCard<IProjectCard> | undefined {
  const wf = player.getWaitingFor();
  return wf instanceof SelectCard && (wf as SelectCard<IProjectCard>).externalDrawPrompt !== undefined ?
    wf as SelectCard<IProjectCard> : undefined;
}

function takeAll(player: IPlayer): Array<CardName> {
  const ask = takePrompt(player);
  if (ask === undefined) {
    throw new Error(`${player.color} is not being asked to take cards`);
  }
  const names = ask.cards.map((c) => c.name);
  player.process({type: 'card', cards: names});
  return names;
}

function countOn(player: IPlayer, name: CardName): number {
  return player.playedCards.get(name)?.resourceCount ?? -1;
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** A bare step context over `player` — the step's own contract, without the phase around it. */
function contextOf(player: IPlayer, state: Record<string, unknown>, reports: Array<EnactOutcome>): EnactContext {
  return {
    game: player.game, parliament: player.game.parliament!, player, winner: undefined, influence: 0,
    source: {kind: 'resolution', id: SPONSORED_PROJECTS_ID, owner: player.color}, state, report: (o) => reports.push(o),
  };
}

describe('SponsoredProjects', () => {
  describe('the catalog entry and the declaration', () => {
    it('is RX40 of the Scientists — one copy, no expansion needed, the draw then the resources, the four-data quest, nothing else', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(SPONSORED_PROJECTS_ID)).eq(SPONSORED_PROJECTS);
      expect(SPONSORED_PROJECTS_CODE).eq('RX40').and.matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX40')).eq(SPONSORED_PROJECTS);
      expect(SPONSORED_PROJECTS.party).eq(PartyName.SCIENTISTS);
      expect(SPONSORED_PROJECTS.compatibility, 'a base card').is.undefined;
      expect(SPONSORED_PROJECTS.winnerSteps).is.undefined;
      expect(SPONSORED_PROJECTS.winnerReward).is.undefined;
      expect(SPONSORED_PROJECTS.worldSteps).is.undefined;
      expect(SPONSORED_PROJECTS.passive).is.undefined;
      expect(SPONSORED_PROJECTS.action).is.undefined;
      expect(SPONSORED_PROJECTS.tileGrant).is.undefined;
      expect(SPONSORED_PROJECTS.agendaGrant).is.undefined;
      // THE PRINTED ORDER — the cards first, the resources second.
      expect(SPONSORED_PROJECTS.immediateSteps?.map((s) => s.key)).deep.eq(['draw', 'resources']);
      expect(SPONSORED_PROJECTS.scaled).deep.eq([SPONSORED_PROJECTS_DRAW, SPONSORED_PROJECTS_RESOURCES]);
      expect(SPONSORED_PROJECTS.text.name).eq('Sponsored Projects');
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === SPONSORED), 'one physical copy').has.length(1);
    });

    it('the draw is Open IP Trade\'s — 1 card per influence; the resources are a card-resource unit of the card\'s OWN kind onto EACH counted card, no influence term', () => {
      expect(SPONSORED_PROJECTS_DRAW).deep.eq({id: 'draw', unit: {kind: 'cards'}, perInfluence: 1, recipient: 'each'});
      expect(SPONSORED_PROJECTS_RESOURCES).deep.eq({
        id: 'resources', unit: {kind: 'cardResource', resources: 'own-kind', onto: 'each-counted'},
        base: 0, perInfluence: 0, count: {id: 'cardsWithResources', per: 1}, recipient: 'each',
      });
      expect(paysEachCountedCard(SPONSORED_PROJECTS_RESOURCES)).is.true;
      expect(paysEachCountedCard(SPONSORED_PROJECTS_DRAW)).is.false;
      expect(declaredCardResourceKinds({kind: 'cardResource', resources: 'own-kind'}), 'no declared kind — never the list of every kind').is.undefined;
      expect(declaredCardResourceKinds({kind: 'cardResource', resources: [CardResource.ANIMAL]})).deep.eq([CardResource.ANIMAL]);
      // Influence buys no resource; the count is everything — one per counted card.
      for (const influence of [0, 1, 3, 5]) {
        expect(scaledAmount(SPONSORED_PROJECTS_RESOURCES, influence, 0)).eq(0);
        expect(scaledAmount(SPONSORED_PROJECTS_RESOURCES, influence, 4)).eq(4);
        expect(scaledAmount(SPONSORED_PROJECTS_DRAW, influence)).eq(influence);
      }
      expect(resolutionCountKind('cardsWithResources')).deep.eq({kind: 'holders', measure: 'cards'});
      expect(declaredCountIds(REDUX_RESOLUTION_CATALOG)).includes('cardsWithResources');
      expect(familyOf(SPONSORED_PROJECTS)).eq('each-card');
    });

    it('the shared step refuses any other declaration — the step and its unit are one thing', () => {
      expect(() => eachCountedCardStep(SPONSORED_PROJECTS_ID, SPONSORED_PROJECTS_DRAW)).throws(/each-counted/);
      expect(() => eachCountedCardStep(SPONSORED_PROJECTS_ID, {...SPONSORED_PROJECTS_RESOURCES, count: {id: 'scienceTags', per: 1}})).throws(/HOLDERS/);
      expect(() => eachCountedCardStep(SPONSORED_PROJECTS_ID, {...SPONSORED_PROJECTS_RESOURCES, count: {id: 'cardResourceTypes', per: 1}}), 'a count by KIND is not a list of destinations').throws(/measured by card/);
      expect(() => eachCountedCardStep(SPONSORED_PROJECTS_ID, {...SPONSORED_PROJECTS_RESOURCES, count: undefined})).throws();
    });

    it('the face prints the set\'s holder glyph — «[a card with resources] : + [?]» — beside «[card] / [influence]»; the quest is 4 data', () => {
      const items = JSON.stringify(SPONSORED_PROJECTS.renderData);
      expect(items).includes(`"type":"${CardRenderItemType.RESOURCE_CARD}"`);
      // The printed «?» is the WILD square — the existing icon (`wild.png`), never a cube with a «?» drawn over it.
      expect(items).includes(`"type":"${CardRenderItemType.WILD}"`);
      expect(items).not.includes(`"resource":"${CardResource.RESOURCE_CUBE}"`);
      expect(items).includes(`"type":"${CardRenderItemType.INFLUENCE}"`);
      expect(SPONSORED_PROJECTS.quest).deep.eq({goal: {kind: 'cardResource', resource: CardResource.DATA}, count: SPONSORED_PROJECTS_QUEST_DATA});
      expect(SPONSORED_PROJECTS_QUEST_DATA).eq(4);
      expect(SPONSORED_PROJECTS.text.quest, 'Diverted Research\'s sentence, reused').eq('Add 4 data resources to your cards');
    });
  });

  describe('the count — the ENGINE\'s cards with a resource', () => {
    it('is `getCardsWithResources`: a corporation counts, a holder at 0 does not, a card that holds nothing does not, another seat\'s cards never', () => {
      const [, p1, p2] = reduxGame();
      p1.playedCards.push(holding(new Arklight(), 2), holding(new Fish(), 2), new Birds(), holding(new Dirigibles(), 1), new Mine(), holding(new Supercomputer(), 3));
      p2.playedCards.push(holding(new Fish(), 5));
      const counted = resolutionCount(p1, 'cardsWithResources');
      expect(counted.count).eq(4);
      expect(counted.cards).deep.eq(p1.getCardsWithResources().map((c) => c.name));
      expect(counted.cards).deep.eq([CardName.ARKLIGHT, CardName.FISH, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER]);
      expect(counted.byCard?.map((e) => [e.card, e.resource, e.count])).deep.eq([
        [CardName.ARKLIGHT, CardResource.ANIMAL, 2],
        [CardName.FISH, CardResource.ANIMAL, 2],
        [CardName.DIRIGIBLES, CardResource.FLOATER, 1],
        [CardName.SUPERCOMPUTER, CardResource.DATA, 3],
      ]);
      expect(holdersCount(p1, 'cardsWithResources')).deep.eq(counted);
    });

    it('each counted card carries what ONE more does to its points — the engine\'s reading, only where the points read the resource', () => {
      const [, p1] = reduxGame();
      p1.playedCards.push(holding(new Fish(), 2), holding(new Tardigrades(), 3), holding(new Dirigibles(), 1));
      const byCard = resolutionCount(p1, 'cardsWithResources').byCard ?? [];
      expect(byCard.find((e) => e.card === CardName.FISH)?.vp).deep.eq({from: 2, to: 3});
      // Tardigrades: 1 VP per 4 microbes — 3 → 4 crosses the line.
      expect(byCard.find((e) => e.card === CardName.TARDIGRADES)?.vp).deep.eq({from: 0, to: 1});
      expect(byCard.find((e) => e.card === CardName.DIRIGIBLES)?.vp, 'no points read the floaters').is.undefined;
    });

    it('the stand\'s restatement agrees with the engine over a corpus — and names why a card does not count', () => {
      const [, p1] = reduxGame();
      const corpus: Array<ICard> = [holding(new Fish(), 0), holding(new Birds(), 1), new Mine(), holding(new Arklight(), 3), holding(new Pets(), 7), holding(new Dirigibles(), 0)];
      for (const card of corpus) {
        p1.playedCards.push(card);
      }
      const engine = p1.getCardsWithResources().map((c) => c.name);
      const stand = countHoldersToward('cardsWithResources', corpus.map((c) => ({name: c.name, resourceType: c.resourceType, resourceCount: c.resourceCount})));
      expect(stand.cards).deep.eq(engine);
      expect(holderCountVerdict({name: CardName.MINE, resourceCount: 0})).deep.eq({counts: false, reason: 'This card holds no resources'});
      expect(holderCountVerdict({name: CardName.FISH, resourceType: CardResource.ANIMAL, resourceCount: 0})).deep.eq({counts: false, reason: 'No resource on this card yet'});
      expect(holderCountVerdict({name: CardName.FISH, resourceType: CardResource.ANIMAL, resourceCount: 1})).deep.eq({counts: true});
      expect(countHoldersToward('scienceTags', []).count, 'a non-holders id counts nothing this way').eq(0);
    });
  });

  describe('the enactment — the draw, then a resource on every card that already has one', () => {
    it('the printed order seat by seat: the take first; the resources land the moment the seat takes — one of its OWN kind on each, a corporation too, a holder at 0 and another seat\'s cards not', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      const fish = holding(new Fish(), 2);
      const dirigibles = holding(new Dirigibles(), 1);
      const computer = holding(new Supercomputer(), 3);
      const birds = new Birds(); // a holder with nothing on it
      p1.playedCards.push(holding(new Arklight(), 4), fish, dirigibles, computer, birds);
      p2.playedCards.push(holding(new Fish(), 5));
      const hand = p1.cardsInHand.length;
      endGenerationThroughParliament(game);
      expect(parliament.enacted).eq(SPONSORED);
      // THE DRAW ASKS FIRST — nothing has landed on any card yet.
      expect(takePrompt(p1)?.cards).has.length(2);
      expect(fish.resourceCount, 'the resources wait for the take').eq(2);
      expect(outcomesOf(parliament, p1, 'resources')).is.empty;
      takeAll(p1);
      runAllActions(game);
      expect(p1.cardsInHand).has.length(hand + 2);
      expect(countOn(p1, CardName.ARKLIGHT), 'the corporation is a card of the tableau').eq(5);
      expect(fish.resourceCount).eq(3);
      expect(dirigibles.resourceCount).eq(2);
      expect(computer.resourceCount).eq(4);
      expect(birds.resourceCount, '«already has» — a holder at 0 receives nothing').eq(0);
      // p2's Fish is p2's own card — paid ONCE, by p2's own payout, never by p1's (p1's record names none of it).
      expect(countOn(p2, CardName.FISH)).eq(6);
      // THE RECORDS, in the printed order.
      const records = outcomesOf(parliament, p1);
      expect(records.map((o) => o.step)).deep.eq(['draw', 'resources']);
      expect(records[0]).deep.include({kind: 'cards', effect: 'draw', amount: 2, drawn: 2, influence: 2});
      expect(records[1]).deep.include({
        kind: 'cardResource', effect: 'resources', onto: 'each-counted', influence: 2, amount: 4, count: 4,
        counted: [CardName.ARKLIGHT, CardName.FISH, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER],
      });
      // A mixed landing names no single kind — every card names its own, with what it held before and its points' move.
      expect(records[1].resource).is.undefined;
      expect(records[1].card).is.undefined;
      expect(records[1].cards).deep.eq([
        {card: CardName.ARKLIGHT, amount: 1, resource: CardResource.ANIMAL, before: 4, vp: {from: 2, to: 2}},
        {card: CardName.FISH, amount: 1, resource: CardResource.ANIMAL, before: 2, vp: {from: 2, to: 3}},
        {card: CardName.DIRIGIBLES, amount: 1, resource: CardResource.FLOATER, before: 1},
        {card: CardName.SUPERCOMPUTER, amount: 1, resource: CardResource.DATA, before: 3},
      ]);
      expect(records[1].countedByCard?.map((e) => e.count)).deep.eq([4, 2, 1, 3]);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
    });

    it('ONE kind on every card → the record names it, like Medical Database\'s', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(holding(new Fish(), 1), holding(new Birds(), 2));
      endGenerationThroughParliament(game);
      takeAll(p1);
      runAllActions(game);
      expect(outcomesOf(parliament, p1, 'resources')[0]).deep.include({kind: 'cardResource', amount: 2, resource: CardResource.ANIMAL});
    });

    it('TWO PARTS, TWO NAMED ZEROS: influence 0 skips the draw («No influence»), no card with a resource skips the resources («No card of yours has a resource yet»)', () => {
      const [game, p1, p2, parliament] = stage();
      expect(parliament.influence(p2)).eq(0);
      p1.playedCards.push(holding(new Fish(), 1));
      p2.playedCards.push(new Birds(), new Mine()); // a holder at 0 and a card that holds nothing
      endGenerationThroughParliament(game);
      takeAll(p1);
      runAllActions(game);
      expect(takePrompt(p2), 'nothing to take at influence 0').is.undefined;
      const [draw, resources] = [outcomesOf(parliament, p2, 'draw')[0], outcomesOf(parliament, p2, 'resources')[0]];
      expect(draw).deep.include({kind: 'skipped', effect: 'draw', amount: 0, influence: 0, reason: 'No influence'});
      expect(resources).deep.include({kind: 'skipped', effect: 'resources', onto: 'each-counted', amount: 0, count: 0, reason: EACH_COUNTED_NO_HOLDER_REASON});
      expect(EACH_COUNTED_NO_HOLDER_REASON).eq('No card of yours has a resource yet');
      expect(game.gameLog.some((e) => e.message === '${0} has no card with a resource on it — nothing from ${1}')).is.true;
    });

    it('an empty deck is a named skip of the draw — the resources are paid all the same', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(holding(new Fish(), 1));
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      endGenerationThroughParliament(game);
      runAllActions(game);
      expect(takePrompt(p1)).is.undefined;
      expect(outcomesOf(parliament, p1, 'draw')[0]).deep.include({kind: 'skipped', amount: 1, drawn: 0, reason: 'The project deck is empty'});
      expect(countOn(p1, CardName.FISH)).eq(2);
    });

    it('THROUGH `addResourceTo`: the journal names every card under the law, and the table\'s answer to an added resource answers (Meat Industry: 2 M€ per animal; Martian Fiber: 1 M€ per data)', () => {
      const [game, p1, , parliament] = stage();
      p1.playedCards.push(new MeatIndustry(), holding(new Fish(), 1), holding(new Birds(), 1), holding(new MartianFiber(), 1));
      endGenerationThroughParliament(game);
      const cash = p1.megaCredits;
      takeAll(p1);
      runAllActions(game);
      expect(p1.megaCredits - cash, '2 animals × 2 M€ + 1 data × 1 M€').eq(5);
      const lines = game.gameLog.filter((e) => e.message === '${0} added ${1} ${2} to ${3} from ${4}');
      expect(lines).has.length(3);
      for (const line of lines) {
        expect(line.data.some((d) => d.type === LogMessageDataType.RESOLUTION && d.value === SPONSORED_PROJECTS_ID), 'the law is the source').is.true;
      }
      expect(outcomesOf(parliament, p1, 'resources')[0].amount).eq(3);
    });

    it('a reload inside the take: the same cards, nothing drawn twice, and the resources land ONCE after it', () => {
      const [game, p1] = stage();
      p1.playedCards.push(holding(new Fish(), 2));
      endGenerationThroughParliament(game);
      const before = takePrompt(p1)!.cards.map((c) => c.name);
      const deck = game.projectDeck.drawPile.length;
      const again = reload(game);
      const seat = again.getPlayerById(p1.id);
      expect(takePrompt(seat)?.cards.map((c) => c.name)).deep.eq(before);
      expect(again.projectDeck.drawPile.length, 'nothing drawn again').eq(deck);
      expect(countOn(seat, CardName.FISH), 'nothing landed before the take').eq(2);
      seat.process({type: 'card', cards: before});
      runAllActions(again);
      expect(countOn(seat, CardName.FISH)).eq(3);
      const parliament = again.parliament!;
      expect(outcomesOf(parliament, seat, 'resources')).has.length(1);
      settleParliamentGates(again);
      expect(countOn(seat, CardName.FISH), 'paid once').eq(3);
    });

    it('the counted cards are FIXED the first time the step runs: a second pass pays the same list, never a card that gained its first resource in between', () => {
      const [, p1] = reduxGame();
      const fish = holding(new Fish(), 1);
      const birds = new Birds();
      p1.playedCards.push(fish, birds);
      const step = SPONSORED_PROJECTS.immediateSteps![1];
      const state: Record<string, unknown> = {};
      const reports: Array<EnactOutcome> = [];
      step.run(contextOf(p1, state, reports));
      expect(fish.resourceCount).eq(2);
      birds.resourceCount = 1; // Birds now holds one — after the list was read
      step.run(contextOf(p1, state, reports));
      expect(birds.resourceCount, 'the list the step read first').eq(1);
      expect(reports.map((r) => r.counted)).deep.eq([[CardName.FISH], [CardName.FISH]]);
    });
  });

  describe('the address — a card payout that asked nobody', () => {
    it('keeps the card-resource kind and surface, but its stage is the REWARD page — and the payload carries the receipt\'s facts', () => {
      expect(CARD_RESOURCE_EACH_ADDRESS).deep.eq({...REWARD_ADDRESS.cardResource, stage: 'reward'});
      const record = {
        player: 'blue', step: 'resources', kind: 'cardResource', effect: 'resources', onto: 'each-counted', amount: 2,
        cards: [
          {card: CardName.FISH, amount: 1, resource: CardResource.ANIMAL, before: 2, vp: {from: 2, to: 3}},
          {card: CardName.DIRIGIBLES, amount: 1, resource: CardResource.FLOATER, before: 1},
        ],
      } as unknown as ParliamentEnactOutcomeModel;
      const delivery = rewardAddressOf(record, 'blue');
      expect(delivery.address).eq(CARD_RESOURCE_EACH_ADDRESS);
      expect(delivery.address.surface).eq('tableau-card');
      expect(delivery.source).eq('card-icon');
      expect(delivery.skipped).is.undefined;
      expect(delivery.payload.onto).eq('each-counted');
      expect(delivery.payload.cards).deep.eq([
        {card: CardName.FISH, amount: 1, resource: CardResource.ANIMAL, before: 2, vp: {from: 2, to: 3}},
        {card: CardName.DIRIGIBLES, amount: 1, resource: CardResource.FLOATER, before: 1},
      ]);
      // …and a pick's payout keeps its own row.
      expect(rewardAddressOf({...record, onto: undefined} as ParliamentEnactOutcomeModel, 'blue').address).eq(REWARD_ADDRESS.cardResource);
      expect(REWARD_ADDRESS.cardResource.stage).eq('choice');
    });
  });

  describe('the quest — 4 data on the seat\'s cards', () => {
    it('the law\'s own data never count; the seat\'s own data do', () => {
      const [game, p1, , parliament] = stage();
      const computer = holding(new Supercomputer(), 1);
      p1.playedCards.push(computer);
      endGenerationThroughParliament(game);
      takeAll(p1);
      runAllActions(game);
      settleParliamentGates(game);
      expect(computer.resourceCount).eq(2);
      expect(parliament.quest?.source).eq(SPONSORED_PROJECTS_ID);
      expect(parliament.questProgressOf(p1), 'the enactment is the political phase\'s').eq(0);
      game.phase = Phase.ACTION;
      const events = game.events;
      events.beginAction(p1, {kind: 'card', card: CardName.SUPERCOMPUTER, owner: p1.color}, {category: 'card-action'});
      try {
        p1.addResourceTo(computer, {qty: 2, log: false});
      } finally {
        events.endScope();
      }
      expect(parliament.questProgressOf(p1), 'the seat\'s own action').eq(2);
    });
  });

  describe('MarsBot — nothing (decision Р3)', () => {
    it('is never dealt, never asked, and nothing lands on its cards', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'none'});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, SPONSORED);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      // Two animals on the human's Fish: the bot's turn moves with the card pool (T10 dealt one more classic card under
      // Redux, and the seed's bot drew Invasive Species, which takes one animal off a Fish) — so the counts are read at
      // the sitting's door, and the law's +1 is asserted against them.
      human.playedCards.push(holding(new Fish(), 2));
      bot.playedCards.push(holding(new Fish(), 2));
      const botHand = bot.cardsInHand.length;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      const humanFish = countOn(human, CardName.FISH);
      const botFish = countOn(bot, CardName.FISH);
      expect(humanFish, 'the human\'s Fish still holds an animal').gte(1);
      takeAll(human);
      runAllActions(game);
      expect(bot.getWaitingFor()).is.undefined;
      expect(bot.cardsInHand).has.length(botHand);
      expect(countOn(bot, CardName.FISH)).eq(botFish);
      expect(countOn(human, CardName.FISH)).eq(humanFish + 1);
      const summary = parliament.lastPhase ?? parliament.phase?.summary;
      expect((summary?.outcomes ?? []).filter((o) => o.player === bot.id)).is.empty;
    });
  });

  describe('the model', () => {
    it('every seat carries its count with the cards, their kinds, their numbers and their points after one more', () => {
      const [game, p1, p2] = stage();
      p1.playedCards.push(holding(new Fish(), 2), holding(new Dirigibles(), 1));
      p2.playedCards.push(holding(new Birds(), 1));
      const model = getParliamentModel(game, p1)!;
      const own = model.players.find((p) => p.color === p1.color)?.counts?.find((c) => c.id === 'cardsWithResources');
      expect(own?.count).eq(2);
      expect(own?.byCard).deep.eq([
        {card: CardName.FISH, resource: CardResource.ANIMAL, count: 2, vp: {from: 2, to: 3}},
        {card: CardName.DIRIGIBLES, resource: CardResource.FLOATER, count: 1},
      ]);
      const other = model.players.find((p) => p.color === p2.color)?.counts?.find((c) => c.id === 'cardsWithResources');
      expect(other?.byCard?.map((e) => e.card), 'another seat counts its own').deep.eq([CardName.BIRDS]);
    });
  });
});
