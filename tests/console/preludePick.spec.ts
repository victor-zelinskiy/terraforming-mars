import {expect} from 'chai';
import {candidateOutlook, preludePickBurns, PRELUDE_SEAT_SELECTOR} from '../../src/client/console/deckPick/preludePick';
import {preludeRisk} from '../../src/client/console/startPreludeRisk';

describe('preludePick — the mid-game prelude pick\'s readings (P91)', () => {
  it('a candidate burns exactly when the server says it cannot resolve now — never re-derived', () => {
    expect(preludePickBurns({state: 'playable'})).is.false;
    expect(preludePickBurns({state: 'noEffect'})).is.true;
    expect(preludePickBurns({state: 'deferred', certainty: 'possible', enablers: [], need: 'playableCard'})).is.true;
    expect(preludePickBurns(undefined), 'no verdict, no claim').is.false;
  });

  it('PL-1468: a drew-N candidate is played now or never — any non-playable verdict is FINAL (the burn), never «play another first»', () => {
    expect(candidateOutlook({state: 'playable'})).is.undefined;
    expect(candidateOutlook(undefined)).is.undefined;
    const deferred = candidateOutlook({state: 'deferred', certainty: 'guaranteed', enablers: ['Donation' as never], need: 'playedPrelude'});
    expect(deferred).deep.eq({state: 'noEffect', need: 'playedPrelude'});
    // …so the deployment's risk stage reads it in its FINAL tone, with the verb that names the loss.
    expect(preludeRisk(deferred, (n) => n)?.tone).eq('final');
  });

  it('the seat is the deck object\'s own «Разыграно» place — inside the pick, never a global source seat', () => {
    expect(PRELUDE_SEAT_SELECTOR).to.match(/^\.con-deckpick /);
    expect(PRELUDE_SEAT_SELECTOR).to.include('[data-prelude-played-seat]');
  });
});
