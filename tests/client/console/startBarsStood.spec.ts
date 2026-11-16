import {expect} from 'chai';
import {noteStartBarsStood, resetStartBarsStood, startBarsStoodBeforeMount} from '@/client/console/startBarsStood';

/**
 * THE GAME STATE MATERIALIZES ONCE PER SEAT (CI 43884064237): the start scene's return from the board after the «Фора»
 * window re-played the bars' entrance — the player rail blinked to opacity 0 and «Фора»'s M€ token measured an
 * unpainted landing. A mount decides at its set-up whether the bars already stood; only the first materialization plays.
 */
describe('startBarsStood — the bars materialize once per seat', () => {
  afterEach(() => resetStartBarsStood());

  it('the first mount of a seat materializes its bars', () => {
    expect(startBarsStoodBeforeMount('p-1')).to.eq(false);
  });

  it('a mount after the bars stood (the return from the board, a restore) keeps them standing', () => {
    noteStartBarsStood('p-1');
    expect(startBarsStoodBeforeMount('p-1')).to.eq(true);
  });

  it('another seat or a later game (a new player id) materializes its own — nothing carries over', () => {
    noteStartBarsStood('p-1');
    expect(startBarsStoodBeforeMount('p-2')).to.eq(false);
  });
});
