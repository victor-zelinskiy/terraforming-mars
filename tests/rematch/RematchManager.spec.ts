import {expect} from 'chai';
import {testGame} from '../TestGame';
import {testAutomaGame, testAutomaMultiplayerGame} from '../automa/AutomaTestGame';
import {RematchManager} from '../../src/server/rematch/RematchManager';
import {IGame} from '../../src/server/IGame';
import {IGameLoader} from '../../src/server/database/IGameLoader';
import {BoardName} from '../../src/common/boards/BoardName';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';

function fakeLoader(): {loader: IGameLoader, added: Array<IGame>} {
  const added: Array<IGame> = [];
  const loader = {
    add: async (game: IGame) => {
      added.push(game);
    },
  } as unknown as IGameLoader;
  return {loader, added};
}

describe('RematchManager', () => {
  beforeEach(() => {
    RematchManager.reset();
  });

  it('initial model has no offer', () => {
    const [game, player] = testGame(2);
    const model = RematchManager.getInstance().getModel(game, player.id);
    expect(model.status).to.eq('none');
    expect(model.viewerIsPlayer).to.be.true;
    expect(model.viewerColor).to.eq(player.color);
    expect(model.viewerMustVote).to.be.false;
    expect(model.votes).to.have.length(2);
  });

  it('offer seeds the offerer accepted and others pending', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);

    expect(added).to.have.length(0); // not all accepted yet
    const offererView = manager.getModel(game, p1.id);
    expect(offererView.status).to.eq('offered');
    expect(offererView.offeredBy).to.eq(p1.color);
    expect(offererView.viewerIsOfferer).to.be.true;
    expect(offererView.viewerMustVote).to.be.false; // offerer is pre-accepted

    const otherView = manager.getModel(game, p2.id);
    expect(otherView.viewerMustVote).to.be.true;
    expect(otherView.viewerIsOfferer).to.be.false;
    const p2vote = otherView.votes.find((v) => v.color === p2.color);
    expect(p2vote?.status).to.eq('pending');
  });

  it('creates the rematch game once everyone accepts, with the same settings', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);

    expect(added).to.have.length(1);
    const newGame = added[0];
    expect(newGame.id).to.not.eq(game.id);
    expect(newGame.gameOptions.boardName).to.eq(game.gameOptions.boardName);
    // Same players (colour/name), brand-new ids.
    expect(newGame.players.map((p) => p.color)).to.deep.eq(game.players.map((p) => p.color));
    for (const p of newGame.players) {
      const original = game.players.find((o) => o.color === p.color);
      expect(p.id).to.not.eq(original?.id);
      expect(p.name).to.eq(original?.name);
    }
    // First player preserved by colour.
    expect(newGame.first.color).to.eq(game.first.color);

    const created = manager.getModel(game, p1.id);
    expect(created.status).to.eq('created');
    expect(created.newGameId).to.eq(newGame.id);
  });

  it('delivers each player ONLY their own new-game join id', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);
    const newGame = added[0];

    const v1 = manager.getModel(game, p1.id);
    const newP1 = newGame.players.find((p) => p.color === p1.color);
    expect(v1.joinKind).to.eq('player');
    expect(v1.joinId).to.eq(newP1?.id);

    const v2 = manager.getModel(game, p2.id);
    const newP2 = newGame.players.find((p) => p.color === p2.color);
    expect(v2.joinId).to.eq(newP2?.id);
    // p1 must never be told p2's new id (no impersonating in the live rematch).
    expect(v1.joinId).to.not.eq(newP2?.id);
  });

  it('spectator gets the new spectator id, never a player id', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);
    const newGame = added[0];

    const spec = manager.getModel(game, game.spectatorId);
    expect(spec.viewerIsPlayer).to.be.false;
    expect(spec.status).to.eq('created');
    expect(spec.joinKind).to.eq('spectator');
    expect(spec.joinId).to.eq(newGame.spectatorId);
  });

  it('a decline kills the offer and records who declined', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    manager.decline(game, p2.color);

    expect(added).to.have.length(0);
    const model = manager.getModel(game, p1.id);
    expect(model.status).to.eq('declined');
    expect(model.declinedBy).to.eq(p2.color);
  });

  it('a player can re-offer after a decline', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    manager.decline(game, p2.color);
    await manager.offer(game, p2.color, loader);

    const model = manager.getModel(game, p1.id);
    expect(model.status).to.eq('offered');
    expect(model.offeredBy).to.eq(p2.color);
    expect(model.viewerMustVote).to.be.true; // p1 now owes a vote
  });

  it('the offerer can cancel their own offer', async () => {
    const [game, p1] = testGame(2);
    const {loader} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    manager.cancel(game, p1.color);

    expect(manager.getModel(game, p1.id).status).to.eq('none');
  });

  it('a non-offerer cannot cancel the offer', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    manager.cancel(game, p2.color);

    expect(manager.getModel(game, p1.id).status).to.eq('offered');
  });

  it('a solo offer creates the rematch immediately', async () => {
    const [game, player] = testGame(1);
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, player.color, loader);

    expect(added).to.have.length(1);
    expect(manager.getModel(game, player.id).status).to.eq('created');
  });

  it('re-rolls the board on the rematch when the original was random', async () => {
    const [game, p1, p2] = testGame(2, {boardName: BoardName.HELLAS, randomBoardOption: RandomBoardOption.OFFICIAL});
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);

    const official = [BoardName.THARSIS, BoardName.HELLAS, BoardName.ELYSIUM];
    expect(official).to.include(added[0].gameOptions.boardName);
    // The random intent is preserved so a rematch-of-the-rematch keeps re-rolling.
    expect(added[0].gameOptions.randomBoardOption).to.eq(RandomBoardOption.OFFICIAL);
  });

  it('preserves the random-first-player intent on the rematch', async () => {
    const [game, p1, p2] = testGame(2, {randomFirstPlayer: true});
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);

    // The intent carries forward so a rematch-of-the-rematch also re-randomizes.
    expect(added[0].gameOptions.randomFirstPlayer).to.eq(true);
    // The first player is still one of the (same) players.
    expect(game.players.map((p) => p.color)).to.include(added[0].first.color);
  });

  it('keeps the same first player when it was explicitly chosen', async () => {
    const [game, p1, p2] = testGame(2); // randomFirstPlayer defaults to false
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);

    expect(added[0].gameOptions.randomFirstPlayer).to.eq(false);
    expect(added[0].first.color).to.eq(game.first.color);
  });

  it('keeps the exact board on the rematch when one was explicitly chosen', async () => {
    const [game, p1, p2] = testGame(2, {boardName: BoardName.HELLAS});
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);

    expect(added[0].gameOptions.randomBoardOption).to.eq(undefined);
    expect(added[0].gameOptions.boardName).to.eq(BoardName.HELLAS);
  });

  it('does not create a second game on a redundant accept', async () => {
    const [game, p1, p2] = testGame(2);
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, p1.color, loader);
    await manager.accept(game, p2.color, loader);
    await manager.accept(game, p2.color, loader); // late duplicate
    await manager.offer(game, p1.color, loader); // offer after created is a no-op

    expect(added).to.have.length(1);
    expect(manager.getModel(game, p1.id).status).to.eq('created');
  });

  it('an automa rematch creates immediately — MarsBot never votes', async () => {
    const [game, human, bot] = testAutomaGame({difficulty: 'hard'});
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, human.color, loader);

    // The lone human is the only voter, so the offer resolves like solo.
    expect(added).to.have.length(1);
    const model = manager.getModel(game, human.id);
    expect(model.status).to.eq('created');
    expect(model.votes).to.have.length(1);
    expect(model.votes[0].color).to.eq(human.color);
    expect(model.joinKind).to.eq('player');

    // The new game seats a FRESH MarsBot (never a copied ordinary Player).
    const rematch = added[0];
    expect(rematch.players).to.have.length(2);
    const newBot = rematch.players.find((p) => p.isMarsBot);
    expect(newBot, 'the rematch must seat a MarsBot').to.not.eq(undefined);
    expect(newBot?.name).to.eq('MarsBot');
    expect(newBot?.id).to.not.eq(bot.id);
    expect(rematch.gameOptions.automa?.difficulty).to.eq('hard');
    expect(rematch.automa).to.not.eq(undefined);
    // The human starts (the automa guard requires it) and keeps their join slot.
    expect(rematch.first.isMarsBot).to.not.eq(true);
    const joinSlot = rematch.players.find((p) => p.color === human.color);
    expect(model.joinId).to.eq(joinSlot?.id);
  });

  it('a multiplayer-with-Automa rematch: humans vote, a fresh bot is re-seated (mode B)', async () => {
    const [game, humans] = testAutomaMultiplayerGame(2, {difficulty: 'hard'});
    const {loader, added} = fakeLoader();
    const manager = RematchManager.getInstance();

    await manager.offer(game, humans[0].color, loader);
    expect(added).to.have.length(0); // The second human still owes a vote.
    await manager.accept(game, humans[1].color, loader);

    expect(added).to.have.length(1);
    const rematch = added[0];
    expect(rematch.players).to.have.length(3);
    expect(rematch.players.filter((p) => p.isMarsBot)).to.have.length(1);
    expect(rematch.gameOptions.automa?.mode).to.eq('multiplayer');
    expect(rematch.gameOptions.automa?.difficulty).to.eq('hard');
  });
});
