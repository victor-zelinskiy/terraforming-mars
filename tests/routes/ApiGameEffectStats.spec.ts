import {expect} from 'chai';
import {ApiGameEffectStats} from '../../src/server/routes/ApiGameEffectStats';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {EffectOverlayStat} from '../../src/common/events/aggregate';
import {CarbonNanosystems} from '../../src/server/cards/promo/CarbonNanosystems';

describe('ApiGameEffectStats', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  it('fails when id not provided', async () => {
    scaffolding.url = '/api/game/effect-stats';
    await scaffolding.get(ApiGameEffectStats.INSTANCE, res);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails on a missing / invalid color', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    scaffolding.url = `/api/game/effect-stats?id=${player.id}`;
    await scaffolding.get(ApiGameEffectStats.INSTANCE, res);
    expect(res.content).eq('Bad request: missing or invalid color parameter');

    res = new MockResponse();
    scaffolding.url = `/api/game/effect-stats?id=${player.id}&color=chartreuse`;
    await scaffolding.get(ApiGameEffectStats.INSTANCE, res);
    expect(res.content).eq('Bad request: missing or invalid color parameter');
  });

  it('404s an unknown game', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    scaffolding.url = `/api/game/effect-stats?id=${player.id}&color=black`;
    await scaffolding.get(ApiGameEffectStats.INSTANCE, res);
    expect(res.content).eq('Not found: game not found');
  });

  // The per-effect CHANNEL split (byChannel) is an additive field of the same
  // payload — it must ride the JSON whole (the client's split adapter reads it).
  it('returns the aggregate WITH its byChannel split through JSON', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    const cn = new CarbonNanosystems();
    game.events.withEffect(player, cn, 'card-played', () => {
      game.events.recordCardResourceDelta(player, cn, 1);
    });
    game.events.recordResourceAsPayment(player, cn, 2, 8);

    scaffolding.url = `/api/game/effect-stats?id=${player.id}&color=${player.color}`;
    await scaffolding.get(ApiGameEffectStats.INSTANCE, res);
    const stats = JSON.parse(res.content) as Array<EffectOverlayStat>;
    const stat = stats.find((s) => s.card === CardName.CARBON_NANOSYSTEMS);
    expect(stat, 'the CN stat').to.not.be.undefined;
    expect(stat!.megacreditsSaved).eq(8);
    expect(stat!.byChannel?.['card-played']?.cardResources[CardResource.GRAPHENE]).eq(1);
    expect(stat!.byChannel?.['resource-payment']?.megacreditsSaved).eq(8);
  });
});
