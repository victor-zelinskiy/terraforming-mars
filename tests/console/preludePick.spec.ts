import {expect} from 'chai';
import {preludePickBurns, PRELUDE_SEAT_SELECTOR} from '../../src/client/console/deckPick/preludePick';

describe('preludePick — the mid-game prelude pick\'s readings (P91)', () => {
  it('a candidate burns exactly when the server says it cannot resolve now — never re-derived', () => {
    expect(preludePickBurns({state: 'playable'})).is.false;
    expect(preludePickBurns({state: 'noEffect'})).is.true;
    expect(preludePickBurns({state: 'deferred', certainty: 'possible', enablers: [], need: 'playableCard'})).is.true;
    expect(preludePickBurns(undefined), 'no verdict, no claim').is.false;
  });

  it('the seat is the deck object\'s own «Разыграно» place — inside the pick, never a global source seat', () => {
    expect(PRELUDE_SEAT_SELECTOR).to.match(/^\.con-deckpick /);
    expect(PRELUDE_SEAT_SELECTOR).to.include('[data-prelude-played-seat]');
  });
});
