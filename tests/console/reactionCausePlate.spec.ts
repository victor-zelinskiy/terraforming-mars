import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {causePlateOf} from '../../src/client/console/cardReaction/reactionCausePlate';

/**
 * THE CAUSE PLATE (P46 Colony Trade Hub): a reaction told at the stage names what ANOTHER seat did that woke it — the
 * colony and the seat that built it, read off the server's `cause.colony`. The viewer's own build is told by its own
 * scene, so it gets no plate; a record with no colony cause gets none either.
 */
describe('reactionCausePlate', () => {
  const seats = [
    {color: 'blue' as Color, name: 'Вы'},
    {color: 'red' as Color, name: 'player2'},
    {color: 'green' as Color, name: 'MarsBot', isMarsBot: true},
  ];
  const colonyRecord = (builder: Color) => ({channel: 'colony-added' as const, cause: {colony: {name: ColonyName.LUNA, builder}}});

  it('the viewer\'s own build: no plate — the colony scene was the cause', () => {
    expect(causePlateOf(colonyRecord('blue'), 'blue', seats)).eq(undefined);
  });

  it('a rival\'s build: the colony and the rival\'s seat', () => {
    expect(causePlateOf(colonyRecord('red'), 'blue', seats)).deep.eq({
      kind: 'colony', colony: ColonyName.LUNA, builder: {color: 'red', name: 'player2'},
    });
  });

  it('MarsBot\'s build: the bot is one more seat, marked as the bot', () => {
    expect(causePlateOf(colonyRecord('green'), 'blue', seats)).deep.eq({
      kind: 'colony', colony: ColonyName.LUNA, builder: {color: 'green', name: 'MarsBot', isMarsBot: true},
    });
  });

  it('an unknown seat keeps its colour as the name — never a blank plate', () => {
    expect(causePlateOf(colonyRecord('yellow'), 'blue', seats)?.builder).deep.eq({color: 'yellow', name: 'yellow'});
  });

  it('no plate for another channel, or for a colony channel without the cause', () => {
    expect(causePlateOf({channel: 'trade', cause: {trade: {kind: 'colony', name: ColonyName.LUNA}}}, 'blue', seats)).eq(undefined);
    expect(causePlateOf({channel: 'colony-added'}, 'blue', seats)).eq(undefined);
  });
});
