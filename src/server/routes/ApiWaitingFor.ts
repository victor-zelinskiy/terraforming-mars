import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Phase} from '../../common/Phase';
import {IPlayer} from '../IPlayer';
import {WaitingForModel} from '../../common/models/WaitingForModel';
import {IGame} from '../IGame';
import {isPlayerId} from '../../common/Types';
import {Request} from '../Request';
import {Response} from '../Response';

export class ApiWaitingFor extends Handler {
  public static readonly INSTANCE = new ApiWaitingFor();
  private constructor() {
    super();
  }

  private playerHasRequiredInput(player: IPlayer): boolean {
    const input = player.getWaitingFor();
    if (input !== undefined) {
      return !input.optional;
    }
    return player.game.phase === Phase.END;
  }

  private playersWithRequiredInputs(game: IGame) {
    return game.playersInGenerationOrder
      .filter((player) => {
        const waitingFor = player.getWaitingFor();
        return waitingFor !== undefined && !waitingFor.optional;
      })
      .map((player) => player.color);
  }

  private getPlayerWaitingForModel(player: IPlayer, game: IGame, gameAge: number, undoCount: number, promptId: number | undefined): WaitingForModel {
    const inputs = this.playersWithRequiredInputs(game);
    // Did the game move past the client's advertised cursor? `REFRESH` IS this
    // fact for a promptless viewer; carrying it on `GO` too lets a mid-prompt
    // client refresh exactly when there is something new (another player's
    // action landed while the viewer was aiming) instead of on every poll.
    //
    // …AND DID THE VIEWER'S OWN PROMPT CHANGE UNDER IT (2026-11-08)? The game age does not move in the research
    // phase, so a prompt answered over another channel (the API, a second device, a campaign's dev tool) left the
    // open page standing on its old question for good — neither the socket's wake nor the poll ever refreshed it.
    // The client advertises the prompt it DISPLAYS (`promptId` = `waitingForSerial`); a different serial now — or no
    // prompt at all where one was advertised — is a change whatever the age says.
    const current = player.getWaitingFor() !== undefined ? player.waitingForSerial : undefined;
    const promptMoved = promptId !== undefined && current !== promptId;
    const changed = game.gameAge > gameAge || game.undoCount > undoCount || promptMoved;
    if (this.playerHasRequiredInput(player)) {
      return {result: 'GO', waitingFor: inputs, changed};
    } else if (changed) {
      return {result: 'REFRESH', waitingFor: inputs, changed};
    }
    return {result: 'WAIT', waitingFor: inputs, changed};
  }

  public override async get(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.url.searchParams.get('id');
    if (id === null) {
      responses.badRequest(req, res, 'missing id parameter');
      return;
    }
    const gameAge = Number(ctx.url.searchParams.get('gameAge'));
    const undoCount = Number(ctx.url.searchParams.get('undoCount'));
    // The prompt the client DISPLAYS — optional (an older client, a promptless viewer sends nothing).
    const promptParam = ctx.url.searchParams.get('promptId');
    const promptId = promptParam === null || promptParam === '' || Number.isNaN(Number(promptParam)) ? undefined : Number(promptParam);

    // Only player ids are served here — the spectator feature (and its
    // spectator-shaped waiting-for model) was removed. A spectator id (or any
    // other non-player id) falls through to the not-found below.
    let game: IGame | undefined;
    if (isPlayerId(id)) {
      game = await ctx.gameLoader.getGame(id);
    }
    if (game === undefined || !isPlayerId(id)) {
      responses.notFound(req, res, 'cannot find game for that player');
      return;
    }
    try {
      const player = game.getPlayerById(id);
      if (!this.isUser(player.user, ctx)) {
        responses.notAuthorized(req, res);
        return;
      }
      ctx.ipTracker.addParticipant(id, ctx.ip);
      responses.writeJson(res, ctx, this.getPlayerWaitingForModel(player, game, gameAge, undoCount, promptId));
    } catch (err) {
      // This is basically impossible since getPlayerById ensures that the player is on that game.
      console.warn(`unable to find player ${id}`, err);
      responses.notFound(req, res, 'player not found');
    }
  }
}
