import {expect} from 'chai';
import {testGame} from '../TestGame';
import {ensurePlayerColorForGame} from '../../src/server/game/ensurePlayerColor';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {LogMessageType} from '../../src/common/logs/LogMessageType';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {Color} from '../../src/common/Color';
import {PlayerId} from '../../src/common/Types';

function logPlayerValue(game: {gameLog: ReadonlyArray<LogMessage>}): Color {
  const last = game.gameLog[game.gameLog.length - 1];
  return last.data[0].value as Color;
}

describe('ensurePlayerColorForGame', () => {
  it('noop when the colour already matches', () => {
    const [game, player] = testGame(2);
    const original = player.color;
    const result = ensurePlayerColorForGame(game, player.id, original);
    expect(result.status).eq('noop');
    expect(player.color).eq(original);
  });

  it('conflict when the desired colour is used by another player', () => {
    const [game, p1, p2] = testGame(2); // p1 blue, p2 red
    const before = p1.color;
    const result = ensurePlayerColorForGame(game, p1.id, p2.color);
    expect(result.status).eq('conflict');
    expect(p1.color).eq(before); // unchanged
  });

  it('updates the colour and migrates log + scale-bonus references', () => {
    const [game, p1] = testGame(2); // p1 blue, p2 red — 'orange' is free
    const oldColor = p1.color;
    const newColor: Color = 'orange';
    game.gameLog.push(new LogMessage(LogMessageType.DEFAULT, '${0}', [{type: LogMessageDataType.PLAYER, value: oldColor}]));
    game.scaleBonusClaims.set('venus-8', oldColor);

    const result = ensurePlayerColorForGame(game, p1.id, newColor);

    expect(result.status).eq('updated');
    expect(result.previousColor).eq(oldColor);
    expect(result.color).eq(newColor);
    expect(p1.color).eq(newColor);
    expect(logPlayerValue(game)).eq(newColor);
    expect(game.scaleBonusClaims.get('venus-8')).eq(newColor);
  });

  it('leaves OTHER players\' colour references untouched', () => {
    const [game, p1, p2] = testGame(2);
    game.gameLog.push(new LogMessage(LogMessageType.DEFAULT, '${0}', [{type: LogMessageDataType.PLAYER, value: p2.color}]));
    ensurePlayerColorForGame(game, p1.id, 'orange');
    expect(logPlayerValue(game)).eq(p2.color); // p2's token is not rewritten
  });

  it('not-found for an unknown player id', () => {
    const [game] = testGame(2);
    const result = ensurePlayerColorForGame(game, 'p-unknown' as PlayerId, 'orange');
    expect(result.status).eq('not-found');
  });
});
