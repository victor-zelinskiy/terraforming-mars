import {expect} from 'chai';
import {Cloner} from '../../src/server/database/Cloner';
import {PlayerId} from '../../src/common/Types';

/**
 * `Cloner.replacePlayerIds` walks a serialized game and swaps every player id
 * it meets — as a VALUE (a vote's owner, a tile's player) and, since Turmoil
 * Redux, as a RECORD KEY (the parliament's Agenda positions, card grants,
 * action uses and quest progress are keyed by player id). A clone or a dev
 * fixture load that renamed only the values left those records pointing at
 * seats that no longer existed.
 */
describe('Cloner.replacePlayerIds', () => {
  const OLD = ['p-old-one-id', 'p-old-two-id'] as Array<PlayerId>;
  const NEW = ['p-new-one-id', 'p-new-two-id'] as Array<PlayerId>;

  it('renames player ids used as record keys, at any depth', () => {
    const obj = {
      agenda: {'p-old-one-id': 3, 'p-old-two-id': 0},
      nested: {grants: {'p-old-two-id': [{party: 'Greens', source: 'Card'}]}},
      progress: {'p-old-one-id': 2},
    };
    Cloner.replacePlayerIds(obj, OLD, NEW);
    expect(obj).deep.eq({
      agenda: {'p-new-one-id': 3, 'p-new-two-id': 0},
      nested: {grants: {'p-new-two-id': [{party: 'Greens', source: 'Card'}]}},
      progress: {'p-new-one-id': 2},
    });
  });

  it('still renames values, and leaves ordinary keys and foreign ids alone', () => {
    const obj = {
      votes: [{owner: 'p-old-one-id', seq: 1}, {owner: 'neutral', seq: 2}],
      players: [{id: 'p-old-two-id', plants: 4}],
      phase: 'action',
      production: {plants: 1},
      other: {'p-someone-else': 1},
    };
    Cloner.replacePlayerIds(obj, OLD, NEW);
    expect(obj).deep.eq({
      votes: [{owner: 'p-new-one-id', seq: 1}, {owner: 'neutral', seq: 2}],
      players: [{id: 'p-new-two-id', plants: 4}],
      phase: 'action',
      production: {plants: 1},
      other: {'p-someone-else': 1},
    });
  });
});
