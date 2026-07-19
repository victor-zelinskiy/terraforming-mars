import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {Server} from '../../src/server/models/ServerModel';
import {marsBotOf} from '../../src/server/automa/AutomaUtil';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {cardsFromJSON, corporationCardsFromJSON} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

/**
 * Drive the REAL start flow to the human's first ACTION-phase turn (gen 1): seed
 * a deterministic deal, answer SelectInitialCards, so the human's corporation is
 * played and the game leaves RESEARCH.
 */
function reachGen1Action() {
  const [game, human, bot] = testAutomaGame({keepInitialCardSelection: true});
  // Replace IN PLACE — the live prompt holds the array refs.
  human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
    ...corporationCardsFromJSON([CardName.INTERPLANETARY_CINEMATICS, CardName.HELION]));
  human.dealtProjectCards.splice(0, 4,
    ...cardsFromJSON([CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]));
  human.process({type: 'initialCards', responses: [
    {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
    {type: 'card', cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET]},
  ]});
  runAllActions(game);
  // The explicit corporationPlay press + the card payment press.
  human.process({type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]});
  runAllActions(game);
  human.process({type: 'option'});
  runAllActions(game);
  return {game, human, bot};
}

describe('Automa serialization', () => {
  it('round-trips the whole automa state', () => {
    const [game] = testAutomaGame({
      preludeExtension: true,
      venusNextExtension: true,
      coloniesExtension: true,
      difficulty: 'hard',
    });
    const automa = game.automa!;
    // Dirty the state a little so the round-trip is not trivial.
    automa.board.tracks[0].advance();
    automa.board.tracks[0].advance();
    automa.board.tracks[0].regress();
    automa.floaters = 3;
    automa.shippingStorage['Ceres'] = 2 as never;
    automa.playedPile.push(CardName.BIRDS);
    automa.destroyedBonusCards.push(automa.bonusDeck.pop()!);
    automa.hardClaimCheckedGeneration = 4;
    automa.revealedCard = automa.actionDeck[0];

    const restoredGame = Game.deserialize(structuredClone(game.serialize()));
    const restored = restoredGame.automa;
    expect(restored).is.not.undefined;
    expect(restored!.difficulty).eq('hard');
    expect(restored!.board.tracks).has.length(8); // Tharsis 7 + Venus.
    expect(restored!.board.tracks[0].position).eq(1);
    expect(restored!.board.tracks[0].regressedPositions).deep.eq(new Set([2]));
    expect(restored!.actionDeck).deep.eq(automa.actionDeck);
    expect(restored!.bonusDeck).deep.eq(automa.bonusDeck);
    expect(restored!.bonusDiscard).deep.eq(automa.bonusDiscard);
    expect(restored!.destroyedBonusCards).deep.eq(automa.destroyedBonusCards);
    expect(restored!.recurringBonusCards).deep.eq(automa.recurringBonusCards);
    expect(restored!.setAsideBonusCards).deep.eq(automa.setAsideBonusCards);
    expect(restored!.floaters).eq(3);
    expect(restored!.shippingStorage).deep.eq(automa.shippingStorage);
    expect(restored!.hardClaimCheckedGeneration).eq(4);
    expect(restored!.revealedCard).deep.eq(automa.revealedCard);
  });

  it('round-trips the pending-turn marker (restart recovery)', () => {
    const [game] = testAutomaGame();
    game.automa!.pendingTurn = true;
    const restored = Game.deserialize(structuredClone(game.serialize()));
    expect(restored.automa!.pendingTurn).is.true;
    // Absent in an old save (no field) deserializes to false.
    const serialized = game.serialize();
    delete (serialized.automa as {pendingTurn?: boolean}).pendingTurn;
    expect(Game.deserialize(structuredClone(serialized)).automa!.pendingTurn).is.false;
  });

  it('round-trips the mode marker; multiplayer restores all seats', () => {
    const [solo] = testAutomaGame(undefined, '-mode-solo');
    expect(Game.deserialize(structuredClone(solo.serialize())).gameOptions.automa?.mode).eq('official-solo');

    const [multi] = testAutomaMultiplayerGame(3, undefined, '-mode-multi');
    const restored = Game.deserialize(structuredClone(multi.serialize()));
    expect(restored.gameOptions.automa?.mode).eq('multiplayer');
    expect(restored.players).has.length(4);
    expect(restored.players.filter((p) => p.isMarsBot)).has.length(1);
  });

  it('restores the bot as the MarsBot player', () => {
    const [game, human] = testAutomaGame();
    const restored = Game.deserialize(structuredClone(game.serialize()));
    expect(restored.players).has.length(2);
    const bot = marsBotOf(restored);
    expect(bot.isMarsBot).is.true;
    expect(bot.name).eq('MarsBot');
    expect(restored.players.find((p) => p.id === human.id)!.isMarsBot).is.false;
    expect(restored.first.id).eq(human.id);
  });

  it('an ordinary game serializes without any automa fields', () => {
    const p1 = TestPlayer.BLUE.newPlayer({name: 'p1'});
    const game = Game.newInstance('game-ser-ord', [p1], p1, 's-ser-ord', {});
    const serialized = game.serialize();
    expect(serialized.automa).is.undefined;
    expect(serialized.players.every((p) => p.isMarsBot === undefined)).is.true;
    const restored = Game.deserialize(structuredClone(serialized));
    expect(restored.automa).is.undefined;
  });

  it('gen-1 reload after the human picked a corporation does not deadlock in RESEARCH', () => {
    const {game, human} = reachGen1Action();

    // Precondition: the start flow landed on the human's first ACTION-phase turn.
    expect(game.phase).eq(Phase.ACTION);
    expect(game.generation).eq(1);
    expect(human.getWaitingFor(), 'the human must be prompted before reload').is.not.undefined;

    // Reload (server restart / cache eviction).
    const restored = Game.deserialize(structuredClone(game.serialize()));
    const restoredHuman = restored.players.find((p) => p.isMarsBot !== true)!;

    // The gen-1 reload guard used "some player has no corporation card" as a
    // proxy for "still in initial setup" — but MarsBot NEVER has a corporation,
    // so it read TRUE forever and bounced the started game back to
    // gotoInitialResearchPhase(), which prompts nobody (the human already
    // picked): RESEARCH phase, no waitingFor → the deadlock the player saw
    // (both chips «ГОТОВ»).
    expect(restored.phase, 'reload must not bounce the game back to RESEARCH').eq(Phase.ACTION);
    expect(restoredHuman.getWaitingFor(), 'the human must still be prompted for actions after reload').is.not.undefined;
  });

  it('gen-1 reload while the bot is the pending active player resolves the turn (no RESEARCH bounce)', () => {
    const {game, human, bot} = reachGen1Action();
    // Simulate production pacing (BotTurnScheduler): the human's turn ended and
    // the bot was made the active player with its resolve pending, but the
    // bounded timer died with the restart that dropped this game from memory.
    human.popWaitingFor();
    game.activePlayer = bot;
    game.automa!.pendingTurn = true;

    const restored = Game.deserialize(structuredClone(game.serialize()));

    // Before the fix, the gen-1 guard intercepted this too and bounced to
    // RESEARCH. Now it falls through to resolveBotTurnOnLoad(), which resolves
    // the pending turn and advances the game.
    expect(restored.phase, 'reload must not bounce the game back to RESEARCH').eq(Phase.ACTION);
    expect(restored.automa!.pendingTurn, 'the pending bot turn must have resolved').is.false;
    const restoredHuman = restored.players.find((p) => p.isMarsBot !== true)!;
    expect(restoredHuman.getWaitingFor(), 'control returns to the human after the bot resolves').is.not.undefined;
  });

  it('gen-1 reload DURING initial research re-prompts the human who has not yet picked', () => {
    // The guard must still fire for a genuine mid-setup save: the human is
    // re-prompted for their corporation + starting hand after reload.
    const [game, human] = testAutomaGame({keepInitialCardSelection: true});
    expect(game.phase).eq(Phase.RESEARCH);
    expect(human.getWaitingFor()).is.not.undefined;

    const restored = Game.deserialize(structuredClone(game.serialize()));
    const restoredHuman = restored.players.find((p) => p.isMarsBot !== true)!;
    expect(restored.phase).eq(Phase.RESEARCH);
    expect(restoredHuman.getWaitingFor(), 'the un-picked human must be re-prompted').is.not.undefined;
  });

  it('gen-1 reload in the DEFERRED corporationPlay window re-issues the play prompt', () => {
    const [game, human] = testAutomaGame({keepInitialCardSelection: true});
    human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
      ...corporationCardsFromJSON([CardName.INTERPLANETARY_CINEMATICS, CardName.HELION]));
    human.dealtProjectCards.splice(0, 4,
      ...cardsFromJSON([CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.INSULATION]));
    human.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]},
      {type: 'card', cards: [CardName.ANTS, CardName.BIRDS, CardName.COMET]},
    ]});
    runAllActions(game);
    // The chosen-but-unplayed window: nothing played, nothing granted yet.
    expect(human.playedCards.corporations()).is.empty;

    const restored = Game.deserialize(structuredClone(game.serialize()));
    const restoredHuman = restored.players.find((p) => p.isMarsBot !== true)!;
    expect(restored.phase).eq(Phase.RESEARCH);
    expect(restoredHuman.getWaitingFor()?.startGamePrompt, 'the corporationPlay prompt must be re-issued')
      .to.deep.eq({kind: 'corporationPlay'});
    // Answering AFTER the reload performs the real play and starts the game.
    restoredHuman.process({type: 'card', cards: [CardName.INTERPLANETARY_CINEMATICS]});
    runAllActions(restored);
    restoredHuman.process({type: 'option'}); // pay for the bought cards
    runAllActions(restored);
    expect(restoredHuman.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.INTERPLANETARY_CINEMATICS]);
    expect(restored.phase).eq(Phase.ACTION);
  });

  it('the face-down action deck contents never leak into any client model', () => {
    const [game, human] = testAutomaGame({keepInitialCardSelection: true});
    const automa = game.automa!;
    const secretNames = automa.actionDeck
      .filter((c): c is {kind: 'project', name: CardName} => c.kind === 'project')
      .map((c) => c.name);
    expect(secretNames.length).is.greaterThan(0);

    const playerModel = JSON.stringify(Server.getPlayerModel(human));
    const spectatorModel = JSON.stringify(Server.getSpectatorModel(game));
    const gameModel = JSON.stringify(Server.getGameModel(game));
    for (const name of secretNames) {
      expect(playerModel, `player model leaks ${name}`).to.not.contain(`"${name}"`);
      expect(spectatorModel, `spectator model leaks ${name}`).to.not.contain(`"${name}"`);
      expect(gameModel, `game model leaks ${name}`).to.not.contain(`"${name}"`);
    }
  });
});
