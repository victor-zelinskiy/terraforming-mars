import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {Server} from '../../src/server/models/ServerModel';
import {marsBotOf} from '../../src/server/automa/AutomaUtil';
import {CardName} from '../../src/common/cards/CardName';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

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
