import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {ActionPreview} from '../../src/server/routes/ActionPreview';
import {CardPlayPreview} from '../../src/server/routes/CardPlayPreview';
import {CardName} from '../../src/common/cards/CardName';
import {CarbonNanosystems} from '../../src/server/cards/promo/CarbonNanosystems';
import {EarthCatapult} from '../../src/server/cards/base/EarthCatapult';
import {GeologicalSurvey} from '../../src/server/cards/ares/GeologicalSurvey';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {ArcticAlgae} from '../../src/server/cards/base/ArcticAlgae';
import {EffectForecast} from '../../src/common/models/EffectForecastModel';

/**
 * THE FORECAST RIDES INSIDE THE PREVIEW — no endpoint of its own: the
 * card-play preview and the action preview both carry `forecast`, so the
 * client's version-keyed caches (the hand prewarm, the action preview store)
 * hold it for free and no new fetch site exists. An expired subject still
 * answers 204 (the preview family's contract), forecast included.
 */
describe('effect forecast in the preview routes', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  async function freshGame() {
    const player = TestPlayer.BLUE.newPlayer();
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-id', [player, player2], player, 'spectatorid', {aresExtension: true, aresHazards: false});
    await scaffolding.ctx.gameLoader.add(game);
    return {game, player, player2};
  }

  it('/api/card-play-preview carries the forecast: reactions, discounts, coverage', async () => {
    const {player} = await freshGame();
    player.playedCards.push(new CarbonNanosystems(), new EarthCatapult());
    player.cardsInHand.push(new GeologicalSurvey());
    player.megaCredits = 30;
    scaffolding.url = `/api/card-play-preview?id=${player.id}&card=${CardName.GEOLOGICAL_SURVEY}`;
    await scaffolding.get(CardPlayPreview.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    const body = JSON.parse(res.content);
    expect(body.card).eq(CardName.GEOLOGICAL_SURVEY);
    const forecast: EffectForecast = body.forecast;
    expect(forecast, 'forecast attached').to.not.be.undefined;
    expect(forecast.facts.map((f) => f.source.name)).to.include(CardName.CARBON_NANOSYSTEMS);
    // Earth Catapult cheapens EVERY card by 2 — itemized by source.
    expect(forecast.discounts).to.deep.include({base: 8, final: 6});
    expect(forecast.discounts.items).to.deep.eq([{source: {kind: 'card', card: CardName.EARTH_CATAPULT, owner: player.color}, amount: 2}]);
    expect(forecast.coverage).eq('complete');
  });

  it('/api/action-preview carries the forecast (the tile pass of an ocean-placing action)', async () => {
    const {player, player2} = await freshGame();
    player.playedCards.push(new AquiferPumping());
    player2.playedCards.push(new ArcticAlgae());
    player.megaCredits = 30;
    scaffolding.url = `/api/action-preview?id=${player.id}&card=${CardName.AQUIFER_PUMPING}`;
    await scaffolding.get(ActionPreview.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    const forecast: EffectForecast = JSON.parse(res.content).forecast;
    expect(forecast, 'forecast attached').to.not.be.undefined;
    const algae = forecast.facts.find((f) => f.source.name === CardName.ARCTIC_ALGAE);
    expect(algae?.certainty).eq('deferred');
    expect(algae?.recipient).deep.eq({kind: 'player', color: player2.color});
  });

  it('an expired subject still answers 204 — forecast or not', async () => {
    const {player} = await freshGame();
    scaffolding.url = `/api/card-play-preview?id=${player.id}&card=${CardName.GEOLOGICAL_SURVEY}`;
    await scaffolding.get(CardPlayPreview.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.noContent);
    expect(res.content).eq('');
  });
});
