import {expect} from 'chai';
import {ApiGameJournalEvents} from '../../src/server/routes/ApiGameJournalEvents';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {GameEvent} from '../../src/common/events/GameEvent';
import {Phase} from '../../src/common/Phase';

/** A minimal well-formed event (the route slices by generation + tag only). */
function event(id: number, generation: number, tags?: Array<string>): GameEvent {
  return {
    id,
    generation,
    phase: Phase.ACTION,
    type: 'resource-changed',
    impact: {},
    correlationId: id,
    ...(tags !== undefined ? {tags: tags as GameEvent['tags']} : {}),
  } as GameEvent;
}

describe('ApiGameJournalEvents', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  it('fails when id not provided', async () => {
    scaffolding.url = '/api/game/journal-events';
    await scaffolding.get(ApiGameJournalEvents.INSTANCE, res);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('returns [] with no generation parameter', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    scaffolding.url = '/api/game/journal-events?id=' + player.id;
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    await scaffolding.get(ApiGameJournalEvents.INSTANCE, res);
    expect(JSON.parse(res.content)).deep.eq([]);
  });

  // REGRESSION (Steam Deck perf iteration 1): the route finds the requested
  // generation's WINDOW from the END of the (chronological) stream instead of
  // filtering the whole game-long array per poll. The window must be exactly
  // the requested generation, in order, minus the analytics-only tags.
  it('returns exactly the requested generation window, tail-first', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    game.events.events.length = 0;
    game.events.events.push(
      event(1, 1),
      event(2, 1),
      event(3, 2),
      event(4, 2, ['resource-payment']), // analytics-only → excluded
      event(5, 2),
      event(6, 3),
    );

    scaffolding.url = `/api/game/journal-events?id=${player.id}&generation=2`;
    await scaffolding.get(ApiGameJournalEvents.INSTANCE, res);
    const events = JSON.parse(res.content) as Array<GameEvent>;
    expect(events.map((e) => e.id)).deep.eq([3, 5]);
  });

  // meta=1 — the notification layer's COHERENT pair: the same events window
  // plus the open-correlation set captured in the SAME read, so the atomic
  // gate never judges fresh streams against an older view's open-set (the
  // 2026-09-04 stream-skew audit). The bare-array shape stays the default.
  it('meta=1 returns {events, openEventCorrelations} from one read', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    game.events.events.length = 0;
    game.events.events.push(event(1, 1), event(2, 1, ['resource-payment']));

    scaffolding.url = `/api/game/journal-events?id=${player.id}&generation=1&meta=1`;
    await scaffolding.get(ApiGameJournalEvents.INSTANCE, res);
    const payload = JSON.parse(res.content) as {events: Array<GameEvent>; openEventCorrelations: Array<number>};
    expect(Array.isArray(payload)).eq(false);
    expect(payload.events.map((e) => e.id), 'same window, same analytics exclusion').deep.eq([1]);
    expect(payload.openEventCorrelations, 'the live open set rides the same response').deep.eq(game.openEventCorrelations());
  });

  it('returns the CURRENT (tail) generation and [] for an unknown one', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    game.events.events.length = 0;
    game.events.events.push(event(1, 1), event(2, 2), event(3, 3), event(4, 3));

    scaffolding.url = `/api/game/journal-events?id=${player.id}&generation=3`;
    await scaffolding.get(ApiGameJournalEvents.INSTANCE, res);
    expect((JSON.parse(res.content) as Array<GameEvent>).map((e) => e.id)).deep.eq([3, 4]);

    scaffolding.url = `/api/game/journal-events?id=${player.id}&generation=9`;
    res = new MockResponse();
    await scaffolding.get(ApiGameJournalEvents.INSTANCE, res);
    expect(JSON.parse(res.content)).deep.eq([]);
  });
});
