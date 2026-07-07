import {expect} from 'chai';
import {ApiGameColonyTradePreview} from '../../src/server/routes/ApiGameColonyTradePreview';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('ApiGameColonyTradePreview', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  async function freshGame() {
    const player = TestPlayer.BLUE.newPlayer();
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-id', [player, player2], player, 'spectatorid', {
      coloniesExtension: true,
      customColoniesList: [
        ColonyName.LUNA, ColonyName.PLUTO, ColonyName.IO, ColonyName.CALLISTO, ColonyName.CERES,
      ],
    });
    await scaffolding.ctx.gameLoader.add(game);
    return {game, player, player2};
  }

  it('fails when id not provided', async () => {
    scaffolding.url = '/api/game/colony-trade-preview?colony=Luna';
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails with a non-player id (spectators have no trade perspective)', async () => {
    scaffolding.url = '/api/game/colony-trade-preview?id=spectatorid&colony=Luna';
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    expect(res.content).eq('Bad request: invalid player id');
  });

  it('fails with missing colony', async () => {
    const {player} = await freshGame();
    scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}`;
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    expect(res.content).eq('Bad request: missing colony parameter');
  });

  it('fails with an unknown colony', async () => {
    const {player} = await freshGame();
    scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&colony=Atlantis`;
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    expect(res.content).eq('Not found: colony not found');
  });

  it('returns the preview for a colony', async () => {
    const {game, player} = await freshGame();
    const luna = game.colonies.find((c) => c.name === ColonyName.LUNA)!;
    luna.trackPosition = 3;
    scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&colony=${ColonyName.LUNA}`;
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    const preview = JSON.parse(res.content);
    expect(preview.colonyName).eq(ColonyName.LUNA);
    expect(preview.track).to.deep.eq({current: 3, effective: 3, steps: 0, willAsk: false});
    expect(preview.rewardQuantity).eq(7);
    expect(preview.followUps).to.deep.eq([]);
  });
});
