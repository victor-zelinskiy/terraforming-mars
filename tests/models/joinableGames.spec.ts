import {expect} from 'chai';
import {testGame} from '../TestGame';
import {getJoinableGameSummary} from '../../src/server/models/joinableGames';
import {normalizePlayerName} from '../../src/common/utils/playerName';
import {EXPANSIONS} from '../../src/common/cards/GameModule';
import {Phase} from '../../src/common/Phase';

describe('getJoinableGameSummary', () => {
  it('matches a player by normalized (case-insensitive, trimmed) name', () => {
    const [game, p1] = testGame(2);
    p1.name = 'Victor';
    const summary = getJoinableGameSummary(game, normalizePlayerName('  VICTOR '));
    expect(summary).not.eq(undefined);
    expect(summary?.you?.id).eq(p1.id);
    expect(summary?.you?.color).eq(p1.color);
    expect(summary?.ambiguous).eq(false);
    expect(summary?.players.find((pl) => pl.isYou)?.name).eq('Victor');
  });

  it('returns undefined when no seat matches', () => {
    const [game] = testGame(2);
    expect(getJoinableGameSummary(game, normalizePlayerName('nobody'))).eq(undefined);
  });

  it('returns undefined for a finished game', () => {
    const [game, p1] = testGame(2);
    p1.name = 'Victor';
    game.phase = Phase.END;
    expect(getJoinableGameSummary(game, normalizePlayerName('Victor'))).eq(undefined);
  });

  it('flags ambiguity and withholds the join id when two seats share the name', () => {
    const [game, p1, p2] = testGame(2);
    p1.name = 'Victor';
    p2.name = 'victor';
    const summary = getJoinableGameSummary(game, normalizePlayerName('Victor'));
    expect(summary?.ambiguous).eq(true);
    expect(summary?.you).eq(undefined);
    expect(summary?.players.filter((pl) => pl.isYou).length).eq(2);
  });

  it('lists exactly the enabled expansions, in canonical order', () => {
    const [game, p1] = testGame(2);
    p1.name = 'Victor';
    const summary = getJoinableGameSummary(game, normalizePlayerName('Victor'));
    const expected = EXPANSIONS.filter((e) => game.gameOptions.expansions[e] === true);
    expect([...(summary?.expansions ?? [])]).deep.eq([...expected]);
  });
});
