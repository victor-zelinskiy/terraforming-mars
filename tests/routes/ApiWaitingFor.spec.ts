import {expect} from 'chai';
import {ApiWaitingFor} from '../../src/server/routes/ApiWaitingFor';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {GameId} from '../../src/common/Types';
import {statusCode} from '../../src/common/http/statusCode';

describe('ApiWaitingFor', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  it('fails when id is missing', async () => {
    scaffolding.url = '/api/waitingfor?gameAge=123&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails when game not found', async () => {
    scaffolding.url = '/api/waitingfor?id=p-some-player-id&gameAge=123&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: cannot find game for that player');
  });

  it('fails when player not found', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('g' + player.id as GameId, [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    (game as any).getPlayerById = () => {
      throw new Error('player does not exist');
    };

    scaffolding.url = '/api/waitingfor?id=' + player.id + '&gameAge=50&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: player not found');
  });

  it('sends model for player', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);

    scaffolding.url = '/api/waitingfor?id=' + player.id + '&gameAge=50&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(res.content).eq('{"result":"GO","waitingFor":["black"],"changed":false}');
  });

  // The `changed` bit — the mid-prompt refresh cursor. `GO` fires on every
  // poll while the viewer holds a prompt, so the client needs the server's
  // own «did the game move past your cursor?» beside it: refresh exactly when
  // another player's action landed, never once per poll interval.
  it('marks GO as changed when the game moved past the advertised cursor', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);

    scaffolding.url = '/api/waitingfor?id=' + player.id + '&gameAge=0&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content);
    expect(model.result).eq('GO');
    expect(model.changed).eq(true);
  });

  it('REFRESH carries changed=true, WAIT carries changed=false', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    player.popWaitingFor(); // the viewer holds no prompt → REFRESH/WAIT path

    scaffolding.url = '/api/waitingfor?id=' + player.id + '&gameAge=0&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    let model = JSON.parse(res.content);
    expect(model.result).eq('REFRESH');
    expect(model.changed).eq(true);

    res = new MockResponse();
    scaffolding.url = `/api/waitingfor?id=${player.id}&gameAge=${game.gameAge}&undoCount=${game.undoCount}`;
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    model = JSON.parse(res.content);
    expect(model.result).eq('WAIT');
    expect(model.changed).eq(false);
  });

  // The spectator feature was removed: a spectator id is no longer a valid
  // participant on this route, even when it belongs to a real loaded game.
  it('rejects a spectator id with not-found', async () => {
    const player = TestPlayer.BLACK.newPlayer();
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-id', [player, player2], player, 's-spectatorid');
    await scaffolding.ctx.gameLoader.add(game);

    scaffolding.url = '/api/waitingfor?id=' + game.spectatorId + '&gameAge=50&undoCount=0';
    await scaffolding.get(ApiWaitingFor.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: cannot find game for that player');
  });
});
