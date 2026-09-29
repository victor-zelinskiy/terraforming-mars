import {expect} from 'chai';
import {unplayableReasonCompact, unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

/**
 * THE COMPACT COUNTER FORM of an unplayable reason («<label> <now>/<bound>») —
 * the one-row status rails speak it, the fullscreen panel keeps the sentence.
 * A COUNT reason has a counter presentation only when its message is in the
 * label table; a message the table does not know keeps the full line (never a
 * bare number with no subject).
 */
describe('unplayableReasonFormat — the compact counter form', () => {
  it('«delegates on resolutions» (Turmoil Redux, TR02) reads as the parliament panel\'s own counter — «On resolutions 1/3»', () => {
    const reason: UnplayableReason = {type: 'count', message: 'Requires ${0} delegate(s) on resolutions', params: ['3'], current: 1, requirement: true};
    expect(unplayableReasonCompact(reason)).eq('On resolutions 1/3');
    expect(unplayableReasonLine(reason)).eq('Requires 3 delegate(s) on resolutions · Now: 1');
  });

  it('the Hydronetwork precedent keeps its counter, and an unknown count message keeps the full line', () => {
    expect(unplayableReasonCompact({type: 'count', message: 'Requires ${0} step(s) advanced on the Hydronetwork', params: ['4'], current: 3})).eq('Hydronetwork 3/4');
    const unknown: UnplayableReason = {type: 'count', message: 'Not enough resources on this card', current: 2};
    expect(unplayableReasonCompact(unknown)).eq(unplayableReasonLine(unknown));
  });
});
