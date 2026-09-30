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

  it('«tags of one type» (Turmoil Redux, TR01) reads as the tag counter — «Tags 7/10», never a tag name in place of the number', () => {
    const reason: UnplayableReason = {type: 'count', message: 'Requires ${0} tags of one type', params: ['10'], current: 7, requirement: true};
    expect(unplayableReasonCompact(reason)).eq('Tags 7/10');
    expect(unplayableReasonLine(reason)).eq('Requires 10 tags of one type · Now: 7');
  });

  it('«influence» (Turmoil Redux, TR04) reads as one counter for the ceiling and the floor — «Influence 2/≤1» draws the ≤ off the template\'s «or less»', () => {
    const ceiling: UnplayableReason = {type: 'count', message: 'Requires influence ${0} or less', params: ['1'], current: 2, requirement: true};
    expect(unplayableReasonCompact(ceiling)).eq('Influence 2/≤1');
    expect(unplayableReasonLine(ceiling)).eq('Requires influence 1 or less · Now: 2');
    const floor: UnplayableReason = {type: 'count', message: 'Requires ${0} influence', params: ['2'], current: 1, requirement: true};
    expect(unplayableReasonCompact(floor)).eq('Influence 1/2');
  });

  it('the Hydronetwork precedent keeps its counter, and an unknown count message keeps the full line', () => {
    expect(unplayableReasonCompact({type: 'count', message: 'Requires ${0} step(s) advanced on the Hydronetwork', params: ['4'], current: 3})).eq('Hydronetwork 3/4');
    const unknown: UnplayableReason = {type: 'count', message: 'Not enough resources on this card', current: 2};
    expect(unplayableReasonCompact(unknown)).eq(unplayableReasonLine(unknown));
  });
});
