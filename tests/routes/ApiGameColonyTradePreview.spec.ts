import {expect} from 'chai';
import {ApiGameColonyTradePreview} from '../../src/server/routes/ApiGameColonyTradePreview';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardName} from '../../src/common/cards/CardName';
import {WaterHauling} from '../../src/server/cards/turmoilRedux/WaterHauling';
import {VenusTradeHub} from '../../src/server/cards/prelude2/VenusTradeHub';
import {statusCode} from '../../src/common/http/statusCode';
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

  // A 2-player game deals FIVE colonies, so the default list is dealt whole
  // (nothing discarded). Pass a longer one to leave tiles out of play — the
  // add-a-tile catalog's own situation.
  const DEALT = [
    ColonyName.LUNA, ColonyName.PLUTO, ColonyName.IO, ColonyName.CALLISTO, ColonyName.CERES,
  ];

  async function freshGame(customColoniesList: ReadonlyArray<ColonyName> = DEALT) {
    const player = TestPlayer.BLUE.newPlayer();
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-id', [player, player2], player, 'spectatorid', {
      coloniesExtension: true,
      customColoniesList: [...customColoniesList],
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

  // A COLONY THAT IS NOT IN THE GAME IS NOT AN ERROR — it is «no preview for
  // that subject» (`responses.noPreview`). The console legitimately rails
  // colonies that are NOT in play: an add-a-tile catalog (Aridor's first
  // action, Maria) offers the game's UNUSED colonies, and descending into one
  // used to fire a trade-preview request that answered a warn-logged 404 on
  // the server and a red 404 in the client console. 204, empty body, and the
  // reason travels in a header.
  it('answers no-content for a colony that is not in the game', async () => {
    const {player} = await freshGame();
    scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&colony=Atlantis`;
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.noContent);
    expect(res.content).eq('');
    expect(res.headers.get('X-No-Preview')).eq('colony not in the game');
  });

  it('answers no-content for an add-a-tile CATALOG colony (Aridor)', async () => {
    const {game, player} = await freshGame([...DEALT, ColonyName.EUROPA, ColonyName.GANYMEDE]);
    // The colonies dealt OUT of this game are exactly what Aridor's first
    // action offers — real colony names, none of them in `game.colonies`.
    const offered = game.discardedColonies[0];
    expect(offered, 'the fixture must leave some colonies undealt').is.not.undefined;
    scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&colony=${offered.name}`;
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.noContent);
    expect(res.content).eq('');
  });

  it('previews the CHOSEN PATH\'s own track advance (`offset` — the Unity action\'s 1)', async () => {
    const {game, player} = await freshGame();
    const luna = game.colonies.find((c) => c.name === ColonyName.LUNA)!;
    luna.trackPosition = 3;
    scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&colony=${ColonyName.LUNA}&offset=1`;
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    const preview = JSON.parse(res.content);
    expect(preview.track).to.deep.eq({current: 3, effective: 4, steps: 1, willAsk: false});
    expect(preview.rewardQuantity).eq(10);
  });

  it('refuses a malformed offset', async () => {
    const {player} = await freshGame();
    scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&colony=${ColonyName.LUNA}&offset=-1`;
    await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: invalid offset parameter');
  });

  /**
   * `?dock=<card>` — the same question about a trade whose destination is a
   * fleet-dock CARD of the asking player's own (`FleetDockPreviewModel`).
   */
  describe('a fleet dock (`dock`)', () => {
    it('returns the dock preview for a dock in the asking player\'s tableau', async () => {
      const {game, player} = await freshGame();
      player.playedCards.push(new WaterHauling());
      scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&dock=${encodeURIComponent(CardName.WATER_HAULING)}`;
      await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
      const preview = JSON.parse(res.content);
      expect(preview.card).eq(CardName.WATER_HAULING);
      expect(preview.available).eq(true);
      expect(preview.colonyName, 'no colony takes part').is.undefined;
      expect(preview.track).is.undefined;
      const oceans = game.board.getOceanSpaces().length;
      expect(preview.effects).to.deep.eq([
        {direction: 'gain', icon: 'oceans', amount: 1, current: oceans, resulting: oceans + 1},
        {direction: 'gain', icon: 'tr', amount: 1, current: player.terraformRating, resulting: player.terraformRating + 1},
      ]);
      expect(preview.followUps).to.deep.eq([{kind: 'note', role: 'tradeReward', note: 'placeOcean'}]);
    });

    it('`colony` and `dock` are mutually exclusive', async () => {
      const {player} = await freshGame();
      scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&colony=${ColonyName.LUNA}&dock=${encodeURIComponent(CardName.WATER_HAULING)}`;
      await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.badRequest);
      expect(res.content).eq('Bad request: colony and dock are mutually exclusive');
    });

    it('answers no-content for a card that is not in the tableau, and for a played card that is no dock', async () => {
      const {player, player2} = await freshGame();
      player2.playedCards.push(new WaterHauling());
      // Another seat's dock is not the asking player's destination (only the owner trades with it).
      scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&dock=${encodeURIComponent(CardName.WATER_HAULING)}`;
      await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.noContent);
      expect(res.headers.get('X-No-Preview')).eq('no such fleet dock in the tableau');

      player.playedCards.push(new VenusTradeHub());
      res = new MockResponse();
      scaffolding.url = `/api/game/colony-trade-preview?id=${player.id}&dock=${encodeURIComponent(CardName.VENUS_TRADE_HUB)}`;
      await scaffolding.get(ApiGameColonyTradePreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.noContent);
      expect(res.content).eq('');
    });
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
