import {expect} from 'chai';
import {ApiDevPlaygroundScenario} from '../../src/server/routes/ApiDevPlaygroundScenario';
import {isPlaygroundScenarioName, PlaygroundScenarioBoot} from '../../src/common/models/PlaygroundScenarioModel';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';

/**
 * THE «Полигон» LIVE-SCENARIO DOOR — an engine-generated parliament fixture
 * booted by NAME as a fresh game: gated like every dev door, the name
 * whitelisted by shape (never a path), a build without the fixture answers
 * 404 with its reason, and the booted game stands exactly where the fixture
 * stopped (Biodome Contest's winner placement), on the seat to open.
 */
describe('ApiDevPlaygroundScenario', () => {
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;
  const realDir = ApiDevPlaygroundScenario.fixturesDir;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    scaffolding.req.method = 'POST';
    res = new MockResponse();
  });

  afterEach(() => {
    ApiDevPlaygroundScenario.fixturesDir = realDir;
  });

  it('the name is a parliament fixture by shape — nothing path-like', () => {
    expect(isPlaygroundScenarioName('parliament-biodome-enact')).is.true;
    expect(isPlaygroundScenarioName('parliament-aquifer-vote')).is.true;
    for (const bad of ['../secrets', 'parliament-../x', 'solo-actions', 'parliament-', 'Parliament-x', 'parliament-a/b', '']) {
      expect(isPlaygroundScenarioName(bad), bad).is.false;
    }
  });

  it('refuses a remote caller', async () => {
    scaffolding.ctx.ip = '!192.168.1.20!';
    scaffolding.url = '/api/dev/playground-scenario?scenario=parliament-biodome-enact';
    await ApiDevPlaygroundScenario.INSTANCE.post(scaffolding.req, res, scaffolding.ctx);
    expect(res.content).eq('Not authorized');
  });

  it('refuses a name that is not a playground scenario', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    scaffolding.url = '/api/dev/playground-scenario?scenario=..%2F..%2Fpackage';
    await ApiDevPlaygroundScenario.INSTANCE.post(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(400);
  });

  it('a build without the fixture answers 404 with the reason', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    ApiDevPlaygroundScenario.fixturesDir = 'no-such-directory';
    scaffolding.url = '/api/dev/playground-scenario?scenario=parliament-biodome-enact';
    await ApiDevPlaygroundScenario.INSTANCE.post(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(404);
  });

  it('boots Biodome Contest\'s winner placement as a live game on the viewer\'s seat', async () => {
    scaffolding.ctx.ip = '!127.0.0.1!';
    scaffolding.url = '/api/dev/playground-scenario?scenario=parliament-biodome-enact';
    await ApiDevPlaygroundScenario.INSTANCE.post(scaffolding.req, res, scaffolding.ctx);
    expect(res.statusCode).eq(200);
    const boot = JSON.parse(res.content) as PlaygroundScenarioBoot;
    expect(boot.seats).has.length(2);
    expect(boot.playerId).eq(boot.seats[0]);
    const game = await scaffolding.ctx.gameLoader.getGame(boot.gameId);
    expect(game, 'the game is registered').is.not.undefined;
    const viewer = game!.getPlayerById(boot.playerId);
    expect(viewer.getWaitingFor()?.type, 'the winner\'s greenery stands').eq('space');
    expect(game!.parliament?.phase?.step).eq('effects');
    // Fresh ids: the fixture's own seat ids are not the booted ones.
    const again = new MockResponse();
    await ApiDevPlaygroundScenario.INSTANCE.post(scaffolding.req, again, scaffolding.ctx);
    const second = JSON.parse(again.content) as PlaygroundScenarioBoot;
    expect(second.gameId).not.eq(boot.gameId);
    expect(second.playerId).not.eq(boot.playerId);
  });
});
