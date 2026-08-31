import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {ActionPreview} from '../../src/server/routes/ActionPreview';
import {CardPlayPreview} from '../../src/server/routes/CardPlayPreview';
import {CorpFirstActionPreview} from '../../src/server/routes/CorpFirstActionPreview';
import {ApiGameBoardCellPreview} from '../../src/server/routes/ApiGameBoardCellPreview';
import {Ants} from '../../src/server/cards/base/Ants';
import {Aridor} from '../../src/server/cards/colonies/Aridor';
import {CardName} from '../../src/common/cards/CardName';

/**
 * THE PREVIEW FAMILY'S ANSWER CONTRACT.
 *
 * Every read-only preview route is asked about a SUBJECT resolved against LIVE
 * state — an action card in the tableau, a playable card, a corporation that
 * still owes its first action, a board space, a colony in the game. That
 * subject legitimately EXPIRES, and the client cannot always avoid asking:
 *
 *   - Aridor's first action drains `pendingInitialActions` in the SAME response
 *     that raises the colony catalog it produces, while the briefing that asked
 *     is still mounted and re-asks on every state move;
 *   - that catalog rails the game's UNUSED colonies — descending into one used
 *     to ask for a trade preview of a colony that is not in the game;
 *   - a prefetch keyed on a state version can always land after the state moved.
 *
 * Those were reported as `[embedded] Not found GET /api/corp-first-action-preview…`
 * on the server and as red 404s in the client console. They are not errors:
 * `responses.noPreview` answers 204 with the reason in `X-No-Preview`, and
 * `notFound` is kept for IDENTITY errors (unknown game / unknown player), which
 * must keep shouting.
 *
 * Each route is asserted THREE ways on purpose — the 204 for an expired
 * subject, a 200 for a live one (so a route that answered 204 unconditionally
 * could not pass), and the 404 that must survive for a bad address.
 */
describe('preview routes answer 204 for an expired subject', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  async function freshGame() {
    const player = TestPlayer.BLUE.newPlayer();
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('game-id', [player, player2], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    return {game, player, player2};
  }

  function expectNoPreview(reason?: string) {
    expect(res.statusCode).eq(statusCode.noContent);
    expect(res.content, 'a 204 carries no body').eq('');
    if (reason !== undefined) {
      expect(res.headers.get('X-No-Preview')).eq(reason);
    }
  }

  describe('/api/action-preview', () => {
    it('204 when the card is not an action card in the tableau', async () => {
      const {player} = await freshGame();
      scaffolding.url = `/api/action-preview?id=${player.id}&card=${CardName.ANTS}`;
      await scaffolding.get(ActionPreview.INSTANCE, res);
      expectNoPreview('action card not found');
    });

    it('200 once the card IS in the tableau', async () => {
      const {player} = await freshGame();
      player.playedCards.push(new Ants());
      scaffolding.url = `/api/action-preview?id=${player.id}&card=${CardName.ANTS}`;
      await scaffolding.get(ActionPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).card).eq(CardName.ANTS);
    });

    it('404 for an unknown player — an ADDRESS error still shouts', async () => {
      await freshGame();
      scaffolding.url = `/api/action-preview?id=p-nobody-id&card=${CardName.ANTS}`;
      await scaffolding.get(ActionPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.notFound);
      expect(res.content).eq('Not found: game not found');
    });
  });

  describe('/api/card-play-preview', () => {
    it('204 when the card is not playable by this player', async () => {
      const {player} = await freshGame();
      scaffolding.url = `/api/card-play-preview?id=${player.id}&card=${CardName.ARIDOR}`;
      await scaffolding.get(CardPlayPreview.INSTANCE, res);
      expectNoPreview('playable card not found');
    });

    it('200 for the corporation the player has picked but not yet played', async () => {
      const {player} = await freshGame();
      player.pickedCorporationCard = new Aridor();
      scaffolding.url = `/api/card-play-preview?id=${player.id}&card=${CardName.ARIDOR}`;
      await scaffolding.get(CardPlayPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).card).eq(CardName.ARIDOR);
    });

    it('404 for an unknown player', async () => {
      await freshGame();
      scaffolding.url = `/api/card-play-preview?id=p-nobody-id&card=${CardName.ARIDOR}`;
      await scaffolding.get(CardPlayPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.notFound);
    });
  });

  describe('/api/corp-first-action-preview', () => {
    // THE REPORTED CASE. The ledger drains at the submit, so the briefing's
    // next version-driven re-ask names a corporation that no longer owes it.
    it('204 once the corporation no longer owes its first action', async () => {
      const {player} = await freshGame();
      scaffolding.url = `/api/corp-first-action-preview?id=${player.id}&corp=${CardName.ARIDOR}`;
      await scaffolding.get(CorpFirstActionPreview.INSTANCE, res);
      expectNoPreview('corporation no longer owes its first action');
    });

    it('200 while the action is still owed', async () => {
      const {player} = await freshGame();
      player.pendingInitialActions.push(new Aridor());
      scaffolding.url = `/api/corp-first-action-preview?id=${player.id}&corp=${CardName.ARIDOR}`;
      await scaffolding.get(CorpFirstActionPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).card).eq(CardName.ARIDOR);
    });

    it('404 for an unknown player', async () => {
      await freshGame();
      scaffolding.url = `/api/corp-first-action-preview?id=p-nobody-id&corp=${CardName.ARIDOR}`;
      await scaffolding.get(CorpFirstActionPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.notFound);
    });
  });

  describe('/api/game/board-cell-preview', () => {
    it('204 for a space id that is not on THIS board', async () => {
      const {player} = await freshGame();
      // Well-formed (`isSpaceId`) so it is not a bad request, but no Tharsis
      // board has it — a hover carried across a game switch.
      scaffolding.url = `/api/game/board-cell-preview?id=${player.id}&space=99`;
      await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
      expectNoPreview('space not on this board');
    });

    it('200 for a real space', async () => {
      const {game, player} = await freshGame();
      const space = game.board.spaces[5];
      scaffolding.url = `/api/game/board-cell-preview?id=${player.id}&space=${space.id}`;
      await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content).space).eq(space.id);
    });
  });
});
