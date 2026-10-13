import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {IGame} from '../../src/server/IGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {newProjectCard} from '../../src/server/createCard';
import {AqueductSystems} from '../../src/server/cards/promo/AqueductSystems';
import {Research} from '../../src/server/cards/base/Research';
import {ApiGameJournalEvents} from '../../src/server/routes/ApiGameJournalEvents';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {GameEvent} from '../../src/common/events/GameEvent';
import {buildEventChildren} from '../../src/client/components/journal/journalEventChild';
import {recomputeRootImpact} from '../../src/client/components/notifications/notificationModel';
import {MockResponse} from '../routes/HttpMocks';
import {RouteTestScaffolding} from '../routes/RouteTestScaffolding';

/**
 * PL-033 — A CONDITIONAL DRAW SEARCH IS A JOURNAL ROW. «Reveal cards until you
 * find N with tag X; discard the rest» wrote public log lines («Discarded N
 * cards …», «… drew …») but the journal's event rows showed only «+N [cards]»
 * and the payment: how many cards the deck turned over, which were thrown away
 * and by what rule was invisible to the owner AND to the rivals. The search
 * now records ONE `deck-searched` fact under the live scope (`DrawCards.keepAll`
 * → `EventRecorder.recordDeckSearched`), the journal draws it as one row under
 * the play's root — and a plain private draw never records one.
 */
function card(name: CardName): IProjectCard {
  return newProjectCard(name)!;
}

/** Stack the draw pile so the FIRST name is turned over first (`draw()` pops the tail); `spare` sits at the bottom. */
function stack(game: IGame, topFirst: ReadonlyArray<CardName>, spare: ReadonlyArray<CardName> = [CardName.TARDIGRADES, CardName.LICHEN]): void {
  game.projectDeck.drawPile.length = 0;
  game.projectDeck.discardPile.length = 0;
  game.projectDeck.drawPile.push(...spare.map(card), ...[...topFirst].reverse().map(card));
}

/** Aqueduct Systems searches for 3 building tags: Ants ✗ → Mine ✓ → Birds ✗ → Geothermal Power ✓ → Comet ✗ → Rad-Chem Factory ✓. */
const JOURNEY = [CardName.ANTS, CardName.MINE, CardName.BIRDS, CardName.GEOTHERMAL_POWER, CardName.COMET, CardName.RAD_CHEM_FACTORY];

function searchesOf(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'deck-searched');
}

/** The journal-events route's answer for the generation, as one player sees it. */
async function journalEventsFor(game: IGame, viewer: TestPlayer): Promise<Array<GameEvent>> {
  const scaffolding = new RouteTestScaffolding();
  const res = new MockResponse();
  await scaffolding.ctx.gameLoader.add(game);
  scaffolding.url = `/api/game/journal-events?id=${viewer.id}&generation=${game.generation}`;
  await scaffolding.get(ApiGameJournalEvents.INSTANCE, res);
  return JSON.parse(res.content) as Array<GameEvent>;
}

describe('deck search — the journal row (PL-033)', () => {
  let game: IGame;
  let owner: TestPlayer;
  let rival: TestPlayer;

  beforeEach(() => {
    [game, owner, rival] = testGame(2);
  });

  function playAqueduct(): void {
    owner.playCard(new AqueductSystems());
    runAllActions(game);
  }

  it('a play that searched records ONE `deck-searched` fact under its root: the rule, 6 turned over, 3 kept, the 3 thrown away BY NAME in reveal order', () => {
    stack(game, JOURNEY);
    playAqueduct();

    expect(owner.cardsInHand.map((c) => c.name)).deep.eq([CardName.MINE, CardName.GEOTHERMAL_POWER, CardName.RAD_CHEM_FACTORY]);
    const searches = searchesOf(game);
    expect(searches).has.length(1);
    const search = searches[0];
    expect(search.player).eq(owner.color);
    expect(search.visibility).eq('journal');
    expect(search.source).deep.eq({kind: 'card', card: CardName.AQUEDUCT_SYSTEMS, owner: owner.color});
    expect(search.impact.deckSearch).deep.eq({
      rule: {count: 3, tag: Tag.BUILDING},
      revealed: 6,
      kept: 3,
      discarded: [CardName.ANTS, CardName.BIRDS, CardName.COMET],
    });
    // Under the play's root — and BEFORE the draw it produced (the search is the cause).
    const root = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.AQUEDUCT_SYSTEMS);
    expect(root).is.not.undefined;
    expect(search.correlationId).eq(root!.correlationId);
    const drawn = game.events.events.find((e) => e.type === 'cards-drawn' && e.correlationId === root!.correlationId);
    expect(drawn?.impact.cardsDrawn).eq(3);
    expect(search.id).lessThan(drawn!.id);
  });

  it('the journal route hands the fact to the owner AND to the rival — the discards are public by the rules', async () => {
    stack(game, JOURNEY);
    playAqueduct();

    for (const viewer of [owner, rival]) {
      const events = await journalEventsFor(game, viewer);
      const search = events.find((e) => e.type === 'deck-searched');
      expect(search, `${viewer.color} reads the search`).is.not.undefined;
      expect(search!.impact.deckSearch?.discarded).deep.eq([CardName.ANTS, CardName.BIRDS, CardName.COMET]);
    }
  });

  it('the journal draws it as ONE row of the play (the rows are built from the root actor, so owner and rival read the same): no chip of its own, the «+3 [cards]» row beside it', () => {
    stack(game, JOURNEY);
    playAqueduct();

    const search = searchesOf(game)[0];
    const chain = game.events.events.filter((e) => e.correlationId === search.correlationId);
    const rows = buildEventChildren(chain, search.correlationId, owner.color);
    const searchRows = rows.filter((r) => r.search !== undefined);
    expect(searchRows).has.length(1);
    expect(searchRows[0].bucket).eq('search');
    expect(searchRows[0].source).deep.eq({kind: 'card', card: CardName.AQUEDUCT_SYSTEMS});
    expect(searchRows[0].player, 'the actor\'s own search — no recipient chip').is.undefined;
    expect(searchRows[0].chips).deep.eq([]);
    expect(searchRows[0].search).deep.eq({
      rule: {count: 3, tag: Tag.BUILDING},
      revealed: 6,
      kept: 3,
      discarded: [CardName.ANTS, CardName.BIRDS, CardName.COMET],
      exhausted: false,
    });
    // The draw keeps its own gain row — the search names it, never sums it a second time.
    expect(rows.some((r) => r.chips.some((c) => c.icon === 'cards' && c.text === '+3'))).is.true;
    // The search row reads before the gain it produced (one tier, chronological).
    const searchAt = rows.indexOf(searchRows[0]);
    const gainAt = rows.findIndex((r) => r.chips.some((c) => c.icon === 'cards'));
    expect(searchAt).lessThan(gainAt);
  });

  it('a notification never sums the search: the rival\'s pills are exactly what they were without it — the row is a CHILD, not a card', () => {
    stack(game, JOURNEY);
    playAqueduct();

    const search = searchesOf(game)[0];
    const all = game.events.events;
    const without = all.filter((e) => e.type !== 'deck-searched');
    const withSearch = recomputeRootImpact(all, search.correlationId, owner.color, rival.color);
    const withoutSearch = recomputeRootImpact(without, search.correlationId, owner.color, rival.color);
    expect(withSearch.pills).deep.eq(withoutSearch.pills);
    expect(withSearch.pillGroups).deep.eq(withoutSearch.pillGroups);
    expect(withSearch.viewerImpact.sign, 'nothing of the rival\'s moved').eq('neutral');
    expect(withSearch.childVMs.length).eq(withoutSearch.childVMs.length + 1);
  });

  it('a search that threw nothing away still records the rule and the count (2 turned over, 2 kept)', () => {
    stack(game, [CardName.MINE, CardName.GEOTHERMAL_POWER]);
    game.events.beginAction(owner, {kind: 'card', card: CardName.AQUEDUCT_SYSTEMS, owner: owner.color}, {category: 'card-play'});
    try {
      owner.drawCard(2, {tag: Tag.BUILDING});
    } finally {
      game.events.endScope();
    }
    expect(searchesOf(game).map((e) => e.impact.deckSearch)).deep.eq([{rule: {count: 2, tag: Tag.BUILDING}, revealed: 2, kept: 2, discarded: []}]);
  });

  it('the deck ran out: `exhausted`, with what it did find', () => {
    // One building card in the whole deck (draw pile + discard pile): the search turns everything over.
    stack(game, [CardName.ANTS, CardName.MINE, CardName.BIRDS], []);
    game.events.beginAction(owner, {kind: 'card', card: CardName.AQUEDUCT_SYSTEMS, owner: owner.color}, {category: 'card-play'});
    try {
      owner.drawCard(3, {tag: Tag.BUILDING});
    } finally {
      game.events.endScope();
    }
    const fact = searchesOf(game)[0]?.impact.deckSearch;
    expect(fact?.exhausted).eq(true);
    expect(fact?.kept).eq(1);
    expect(fact?.revealed).eq(fact!.kept + fact!.discarded.length);
    const chain = game.events.events.filter((e) => e.correlationId === searchesOf(game)[0].correlationId);
    const row = buildEventChildren(chain, searchesOf(game)[0].correlationId, owner.color).find((r) => r.search !== undefined);
    expect(row?.search?.exhausted).eq(true);
  });

  it('an opaque `include` search (Nobel Prize, Celestic) is a search too: counts and names, no rule', () => {
    stack(game, [CardName.ANTS, CardName.MINE]);
    game.events.beginAction(owner, {kind: 'card', card: CardName.AQUEDUCT_SYSTEMS, owner: owner.color}, {category: 'card-play'});
    try {
      owner.drawCard(1, {include: (c) => c.name === CardName.MINE});
    } finally {
      game.events.endScope();
    }
    expect(searchesOf(game).map((e) => e.impact.deckSearch)).deep.eq([{revealed: 2, kept: 1, discarded: [CardName.ANTS]}]);
  });

  it('a search inside a PASSIVE EFFECT is its own row under the effect\'s card — never folded into the marker', () => {
    stack(game, JOURNEY);
    const effectCard = new AqueductSystems();
    game.events.beginAction(owner, {kind: 'card', card: CardName.RESEARCH, owner: owner.color}, {category: 'card-play'});
    try {
      game.events.withEffect(owner, effectCard, 'card-played', () => owner.drawCard(1, {tag: Tag.BUILDING}));
    } finally {
      game.events.endScope();
    }
    const search = searchesOf(game)[0];
    expect(search.tags).includes('passive-effect');
    const chain = game.events.events.filter((e) => e.correlationId === search.correlationId);
    const row = buildEventChildren(chain, search.correlationId, owner.color).find((r) => r.search !== undefined);
    expect(row?.source).deep.eq({kind: 'card', card: CardName.AQUEDUCT_SYSTEMS});
    expect(row?.search?.discarded).deep.eq([CardName.ANTS]);
  });

  it('a PLAIN draw stays private: no `deck-searched`, nothing the route could hand a rival', async () => {
    stack(game, JOURNEY);
    owner.playCard(new Research());
    runAllActions(game);

    expect(owner.cardsInHand.map((c) => c.name)).deep.eq([CardName.ANTS, CardName.MINE]);
    expect(searchesOf(game)).deep.eq([]);
    const events = await journalEventsFor(game, rival);
    const named = events.filter((e) => JSON.stringify(e).includes(CardName.ANTS) || JSON.stringify(e).includes(CardName.MINE));
    expect(named, 'no event names a privately drawn card').deep.eq([]);
  });

  it('a search with no scope (no root to stand under) records nothing', () => {
    stack(game, JOURNEY);
    owner.drawCard(1, {tag: Tag.BUILDING});
    expect(searchesOf(game)).deep.eq([]);
  });
});
