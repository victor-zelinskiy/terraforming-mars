import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {EmptyBoard} from '../testing/EmptyBoard';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {Philares} from '../../src/server/cards/promo/Philares';
import {SelectResources} from '../../src/server/inputs/SelectResources';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {PlayerInput} from '../../src/server/routes/PlayerInput';
import {MockRequest, MockResponse} from '../routes/HttpMocks';
import {RouteTestScaffolding} from '../routes/RouteTestScaffolding';
import {GameInvalidation, RealtimeHub} from '../../src/server/server/realtime/RealtimeHub';
import {IPlayer} from '../../src/server/IPlayer';
import {IGame} from '../../src/server/IGame';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {cast} from '../../src/common/utils/utils';
import {Units} from '../../src/common/Units';

/*
 * THE INPUT ROUTE BROADCASTS THE REQUEST IT PROCESSED (PL-301, the field report of 2026-10-14).
 *
 * The realtime invalidation used to ride `takeAction` alone (a save, or the not-saved intermediate action). The
 * FINAL GREENERY loop never passes through `takeAction`: `takeActionForFinalGreenery` places the tile, drains the
 * deferred queue — which hands Philares' pick to ITS OWNER — and the owner's answer puts the greenery prompt back on
 * the first seat through the same drain. Neither hop saved nor bumped the cursor, so neither seat's WebSocket ever
 * woke: the owner learned of their pick, and the first seat of their returned prompt, from the stretched fallback
 * poll — ≈20 s each in the field. One broadcast per processed request, after the state settled.
 */
function spyInvalidate(): {calls: Array<GameInvalidation>, restore: () => void} {
  const hub = RealtimeHub.getInstance();
  const original = hub.invalidate.bind(hub);
  const calls: Array<GameInvalidation> = [];
  hub.invalidate = (update) => {
    calls.push(update);
    return 0;
  };
  return {calls, restore: () => {
    hub.invalidate = original;
  }};
}

/** Answer the seat's standing prompt THROUGH THE ROUTE — the path a client's submit takes. */
async function postInput(game: IGame, player: IPlayer, response: InputResponse): Promise<MockResponse> {
  const req = new MockRequest();
  const res = new MockResponse();
  const scaffolding = new RouteTestScaffolding(req);
  scaffolding.url = '/player/input?id=' + player.id;
  await scaffolding.ctx.gameLoader.add(game);
  const post = scaffolding.post(PlayerInput.INSTANCE, res);
  const emit = Promise.resolve().then(() => {
    req.emitter.emit('data', JSON.stringify(response));
    req.emitter.emit('end');
  });
  await Promise.all([emit, post]);
  return res;
}

describe('realtime/the input route broadcasts (PL-301)', () => {
  it('the final greenery loop: the answer that hands a pick to ANOTHER seat broadcasts, and so does the answer that hands the prompt back', async () => {
    const philares = new Philares();
    const [game, first, owner] = testGame(2);
    game.board = EmptyBoard.newInstance();
    const space = game.board.spaces[4];
    const adjacent = game.board.getAdjacentSpaces(space)[0];
    owner.playedCards.push(philares);
    game.addGreenery(owner, space);
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    first.plants = 16;
    owner.plants = 0;
    runAllActions(game);
    await new Promise((resolve) => setTimeout(resolve, 0)); // the setup's own saves settle before the spy

    game.takeNextFinalGreeneryAction();
    const ask = cast(first.getWaitingFor(), OrOptions);
    expect(ask.finalGreeneryPrompt, 'the first seat holds the finale').is.not.undefined;

    const {calls, restore} = spyInvalidate();
    try {
      // ① the first seat places NEXT TO Philares' tile → the owner's pick is deferred, the first seat waits.
      const placed = await postInput(game, first, {type: 'or', index: 0, response: {type: 'space', spaceId: adjacent.id}});
      expect(placed.content, 'the route answered the placement').to.include('"thisPlayer"');
      cast(owner.getWaitingFor(), SelectResources);
      expect(first.getWaitingFor(), 'the first seat has nothing to answer while the owner decides').is.undefined;
      expect(calls.some((c) => c.gameId === game.id), 'the owner\'s client is woken by the request that gave it a prompt').is.true;

      // ② the owner answers → the finale prompt is BACK on the first seat (no takeAction anywhere on this path).
      calls.length = 0;
      await postInput(game, owner, {type: 'resources', units: Units.of({plants: 1})});
      const back = cast(first.getWaitingFor(), OrOptions);
      expect(back.finalGreeneryPrompt, 'the greenery prompt returned to the first seat').is.not.undefined;
      expect(calls.some((c) => c.gameId === game.id), 'the first seat\'s client is woken the moment its prompt returns').is.true;
    } finally {
      restore();
    }
  });

  it('a re-ask of the SAME seat broadcasts too (the next greenery after a landing)', async () => {
    const [game, first] = testGame(2);
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    first.plants = 16;
    runAllActions(game);
    await new Promise((resolve) => setTimeout(resolve, 0));
    game.takeNextFinalGreeneryAction();
    const ask = cast(first.getWaitingFor(), OrOptions);
    const spaceId = game.board.getAvailableSpacesForGreenery(first)[0].id;

    const {calls, restore} = spyInvalidate();
    try {
      await postInput(game, first, {type: 'or', index: 0, response: {type: 'space', spaceId}});
      expect(cast(first.getWaitingFor(), OrOptions).finalGreeneryPrompt, 'asked again').is.not.undefined;
      expect(first.getWaitingFor()).is.not.eq(ask);
      expect(calls.some((c) => c.gameId === game.id && c.gameAge === game.gameAge), 'every other seat sees the tile at once').is.true;
    } finally {
      restore();
    }
  });
});
